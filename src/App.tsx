import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, setPersistence, browserSessionPersistence } from 'firebase/auth'
import './App.css'
import { type ObservationSubmission } from './components/ObservationPanel'
import StaffSignIn from './components/StaffSignIn'
import StaffSelection from './components/StaffSelection'
import StaffApp from './pawpals/StaffApp'
import OwnerRegistration from './OwnerRegistration'
import { OwnerInviteError } from './pages/OwnerForm'
import { createIntakeRepository, createOperationRepository, createPetRepository, createInviteRepository, createStaffProfileRepository, type IntakeRepository, type PetRepository, type OperationRepository, type MatchingSnapshot, type ObservationRecord, type StaffProfile } from './data'
import { intakeToPetProfile } from './domain/intakeProfile'
import { createOptimalRoomPlan } from './domain/matching'
import type { MatchingResult, PetProfile as DomainPetProfile, RoomDefinition } from './domain/types'
import { getFirebaseAuth } from './lib/firebase'
import { parseAppRoute, generateOwnerInviteToken, createOwnerInviteUrl } from './lib/ownerInvite'
interface RuntimeServices { intakeRepository:IntakeRepository;petRepository:PetRepository;operationRepository:OperationRepository }
type Runtime={ok:true;services:RuntimeServices}|{ok:false;error:string}
function createRuntime():Runtime { try {return {ok:true,services:{intakeRepository:createIntakeRepository(),petRepository:createPetRepository(),operationRepository:createOperationRepository()}}}catch{return {ok:false,error:'施設データへの接続を準備できませんでした。'}} }
const runtime=createRuntime()
const ROOM_CATALOG = [
  { id: 'garden', name: 'ガーデンルーム' },
  { id: 'sunny', name: 'サニールーム' },
  { id: 'calm', name: 'カームルーム' },
] as const

type AppStatus = { tone: 'info' | 'success' | 'error'; message: string }

function createRooms(petCount: number): RoomDefinition[] {
  if (petCount === 0) return []
  const roomCount = Math.min(ROOM_CATALOG.length, Math.max(1, Math.ceil(petCount / 2)))
  const capacity = Math.ceil(petCount / roomCount)
  return ROOM_CATALOG.slice(0, roomCount).map((room) => ({ ...room, capacity, minOccupancy: 1 }))
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
  const [dataState, setDataState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [isConfirmed, setIsConfirmed] = useState(false)
  const [matchingHistory, setMatchingHistory] = useState<MatchingSnapshot[]>([])
  const [observations, setObservations] = useState<ObservationRecord[]>([])
  const [historyError, setHistoryError] = useState('')
  const [status, setStatus] = useState<AppStatus>(() => {
    const configurationError = firebaseConfigurationError()
    return configurationError
      ? { tone: 'error', message: configurationError }
      : { tone: 'info', message: '施設の登録情報を読み込んでいます。' }
  })

  const rooms = useMemo(() => createRooms(pets.length), [pets.length])
  const matchingResult = useMemo(() => pets.length > 0 ? createOptimalRoomPlan(pets, rooms) : null, [pets, rooms])
  const loadHistory = useCallback(async () => {
    if (!runtime.ok) return
    const results = await Promise.allSettled([
      runtime.services.operationRepository.listMatchings(),
      runtime.services.operationRepository.listObservations(),
    ])
    if (results[0].status === 'fulfilled') setMatchingHistory(results[0].value)
    if (results[1].status === 'fulfilled') setObservations(results[1].value)
    setHistoryError(results.some(result => result.status === 'rejected') ? '保存履歴を取得できませんでした。登録情報を更新して再試行してください。' : '')
  }, [])

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
      const intakes = await runtime.services.intakeRepository.listRecent(25)
      await Promise.all(intakes.filter(intake => intake.status === 'ready' && intake.matchingProfile).map(intake =>
        runtime.services.petRepository.saveIfAbsent(intakeToPetProfile({ intakeId:intake.id, pet:intake.pet, matchingProfile:intake.matchingProfile }))))
      const [page] = await Promise.all([runtime.services.petRepository.listPage(20), loadHistory()])
      setPets(page.pets)
      setDataState('ready')
      setIsConfirmed(false)
      setStatus({
        tone: 'success',
        message: page.pets.length > 0
          ? `${page.pets.length}頭の登録情報を読み込み、全${page.pets.length * (page.pets.length - 1) / 2}ペアを採点しました。`
          : '登録済みのわんちゃんはまだいません。',
      })
      return page.pets
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Firestoreからプロフィールを取得できませんでした。'
      setDataState('error')
      setStatus({ tone: 'error', message: `${message} 「登録情報を更新」を押して再試行してください。` })
      throw error
    }

    })()
    refreshPromise.current = pending
    try { return await pending } finally { refreshPromise.current = null }
  }, [loadHistory])

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
      setDataState('ready')
      setIsConfirmed(false)
    }, 20)
    return () => {
      active = false
      unsubscribe()
    }
  }, [loadPets])

  const saveCurrentMatching = useCallback(async (confirmation: boolean) => {
    const configurationError = firebaseConfigurationError()
    if (configurationError || !runtime.ok) {
      setStatus({ tone: 'error', message: configurationError ?? 'サービスを初期化できませんでした。' })
      return
    }
    if (!matchingResult || (confirmation && matchingResult.status !== 'success')) {
      setStatus({ tone: 'error', message: '再計算するプロフィールがありません。' })
      return
    }
    setIsOptimizing(true)
    setIsConfirmed(false)
    try {
      await runtime.services.operationRepository.saveMatching(createMatchingSnapshot(matchingResult, pets, confirmation ? 'confirmed' : 'proposed'))
      await loadHistory()
      setIsConfirmed(confirmation)
      setStatus({
        tone: 'success',
        message: confirmation
          ? 'この部屋割りを確定して保存しました。'
          : matchingResult.status === 'success'
            ? `全${matchingResult.pairResults.length}ペアを再採点し、部屋割り案を保存しました。`
            : matchingResult.message,
      })
    } catch (error) {
      setStatus({ tone: 'error', message: `${error instanceof Error ? error.message : '結果を保存できませんでした。'} 同じ操作を再度実行してください。` })
    } finally {
      setIsOptimizing(false)
    }
  }, [matchingResult, pets, loadHistory])

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
      await loadHistory()
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
  }, [pets, loadHistory])


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
    {historyError && <p className="app-status app-status--error" role="alert">{historyError}</p>}
    {dataState === 'ready' ? <StaffApp pets={pets} matchingResult={matchingResult} rooms={rooms}
      matchingHistory={matchingHistory} observations={observations} staffName={staff.name}
      busy={isOptimizing} confirmed={isConfirmed} onIssueInvite={issueInvite}
      onOptimize={() => saveCurrentMatching(false)} onConfirm={() => saveCurrentMatching(true)} onObserve={applyObservation} />
      : <section className="app-state-panel" role="status"><h1>{dataState === 'loading' ? '登録情報を読み込んでいます' : '登録情報を読み込めませんでした'}</h1><p>{dataState === 'loading' ? 'そのままお待ちください。' : '接続を確認し、「登録情報を更新」を押してください。'}</p></section>}

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
