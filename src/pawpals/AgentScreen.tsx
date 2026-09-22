import ObservationPanel, { type ObservationSubmission } from '../components/ObservationPanel'
import type { ObservationRecord } from '../data'
import type { DailyOperationDay, DailyOperationPlan, FacilityRoomSettings, OperationAuditEvent } from '../domain/dailyOperations'
import { isCurrentPlan, isCurrentProposed } from '../domain/dailyOperations'
import type { DomainPetProfile, MatchingResult } from './pawPalsModel'
import { formatRecordedAt } from './pawPalsModel'

interface AgentScreenProps {
  pets: readonly DomainPetProfile[]
  matchingResult: MatchingResult | null
  observations: readonly ObservationRecord[]
  operationDate: string
  staffName: string
  dailyOperation: DailyOperationDay | null
  roomSettings: FacilityRoomSettings | null
  currentPlan: DailyOperationPlan | null
  auditEntries: readonly OperationAuditEvent[]
  busy: boolean
  onObserve: (submission: ObservationSubmission) => Promise<void>
}

type CurrentManualObservation = ObservationRecord & {
  source: 'manual'
  operationDate: string
  staffId: string
  petIds: string[]
}

export function manualObservationsForDate(observations: readonly ObservationRecord[], operationDate: string): CurrentManualObservation[] {
  return observations.filter((observation): observation is CurrentManualObservation => (
    'source' in observation && observation.source === 'manual'
    && 'operationDate' in observation && observation.operationDate === operationDate
    && 'staffId' in observation && typeof observation.staffId === 'string'
    && 'petIds' in observation && Array.isArray(observation.petIds)
  )).sort((left, right) => right.observedAt.localeCompare(left.observedAt))
}

const AUDIT_LABELS: Record<OperationAuditEvent['action'], string> = {
  day_saved: '当日の預かり犬を保存',
  rooms_saved: '施設の部屋設定を保存',
  recalculated: '相性・部屋割りを再計算',
  confirmed: 'スタッフが割当案を確定',
  rejected: 'スタッフが割当案を却下',
}

const PLAN_LABELS: Record<DailyOperationPlan['status'], string> = {
  proposed: '提案中',
  confirmed: 'スタッフ確定済み',
  rejected: '却下済み',
  superseded: '別の案へ更新済み',
}

export function auditEntriesForDate(entries: readonly OperationAuditEvent[], operationDate: string): OperationAuditEvent[] {
  return entries.filter((entry) => entry.date === operationDate || (entry.date === null && entry.action === 'rooms_saved'))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
}

export default function AgentScreen({
  pets, matchingResult, observations, operationDate, staffName, dailyOperation,
  roomSettings, currentPlan, auditEntries, busy, onObserve,
}: AgentScreenProps) {
  const manualObservations = manualObservationsForDate(observations, operationDate)
  const audits = auditEntriesForDate(auditEntries, operationDate)
  const planForDate = currentPlan?.date === operationDate ? currentPlan : null
  const proposed = isCurrentProposed(dailyOperation, roomSettings, planForDate)
  const current = isCurrentPlan(dailyOperation, roomSettings, planForDate)
  const confirmed = current && planForDate?.status === 'confirmed'
  const hasCurrentPlan = proposed || confirmed
  const stages = [
    { number: '01', label: '当日対象保存', done: dailyOperation?.date === operationDate && pets.length > 0 },
    { number: '02', label: '相性計算', done: hasCurrentPlan && matchingResult !== null },
    { number: '03', label: '部屋割り', done: hasCurrentPlan && matchingResult?.status === 'success' },
    { number: '04', label: 'スタッフ確定', done: confirmed },
    { number: '05', label: '手動観測保存', done: manualObservations.length > 0 },
  ]
  const firstPending = stages.findIndex((stage) => !stage.done)
  const observationPets = pets.map((pet) => ({
    id: pet.id, name: pet.name, breed: pet.breed, ageLabel: `${pet.ageYears}歳`, avatarUrl: pet.photoUrl,
  }))
  const logs = [
    ...audits.map((entry) => ({
      id: `audit-${entry.id}`, recordedAt: entry.createdAt, title: AUDIT_LABELS[entry.action],
      detail: entry.reason,
      attribution: `運用日：${entry.date ?? '施設共通'} / 担当：${entry.staffId}`,
      planReference: [entry.sourcePlanId ? `元案：${entry.sourcePlanId}` : '', entry.planId ? `対象案：${entry.planId}` : ''].filter(Boolean).join(' / '),
    })),
    ...manualObservations.map((observation) => ({
      id: `observation-${observation.id}`, recordedAt: observation.observedAt, title: '手動観測を保存',
      detail: observation.facts.join(' / '),
      attribution: `運用日：${observation.operationDate} / 担当：${observation.staffId}`,
      planReference: '',
    })),
  ].sort((left, right) => right.recordedAt.localeCompare(left.recordedAt))

  return (
    <section className="screen active" aria-labelledby="agent-screen-title">
      <div className="page-title">
        <div>
          <span className="eyebrow">処理と記録</span>
          <h1 id="agent-screen-title">エージェント運用ログ</h1>
          <p>当日の相性計算、スタッフ判断、手動観測を保存記録から確認できます。</p>
        </div>
        <div className="date-chip">{operationDate} / {busy ? '処理中' : '操作待ち'}</div>
      </div>
      <div className="goal-box pawpals-agent-note">
        <b>スタッフによる手動観測</b>
        <p>スタッフが確認・入力した事実だけを記録します。カメラ接続や自動監視はありません。</p>
      </div>
      <div className="agent-layout">
        <div className="card loop-card">
          <p>現在の割当案：<b>{planForDate ? PLAN_LABELS[planForDate.status] : '未作成'}</b>{planForDate && !current ? '（条件変更のため再計算が必要）' : ''}</p>
          <div className="loop" aria-label="当日の運用処理の進行状況">
            {stages.map((stage, index) => (
              <div className="pawpals-loop-fragment" key={stage.number}>
                <div aria-label={`${stage.label}：${stage.done ? '完了' : '未完了'}`} className={`loop-step ${stage.done ? 'done' : index === firstPending ? 'active' : ''}`}>
                  {stage.number}<br /><b>{stage.label}</b>
                </div>
                {index < stages.length - 1 ? <span aria-hidden="true">→</span> : null}
              </div>
            ))}
          </div>
          {manualObservations.length > 0 ? manualObservations.slice(0, 4).map((observation) => (
            <div className="event" key={observation.id}>
              <b>{formatRecordedAt(observation.observedAt)} {observation.title}</b>
              <p>手動入力 / 運用日：{observation.operationDate} / 担当：{observation.staffId}</p>
              <p>対象：{observation.petIds.map((id) => pets.find((pet) => pet.id === id)?.name ?? id).join('・')}</p>
              {observation.facts.map((fact, index) => <p key={`${observation.id}-fact-${index}`}>{fact}</p>)}
              <small>{observation.recommendation}</small>
            </div>
          )) : (
            <div className="pawpals-empty"><b>この運用日の手動観測はありません</b><p>スタッフが確認した事実を下のフォームから記録できます。</p></div>
          )}
        </div>
        <div className="card log-card">
          <div className="card-top">
            <div><span className="eyebrow">保存済みログ</span><h2>操作と観測の記録</h2></div>
            <span className="live">{logs.length}件</span>
          </div>
          {logs.length > 0 ? (
            <div className="agent-log">
              {logs.slice(0, 20).map((log) => (
                <div key={log.id}>
                  <time>{formatRecordedAt(log.recordedAt)}（日本時間）</time>
                  <b>{log.title}</b>
                  <p>{log.detail}</p>
                  <p>{log.attribution}</p>
                  {log.planReference ? <p>{log.planReference}</p> : null}
                </div>
              ))}
            </div>
          ) : <div className="pawpals-empty"><p>この運用日の保存済みログはありません。</p></div>}
          <div className="log-foot">当日の記録と施設共通の部屋設定変更を表示します。旧デモの観測記録は含みません。{logs.length > 20 ? '最新20件を表示しています。' : ''}</div>
        </div>
      </div>
      <div className="pawpals-observation-shell">
        <ObservationPanel pets={observationPets} operationDate={operationDate} staffName={staffName} isSubmitting={busy} onSubmit={onObserve} />
      </div>
    </section>
  )
}
