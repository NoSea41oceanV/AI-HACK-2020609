import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import ObservationDemo, { type ObservationScenario } from './components/ObservationDemo'
import {
  createIntakeRepository,
  createOperationRepository,
  createPetRepository,
  demoPets as repositoryDemoPets,
  type IntakeMediaMetadata,
  type MatchingSnapshot,
  type ObservationRecord,
  type OwnerIntake,
} from './data'
import { intakeToPetProfile } from './domain/intakeProfile'
import { createOptimalRoomPlan } from './domain/matching'
import type {
  MatchingResult,
  PairCompatibility,
  PetProfile as DomainPetProfile,
  RoomDefinition,
} from './domain/types'
import OwnerForm, { type OwnerRegistrationPayload } from './pages/OwnerForm'
import StaffDashboard, {
  type CompatibilityPair,
  type PetProfile as DashboardPetProfile,
  type RoomAssignment as DashboardRoomAssignment,
} from './pages/StaffDashboard'

const petRepository = createPetRepository()
const intakeRepository = createIntakeRepository()
const operationRepository = createOperationRepository()

const DEMO_PETS: DomainPetProfile[] = [
  {
    id: 'komugi',
    name: 'こむぎ',
    breed: 'トイプードル',
    ageYears: 3,
    weightKg: 4.2,
    energyLevel: 4,
    sociability: 5,
    anxietyLevel: 2,
    assertiveness: 2,
    resourceGuarding: 1,
    playStyles: ['fetch', 'chase'],
  },
  {
    id: 'maru',
    name: 'まる',
    breed: '柴犬',
    ageYears: 5,
    weightKg: 9.8,
    energyLevel: 3,
    sociability: 3,
    anxietyLevel: 2,
    assertiveness: 3,
    resourceGuarding: 2,
    playStyles: ['chase', 'solo'],
  },
  {
    id: 'luna',
    name: 'ルナ',
    breed: 'ミニチュアダックス',
    ageYears: 2,
    weightKg: 5.1,
    energyLevel: 4,
    sociability: 4,
    anxietyLevel: 2,
    assertiveness: 2,
    resourceGuarding: 1,
    playStyles: ['fetch', 'chase'],
  },
  {
    id: 'leo',
    name: 'レオ',
    breed: 'フレンチブルドッグ',
    ageYears: 4,
    weightKg: 11.5,
    energyLevel: 3,
    sociability: 4,
    anxietyLevel: 1,
    assertiveness: 3,
    resourceGuarding: 1,
    playStyles: ['wrestle', 'tug'],
  },
  {
    id: 'mugi',
    name: 'むぎ',
    breed: 'ポメラニアン',
    ageYears: 6,
    weightKg: 3.3,
    energyLevel: 2,
    sociability: 3,
    anxietyLevel: 4,
    assertiveness: 1,
    resourceGuarding: 1,
    playStyles: ['gentle', 'solo'],
    hardBlockedPetIds: ['kai'],
  },
  {
    id: 'kai',
    name: 'カイ',
    breed: 'ボーダーコリー',
    ageYears: 3,
    weightKg: 16.4,
    energyLevel: 5,
    sociability: 4,
    anxietyLevel: 1,
    assertiveness: 5,
    resourceGuarding: 2,
    playStyles: ['chase', 'tug'],
  },
]

const DEMO_ROOMS: RoomDefinition[] = [
  { id: 'garden', name: 'ガーデンルーム', capacity: 2, minOccupancy: 2 },
  { id: 'sunny', name: 'サニールーム', capacity: 2, minOccupancy: 2 },
  { id: 'calm', name: 'カームルーム', capacity: 2, minOccupancy: 2 },
]

const OBSERVATION_SCENARIOS: ObservationScenario[] = [
  {
    id: 'overexcited-kai',
    title: '遊び開始後に興奮が高まったケース',
    description: 'デモ動画の行動ラベルを使い、現在の部屋割りに影響する観測事実を表示します。',
    sourceLabel: 'デモ動画 01・00:18–00:42',
    facts: [
      { id: 'f1', type: 'overexcited', petName: 'カイ', label: '興奮が継続', detail: '追走後も速度が落ちず、接近回数が増えています。' },
      { id: 'f2', type: 'tense', petName: 'むぎ', label: '距離を取る', detail: '壁際へ移動し、相手と視線を合わせない状態です。' },
    ],
    impacts: [
      { title: 'カイとむぎは同室にしない', detail: '登録済みの安全制約とも一致します。', severity: 'high' },
      { title: '活動量差を再確認', detail: '次候補ペアを含めて全室を再計算します。', severity: 'attention' },
    ],
    recommendation: 'カイを活動量の近いペットと組み、全室の割当を再計算します。',
  },
  {
    id: 'calm-luna',
    title: '落ち着いて遊べているケース',
    description: '良好な観測結果から、現行割当を維持する判断例を表示します。',
    sourceLabel: 'デモ動画 02・00:08–00:31',
    facts: [
      { id: 'f3', type: 'calm', petName: 'ルナ', label: '交互に追走', detail: '短い追走のあと自然に休憩できています。' },
      { id: 'f4', type: 'calm', petName: 'こむぎ', label: '適切な距離', detail: '相手の停止に合わせて動きを止めています。' },
    ],
    impacts: [
      { title: '現在の組み合わせを維持可能', detail: '緊張・回避の兆候はサンプル内で見られません。', severity: 'info' },
    ],
    recommendation: '現行の制約を変えずに再計算し、同じ割当になることを確認します。',
  },
]

const FACTOR_META = [
  ['energy', '活動量', 25],
  ['size', '体格', 20],
  ['playStyle', '遊び方', 20],
  ['sociability', '社交性', 15],
  ['emotionalBalance', '感情バランス', 10],
  ['resourceSafety', '資源防衛リスク', 10],
] as const

const repositoryDemoPetIds = new Set(repositoryDemoPets.map((pet) => pet.id))

function createRooms(petCount: number): RoomDefinition[] {
  const capacity = Math.max(2, Math.ceil(petCount / 3))
  return DEMO_ROOMS.map((room) => ({ ...room, capacity, minOccupancy: 1 }))
}

function describePair(pair: PairCompatibility, petNameIndex: ReadonlyMap<string, string>): string {
  const names = `${petNameIndex.get(pair.petAId)}と${petNameIndex.get(pair.petBId)}`
  if (!pair.allowed) return `${names}は全項目を採点済みですが、安全上のハード制約により同室候補から除外します。`
  if (pair.score >= 80) return `${names}は活動量と遊び方が近く、お互いのペースを保ちやすい組み合わせです。`
  if (pair.score >= 65) return `${names}は概ね相性良好です。最初の接触では距離感を確認してください。`
  return `${names}は相性差があります。部屋数と定員を満たす場合のみ候補にし、スタッフが様子を確認します。`
}

function toDashboardPairs(result: MatchingResult, pets: readonly DomainPetProfile[]): CompatibilityPair[] {
  const petNameIndex = new Map(pets.map((pet) => [pet.id, pet.name]))
  return result.pairResults.map((pair) => ({
    id: pair.pairKey,
    petAId: pair.petAId,
    petBId: pair.petBId,
    totalScore: pair.score,
    factors: FACTOR_META.map(([key, label, maxScore]) => ({
      label,
      score: pair.breakdown[key],
      maxScore,
    })),
    explanation: describePair(pair, petNameIndex),
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

function createMatchingSnapshot(
  result: MatchingResult,
  pets: readonly DomainPetProfile[],
  status: MatchingSnapshot['status'],
): MatchingSnapshot {
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
    rooms: result.status === 'success'
      ? result.rooms.map((room) => ({
          roomId: room.roomId,
          petIds: room.petIds,
          averageCompatibility: room.averageCompatibility,
          minimumCompatibility: room.minimumCompatibility,
        }))
      : [],
    objectiveScore: result.status === 'success' ? result.objectiveScore : null,
    createdAt: new Date().toISOString(),
  }
}

function createObservationRecord(scenario: ObservationScenario): ObservationRecord {
  return {
    id: crypto.randomUUID(),
    scenarioId: scenario.id,
    title: scenario.title,
    facts: scenario.facts.map((fact) =>
      `${fact.petName ? `${fact.petName}: ` : ''}${fact.label} - ${fact.detail}`,
    ),
    impacts: scenario.impacts.map((impact) => `${impact.title} - ${impact.detail}`),
    recommendation: scenario.recommendation,
    observedAt: new Date().toISOString(),
  }
}

async function saveMatchingSnapshot(
  result: MatchingResult,
  pets: readonly DomainPetProfile[],
  status: MatchingSnapshot['status'],
) {
  await operationRepository.saveMatching(createMatchingSnapshot(result, pets, status))
}

function toDashboardPets(pets: readonly DomainPetProfile[]): DashboardPetProfile[] {
  return pets.map((pet) => ({
    id: pet.id,
    name: pet.name,
    breed: pet.breed,
    ageLabel: `${pet.ageYears}歳`,
  }))
}

function selectedMedia(file: File | null, kind: IntakeMediaMetadata['kind']): IntakeMediaMetadata | undefined {
  return file ? {
    kind,
    fileName: file.name,
    contentType: file.type,
    sizeBytes: file.size,
    status: 'selected',
  } : undefined
}

async function submitOwnerRegistration(payload: OwnerRegistrationPayload): Promise<void> {
  const intakeId = crypto.randomUUID()
  const intake: OwnerIntake = {
    id: intakeId,
    inviteId: payload.inviteId,
    owner: payload.owner,
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
    media: {
      photo: selectedMedia(payload.media.photo, 'image'),
      video: selectedMedia(payload.media.video, 'video'),
    },
    status: 'ready',
    submittedAt: new Date().toISOString(),
  }
  await intakeRepository.save(intake)
  await petRepository.save(intakeToPetProfile({ intakeId, pet: intake.pet }))
}

function DemoNavigation({ ownerView }: { ownerView: boolean }) {
  return (
    <nav className="demo-navigation" aria-label="デモ画面の切り替え">
      <span className="demo-navigation__label">デモ画面</span>
      <a href="/" aria-current={ownerView ? undefined : 'page'}>スタッフ</a>
      <a href="/?view=owner" aria-current={ownerView ? 'page' : undefined}>飼い主フォーム</a>
    </nav>
  )
}

function isOwnerRoute() {
  const params = new URLSearchParams(window.location.search)
  return window.location.pathname.replace(/\/+$/, '') === '/owner' || params.get('view') === 'owner'
}

export default function App() {
  const ownerView = isOwnerRoute()
  const lastAutoSavedPetSignature = useRef(DEMO_PETS.map((pet) => pet.id).sort().join('|'))
  const [repositoryPets, setRepositoryPets] = useState<DomainPetProfile[]>([])
  const pets = useMemo(() => {
    const merged = new Map(DEMO_PETS.map((pet) => [pet.id, pet]))
    for (const pet of repositoryPets) {
      if (!repositoryDemoPetIds.has(pet.id)) merged.set(pet.id, pet)
    }
    return [...merged.values()]
  }, [repositoryPets])
  const rooms = useMemo(() => createRooms(pets.length), [pets.length])
  const [matchingResult, setMatchingResult] = useState<MatchingResult>(() =>
    createOptimalRoomPlan(DEMO_PETS, createRooms(DEMO_PETS.length)),
  )
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [isConfirmed, setIsConfirmed] = useState(false)
  const [selectedScenarioId, setSelectedScenarioId] = useState(OBSERVATION_SCENARIOS[0].id)
  const [statusMessage, setStatusMessage] = useState('全15ペアを採点し、定員内で全体最適化しました。')

  useEffect(() => petRepository.subscribeRecent(setRepositoryPets, 20), [])

  useEffect(() => {
    const nextResult = createOptimalRoomPlan(pets, rooms)
    setMatchingResult(nextResult)
    setIsConfirmed(false)
    const pairCount = pets.length * (pets.length - 1) / 2
    setStatusMessage(nextResult.status === 'success'
      ? `全${pairCount}ペアを採点し、${rooms.length}室の割当を最適化しました。`
      : nextResult.message)
    const petSignature = pets.map((pet) => pet.id).sort().join('|')
    if (petSignature !== lastAutoSavedPetSignature.current) {
      lastAutoSavedPetSignature.current = petSignature
      void saveMatchingSnapshot(nextResult, pets, 'proposed').catch(() => {
        console.error('マッチング提案の保存に失敗しました。')
      })
    }
  }, [pets, rooms])

  const dashboardPets = useMemo(() => toDashboardPets(pets), [pets])
  const dashboardPairs = useMemo(() => toDashboardPairs(matchingResult, pets), [matchingResult, pets])
  const dashboardRooms = useMemo(() => toDashboardRooms(matchingResult, rooms), [matchingResult, rooms])

  const recalculate = (message = '全ペアを再採点し、部屋割りを更新しました。') => {
    setIsOptimizing(true)
    setIsConfirmed(false)
    window.setTimeout(async () => {
      const nextResult = createOptimalRoomPlan(pets, rooms)
      setMatchingResult(nextResult)
      setStatusMessage(nextResult.status === 'success' ? message : nextResult.message)
      if (nextResult.status === 'success') {
        try {
          await saveMatchingSnapshot(nextResult, pets, 'proposed')
        } catch {
          console.error('マッチング提案の保存に失敗しました。')
        }
      }
      setIsOptimizing(false)
    }, 420)
  }

  if (ownerView) {
    return (
      <div className="app-shell">
        <DemoNavigation ownerView />
        <OwnerForm inviteId="DEMO-PAW-2026" onSubmit={submitOwnerRegistration} />
      </div>
    )
  }

  return (
    <div className="app-shell">
      <DemoNavigation ownerView={false} />
      <p className={`app-status ${matchingResult.status === 'infeasible' ? 'app-status--error' : ''}`} role="status">
        {statusMessage}
      </p>
      <StaffDashboard
        pets={dashboardPets}
        pairs={dashboardPairs}
        rooms={dashboardRooms}
        isOptimizing={isOptimizing}
        isConfirmed={isConfirmed}
        onRunOptimization={() => recalculate()}
        onConfirm={async () => {
          if (matchingResult.status !== 'success') return
          try {
            await saveMatchingSnapshot(matchingResult, pets, 'confirmed')
            setIsConfirmed(true)
            setStatusMessage('施設オペレーターがこの部屋割りを最終確定しました。')
          } catch {
            setIsConfirmed(false)
            setStatusMessage('確定記録を保存できませんでした。通信状態を確認して再度お試しください。')
          }
        }}
      />
      <div className="app-observation-shell">
        <ObservationDemo
          scenarios={OBSERVATION_SCENARIOS}
          selectedScenarioId={selectedScenarioId}
          onScenarioSelect={setSelectedScenarioId}
          isRecalculating={isOptimizing}
          onRecalculateRequest={(scenario) => {
            void (async () => {
              try {
                await operationRepository.saveObservation(createObservationRecord(scenario))
              } catch {
                console.error('観測記録の保存に失敗しました。')
              }
              recalculate(`観測デモ「${scenario.title}」を反映する再計算を実行しました。`)
            })()
          }}
        />
      </div>
    </div>
  )
}
