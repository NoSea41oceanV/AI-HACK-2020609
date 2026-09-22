import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, setPersistence, browserSessionPersistence } from 'firebase/auth'
import './App.css'
import ObservationPanel, { type ObservationSubmission } from './components/ObservationPanel'
import StaffSignIn from './components/StaffSignIn'
import StaffSelection from './components/StaffSelection'
import OwnerRegistration from './OwnerRegistration'
import { OwnerInviteError } from './pages/OwnerForm'
import { createIntakeRepository, createOperationRepository, createPetRepository, createInviteRepository, createStaffProfileRepository, type IntakeRepository, type PetRepository, type OperationRepository, type MatchingSnapshot, type ObservationRecord, type OwnerIntake, type StaffProfile } from './data'
import { intakeToPetProfile } from './domain/intakeProfile'
import { createOptimalRoomPlan } from './domain/matching'
import { evaluateManualAssignments } from './domain/manualAssignment'
import type { MatchingResult, PairCompatibility, PetProfile as DomainPetProfile, RoomAssignment as DomainRoomAssignment, RoomDefinition } from './domain/types'
import { getFirebaseAuth } from './lib/firebase'
import { parseAppRoute, generateOwnerInviteToken, createOwnerInviteUrl } from './lib/ownerInvite'
import StaffDashboard, { type CompatibilityPair, type PetProfile as DashboardPetProfile, type RoomAssignment as DashboardRoomAssignment } from './pages/StaffDashboard'
interface RuntimeServices { intakeRepository:IntakeRepository;petRepository:PetRepository;operationRepository:OperationRepository }
type Runtime={ok:true;services:RuntimeServices}|{ok:false;error:string}
function createRuntime():Runtime { try {return {ok:true,services:{intakeRepository:createIntakeRepository(),petRepository:createPetRepository(),operationRepository:createOperationRepository()}}}catch{return {ok:false,error:'施設データへの接続を準備できませんでした。'}} }
const runtime=createRuntime()
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

type AppStatus = { tone: 'info' | 'success' | 'error'; message: string }

function staffDataError(error: unknown, fallback: string): string {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
  if (code === 'permission-denied') return '施設の利用権限を確認できません。施設の管理担当者に確認してください。'
  if (code === 'unavailable' || code === 'auth/network-request-failed') return '接続できませんでした。通信状態を確認してください。'
  return fallback
}

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

function pairGuidance(pair: PairCompatibility, petNameIndex: ReadonlyMap<string, string>) {
  const ranked = FACTOR_META.map(([key, label, maxScore]) => ({ label, ratio: pair.breakdown[key] / maxScore }))
    .sort((left, right) => right.ratio - left.ratio)
  const strengths = ranked.slice(0, 2).map((factor) => factor.label)
  const watch = ranked.at(-1)?.label ?? '距離感'
  const strengthDescription = pair.score >= 80
    ? `${strengths.join('・')}がよく一致しています。`
    : pair.score >= 65
      ? `このペアの中では${strengths.join('・')}が比較的合っています。`
      : `${strengths.join('・')}は他の項目より近いものの、総合的には慎重な評価です。`
  return {
    reasons: pair.allowed
      ? [strengthDescription, `総合相性は100点中${pair.score}点です。`]
      : [`総合相性は100点中${pair.score}点ですが、安全制約を優先します。`],
    cautions: pair.allowed
      ? [`初回は${watch}と互いの距離の取り方を観察してください。`]
      : ['安全制約が登録されているため、同室にはできません。'],
    recommendation: pair.allowed
      ? `スタッフが見守れる場所で短時間から始め、${watch}に変化があれば距離を取ってください。`
      : `${petNameIndex.get(pair.petAId) ?? pair.petAId}と${petNameIndex.get(pair.petBId) ?? pair.petBId}は別室に割り当ててください。`,
  }
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
    ...pairGuidance(pair, petNameIndex),
    hardConstraints: pair.hardConstraints.map((constraint) => constraint.message),
  }))
}

function toDashboardRoomAssignments(assignments: readonly DomainRoomAssignment[], rooms: readonly RoomDefinition[]): DashboardRoomAssignment[] {
  const roomIndex = new Map(rooms.map((room) => [room.id, room]))
  return assignments.map((assignment) => {
    const room = roomIndex.get(assignment.roomId)
    return {
      id: assignment.roomId,
      name: room?.name ?? assignment.roomId,
      capacity: room?.capacity ?? assignment.petIds.length,
      minOccupancy: room?.minOccupancy,
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
  staffId: string,
  roomOverride?: readonly DomainRoomAssignment[],
  changed = false,
): MatchingSnapshot {
  const finalRooms = roomOverride ?? (result.status === 'success' ? result.rooms : [])
  const pairIndex = new Map(result.pairResults.map((pair) => [pair.pairKey, pair]))
  const objectiveScore = finalRooms.reduce((total, room) => total + room.pairKeys.reduce((roomTotal, pairKey) => roomTotal + ((pairIndex.get(pairKey)?.score ?? 50) - 50), 0), 0)
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
    rooms: finalRooms.map((room) => ({
      roomId: room.roomId,
      petIds: room.petIds,
      averageCompatibility: room.averageCompatibility,
      minimumCompatibility: room.minimumCompatibility,
    })),
    objectiveScore: result.status === 'success' ? Math.round(objectiveScore * 10) / 10 : null,
    proposedByStaffId: staffId,
    ...(changed ? { changedByStaffId: staffId } : {}),
    ...(status === 'confirmed' ? { confirmedByStaffId: staffId } : {}),
    createdAt: new Date().toISOString(),
  }
}

function toDashboardPets(pets: readonly DomainPetProfile[], intakes: readonly OwnerIntake[]): DashboardPetProfile[] {
  const intakeIndex = new Map(intakes.map((intake) => [intake.id, intake]))
  return pets.map((pet) => {
    const intake = intakeIndex.get(pet.id)
    const risk = intake?.aiAnalysis?.riskFlags.find(Boolean)
    return {
      id: pet.id, name: pet.name, breed: pet.breed, ageLabel: `${pet.ageYears}歳`, avatarUrl: pet.photoUrl,
      personalitySummary: intake?.aiAnalysis?.summary || pet.notes,
      personalityTraits: intake?.aiAnalysis?.personalityTraits.map((trait) => trait.label),
      energyLevel: pet.energyLevel, sociability: pet.sociability, anxietyLevel: pet.anxietyLevel,
      assertiveness: pet.assertiveness, resourceGuarding: pet.resourceGuarding, playStyles: pet.playStyles,
      registrationLabel: intake ? (intake.status === 'ready' ? 'AI確認済み' : '登録確認中') : '登録済み',
      cautionLabel: risk || (pet.resourceGuarding >= 4 ? '食事・おもちゃの管理に注意' : undefined),
    }
  })
}

function toRegistrationRows(pets: readonly DomainPetProfile[], intakes: readonly OwnerIntake[]): DashboardPetProfile[] {
  const readyPets = toDashboardPets(pets, intakes)
  const readyIds = new Set(readyPets.map((pet) => pet.id))
  const pending = intakes.filter((intake) => !readyIds.has(intake.id)).map((intake) => ({
    id: intake.id,
    name: intake.pet.name,
    breed: intake.pet.breed,
    ageLabel: `${intake.pet.ageYears}歳`,
    sexLabel: intake.pet.sex === 'male' ? '男の子' : intake.pet.sex === 'female' ? '女の子' : '性別不明',
    personalitySummary: intake.aiAnalysis?.summary || intake.pet.personality,
    personalityTraits: intake.aiAnalysis?.personalityTraits.map((trait) => trait.label),
    playStyles: intake.matchingProfile?.playStyles,
    registrationLabel: intake.status === 'error' ? '登録エラー' : intake.status === 'analyzing' ? 'AI確認中' : 'プロフィール反映待ち',
    cautionLabel: intake.aiAnalysis?.riskFlags.find(Boolean) || intake.pet.concerns || undefined,
  }))
  return [...readyPets, ...pending]
}

function toDashboardRooms(result: MatchingResult, rooms: readonly RoomDefinition[]): DashboardRoomAssignment[] {
  return result.status === 'success' ? toDashboardRoomAssignments(result.rooms, rooms) : []
}

function firebaseConfigurationError(): string | null {
  if (!runtime.ok) return runtime.error
  const { intakeRepository, petRepository, operationRepository } = runtime.services
  if (intakeRepository.kind === 'local' || petRepository.kind === 'local' || operationRepository.kind === 'local') {
    return 'Firebaseが未設定です。実データを保存できないため、この画面ではローカル代替処理を行いません。'
  }
  return null
}

function StaffWorkspace({ staff, onChangeStaff, onSignOut }: {staff:StaffProfile;onChangeStaff:()=>void;onSignOut:()=>void}) {
  const [pets, setPets] = useState<DomainPetProfile[]>([])
  const [intakes, setIntakes] = useState<OwnerIntake[]>([])
  const [matchingHistory, setMatchingHistory] = useState<MatchingSnapshot[]>([])
  const [dataState, setDataState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [status, setStatus] = useState<AppStatus>(() => {
    const configurationError = firebaseConfigurationError()
    return configurationError
      ? { tone: 'error', message: configurationError }
      : { tone: 'info', message: '施設の登録情報を読み込んでいます。' }
  })

  const rooms = useMemo(() => createRooms(pets.length), [pets.length])
  const matchingResult = useMemo(() => pets.length > 0 ? createOptimalRoomPlan(pets, rooms) : null, [pets, rooms])
  const dashboardPets = useMemo(() => toDashboardPets(pets, intakes), [pets, intakes])
  const registrationRows = useMemo(() => toRegistrationRows(pets, intakes), [pets, intakes])
  const dashboardPairs = useMemo(() => matchingResult ? toDashboardPairs(matchingResult, pets) : [], [matchingResult, pets])
  const automaticDashboardRooms = useMemo(() => matchingResult ? toDashboardRooms(matchingResult, rooms) : [], [matchingResult, rooms])
  const restoredPlan = useMemo(() => {
    if (!matchingResult) return null
    const currentPetKey = pets.map((pet) => pet.id).sort().join('|')
    const snapshot = matchingHistory.find((item) => [...item.petIds].sort().join('|') === currentPetKey)
    if (!snapshot) return null
    const evaluation = evaluateManualAssignments(pets, rooms, matchingResult.pairResults, snapshot.rooms)
    return evaluation.valid ? { snapshot, rooms: toDashboardRoomAssignments(evaluation.rooms, rooms) } : null
  }, [matchingHistory, matchingResult, pets, rooms])
  const dashboardRooms = restoredPlan?.rooms ?? automaticDashboardRooms
  const pendingApprovalCount = restoredPlan?.snapshot.status === 'proposed' ? 1 : 0

  const refreshPromise = useRef<Promise<DomainPetProfile[]> | null>(null)
  const loadPets = useCallback(async () => {
    if (refreshPromise.current) return refreshPromise.current
    const pending = (async () => {
    const configurationError = firebaseConfigurationError()
    if (configurationError) {
      setDataState('error')
      setStatus({ tone: 'error', message: configurationError })
      throw new Error(configurationError)
    }
    if (!runtime.ok) throw new Error(runtime.error)

    setDataState('loading')
    try {
      const [nextIntakes, nextHistory] = await Promise.all([
        runtime.services.intakeRepository.listRecent(25),
        runtime.services.operationRepository.listMatchings(25),
      ])
      setIntakes(nextIntakes)
      setMatchingHistory(nextHistory)
      await Promise.all(nextIntakes.filter(intake => intake.status === 'ready' && intake.matchingProfile).map(intake =>
        runtime.services.petRepository.saveIfAbsent(intakeToPetProfile({ intakeId:intake.id, pet:intake.pet, matchingProfile:intake.matchingProfile }))))
      const page = await runtime.services.petRepository.listPage(20)
      setPets(page.pets)
      setDataState('ready')
      setStatus({
        tone: 'success',
        message: page.pets.length > 0
          ? `${page.pets.length}頭の登録情報を読み込み、全${page.pets.length * (page.pets.length - 1) / 2}ペアを採点しました。`
          : '登録済みのわんちゃんはまだいません。',
      })
      return page.pets
    } catch (error) {
      const message = staffDataError(error, '登録情報を取得できませんでした。')
      setDataState('error')
      setStatus({ tone: 'error', message: `${message} 「登録情報を更新」を押して再試行してください。` })
      throw error
    }

    })()
    refreshPromise.current = pending
    try { return await pending } finally { refreshPromise.current = null }
  }, [])

  useEffect(() => {
    if (firebaseConfigurationError() || !runtime.ok) {
      setDataState('error')
      return
    }
    let active = true
    void loadPets().catch(() => undefined)
    const unsubscribe = runtime.services.petRepository.subscribeRecent((nextPets) => {
      if (!active) return
      setPets(nextPets)
    }, 20)
    return () => {
      active = false
      unsubscribe()
    }
  }, [loadPets])

  const saveCurrentMatching = useCallback(async (
    confirmation: boolean,
    manualRooms?: readonly DashboardRoomAssignment[],
    changed = false,
  ) => {
    const configurationError = firebaseConfigurationError()
    if (configurationError || !runtime.ok) {
      setStatus({ tone: 'error', message: configurationError ?? 'サービスを初期化できませんでした。' })
      return
    }
    if (!matchingResult) {
      setStatus({ tone: 'error', message: '再計算するプロフィールがありません。' })
      return
    }
    let evaluatedRooms: readonly DomainRoomAssignment[] | undefined
    if (manualRooms) {
      const evaluation = evaluateManualAssignments(
        pets,
        rooms,
        matchingResult.pairResults,
        manualRooms.map((room) => ({ roomId: room.id, petIds: room.petIds })),
      )
      if (!evaluation.valid) {
        setStatus({ tone: 'error', message: `最終案を確定できません: ${evaluation.issues[0]?.message ?? '割当を確認してください。'}` })
        return
      }
      evaluatedRooms = evaluation.rooms
    }
    setIsOptimizing(true)
    try {
      const snapshot = createMatchingSnapshot(matchingResult, pets, confirmation ? 'confirmed' : 'proposed', staff.id, evaluatedRooms, changed)
      await runtime.services.operationRepository.saveMatching(snapshot)
      setMatchingHistory((current) => [snapshot, ...current].slice(0, 25))
      setStatus({
        tone: 'success',
        message: confirmation
          ? 'この部屋割りを確定して保存しました。'
          : matchingResult.status === 'success'
            ? `全${matchingResult.pairResults.length}ペアを再採点し、部屋割り案を保存しました。`
            : matchingResult.message,
      })
    } catch (error) {
      setStatus({ tone: 'error', message: `${staffDataError(error, '結果を保存できませんでした。')} 同じ操作を再度実行してください。` })
    } finally {
      setIsOptimizing(false)
    }
  }, [matchingResult, pets, rooms, staff.id])

  const applyObservation = useCallback(async (submission: ObservationSubmission) => {
    const configurationError = firebaseConfigurationError()
    if (configurationError || !runtime.ok) throw new Error(configurationError ?? 'サービスを初期化できませんでした。')
    const primary = pets.find((pet) => pet.id === submission.petAId)
    const counterpart = pets.find((pet) => pet.id === submission.petBId)
    if (!primary || !counterpart) throw new Error('対象ペットを現在のFirestoreデータから確認できません。')

    setIsOptimizing(true)
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
      const snapshot = createMatchingSnapshot(nextResult, nextPets, 'proposed', staff.id)
      await runtime.services.operationRepository.saveMatching(snapshot)
      setMatchingHistory((current) => [snapshot, ...current].slice(0, 25))
      setPets(nextPets)
      setStatus({
        tone: nextResult.status === 'success' ? 'success' : 'error',
        message: nextResult.status === 'success'
          ? `観測記録を保存し、全${nextResult.pairResults.length}ペアと部屋割りを再計算しました。`
          : `観測記録は保存しましたが、再配置案を作れませんでした: ${nextResult.message}`,
      })
    } catch (error) {
      const message = staffDataError(error, '観測を反映できませんでした。')
      setStatus({ tone: 'error', message: `${message} 内容を確認して再度実行してください。` })
      throw new Error(message)
    } finally {
      setIsOptimizing(false)
    }
  }, [pets, staff.id])


  const issueInvite = async () => {
    const repository=createInviteRepository()
    if(!repository)throw new Error('登録URLを発行できません。')
    const token=generateOwnerInviteToken()
    await repository.create(token,staff.id)
    return createOwnerInviteUrl(window.location.origin,token)
  }
  return <div className="app-shell">
    <header className="facility-toolbar">
      <strong>操作担当: {staff.name}</strong>
      <span>スタッフ選択は操作担当の記録です</span>
      <button type="button" onClick={onChangeStaff}>担当を変更</button>
      <button type="button" onClick={onSignOut}>ログアウト</button>
    </header>
    <div className={`app-status app-status--${status.tone}`} role={status.tone==='error'?'alert':'status'}>
      <span>{status.message}</span>
      <button type="button" disabled={dataState==='loading'} onClick={()=>void loadPets().catch(()=>undefined)}>登録情報を更新</button>
    </div>
    {dataState==='ready' ? <>
      <StaffDashboard key={staff.id} pets={dashboardPets} registrationPets={registrationRows} pairs={dashboardPairs} rooms={dashboardRooms} pendingApprovalCount={pendingApprovalCount} isOptimizing={isOptimizing} isConfirmed={restoredPlan?.snapshot.status === 'confirmed'} assignmentBaselineLabel={restoredPlan?.snapshot.status === 'confirmed' ? '前回の確定' : restoredPlan ? '保存済み提案' : 'AI提案'} onIssueInvite={issueInvite} issuedByLabel={staff.name} onRunOptimization={()=>void saveCurrentMatching(false)} onConfirm={(finalRooms, changed)=>void saveCurrentMatching(true, finalRooms, changed)} />
      {matchingResult ? <div className="app-observation-shell"><ObservationPanel pets={dashboardPets} isSubmitting={isOptimizing} onSubmit={applyObservation}/></div> : null}
    </> : <section className="app-state-panel" role={dataState==='error'?'alert':'status'} aria-label="対応件数の読み込み状態">
      <h1>{dataState==='loading'?'対応件数と登録情報を読み込んでいます':'対応件数を読み込めませんでした'}</h1>
      <p>{dataState==='loading'?'承認待ち・要注意・未割当を集計しています。そのままお待ちください。':'接続を確認し、「登録情報を更新」を押してください。'}</p>
    </section>}
  </div>
}

type FacilityState={kind:'loading'}|{kind:'signed-out'}|{kind:'denied'}|{kind:'ready';uid:string;staff:StaffProfile[]}
function FacilityGate() {
  const [auth]=useState(()=>{try{return getFirebaseAuth()}catch{return null}})
  const [state,setState]=useState<FacilityState>({kind:'loading'})
  const [selected,setSelected]=useState<StaffProfile|null>(null)
  const [exitError,setExitError]=useState('')
  useEffect(()=>{
    if(!auth){setState({kind:'signed-out'});return}
    let version=0
    const unsubscribe=onAuthStateChanged(auth,user=>{
      const current=++version
      setSelected(null)
      if(!user){setState({kind:'signed-out'});return}
      setState({kind:'loading'})
      void (async()=>{
        try{
          const repository=createStaffProfileRepository()
          if(!repository)throw new Error('Unconfigured')
          const staff=await repository.listActive()
          if(current===version)setState({kind:'ready',uid:user.uid,staff})
        }catch{if(current===version)setState({kind:'denied'})}
      })()
    })
    return ()=>{version++;unsubscribe()}
  },[auth])
  async function login(email:string,password:string) {
    if(!auth)throw new Error('Unconfigured')
    await setPersistence(auth,browserSessionPersistence)
    await signInWithEmailAndPassword(auth,email,password)
  }
  function logout() {
    setExitError('')
    if(auth)void signOut(auth).catch(()=>setExitError('ログアウトできませんでした。接続を確認し、もう一度お試しください。'))
  }
  if(state.kind==='signed-out')return <StaffSignIn onSignIn={login} disabledReason={!auth?'現在ログインを利用できません。施設の管理担当者へお問い合わせください。':undefined}/>
  if(state.kind==='loading')return <section className="app-state-panel" role="status"><h1>施設の利用権限を確認しています</h1></section>
  if(state.kind==='denied')return <main className="staff-sign-in"><section className="staff-sign-in__card"><h1>この施設アカウントでは利用できません</h1><p>施設の利用設定を管理担当者に確認してください。</p><button type="button" onClick={logout}>ログアウト</button>{exitError&&<p role="alert">{exitError}</p>}</section></main>
  return <>{exitError&&<p className="app-status app-status--error" role="alert">{exitError}</p>}{selected ? <StaffWorkspace key={state.uid} staff={selected} onChangeStaff={()=>setSelected(null)} onSignOut={logout}/> : <StaffSelection staff={state.staff} onSelect={id=>setSelected(state.staff.find(person=>person.id===id)??null)} onSignOut={logout}/>}</>
}
export default function App() {
  const [route,setRoute]=useState(()=>parseAppRoute(window.location))
  useEffect(()=>{const update=()=>setRoute(parseAppRoute(window.location));window.addEventListener('popstate',update);window.addEventListener('hashchange',update);return ()=>{window.removeEventListener('popstate',update);window.removeEventListener('hashchange',update)}},[])
  if(route.kind==='owner')return <OwnerRegistration key={route.token??'missing'} token={route.token}/>
  if(route.kind==='not-found')return <OwnerInviteError reason="invalid"/>
  return <FacilityGate/>
}
