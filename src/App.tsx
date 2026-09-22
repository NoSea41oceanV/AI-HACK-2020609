import { useCallback, useEffect, useRef, useState } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, setPersistence, browserSessionPersistence } from 'firebase/auth'
import './App.css'
import { type ObservationSubmission } from './components/ObservationPanel'
import StaffSignIn from './components/StaffSignIn'
import StaffSelection from './components/StaffSelection'
import StaffApp from './pawpals/StaffApp'
import OwnerRegistration from './OwnerRegistration'
import { OwnerInviteError } from './pages/OwnerForm'
import { createIntakeRepository, createOperationRepository, createPetRepository, createInviteRepository, createStaffProfileRepository, createDailyOperationRepository, createManualObservationRepository, demoPets, demoRooms, operationDateForObservation, type MatchingSnapshot, type ObservationRecord, type PetPage, type StaffProfile } from './data'
import { intakeToPetProfile } from './domain/intakeProfile'
import { assertOperationDate, isCurrentPlan, isCurrentProposed, type DailyOperationDay, type DailyOperationPlan, type FacilityRoomSettings, type OperationAuditEvent } from './domain/dailyOperations'
import { createOptimalRoomPlan } from './domain/matching'
import type { PetProfile as DomainPetProfile, RoomDefinition } from './domain/types'
import { getFirebaseAuth } from './lib/firebase'
import { parseAppRoute, generateOwnerInviteToken, createOwnerInviteUrl } from './lib/ownerInvite'

function createRuntime() {
  try {
    return { ok: true as const, services: {
      intake: createIntakeRepository(), pets: createPetRepository(), operations: createOperationRepository(),
      daily: createDailyOperationRepository(),
      manualObservations: createManualObservationRepository(),
    } }
  } catch { return { ok: false as const, error: '施設データへの接続を準備できませんでした。' } }
}
const runtime = createRuntime()
type AppStatus = { tone: 'info' | 'success' | 'error'; message: string }
interface DailyView {
  date: string
  day: DailyOperationDay | null
  settings: FacilityRoomSettings | null
  plan: DailyOperationPlan | null
  audit: OperationAuditEvent[]
}
const emptyDaily = (date: string): DailyView => ({ date, day: null, settings: null, plan: null, audit: [] })
const todayInJapan = () => new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
const errorText = (error: unknown) => error instanceof Error ? error.message : '接続を確認してもう一度お試しください。'

function requireServices() {
  if (!runtime.ok) throw new Error(runtime.error)
  const services = runtime.services
  if (!services.daily || !services.manualObservations || services.intake.kind !== 'firestore' || services.pets.kind !== 'firestore' || services.operations.kind !== 'firestore') {
    throw new Error('Firebaseが未設定です。実データを保存できないため、この画面ではローカル代替処理を行いません。')
  }
  return { ...services, daily: services.daily, manualObservations: services.manualObservations }
}

function StaffWorkspace({ staff, onChangeStaff, onSignOut }: { staff: StaffProfile; onChangeStaff: () => void; onSignOut: () => void }) {
  const [facilityId] = useState(() => getFirebaseAuth()?.currentUser?.uid)
  const [pets, setPets] = useState<DomainPetProfile[]>([])
  const [dataState, setDataState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [operationDate, setOperationDate] = useState(todayInJapan)
  const [dailyView, setDailyView] = useState(() => emptyDaily(operationDate))
  const [dailyLoading, setDailyLoading] = useState(true)
  const [dailyError, setDailyError] = useState('')
  const [busy, setBusy] = useState(false)
  const [matchingHistory, setMatchingHistory] = useState<MatchingSnapshot[]>([])
  const [observations, setObservations] = useState<ObservationRecord[]>([])
  const [historyError, setHistoryError] = useState('')
  const [status, setStatus] = useState<AppStatus>({ tone: 'info', message: '施設の登録情報を読み込んでいます。' })
  const active = useRef(true)
  const selectedDate = useRef(operationDate)
  selectedDate.current = operationDate
  const dailyRequest = useRef(0)
  const mutationLock = useRef(false)
  const petRequest = useRef<Promise<DomainPetProfile[]> | null>(null)
  const observationRetryIds = useRef(new Map<string, string>())

  const assertFacility = useCallback(() => {
    if (!active.current || !facilityId || getFirebaseAuth()?.currentUser?.uid !== facilityId) throw new Error('施設アカウントが変更されました。ログインを確認してください。')
  }, [facilityId])

  useEffect(() => {
    active.current = true
    return () => { active.current = false; dailyRequest.current += 1 }
  }, [])

  const loadHistory = useCallback(async () => {
    assertFacility()
    const { operations, manualObservations } = requireServices()
    const results = await Promise.allSettled([operations.listMatchings(), manualObservations.listManual()])
    assertFacility()
    if (results[0].status === 'fulfilled') setMatchingHistory(results[0].value)
    if (results[1].status === 'fulfilled') setObservations(results[1].value)
    setHistoryError(results.some(result => result.status === 'rejected') ? '保存履歴を取得できませんでした。登録情報を更新して再試行してください。' : '')
  }, [assertFacility])

  const loadDaily = useCallback(async (date: string) => {
    assertFacility()
    const request = ++dailyRequest.current
    if (selectedDate.current === date) setDailyLoading(true)
    try {
      const { daily } = requireServices()
      const [day, settings, audit] = await Promise.all([daily.getDay(date), daily.getRooms(), daily.listAudit(date)])
      assertFacility()
      const plan = day?.latestPlanId ? await daily.getPlan(date, day.latestPlanId) : null
      assertFacility()
      if (request === dailyRequest.current && selectedDate.current === date) {
        setDailyView({ date, day, settings, plan, audit })
        setDailyError('')
      }
    } catch (error) {
      if (active.current && request === dailyRequest.current && selectedDate.current === date) {
        setDailyView(emptyDaily(date))
        setDailyError(`当日の運用情報を取得できませんでした。${errorText(error)}`)
      }
      throw error
    } finally {
      if (active.current && request === dailyRequest.current && selectedDate.current === date) setDailyLoading(false)
    }
  }, [assertFacility])

  const loadPets = useCallback(async () => {
    if (petRequest.current) return petRequest.current
    const pending = (async () => {
      assertFacility()
      const services = requireServices()
      const intakes = await services.intake.listRecent(25)
      assertFacility()
      await Promise.all(intakes.filter(intake => intake.status === 'ready' && intake.matchingProfile).map(intake =>
        services.pets.saveIfAbsent(intakeToPetProfile({ intakeId: intake.id, pet: intake.pet, matchingProfile: intake.matchingProfile }))))
      const all: DomainPetProfile[] = []
      let cursor: string | null = null
      const seen = new Set<string>()
      do {
        assertFacility()
        // The repository fetches one look-ahead record; keep each Rules query at <=25.
        const page: PetPage = await services.pets.listPage(24, cursor)
        all.push(...page.pets)
        cursor = page.nextCursor
        if (cursor && seen.has(cursor)) throw new Error('登録一覧の続きを取得できませんでした。')
        if (cursor) seen.add(cursor)
      } while (cursor)
      assertFacility()
      setPets(all)
      setDataState('ready')
      return all
    })()
    petRequest.current = pending
    try { return await pending }
    catch (error) {
      if (active.current) { setDataState('error'); setStatus({ tone: 'error', message: errorText(error) }) }
      throw error
    } finally { petRequest.current = null }
  }, [assertFacility])

  useEffect(() => { void loadPets().then(async () => { await loadHistory(); if (active.current) setStatus({ tone: 'success', message: '登録情報を読み込みました。当日の対象犬と部屋設定を確認してください。' }) }).catch(() => undefined) }, [loadPets, loadHistory])
  useEffect(() => { void loadDaily(operationDate).catch(() => undefined) }, [loadDaily, operationDate])

  const view = dailyView.date === operationDate ? dailyView : emptyDaily(operationDate)
  const currentResult = !dailyLoading && !dailyError && isCurrentPlan(view.day, view.settings, view.plan)
    && (view.plan?.status === 'proposed' || view.plan?.status === 'confirmed') ? view.plan.result : null

  const perform = async (work: () => Promise<unknown>, success: string) => {
    if (mutationLock.current || dailyLoading) throw new Error('処理中です。完了してからお試しください。')
    if (dailyError) throw new Error('運用情報を読み直してからお試しください。')
    assertFacility()
    const date = operationDate
    mutationLock.current = true
    setBusy(true)
    let saved = false
    try {
      await work()
      saved = true
      assertFacility()
      await Promise.all([loadDaily(date), loadHistory()])
      setStatus({ tone: 'success', message: success })
    } catch (error) {
      if (active.current) setStatus({ tone: 'error', message: saved
        ? `保存しましたが、表示の更新を確認できませんでした。「登録情報を更新」で確認してください。${errorText(error)}`
        : errorText(error) })
      if (!saved && active.current) await loadDaily(date).catch(() => undefined)
      throw error
    } finally {
      mutationLock.current = false
      if (active.current) setBusy(false)
    }
  }

  const saveDailyPets = (petIds: string[]) => perform(() => requireServices().daily.saveDay({
    date: operationDate, petIds, staffId: staff.id, expectedRevision: view.day?.revision ?? 0,
  }), '当日の対象犬を保存しました。部屋割りを再計算してください。')
  const saveRooms = (rooms: RoomDefinition[]) => perform(() => requireServices().daily.saveRooms({
    rooms, staffId: staff.id, expectedRevision: view.settings?.revision ?? 0,
  }), '施設の部屋設定を保存しました。部屋割りを再計算してください。')
  const optimize = async () => {
    try {
      await perform(() => requireServices().daily.recalculate({ date: operationDate, staffId: staff.id,
        reason: 'スタッフ操作による当日配置の再計算', expectedRevision: view.day?.revision ?? 0,
        expectedRoomsRevision: view.settings?.revision ?? 0 }), '当日の対象犬だけで部屋割り案を保存しました。')
    } catch { /* The shared status contains the actionable failure. */ }
  }
  const decidePlan = (decision: 'confirmed' | 'rejected', reason: string) => perform(async () => {
    if (!view.day || !view.plan || !isCurrentProposed(view.day, view.settings, view.plan)) throw new Error('最新の有効な案を表示してから判断してください。')
    return requireServices().daily.decide({ date: operationDate, planId: view.plan.id, staffId: staff.id,
      decision, reason, expectedRevision: view.day.revision })
  }, decision === 'confirmed' ? '選択中のスタッフが最新案を承認しました。' : '選択中のスタッフが最新案を却下しました。')

  const applyObservation = async (submission: ObservationSubmission) => {
    await perform(async () => {
      const primary = pets.find(pet => pet.id === submission.petAId)
      const counterpart = pets.find(pet => pet.id === submission.petBId)
      if (!primary || !counterpart || !view.day || ![primary.id, counterpart.id].every(id => view.day!.selectedPetIds.includes(id))) throw new Error('当日の対象犬を選択してください。')
      const services = requireServices()
      const observedAt = new Date().toISOString()
      if (operationDateForObservation(observedAt) !== operationDate) throw new Error('手動観測は日本時間の当日だけ登録できます。')
      const petIds = [primary.id, counterpart.id].sort()
      const retryKey = JSON.stringify([operationDate, petIds, submission.decision, submission.notes])
      const observationId = observationRetryIds.current.get(retryKey) ?? crypto.randomUUID()
      observationRetryIds.current.set(retryKey, observationId)
      try {
        await services.manualObservations.createManual({ id: observationId,
          title: `${primary.name}と${counterpart.name}の当日観測`, facts: [submission.notes],
          impacts: [submission.decision === 'separate' ? '安全判断として同室不可制約を追加' : 'プロフィール変更なしで再評価'],
          recommendation: '当日の部屋割りを再計算し、スタッフが結果を確認する。', observedAt,
          staffId: staff.id, petIds, operationDate }, facilityId)
        if (submission.decision === 'separate') {
          assertFacility()
          const hardBlockedPetIds = [...new Set([...(primary.hardBlockedPetIds ?? []), counterpart.id])].sort()
          await services.pets.save({ ...primary, hardBlockedPetIds })
          assertFacility()
          setPets(current => current.map(pet => pet.id === primary.id ? { ...pet, hardBlockedPetIds } : pet))
        }
        assertFacility()
        await services.daily.recalculate({ date: operationDate, staffId: staff.id, reason: submission.notes,
          expectedRevision: view.day.revision, expectedRoomsRevision: view.settings?.revision ?? 0 })
        observationRetryIds.current.delete(retryKey)
      } catch (error) {
        throw new Error(`観測の保存または部屋割り案の更新を完了できませんでした。${errorText(error)}`)
      }
    }, '観測を保存し、当日の部屋割り案を更新しました。')
  }

  const issueInvite = async () => {
    assertFacility()
    const repository = createInviteRepository()
    if (!repository) throw new Error('登録URLを発行できません。')
    const token = generateOwnerInviteToken()
    await repository.create(token, staff.id)
    return createOwnerInviteUrl(window.location.origin, token)
  }
  const changeDate = (date: string) => {
    if (mutationLock.current || date === selectedDate.current) return
    try { assertOperationDate(date) } catch { return }
    selectedDate.current = date
    dailyRequest.current += 1
    setDailyView(emptyDaily(date))
    setDailyError('')
    setDailyLoading(true)
    setOperationDate(date)
  }
  const refresh = async () => {
    if (mutationLock.current) return
    mutationLock.current = true
    setBusy(true)
    try { await Promise.all([loadPets(), loadHistory(), loadDaily(operationDate)]); setStatus({ tone: 'success', message: '保存済みの登録・運用情報を更新しました。' }) }
    catch (error) { if (active.current) setStatus({ tone: 'error', message: errorText(error) }) }
    finally { mutationLock.current = false; if (active.current) setBusy(false) }
  }
  return <div className="app-shell">
    <header className="facility-toolbar">
      <strong>操作担当: {staff.name}</strong><span>スタッフ選択は操作担当の記録です</span>
      <button type="button" disabled={busy} onClick={onChangeStaff}>担当を変更</button>
      <button type="button" disabled={busy} onClick={onSignOut}>ログアウト</button>
    </header>
    <div className={`app-status app-status--${status.tone}`} role={status.tone === 'error' ? 'alert' : 'status'}>
      <span>{status.message}</span><button type="button" disabled={busy || dataState === 'loading'} onClick={() => void refresh()}>登録情報を更新</button>
    </div>
    {historyError && <p className="app-status app-status--error" role="alert">{historyError}</p>}
    {dailyError && <p className="app-status app-status--error" role="alert">{dailyError}</p>}
    {dataState === 'ready' ? <StaffApp pets={pets} matchingResult={currentResult} rooms={view.settings?.rooms ?? []}
      matchingHistory={matchingHistory} observations={observations} staffName={staff.name}
      operationDate={operationDate} dailyOperation={view.day} roomSettings={view.settings} currentPlan={view.plan} auditEntries={view.audit}
      busy={busy || dailyLoading || Boolean(dailyError)} onIssueInvite={issueInvite} onOperationDateChange={changeDate}
      onSaveDailyPets={saveDailyPets} onSaveRooms={saveRooms} onOptimize={optimize} onDecidePlan={decidePlan} onObserve={applyObservation} />
      : <section className="app-state-panel" role="status"><h1>{dataState === 'loading' ? '登録情報を読み込んでいます' : '登録情報を読み込めませんでした'}</h1><p>接続を確認し、「登録情報を更新」を押してください。</p></section>}
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

function PublicDemo() {
  const date = todayInJapan()
  const updatedAt = `${date}T01:00:00.000Z`
  const result = createOptimalRoomPlan(demoPets, demoRooms)
  if (result.status !== 'success') return <section className="app-state-panel" role="alert"><h1>デモを表示できません</h1><p>{result.message}</p></section>

  const day: DailyOperationDay = {
    facilityId: 'public-demo', date, selectedPetIds: demoPets.map((pet) => pet.id).sort(), revision: 2,
    latestPlanId: 'public-demo-plan', lastAuditId: 'public-demo-confirmed', updatedAt, updatedBy: 'デモ担当',
  }
  const roomSettings: FacilityRoomSettings = {
    facilityId: 'public-demo', rooms: demoRooms, revision: 1, lastAuditId: 'public-demo-rooms', updatedAt, updatedBy: 'デモ担当',
  }
  const plan: DailyOperationPlan = {
    id: 'public-demo-plan', facilityId: 'public-demo', date, status: 'confirmed',
    petIds: day.selectedPetIds, rooms: demoRooms, roomsRevision: 1, dayRevision: 1, result,
    sourcePlanId: null, createdAt: updatedAt, updatedAt, staffId: 'デモ担当',
    reason: '公開デモ用の架空データで確認済み', lastAuditId: 'public-demo-confirmed',
  }
  const audit: OperationAuditEvent[] = [{
    id: 'public-demo-confirmed', facilityId: 'public-demo', date, action: 'confirmed', staffId: 'デモ担当',
    reason: '公開デモ用の架空データで確認済み', sourcePlanId: null, planId: plan.id, createdAt: updatedAt,
    dayRevision: 2, roomsRevision: 1,
  }]
  const readOnly = async () => { throw new Error('公開デモでは変更を保存しません。画面と計算結果をご確認ください。') }

  return <div className="app-shell">
    <header className="facility-toolbar"><strong>公開デモ</strong><span>6頭の架空データを表示しています。操作内容は保存されません。</span></header>
    <StaffApp pets={demoPets} matchingResult={result} rooms={demoRooms} matchingHistory={[]} observations={[]}
      operationDate={date} dailyOperation={day} roomSettings={roomSettings} currentPlan={plan} auditEntries={audit}
      staffName="デモ担当" busy={false} onOperationDateChange={() => undefined}
      onSaveDailyPets={readOnly} onSaveRooms={readOnly} onOptimize={readOnly} onDecidePlan={readOnly}
      onIssueInvite={async () => { await readOnly(); return '' }} onObserve={readOnly} />
  </div>
}

export default function App() {
  const [route,setRoute]=useState(()=>parseAppRoute(window.location))
  useEffect(()=>{const update=()=>setRoute(parseAppRoute(window.location));window.addEventListener('popstate',update);window.addEventListener('hashchange',update);return ()=>{window.removeEventListener('popstate',update);window.removeEventListener('hashchange',update)}},[])
  if(route.kind==='owner')return <OwnerRegistration key={route.token??'missing'} token={route.token}/>
  if(route.kind==='demo')return <PublicDemo/>
  if(route.kind==='not-found')return <OwnerInviteError reason="invalid"/>
  return <FacilityGate/>
}
