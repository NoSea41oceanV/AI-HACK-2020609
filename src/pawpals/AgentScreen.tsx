import ObservationPanel, { type ObservationSubmission } from '../components/ObservationPanel'
import type { MatchingSnapshot, ObservationRecord } from '../data'
import type { DomainPetProfile, MatchingResult } from './pawPalsModel'
import { formatRecordedAt } from './pawPalsModel'

interface AgentScreenProps {
  pets: readonly DomainPetProfile[]
  matchingResult: MatchingResult | null
  matchingHistory: readonly MatchingSnapshot[]
  observations: readonly ObservationRecord[]
  busy: boolean
  confirmed: boolean
  onObserve: (submission: ObservationSubmission) => Promise<void>
}

type LogItem = { id: string; recordedAt: string; title: string; detail: string }

function buildLogs(
  matchingHistory: readonly MatchingSnapshot[],
  observations: readonly ObservationRecord[],
): LogItem[] {
  return [
    ...matchingHistory.map((snapshot) => ({
      id: `matching-${snapshot.id}`,
      recordedAt: snapshot.createdAt,
      title: snapshot.status === 'confirmed' ? 'スタッフ確定' : '相性計算・部屋割り',
      detail: `${snapshot.petIds.length}頭の${snapshot.pairResults.length}ペアを記録し、${snapshot.rooms.length}室の結果を保存しました。`,
    })),
    ...observations.map((observation) => ({
      id: `observation-${observation.id}`,
      recordedAt: observation.observedAt,
      title: observation.title,
      detail: [...observation.facts, ...observation.impacts].join(' / ') || observation.recommendation,
    })),
  ].sort((left, right) => right.recordedAt.localeCompare(left.recordedAt))
}

export default function AgentScreen({
  pets,
  matchingResult,
  matchingHistory,
  observations,
  busy,
  confirmed,
  onObserve,
}: AgentScreenProps) {
  const logs = buildLogs(matchingHistory, observations)
  const hasPlan = matchingResult?.status === 'success'
  const stages = [
    { number: '01', label: '登録確認', done: pets.length > 0 },
    { number: '02', label: '相性計算', done: matchingResult !== null },
    { number: '03', label: '部屋割り', done: hasPlan },
    { number: '04', label: 'スタッフ確定', done: confirmed },
    { number: '05', label: '観測反映', done: observations.length > 0 },
  ]
  const firstPending = stages.findIndex((stage) => !stage.done)
  const observationPets = pets.map((pet) => ({
    id: pet.id,
    name: pet.name,
    breed: pet.breed,
    ageLabel: `${pet.ageYears}歳`,
    avatarUrl: pet.photoUrl,
  }))

  return (
    <section className="screen active" aria-labelledby="agent-screen-title">
      <div className="page-title">
        <div>
          <span className="eyebrow">処理と記録</span>
          <h1 id="agent-screen-title">AIエージェント</h1>
          <p>実行済みの相性計算、スタッフ確定、観測反映を保存記録から確認できます。</p>
        </div>
        <div className="date-chip">{busy ? '処理中' : '操作待ち'}</div>
      </div>
      <div className="goal-box pawpals-agent-note">
        <b>観測について</b>
        <p>観測はスタッフが確認した事実を手入力した時だけ反映します。15分ごとの自動監視は未実装です。医療判断は行いません。</p>
      </div>
      <div className="agent-layout">
        <div className="card loop-card">
          <div className="loop" aria-label="運用処理の進行状況">
            {stages.map((stage, index) => (
              <div className="pawpals-loop-fragment" key={stage.number}>
                <div className={`loop-step ${stage.done ? 'done' : index === firstPending ? 'active' : ''}`}>
                  {stage.number}<br /><b>{stage.label}</b>
                </div>
                {index < stages.length - 1 ? <span aria-hidden="true">→</span> : null}
              </div>
            ))}
          </div>
          {observations.length > 0 ? observations.slice(0, 4).map((observation) => (
            <div className="event" key={observation.id}>
              <b>{formatRecordedAt(observation.observedAt)} {observation.title}</b>
              {observation.facts.map((fact, index) => <p key={`${observation.id}-fact-${index}`}>{fact}</p>)}
              <small>{observation.recommendation}</small>
            </div>
          )) : (
            <div className="pawpals-empty"><b>観測記録はありません</b><p>スタッフが確認した事実を下のフォームから記録できます。</p></div>
          )}
        </div>
        <div className="card log-card">
          <div className="card-top">
            <div><span className="eyebrow">保存済みログ</span><h2>保存された記録</h2></div>
            <span className="live">{logs.length}件</span>
          </div>
          {logs.length > 0 ? (
            <div className="agent-log">
              {logs.slice(0, 10).map((log) => (
                <div key={log.id}>
                  <time>{formatRecordedAt(log.recordedAt)}</time>
                  <b>{log.title}</b>
                  <p>{log.detail}</p>
                </div>
              ))}
            </div>
          ) : <div className="pawpals-empty"><p>保存済みログはありません。</p></div>}
          <div className="log-foot">表示内容は施設スコープに保存された計算・確定・観測記録です。</div>
        </div>
      </div>
      <div className="pawpals-observation-shell">
        <ObservationPanel pets={observationPets} isSubmitting={busy} onSubmit={onObserve} />
      </div>
    </section>
  )
}
