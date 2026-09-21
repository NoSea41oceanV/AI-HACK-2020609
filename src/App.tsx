import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import ObservationPanel, { type ObservationSubmission } from './components/ObservationPanel'
import ProcessingStatus, { type ProcessingStep } from './components/ProcessingStatus'
import {
  createIntakeRepository,
  createOperationRepository,
  createPetRepository,
  type IntakeMediaMetadata,
  type IntakeRepository,
  type MatchingSnapshot,
  type ObservationRecord,
  type OperationRepository,
  type OwnerIntake,
  type PetRepository,
} from './data'
import { intakeToPetProfile, type IntakeAiAnalysis } from './domain/intakeProfile'
import { createOptimalRoomPlan } from './domain/matching'
import type {
  MatchingResult,
  PairCompatibility,
  PetProfile as DomainPetProfile,
  RoomDefinition,
} from './domain/types'
import { createAIWorkerClient, type AIWorkerClient } from './lib/workerClient'
import OwnerForm, { type OwnerRegistrationPayload } from './pages/OwnerForm'
import StaffDashboard, {
  type CompatibilityPair,
  type PetProfile as DashboardPetProfile,
  type RoomAssignment as DashboardRoomAssignment,
} from './pages/StaffDashboard'

interface RuntimeServices {
  intakeRepository: IntakeRepository
  petRepository: PetRepository
  operationRepository: OperationRepository
  workerClient: AIWorkerClient | null
  workerError: string | null
}

type Runtime = { ok: true; services: RuntimeServices } | { ok: false; error: string }

const createRuntime = (): Runtime => {
  try {
    let workerClient: AIWorkerClient | null = null
    let workerError: string | null = null
    try {
      workerClient = createAIWorkerClient()
    } catch (error) {
      workerError = error instanceof Error ? error.message : 'AI Worker設定を読み込めませんでした。'
    }
    return {
      ok: true,
      services: {
        intakeRepository: createIntakeRepository(),
        petRepository: createPetRepository(),
        operationRepository: createOperationRepository(),
        workerClient,
        workerError,
      },
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'サービス設定を読み込めませんでした。' }
  }
}

const runtime = createRuntime()

const ROOM_CATALOG = [
  { id: 'garden', name: 'ガーデンルーム' },
  { id: 'sunny', name: 'サニールーム' },
  { id: 'calm', name: 'カームルーム' },
] as const

const FACTOR_META = [
  ['energy', '活動量', 25],
  ['size', '体格', 20],
  ['playStyle', '遊び方', 20],
  ['sociability', '社交性', 15],
  ['emotionalBalance', '感情バランス', 10],
  ['resourceSafety', '資源防衛リスク', 10],
] as const

const OWNER_STEPS: ProcessingStep[] = [
  { id: 'analysis', label: '入力とメディアをAI解析', status: 'idle' },
  { id: 'intake', label: '解析済み受付をFirestore保存', status: 'idle' },
  { id: 'profile', label: '非PIIプロフィールを保存', status: 'idle' },
  { id: 'matching', label: '全ペア採点・部屋最適化', status: 'idle' },
]

interface SubmissionAttempt {
  signature: string
  intakeId: string
  intakeStored: boolean
  analysis?: IntakeAiAnalysis
}

type OwnerAnalysisCapableClient = AIWorkerClient & {
  analyzeOwnerRegistration(input: {
    personality: string
    playStyle: string
    concerns: string
    photo?: Blob & { name?: string }
    video?: Blob & { name?: string }
  }): Promise<{ analysis: IntakeAiAnalysis }>
}

type AppStatus = { tone: 'info' | 'success' | 'error'; message: string }

function createRooms(petCount: number): RoomDefinition[] {
  if (petCount === 0) return []
  const roomCount = Math.min(ROOM_CATALOG.length, Math.max(1, Math.ceil(petCount / 2)))
  const capacity = Math.ceil(petCount / roomCount)
  return ROOM_CATALOG.slice(0, roomCount).map((room) => ({ ...room, capacity, minOccupancy: 1 }))
}

function pairReason(pair: PairCompatibility, petNameIndex: ReadonlyMap<string, string>): string {
  const names = `${petNameIndex.get(pair.petAId) ?? pair.petAId}と${petNameIndex.get(pair.petBId) ?? pair.petBId}`
  if (!pair.allowed) return `${names}は全項目を採点済みですが、記録された安全制約により同室候補から除外されています。`
  const factors = FACTOR_META.map(([key, label, maxScore]) => ({
    label,
    ratio: pair.breakdown[key] / maxScore,
  })).sort((left, right) => right.ratio - left.ratio)
  const strengths = factors.slice(0, 2).map((factor) => factor.label).join('・')
  const watch = factors.at(-1)?.label ?? '距離感'
  return `${names}は${strengths}の一致度が高い組み合わせです。初回接触では${watch}をスタッフが観察してください。`
}

function toDashboardPairs(result: MatchingResult, pets: readonly DomainPetProfile[]): CompatibilityPair[] {
  const petNameIndex = new Map(pets.map((pet) => [pet.id, pet.name]))
  return result.pairResults.map((pair) => ({
    id: pair.pairKey,
    petAId: pair.petAId,
    petBId: pair.petBId,
    totalScore: pair.score,
    factors: FACTOR_META.map(([key, label, maxScore]) => ({ label, score: pair.breakdown[key], maxScore })),
    explanation: pairReason(pair, petNameIndex),
    hardConstraints: pair.hardConstraints.map((constraint) => constraint.message),
  }))
}

function toDashboardRooms(result: MatchingResult, rooms: readonly RoomDefinition[]): DashboardRoomAssignment[] {
  if (result.status !== 'success') return []
  const roomIndex = new Map(rooms.map((room) => [room.id, room]))
  return result.rooms.map((assignment) => {
    const room = roomIndex.get(assignment.roomId)
    return {
      id: assignment.roomId,
      name: room?.name ?? assignment.roomId,
      capacity: room?.capacity ?? assignment.petIds.length,
      petIds: assignment.petIds,
      averageScore: assignment.averageCompatibility ?? 100,
      note: assignment.minimumCompatibility === null
        ? '単独利用のためペアスコアはありません。'
        : `室内の最低相性は ${assignment.minimumCompatibility}点です。`,
    }
  })
}

function createMatchingSnapshot(result: MatchingResult, pets: readonly DomainPetProfile[], status: MatchingSnapshot['status']): MatchingSnapshot {
  return {
    id: crypto.randomUUID(),
    status,
    petIds: pets.map((pet) => pet.id).sort(),
    pairResults: result.pairResults.map((pair) => ({
      pairKey: pair.pairKey,
      petAId: pair.petAId,
      petBId: pair.petBId,
      score: pair.score,
      allowed: pair.allowed,
      hardConstraintCodes: pair.hardConstraints.map((constraint) => constraint.code),
    })),
    rooms: result.status === 'success' ? result.rooms.map((room) => ({
      roomId: room.roomId,
      petIds: room.petIds,
      averageCompatibility: room.averageCompatibility,
      minimumCompatibility: room.minimumCompatibility,
    })) : [],
    objectiveScore: result.status === 'success' ? result.objectiveScore : null,
    createdAt: new Date().toISOString(),
  }
}

function selectedMedia(file: File | null, kind: IntakeMediaMetadata['kind']): IntakeMediaMetadata | undefined {
  return file ? { kind, fileName: file.name, contentType: file.type, sizeBytes: file.size, status: 'selected' } : undefined
}

function validatePayload(payload: OwnerRegistrationPayload) {
  const checks: Array<[string, string, number]> = [
    ['飼い主名', payload.owner.name, 80],
    ['連絡先', payload.owner.contact, 200],
    ['わんちゃんの名前', payload.pet.name, 40],
    ['犬種', payload.pet.breed, 80],
    ['性格', payload.pet.personality, 1_000],
    ['遊び方', payload.pet.playStyle, 1_000],
    ['注意事項', payload.pet.concerns, 1_000],
  ]
  for (const [label, value, maximum] of checks) {
    if (value.length > maximum) throw new Error(`${label}は${maximum}文字以内で入力してください。`)
  }
  for (const file of [payload.media.photo, payload.media.video]) {
    if (file && file.name.length > 120) throw new Error('ファイル名は120文字以内にしてください。')
  }
}

function payloadSignature(payload: OwnerRegistrationPayload): string {
  const fileKey = (file: File | null) => file ? [file.name, file.size, file.type, file.lastModified] : null
  return JSON.stringify({ inviteId: payload.inviteId, owner: payload.owner, pet: payload.pet, photo: fileKey(payload.media.photo), video: fileKey(payload.media.video) })
}

function toDashboardPets(pets: readonly DomainPetProfile[]): DashboardPetProfile[] {
  return pets.map((pet) => ({ id: pet.id, name: pet.name, breed: pet.breed, ageLabel: `${pet.ageYears}歳`, avatarUrl: pet.photoUrl }))
}

function firebaseConfigurationError(): string | null {
  if (!runtime.ok) return runtime.error
  const { intakeRepository, petRepository, operationRepository } = runtime.services
  if (intakeRepository.kind === 'local' || petRepository.kind === 'local' || operationRepository.kind === 'local') {
    return 'Firebaseが未設定です。実データを保存できないため、この画面ではローカル代替処理を行いません。'
  }
  return null
}

function ownerConfigurationError(): string | null {
  const firebaseError = firebaseConfigurationError()
  if (firebaseError || !runtime.ok) return firebaseError
  const { workerClient, workerError } = runtime.services
  if (workerError) return workerError
  if (!workerClient) return 'AI Workerを初期化できませんでした。'
  if (workerClient.state.kind === 'disabled') return workerClient.state.reason
  return null
}

function DemoNavigation({ ownerView }: { ownerView: boolean }) {
  return (
    <nav className="demo-navigation" aria-label="画面の切り替え">
      <span className="demo-navigation__label">PAWPAIR</span>
      <a href="/" aria-current={ownerView ? undefined : 'page'}>スタッフ</a>
      <a href="/?view=owner" aria-current={ownerView ? 'page' : undefined}>飼い主フォーム</a>
    </nav>
  )
}

function isOwnerRoute() {
  const params = new URLSearchParams(window.location.search)
  return window.location.pathname.replace(/\/+$/, '') === '/owner' || params.get('view') === 'owner'
}

function setStepStatus(steps: readonly ProcessingStep[], id: string, status: ProcessingStep['status']): ProcessingStep[] {
  return steps.map((step) => step.id === id ? { ...step, status } : step)
}

function retryableMessage(error: unknown) {
  const detail = error instanceof Error ? error.message : '処理を完了できませんでした。'
  return `${detail} 入力内容を変えずに同じボタンから再試行できます。`
}

function requireOwnerAnalysisClient(client: AIWorkerClient): OwnerAnalysisCapableClient {
  const candidate = client as AIWorkerClient & { analyzeOwnerRegistration?: unknown }
  if (typeof candidate.analyzeOwnerRegistration !== 'function') {
    throw new Error('AI Workerクライアントが飼い主登録解析に対応していません。最新版を反映して再読み込みしてください。')
  }
  return candidate as OwnerAnalysisCapableClient
}

export default function App() {
  const ownerView = isOwnerRoute()
  const submissionAttempt = useRef<SubmissionAttempt | null>(null)
  const [pets, setPets] = useState<DomainPetProfile[]>([])
  const [dataState, setDataState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [ownerSteps, setOwnerSteps] = useState<ProcessingStep[]>(OWNER_STEPS)
  const [ownerError, setOwnerError] = useState('')
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [isConfirmed, setIsConfirmed] = useState(false)
  const [status, setStatus] = useState<AppStatus>(() => {
    const configurationError = firebaseConfigurationError()
    return configurationError
      ? { tone: 'error', message: configurationError }
      : { tone: 'info', message: 'Firestoreから登録プロフィールを読み込んでいます。' }
  })

  const rooms = useMemo(() => createRooms(pets.length), [pets.length])
  const matchingResult = useMemo(() => pets.length > 0 ? createOptimalRoomPlan(pets, rooms) : null, [pets, rooms])
  const dashboardPets = useMemo(() => toDashboardPets(pets), [pets])
  const dashboardPairs = useMemo(() => matchingResult ? toDashboardPairs(matchingResult, pets) : [], [matchingResult, pets])
  const dashboardRooms = useMemo(() => matchingResult ? toDashboardRooms(matchingResult, rooms) : [], [matchingResult, rooms])

  const loadPets = useCallback(async () => {
    const configurationError = firebaseConfigurationError()
    if (configurationError) {
      setDataState('error')
      setStatus({ tone: 'error', message: configurationError })
      throw new Error(configurationError)
    }
    if (!runtime.ok) throw new Error(runtime.error)

    setDataState('loading')
    try {
      const page = await runtime.services.petRepository.listPage(20)
      setPets(page.pets)
      setDataState('ready')
      setIsConfirmed(false)
      setStatus({
        tone: 'success',
        message: page.pets.length > 0
          ? `Firestoreから${page.pets.length}頭を取得し、全${page.pets.length * (page.pets.length - 1) / 2}ペアを採点しました。`
          : 'Firestoreへの接続を確認しました。登録済みプロフィールはまだありません。',
      })
      return page.pets
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Firestoreからプロフィールを取得できませんでした。'
      setDataState('error')
      setStatus({ tone: 'error', message: `${message} 「再接続」を押して再試行してください。` })
      throw error
    }
  }, [])

  useEffect(() => {
    if (firebaseConfigurationError() || !runtime.ok || ownerView) {
      setDataState('error')
      return
    }
    let active = true
    void loadPets().catch(() => undefined)
    const unsubscribe = runtime.services.petRepository.subscribeRecent((nextPets) => {
      if (!active) return
      setPets(nextPets)
      setDataState('ready')
      setIsConfirmed(false)
    }, 20)
    return () => {
      active = false
      unsubscribe()
    }
  }, [loadPets, ownerView])

  const submitOwnerRegistration = useCallback(async (payload: OwnerRegistrationPayload): Promise<void> => {
    validatePayload(payload)
    const configurationError = ownerConfigurationError()
    if (configurationError) {
      const message = retryableMessage(new Error(configurationError))
      setOwnerError(message)
      setOwnerSteps(setStepStatus(OWNER_STEPS, 'analysis', 'error'))
      throw new Error(message)
    }
    if (!runtime.ok) throw new Error(runtime.error)

    const { intakeRepository, petRepository, operationRepository, workerClient } = runtime.services
    if (!workerClient) throw new Error('AI Workerを初期化できませんでした。')
    const signature = payloadSignature(payload)
    let attempt = submissionAttempt.current
    if (!attempt || attempt.signature !== signature) {
      attempt = { signature, intakeId: crypto.randomUUID(), intakeStored: false }
      submissionAttempt.current = attempt
    }

    setOwnerError('')
    let activeStep = 'analysis'
    setOwnerSteps(OWNER_STEPS.map((step) => ({ ...step, status: step.id === activeStep ? 'active' : 'idle' })))
    try {
      if (!attempt.analysis) {
        const ownerAnalysisClient = requireOwnerAnalysisClient(workerClient)
        const result = await ownerAnalysisClient.analyzeOwnerRegistration({
          personality: payload.pet.personality,
          playStyle: payload.pet.playStyle,
          concerns: payload.pet.concerns,
          photo: payload.media.photo ?? undefined,
          video: payload.media.video ?? undefined,
        })
        attempt.analysis = result.analysis
      }
      setOwnerSteps((steps) => setStepStatus(steps, 'analysis', 'done'))

      activeStep = 'intake'
      setOwnerSteps((steps) => setStepStatus(steps, activeStep, 'active'))
      if (!attempt.intakeStored) {
        const intake: OwnerIntake = {
          id: attempt.intakeId,
          inviteId: payload.inviteId,
          owner: { ...payload.owner },
          pet: {
            name: payload.pet.name,
            breed: payload.pet.breed,
            ageYears: payload.pet.age,
            weightKg: payload.pet.weightKg,
            sex: payload.pet.sex,
            personality: payload.pet.personality,
            playStyle: payload.pet.playStyle,
            concerns: payload.pet.concerns,
          },
          media: { photo: selectedMedia(payload.media.photo, 'image'), video: selectedMedia(payload.media.video, 'video') },
          aiAnalysis: attempt.analysis,
          matchingProfile: attempt.analysis.matchingProfile,
          status: 'ready',
          submittedAt: new Date().toISOString(),
        }
        await intakeRepository.save(intake)
        attempt.intakeStored = true
      }
      setOwnerSteps((steps) => setStepStatus(steps, 'intake', 'done'))

      activeStep = 'profile'
      setOwnerSteps((steps) => setStepStatus(steps, activeStep, 'active'))
      const profile = intakeToPetProfile({
        intakeId: attempt.intakeId,
        pet: {
          name: payload.pet.name,
          breed: payload.pet.breed,
          ageYears: payload.pet.age,
          weightKg: payload.pet.weightKg,
          personality: payload.pet.personality,
          playStyle: payload.pet.playStyle,
          concerns: payload.pet.concerns,
        },
        matchingProfile: attempt.analysis.matchingProfile,
      })
      await petRepository.save(profile)
      setOwnerSteps((steps) => setStepStatus(steps, 'profile', 'done'))

      activeStep = 'matching'
      setOwnerSteps((steps) => setStepStatus(steps, activeStep, 'active'))
      const page = await petRepository.listPage(20)
      if (!page.pets.some((pet) => pet.id === profile.id)) throw new Error('保存したプロフィールをFirestoreで確認できませんでした。')
      const nextMatching = createOptimalRoomPlan(page.pets, createRooms(page.pets.length))
      await operationRepository.saveMatching(createMatchingSnapshot(nextMatching, page.pets, 'proposed'))
      setOwnerSteps((steps) => setStepStatus(steps, 'matching', 'done'))
      submissionAttempt.current = null
    } catch (error) {
      setOwnerSteps((steps) => setStepStatus(steps, activeStep, 'error'))
      const message = retryableMessage(error)
      setOwnerError(message)
      if (activeStep === 'intake' && !attempt.intakeStored) {
        submissionAttempt.current = {
          signature: attempt.signature,
          intakeId: crypto.randomUUID(),
          intakeStored: false,
          analysis: attempt.analysis,
        }
      }
      throw new Error(message)
    }
  }, [])

  const saveCurrentMatching = useCallback(async (confirmation: boolean) => {
    const configurationError = firebaseConfigurationError()
    if (configurationError || !runtime.ok) {
      setStatus({ tone: 'error', message: configurationError ?? 'サービスを初期化できませんでした。' })
      return
    }
    if (!matchingResult) {
      setStatus({ tone: 'error', message: '再計算するプロフィールがありません。' })
      return
    }
    setIsOptimizing(true)
    setIsConfirmed(false)
    try {
      await runtime.services.operationRepository.saveMatching(createMatchingSnapshot(matchingResult, pets, confirmation ? 'confirmed' : 'proposed'))
      setIsConfirmed(confirmation)
      setStatus({
        tone: 'success',
        message: confirmation
          ? 'この部屋割りをFirestoreへ最終確定として保存しました。'
          : matchingResult.status === 'success'
            ? `全${matchingResult.pairResults.length}ペアを再採点し、部屋割り案をFirestoreへ保存しました。`
            : matchingResult.message,
      })
    } catch (error) {
      setStatus({ tone: 'error', message: `${error instanceof Error ? error.message : '結果を保存できませんでした。'} 同じ操作を再度実行してください。` })
    } finally {
      setIsOptimizing(false)
    }
  }, [matchingResult, pets])

  const applyObservation = useCallback(async (submission: ObservationSubmission) => {
    const configurationError = firebaseConfigurationError()
    if (configurationError || !runtime.ok) throw new Error(configurationError ?? 'サービスを初期化できませんでした。')
    const primary = pets.find((pet) => pet.id === submission.petAId)
    const counterpart = pets.find((pet) => pet.id === submission.petBId)
    if (!primary || !counterpart) throw new Error('対象ペットを現在のFirestoreデータから確認できません。')

    setIsOptimizing(true)
    setIsConfirmed(false)
    try {
      const observation: ObservationRecord = {
        id: crypto.randomUUID(),
        scenarioId: submission.decision,
        title: `${primary.name}と${counterpart.name}の当日観測`,
        facts: [submission.notes],
        impacts: [submission.decision === 'separate' ? '安全判断として同室不可制約を追加' : 'プロフィール変更なしで全ペアを再評価'],
        recommendation: submission.decision === 'separate'
          ? '両者を別室候補として再計算する。'
          : '現在のプロフィールで全室を再計算し、スタッフが結果を確認する。',
        observedAt: new Date().toISOString(),
      }
      await runtime.services.operationRepository.saveObservation(observation)
      let nextPets = pets
      if (submission.decision === 'separate') {
        const updatedPrimary: DomainPetProfile = {
          ...primary,
          hardBlockedPetIds: [...new Set([...(primary.hardBlockedPetIds ?? []), counterpart.id])].sort(),
        }
        await runtime.services.petRepository.save(updatedPrimary)
        nextPets = pets.map((pet) => pet.id === updatedPrimary.id ? updatedPrimary : pet)
      }
      const nextResult = createOptimalRoomPlan(nextPets, createRooms(nextPets.length))
      await runtime.services.operationRepository.saveMatching(createMatchingSnapshot(nextResult, nextPets, 'proposed'))
      setPets(nextPets)
      setStatus({
        tone: nextResult.status === 'success' ? 'success' : 'error',
        message: nextResult.status === 'success'
          ? `観測記録を保存し、全${nextResult.pairResults.length}ペアと部屋割りを再計算しました。`
          : `観測記録は保存しましたが、再配置案を作れませんでした: ${nextResult.message}`,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : '観測を反映できませんでした。'
      setStatus({ tone: 'error', message: `${message} 内容を確認して再度実行してください。` })
      throw error
    } finally {
      setIsOptimizing(false)
    }
  }, [pets])

  if (ownerView) {
    return (
      <div className="app-shell">
        <DemoNavigation ownerView />
        <ProcessingStatus title="登録処理の進行状況" steps={ownerSteps} error={ownerError || ownerConfigurationError() || undefined} />
        <OwnerForm inviteId="PAW-2026" onSubmit={submitOwnerRegistration} />
      </div>
    )
  }

  return (
    <div className="app-shell">
      <DemoNavigation ownerView={false} />
      <div className={`app-status app-status--${status.tone}`} role={status.tone === 'error' ? 'alert' : 'status'}>
        <span>{status.message}</span>
        {dataState === 'error' ? <button type="button" onClick={() => void loadPets().catch(() => undefined)}>再接続</button> : null}
      </div>

      {dataState === 'ready' && matchingResult ? (
        <>
          <StaffDashboard
            pets={dashboardPets}
            pairs={dashboardPairs}
            rooms={dashboardRooms}
            isOptimizing={isOptimizing}
            isConfirmed={isConfirmed}
            onRunOptimization={() => void saveCurrentMatching(false)}
            onConfirm={() => void saveCurrentMatching(true)}
          />
          <div className="app-observation-shell">
            <ObservationPanel pets={dashboardPets} isSubmitting={isOptimizing} onSubmit={applyObservation} />
          </div>
        </>
      ) : dataState === 'loading' ? (
        <section className="app-state-panel" aria-live="polite">
          <span className="app-spinner" aria-hidden="true" />
          <h1>Firestoreから読み込み中</h1>
          <p>登録済みプロフィールを確認しています。</p>
        </section>
      ) : dataState === 'ready' ? (
        <section className="app-state-panel">
          <h1>登録プロフィールはまだありません</h1>
          <p>飼い主フォームでAI解析まで完了すると、ここに実データが表示されます。</p>
          <a href="/?view=owner">飼い主フォームを開く</a>
        </section>
      ) : (
        <section className="app-state-panel app-state-panel--error">
          <h1>スタッフ画面を開始できません</h1>
          <p>上のエラーを解消してから「再接続」を押してください。固定データへの切り替えは行いません。</p>
        </section>
      )}
    </div>
  )
}
