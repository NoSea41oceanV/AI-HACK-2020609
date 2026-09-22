import { useState } from 'react'
import type { MatchingSnapshot, ObservationRecord } from '../data'
import { isCurrentPlan, isCurrentProposed } from '../domain/dailyOperations'
import type { DailyOperationDay, DailyOperationPlan, FacilityRoomSettings, OperationAuditEvent } from '../domain/dailyOperations'
import type { DomainPetProfile, MatchingResult, RoomDefinition } from './pawPalsModel'
import { formatRecordedAt, petById, roomName } from './pawPalsModel'
import './DailyOperations.css'

export interface TodayScreenProps {
  pets: readonly DomainPetProfile[]
  matchingResult: MatchingResult | null
  rooms: readonly RoomDefinition[]
  matchingHistory: readonly MatchingSnapshot[]
  observations: readonly ObservationRecord[]
  busy: boolean
  staffName: string
  operationDate: string
  dailyOperation: DailyOperationDay | null
  roomSettings: FacilityRoomSettings | null
  currentPlan: DailyOperationPlan | null
  auditEntries: readonly OperationAuditEvent[]
  onOperationDateChange: (date: string) => void
  onSaveDailyPets: (petIds: string[]) => Promise<void>
  onSaveRooms: (rooms: RoomDefinition[]) => Promise<void>
  onOptimize: () => void | Promise<void>
  onDecidePlan: (decision: 'confirmed' | 'rejected', reason: string) => Promise<void>
}

const AUDIT_LABELS = { day_saved: '当日の預かり犬を保存', rooms_saved: '施設の部屋設定を保存', recalculated: '部屋割り案を再計算', confirmed: '部屋割り案を承認・確定', rejected: '部屋割り案を却下' }
const PLAN_LABELS = { proposed: '承認待ち', confirmed: '確定済み', rejected: '却下済み', superseded: '更新前の案' }
const normalizedRooms = (rooms: readonly RoomDefinition[]) => rooms.map((room) => ({ ...room, minOccupancy: room.minOccupancy ?? 0 }))
const sameIds = (left: readonly string[], right: readonly string[]) => left.length === right.length && [...left].sort().join('\0') === [...right].sort().join('\0')

// A different date starts a fresh editor; each saved revision resets only its own draft.
export default function TodayScreen(props: TodayScreenProps) {
  return <DailyOperationsEditor key={props.operationDate} {...props} />
}

function DailyOperationsEditor({
  pets, matchingResult, rooms, matchingHistory, observations, busy, staffName,
  operationDate, dailyOperation, roomSettings, currentPlan, auditEntries,
  onOperationDateChange, onSaveDailyPets, onSaveRooms, onOptimize, onDecidePlan,
}: TodayScreenProps) {
  const day = dailyOperation?.date === operationDate ? dailyOperation : null
  const savedPetIds = day?.selectedPetIds ?? []
  const savedRooms = normalizedRooms(roomSettings?.rooms ?? rooms)
  const dayRevision = day?.revision ?? 0
  const roomRevision = roomSettings?.revision ?? 0
  const [petDraftState, setPetDraftState] = useState(() => ({ revision: dayRevision, values: [...savedPetIds] }))
  const [roomDraftState, setRoomDraftState] = useState<{ revision: number; values: RoomDefinition[] }>(() => ({ revision: roomRevision, values: savedRooms }))
  const [reasonState, setReasonState] = useState({ planId: currentPlan?.id, value: '' })
  const selectedPetIds = petDraftState.revision === dayRevision ? petDraftState.values : savedPetIds
  const roomDraft = roomDraftState.revision === roomRevision ? roomDraftState.values : savedRooms
  const reason = reasonState.planId === currentPlan?.id ? reasonState.value : ''
  const setSelectedPetIds = (update: (previous: string[]) => string[]) => setPetDraftState({ revision: dayRevision, values: update([...selectedPetIds]) })
  const setRoomDraft = (update: (previous: RoomDefinition[]) => RoomDefinition[]) => setRoomDraftState({ revision: roomRevision, values: update(roomDraft) })
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const petIndex = petById(pets)
  const selectedIds = new Set(selectedPetIds)
  const petsDirty = !sameIds(selectedPetIds, savedPetIds)
  const roomsDirty = JSON.stringify(roomDraft) !== JSON.stringify(savedRooms)
  const unsaved = petsDirty || roomsDirty
  const working = busy || pending !== null
  const plan = currentPlan?.date === operationDate && currentPlan.id === day?.latestPlanId ? currentPlan : null
  const planMatchesSettings = isCurrentPlan(day, roomSettings, plan)
  const awaitingApproval = isCurrentProposed(day, roomSettings, plan)
  const stateLabel = plan ? (plan.status === 'superseded' ? PLAN_LABELS.superseded : !planMatchesSettings ? '再計算が必要' : PLAN_LABELS[plan.status]) : '未計算'
  const roomError = roomDraft.length === 0 || roomDraft.length > 10 ? '部屋は1〜10室で設定してください。'
    : roomDraft.some((room) => !room.name.trim()) ? '部屋名を入力してください。'
      : roomDraft.some((room) => !Number.isInteger(room.capacity) || room.capacity < 1 || room.capacity > 20) ? '定員は1〜20の整数にしてください。'
        : roomDraft.some((room) => !Number.isInteger(room.minOccupancy) || (room.minOccupancy ?? 0) < 0 || (room.minOccupancy ?? 0) > room.capacity) ? '最低頭数は0から定員までの整数にしてください。' : ''
  const savedPetMissing = savedPetIds.some((id) => !petIndex.has(id))
  const canOptimize = Boolean(day && roomSettings && savedPetIds.length > 0 && !savedPetMissing && !unsaved && !working)
  const canDecide = awaitingApproval && !unsaved && !working
  const dailyAudits = auditEntries.filter((entry) => entry.date === operationDate || entry.date === null).sort((left, right) => right.createdAt.localeCompare(left.createdAt))
  const activity = [
    ...matchingHistory.map((snapshot) => ({ id: `matching-${snapshot.id}`, at: snapshot.createdAt, title: snapshot.status === 'confirmed' ? '保存済みの部屋割りを確定' : '部屋割りの計算結果を保存', detail: `${snapshot.petIds.length}頭・${snapshot.rooms.length}室` })),
    ...observations.map((observation) => ({ id: `observation-${observation.id}`, at: observation.observedAt, title: observation.title, detail: observation.recommendation })),
  ].sort((left, right) => right.at.localeCompare(left.at)).slice(0, 5)

  async function run(label: string, action: () => void | Promise<void>) {
    if (working) return
    setPending(label)
    setError('')
    setNotice('')
    try {
      await action()
      setNotice(`${label}が完了しました。`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `${label}に失敗しました。もう一度お試しください。`)
    } finally { setPending(null) }
  }

  function updateRoom(id: string, changes: Partial<RoomDefinition>) {
    setRoomDraft((previous) => previous.map((room) => room.id === id ? { ...room, ...changes } : room))
  }

  return (
    <section className="screen active daily-operations" aria-labelledby="today-screen-title" aria-busy={working}>
      <div className="page-title">
        <div><span className="eyebrow">DAY CARE OPERATIONS</span><h1 id="today-screen-title">今日の運営</h1><p>預かり犬と部屋を準備して、スタッフの確認で編成を確定します。</p></div>
        <label className="daily-date">運営日<input type="date" aria-label="運営日" value={operationDate} disabled={working} onChange={(event) => { if (event.target.value) onOperationDateChange(event.target.value) }} /></label>
      </div>
      {error ? <p className="daily-message daily-message-error" role="alert">{error}</p> : null}
      {pending || notice ? <p className="daily-message" role="status">{pending ? `${pending}中…` : notice}</p> : null}
      <div className="kpis">
        <div className="kpi"><b>{savedPetIds.length}<small>頭</small></b><span>当日の預かり犬・保存済み</span></div>
        <div className="kpi"><b>{roomSettings?.rooms.length ?? 0}<small>室</small></b><span>施設の部屋・保存済み</span></div>
        <div className="kpi"><b>{awaitingApproval ? 1 : 0}<small>件</small></b><span>最新案の承認待ち</span></div>
        <div className="kpi"><b className="daily-state-value">{stateLabel}</b><span>当日の編成状態</span></div>
      </div>
      <div className="daily-setup-grid">
        <section className="card" aria-labelledby="daily-pets-title">
          <div className="card-top"><div><span className="eyebrow">01 · 預かりの準備</span><h2 id="daily-pets-title">当日の預かり犬</h2></div><span className={`status ${petsDirty || !day ? 'warning' : ''}`}>{petsDirty ? '未保存の変更' : day ? '保存済み' : '未保存'}</span></div>
          <p className="daily-help">{operationDate} に預かる犬を、登録済みの{pets.length}頭から選びます。</p>
          <div className="daily-pet-list">
            {pets.map((pet) => <label className={`daily-pet-option ${selectedIds.has(pet.id) ? 'is-selected' : ''}`} key={pet.id}>
              <input type="checkbox" checked={selectedIds.has(pet.id)} disabled={working} onChange={(event) => setSelectedPetIds((previous) => event.target.checked ? [...previous, pet.id] : previous.filter((id) => id !== pet.id))} />
              <span><b>{pet.name}</b><small>{pet.breed || '犬種未登録'} · {pet.weightKg} kg</small></span>
            </label>)}
            {pets.length === 0 ? <p className="daily-help">登録済みの犬はいません。プロフィールを登録してから選択してください。</p> : null}
          </div>
          {selectedPetIds.filter((id) => !petIndex.has(id)).map((id) => <label className="daily-pet-option" key={id}><input type="checkbox" checked disabled={working} onChange={() => setSelectedPetIds((previous) => previous.filter((value) => value !== id))} /><span>登録情報を確認できない犬：{id}</span></label>)}
          <div className="daily-save-row"><span>選択中 <b>{selectedPetIds.length}頭</b> / 保存済み {savedPetIds.length}頭</span><button className="secondary" type="button" disabled={working || (Boolean(day) && !petsDirty)} onClick={() => void run('預かり犬の保存', () => onSaveDailyPets(selectedPetIds))}>預かり犬を保存</button></div>
          {day ? <p className="daily-saved">{formatRecordedAt(day.updatedAt)} · {day.updatedBy} が保存</p> : null}
        </section>
        <section className="card" aria-labelledby="daily-rooms-title">
          <div className="card-top"><div><span className="eyebrow">02 · 施設の設定</span><h2 id="daily-rooms-title">部屋と定員</h2></div><span className={`status ${roomsDirty || !roomSettings ? 'warning' : ''}`}>{roomsDirty ? '未保存の変更' : roomSettings ? '保存済み' : '未保存'}</span></div>
          <p className="daily-help">施設共通の設定です。空室を許可する部屋の最低頭数は0にします。</p>
          <div className="daily-room-list">
            {roomDraft.map((room, index) => <div className="daily-room-editor" key={room.id}>
              <label>部屋名<input aria-label={`部屋${index + 1}の名前`} value={room.name} disabled={working} maxLength={80} onChange={(event) => updateRoom(room.id, { name: event.target.value })} /></label>
              <label>定員<input aria-label={`部屋${index + 1}の定員`} type="number" min="1" max="20" step="1" value={room.capacity} disabled={working} onChange={(event) => updateRoom(room.id, { capacity: Number(event.target.value) })} /></label>
              <label>最低頭数<input aria-label={`部屋${index + 1}の最低頭数`} type="number" min="0" max={room.capacity} step="1" value={room.minOccupancy ?? 0} disabled={working} onChange={(event) => updateRoom(room.id, { minOccupancy: Number(event.target.value) })} /></label>
              <button className="daily-remove" type="button" aria-label={`${room.name || `部屋${index + 1}`}を削除`} disabled={working} onClick={() => setRoomDraft((previous) => previous.filter((item) => item.id !== room.id))}>削除</button>
            </div>)}
          </div>
          {roomError ? <p className="daily-validation">{roomError}</p> : null}
          <div className="daily-save-row"><button className="daily-add" type="button" disabled={working} onClick={() => setRoomDraft((previous) => [...previous, { id: `room-${crypto.randomUUID()}`, name: '', capacity: 4, minOccupancy: 0 }])}>＋ 部屋を追加</button><button className="secondary" type="button" disabled={working || Boolean(roomError) || (Boolean(roomSettings) && !roomsDirty)} onClick={() => void run('部屋設定の保存', () => onSaveRooms(roomDraft.map((room) => ({ ...room, name: room.name.trim() }))))}>部屋設定を保存</button></div>
          {roomSettings ? <p className="daily-saved">{formatRecordedAt(roomSettings.updatedAt)} · {roomSettings.updatedBy} が保存</p> : null}
        </section>
      </div>
      <div className="daily-results-grid">
        <section className="card daily-plan" aria-labelledby="daily-plan-title">
          <div className="card-top"><div><span className="eyebrow">03 · 編成とスタッフ確認</span><h2 id="daily-plan-title">当日のグループ編成案</h2></div><span className={`status ${awaitingApproval || (plan && !planMatchesSettings) ? 'warning' : ''}`}>{stateLabel}</span></div>
          <div className="goal-box"><b>保存済みの{savedPetIds.length}頭・{roomSettings?.rooms.length ?? 0}室で計算</b><p>同室にできない組み合わせと定員を守り、6因子と利用可能なAI 7軸を反映した相性スコアで部屋割りを提案します。</p></div>
          {unsaved ? <p className="daily-validation">預かり犬または部屋に未保存の変更があります。保存後に再計算・承認してください。</p> : null}
          {savedPetMissing ? <p className="daily-validation">保存済みの預かり犬に、登録情報を確認できない犬がいます。対象から外して保存してください。</p> : null}
          {plan && !planMatchesSettings ? <p className="daily-validation">この案の作成後に対象犬または部屋設定が更新されました。最新の設定で再計算してください。</p> : null}
          {plan ? <>
            <p className="daily-plan-meta">案 ID：<span>{plan.id}</span><br />作成 {formatRecordedAt(plan.createdAt)} · 対象 {plan.petIds.length}頭</p>
            {plan.result.rooms.map((assignment) => <div className={`group-row ${planMatchesSettings && plan.status !== 'rejected' ? 'proposed' : ''}`} key={assignment.roomId}>
              <div className="group-name"><b>{roomName(plan.rooms, assignment.roomId)}</b><span>{assignment.petIds.length}頭 / 定員 {plan.rooms.find((room) => room.id === assignment.roomId)?.capacity ?? '—'}頭</span></div>
              <div className="dog-names">{assignment.petIds.map((petId) => petIndex.get(petId)?.name ?? petId).join(' ・ ') || '空室'}</div>
              <span className="verdict good">制約通過</span>
            </div>)}
            <div className="reason-box"><b>計算結果</b><p>全{plan.result.pairResults.length}ペアを評価。同室ペアの合計相性スコアは{plan.result.totalCompatibilityScore}点です。</p><small>合計点は部屋内のペアのスコアを足した値です。</small></div>
            {plan.status === 'confirmed' || plan.status === 'rejected' ? <div className="daily-decision-record"><b>{PLAN_LABELS[plan.status]} · {plan.staffId}</b><p>{formatRecordedAt(plan.updatedAt)}{plan.reason ? ` · ${plan.reason}` : ' · 理由の記入なし'}</p></div> : null}
          </> : <div className="pawpals-empty"><b>当日の編成案はまだありません</b><p>預かり犬と施設の部屋設定を保存して、部屋割りを計算してください。</p></div>}
          {matchingResult?.status === 'infeasible' ? <p className="daily-message daily-message-error" role="alert">編成案を作成できませんでした。{matchingResult.message}</p> : null}
          <div className="approval">
            <div><b>操作担当：{staffName}</b><small>最新の案を確認し、承認または却下を記録します。</small></div>
            <label className="daily-reason">判断理由・確認メモ（承認・却下ともに必須）<textarea value={reason} required disabled={!canDecide} maxLength={1000} placeholder="例：当日の体調と部屋の利用状況を確認しました。" onChange={(event) => setReasonState({ planId: currentPlan?.id, value: event.target.value })} /></label>
            <div className="approval-buttons">
              <button className="secondary" type="button" disabled={!canOptimize} onClick={() => void run('部屋割りの再計算', onOptimize)}>部屋割りを再計算</button>
              <button className="danger-outline" type="button" disabled={!canDecide || !reason.trim()} onClick={() => void run('編成案の却下', () => onDecidePlan('rejected', reason.trim()))}>この案を却下</button>
              <button className="primary" type="button" disabled={!canDecide || !reason.trim()} onClick={() => void run('編成案の承認', () => onDecidePlan('confirmed', reason.trim()))}>この案を承認・確定</button>
            </div>
            {!day || !roomSettings || savedPetIds.length === 0 ? <p className="daily-help">計算には、1頭以上の預かり犬と部屋設定の保存が必要です。</p> : null}
          </div>
        </section>
        <aside className="daily-records">
          <section className="card" aria-labelledby="daily-audit-title"><div className="card-top"><div><span className="eyebrow">SAVED OPERATIONS</span><h2 id="daily-audit-title">当日の操作履歴</h2></div></div><p className="daily-help">{operationDate} の操作と施設共通の部屋設定変更</p>
            {dailyAudits.length ? <ol className="daily-audit-list">{dailyAudits.map((entry) => <li key={entry.id}><time dateTime={entry.createdAt}>{formatRecordedAt(entry.createdAt)}</time><b>{AUDIT_LABELS[entry.action]}</b><p>担当：{entry.staffId}</p>{entry.reason ? <p>理由：{entry.reason}</p> : null}{entry.planId ? <small>案 ID：{entry.planId}</small> : null}{entry.sourcePlanId ? <small>更新元：{entry.sourcePlanId}</small> : null}</li>)}</ol> : <div className="pawpals-empty"><p>当日の保存済み操作はありません。</p></div>}
          </section>
          <section className="card" aria-labelledby="daily-activity-title"><div className="card-top"><div><span className="eyebrow">ACTIVITY</span><h2 id="daily-activity-title">保存済みの活動</h2></div></div><p className="daily-help">過去の日付を含む計算・観測の記録</p>{activity.length ? <ol className="daily-audit-list">{activity.map((item) => <li key={item.id}><time dateTime={item.at}>{formatRecordedAt(item.at)}</time><b>{item.title}</b><p>{item.detail}</p></li>)}</ol> : <div className="pawpals-empty"><p>保存済みの活動はありません。</p></div>}</section>
        </aside>
      </div>
    </section>
  )
}
