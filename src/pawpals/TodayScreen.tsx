import type { MatchingSnapshot, ObservationRecord } from '../data'
import type { DomainPetProfile, MatchingResult, RoomDefinition } from './pawPalsModel'
import { formatRecordedAt, petById, roomName } from './pawPalsModel'

interface TodayScreenProps {
  pets: readonly DomainPetProfile[]
  matchingResult: MatchingResult | null
  rooms: readonly RoomDefinition[]
  matchingHistory: readonly MatchingSnapshot[]
  observations: readonly ObservationRecord[]
  busy: boolean
  confirmed: boolean
  onOptimize: () => void | Promise<void>
  onConfirm: () => void | Promise<void>
}

type ActivityItem = { id: string; recordedAt: string; title: string; detail: string }

function recentActivity(
  matchingHistory: readonly MatchingSnapshot[],
  observations: readonly ObservationRecord[],
): ActivityItem[] {
  return [
    ...matchingHistory.map((snapshot) => ({
      id: `matching-${snapshot.id}`,
      recordedAt: snapshot.createdAt,
      title: snapshot.status === 'confirmed' ? '部屋割りをスタッフが確定' : '部屋割り案を保存',
      detail: `${snapshot.petIds.length}頭・${snapshot.pairResults.length}ペア・${snapshot.rooms.length}室`,
    })),
    ...observations.map((observation) => ({
      id: `observation-${observation.id}`,
      recordedAt: observation.observedAt,
      title: observation.title,
      detail: observation.recommendation,
    })),
  ].sort((left, right) => right.recordedAt.localeCompare(left.recordedAt)).slice(0, 6)
}

export default function TodayScreen({
  pets,
  matchingResult,
  rooms,
  matchingHistory,
  observations,
  busy,
  confirmed,
  onOptimize,
  onConfirm,
}: TodayScreenProps) {
  const petIndex = petById(pets)
  const assignedRooms = matchingResult?.status === 'success' ? matchingResult.rooms : []
  const activity = recentActivity(matchingHistory, observations)
  const pairCount = matchingResult?.pairResults.length ?? 0
  const stateLabel = busy ? '処理中' : confirmed ? '確定済み' : matchingResult ? '確認待ち' : '未計算'

  return (
    <section className="screen active" aria-labelledby="today-screen-title">
      <div className="page-title">
        <div>
          <span className="eyebrow">今日の運営</span>
          <h1 id="today-screen-title">今日の運営</h1>
          <p>登録済みプロフィールを使った相性計算と部屋割りをスタッフが確認します。</p>
        </div>
        <div className="date-chip">登録犬：{pets.length}頭</div>
      </div>

      <div className="kpis">
        <div className="kpi"><b>{pets.length}</b><span>登録済みの犬</span></div>
        <div className="kpi"><b>{assignedRooms.length}</b><span>計算用の暫定部屋</span></div>
        <div className="kpi"><b>{pairCount}</b><span>採点済みペア</span></div>
        <div className="kpi"><b>{stateLabel}</b><span>現在の計算状態</span></div>
      </div>

      <div className="two-col">
        <div className="card">
          <div className="card-top">
            <div><span className="eyebrow">部屋割りの計画</span><h2>グループ編成案</h2></div>
            <span className={`status ${confirmed ? '' : 'warning'}`}>{stateLabel}</span>
          </div>
          <div className="goal-box">
            <b>計算対象</b>
            <p>登録済みの{pets.length}頭について、ハード制約を先に確認してから6因子の相性スコアで部屋割りを計算します。</p>
            <small>登録犬は当日の預かり確定情報とは連動していません。表示する部屋は施設設定ではなく、計算用の暫定枠です。</small>
          </div>

          {matchingResult?.status === 'success' ? matchingResult.rooms.map((assignment, index) => (
            <div className="group-row proposed" key={assignment.roomId}>
              <div className="group-name">
                <b>GROUP {index + 1}</b>
                <span>{roomName(rooms, assignment.roomId)}</span>
              </div>
              <div className="dog-names">
                {assignment.petIds.map((petId) => petIndex.get(petId)?.name ?? petId).join(' ・ ') || '割り当てなし'}
              </div>
              <span className="verdict good">制約通過</span>
            </div>
          )) : (
            <div className="pawpals-empty">
              <b>{matchingResult?.status === 'infeasible' ? '編成案を作成できませんでした' : '計算結果はまだありません'}</b>
              <p>{matchingResult?.status === 'infeasible' ? matchingResult.message : '登録後に「部屋割りを再計算」を実行してください。'}</p>
            </div>
          )}

          {matchingResult ? (
            <div className="reason-box">
              <b>計算結果</b>
              <p>{matchingResult.status === 'success'
                ? `全${matchingResult.pairResults.length}ペアを評価し、${matchingResult.rooms.length}個の暫定グループへ割り当てました。合計相性スコアは${matchingResult.totalCompatibilityScore}点です。`
                : matchingResult.message}</p>
            </div>
          ) : null}

          <div className="approval">
            <div><b>スタッフ操作</b><small>保存と最終確定は操作担当者が実行します。</small></div>
            <div className="approval-buttons">
              <button className="secondary" type="button" disabled={busy || pets.length === 0} onClick={() => void onOptimize()}>
                {busy ? '計算中…' : '部屋割りを再計算'}
              </button>
              <button className="primary" type="button" disabled={busy || matchingResult?.status !== 'success' || confirmed} onClick={() => void onConfirm()}>
                {confirmed ? '確定済み' : 'この編成を確定'}
              </button>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-top"><div><span className="eyebrow">保存済みの活動</span><h2>最新の記録</h2></div></div>
          {activity.length > 0 ? (
            <div className="timeline">
              {activity.map((item) => (
                <div key={item.id}>
                  <time>{formatRecordedAt(item.recordedAt)}</time>
                  <b>{item.title}</b>
                  <p>{item.detail}</p>
                </div>
              ))}
            </div>
          ) : <div className="pawpals-empty"><p>保存済みの計算・観測記録はありません。</p></div>}
        </div>
      </div>
    </section>
  )
}
