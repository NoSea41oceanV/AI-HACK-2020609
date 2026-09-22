import { useEffect, useMemo, useState } from 'react';
import StaffInvitePanel from '../components/StaffInvitePanel';
import { validateManualAssignments } from '../domain/manualAssignment';
import './StaffDashboard.css';

export type PetProfile = {
  id: string;
  name: string;
  breed?: string;
  ageLabel?: string;
  sexLabel?: string;
  avatarUrl?: string;
  avatarColor?: string;
  personality?: string;
  aiSummary?: string;
  aiCautions?: string[];
  aiRecommendations?: string[];
};

export type ScoreFactor = { label: string; score: number; maxScore: number; note?: string };

export type CompatibilityPair = {
  id: string;
  petAId: string;
  petBId: string;
  totalScore: number;
  factors: ScoreFactor[];
  explanation: string;
  hardConstraints?: string[];
  aiExplanation?: string;
  aiCautions?: string[];
  aiRecommendations?: string[];
  historyLabel?: string;
};

export type RoomAssignment = {
  id: string;
  name: string;
  capacity: number;
  minOccupancy?: number;
  petIds: string[];
  averageScore: number;
  minimumScore?: number | null;
  note?: string;
};

export type StaffDashboardProps = {
  pets: PetProfile[];
  pairs: CompatibilityPair[];
  rooms: RoomAssignment[];
  selectedPairId?: string;
  isOptimizing?: boolean;
  isConfirmed?: boolean;
  updatedAtLabel?: string;
  onIssueInvite?: () => Promise<string>;
  issuedByLabel?: string;
  onSelectPair?: (pairId: string) => void;
  onRunOptimization?: () => void;
  onAssignmentsChange?: (rooms: RoomAssignment[]) => void;
  onConfirm?: (rooms: RoomAssignment[]) => void;
};

type ScoreTone = 'excellent' | 'good' | 'watch' | 'blocked';
const cloneRooms = (rooms: readonly RoomAssignment[]) => rooms.map((room) => ({ ...room, petIds: [...room.petIds] }));
const getScoreTone = (score: number, hasConstraint = false): ScoreTone => hasConstraint ? 'blocked' : score >= 80 ? 'excellent' : score >= 65 ? 'good' : 'watch';
const verdict = (score: number, hasConstraint = false) => {
  const tone = getScoreTone(score, hasConstraint);
  return { tone, label: tone === 'blocked' ? '同室不可' : tone === 'excellent' ? '好相性' : tone === 'good' ? '調整可' : '要注意' };
};

const PawMark = () => <svg aria-hidden="true" className="staff-dashboard__paw" viewBox="0 0 40 40"><path d="M19.9 19.1c-5.6 0-10.3 5.2-10.3 10 0 3.7 3 6.1 6.5 5.1 2.5-.7 5.2-.7 7.7 0 3.5 1 6.5-1.4 6.5-5.1-.1-4.8-4.8-10-10.4-10Z" /><ellipse cx="8.8" cy="17.8" rx="4.1" ry="5.4" transform="rotate(-25 8.8 17.8)" /><ellipse cx="31.2" cy="17.8" rx="4.1" ry="5.4" transform="rotate(25 31.2 17.8)" /><ellipse cx="15.2" cy="9.3" rx="4.1" ry="5.4" transform="rotate(-8 15.2 9.3)" /><ellipse cx="24.8" cy="9.3" rx="4.1" ry="5.4" transform="rotate(8 24.8 9.3)" /></svg>;
const WarningIcon = () => <svg aria-hidden="true" className="warning-icon" viewBox="0 0 24 24"><path d="M12 3.5 21 20H3L12 3.5Z" /><path d="M12 9v5m0 3v.1" /></svg>;

function PetAvatar({ pet, index, large = false }: { pet: PetProfile; index: number; large?: boolean }) {
  return <span className={`pet-avatar ${large ? 'pet-avatar--large' : ''}`} style={{ backgroundColor: pet.avatarColor ?? ['#dfe9dd', '#f3dfd3', '#e6e1d6', '#dce8e2'][index % 4] }}>{pet.avatarUrl ? <img alt="" src={pet.avatarUrl} /> : pet.name.slice(0, 1)}</span>;
}

export function StaffDashboard({ pets, pairs, rooms, selectedPairId, isOptimizing = false, isConfirmed = false, updatedAtLabel = 'たった今更新', onIssueInvite, issuedByLabel, onSelectPair, onRunOptimization, onAssignmentsChange, onConfirm }: StaffDashboardProps) {
  const [internalPairId, setInternalPairId] = useState<string>();
  const [focusPetId, setFocusPetId] = useState(() => pairs.find((pair) => pair.id === selectedPairId)?.petAId ?? pairs[0]?.petAId ?? pets[0]?.id);
  const [draftRooms, setDraftRooms] = useState<RoomAssignment[]>(() => cloneRooms(rooms));
  useEffect(() => setDraftRooms(cloneRooms(rooms)), [rooms]);
  useEffect(() => {
    if (!focusPetId || !pets.some((pet) => pet.id === focusPetId)) setFocusPetId(pets[0]?.id);
  }, [focusPetId, pets]);

  const petsById = useMemo(() => new Map(pets.map((pet) => [pet.id, pet])), [pets]);
  const pairByPetIds = useMemo(() => {
    const map = new Map<string, CompatibilityPair>();
    for (const pair of pairs) { map.set(`${pair.petAId}:${pair.petBId}`, pair); map.set(`${pair.petBId}:${pair.petAId}`, pair); }
    return map;
  }, [pairs]);
  const activePairId = selectedPairId ?? internalPairId ?? pairs[0]?.id;
  const activePair = pairs.find((pair) => pair.id === activePairId);
  const focusPet = focusPetId ? petsById.get(focusPetId) : undefined;
  const selectedPetIds = activePair && focusPetId && (activePair.petAId === focusPetId || activePair.petBId === focusPetId)
    ? [focusPetId, activePair.petAId === focusPetId ? activePair.petBId : activePair.petAId]
    : activePair ? [activePair.petAId, activePair.petBId] : [];
  const activeVerdict = activePair ? verdict(activePair.totalScore, (activePair.hardConstraints?.length ?? 0) > 0) : null;
  const candidates = useMemo(() => pairs.filter((pair) => pair.petAId === focusPetId || pair.petBId === focusPetId).map((pair) => ({ pair, partnerId: pair.petAId === focusPetId ? pair.petBId : pair.petAId })).sort((left, right) => right.pair.totalScore - left.pair.totalScore), [focusPetId, pairs]);
  const hasAiAnalysis = pets.some((pet) => Boolean(pet.aiSummary));

  const scoredDraftRooms = useMemo(() => draftRooms.map((room) => {
    const scores: number[] = [];
    for (let left = 0; left < room.petIds.length; left += 1) for (let right = left + 1; right < room.petIds.length; right += 1) {
      const pair = pairByPetIds.get(`${room.petIds[left]}:${room.petIds[right]}`);
      if (pair) scores.push(pair.totalScore);
    }
    const averageScore = scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 100;
    const minimumScore = scores.length ? Math.min(...scores) : null;
    return { ...room, averageScore, minimumScore, note: minimumScore === null ? '単独利用のためペアスコアはありません。' : `室内の最低相性は ${minimumScore}点です。` };
  }), [draftRooms, pairByPetIds]);
  const assignmentValidation = useMemo(() => validateManualAssignments(
    pets.map(({ id, name }) => ({ id, name })),
    scoredDraftRooms.map(({ id, name, capacity, minOccupancy, petIds }) => ({ id, name, capacity, minOccupancy, petIds })),
    pairs.map((pair) => ({ petAId: pair.petAId, petBId: pair.petBId, allowed: (pair.hardConstraints?.length ?? 0) === 0 })),
  ), [pairs, pets, scoredDraftRooms]);

  const selectPair = (pair: CompatibilityPair) => { setInternalPairId(pair.id); onSelectPair?.(pair.id); };
  const updateRoomSlot = (roomId: string, slotIndex: number, petId: string) => {
    const next = draftRooms.map((room) => {
      if (room.id !== roomId) return room;
      const slots = Array.from({ length: room.capacity }, (_, index) => room.petIds[index] ?? '');
      slots[slotIndex] = petId;
      return { ...room, petIds: slots.filter(Boolean) };
    });
    setDraftRooms(next);
    onAssignmentsChange?.(next);
  };
  const resetOptimization = () => { setDraftRooms(cloneRooms(rooms)); onAssignmentsChange?.(rooms); onRunOptimization?.(); };

  return <main className="staff-dashboard">
    <header className="staff-dashboard__header">
      <a className="staff-dashboard__brand" href="#compatibility-record" aria-label="PAWPAIR 相性カルテ"><span className="staff-dashboard__brand-mark"><PawMark /></span><span>PAWPAIR</span></a>
      <nav className="staff-dashboard__steps" aria-label="スタッフ業務の進行"><a href="#registered-pets"><span>1</span>登録Pet</a><a className="is-active" href="#compatibility-record" aria-current="step"><span>2</span>相性カルテ</a><a href="#room-assignment"><span>3</span>部屋割り確定</a></nav>
      <div className="staff-dashboard__data-state"><span className={hasAiAnalysis ? 'is-ready' : 'is-idle'}>{hasAiAnalysis ? 'AI解析データあり' : 'AI解析データ未取得'}</span><small>{updatedAtLabel}</small></div>
    </header>

    <section className="staff-dashboard__actions" aria-label="次に確認する業務">
      <a href="#today-pets"><span>今日預かるPet一覧</span><strong>未設定</strong><small>当日受付データの連携状況を確認</small></a>
      <a href="#registration-requests"><span>承認待ち</span><strong>未設定</strong><small>承認フローの連携状況を確認</small></a>
    </section>

    <section className="staff-dashboard__intro" id="compatibility-record"><p>登録プロフィールから算定</p><div><h1>相性カルテ</h1><button className="button button--secondary" disabled={isOptimizing || pets.length === 0} onClick={resetOptimization} type="button">{isOptimizing ? '再計算しています…' : 'おすすめを再計算'}</button></div><span>全ペアの採点 → 安全制約 → スタッフ確認の順で判断します。</span></section>

    <div className="staff-dashboard__workspace">
      <section className="compatibility-record" aria-labelledby="pair-detail-title">
        <div className="pair-picker">
          <label><span>選択するPet</span><select value={focusPetId ?? ''} onChange={(event) => { setFocusPetId(event.target.value); const next = pairs.find((pair) => pair.petAId === event.target.value || pair.petBId === event.target.value); if (next) selectPair(next); }}>{pets.map((pet) => <option key={pet.id} value={pet.id}>{pet.name}</option>)}</select></label>
          <span aria-hidden="true">×</span>
          <label><span>比較する相手</span><select value={activePair ? (activePair.petAId === focusPetId ? activePair.petBId : activePair.petAId) : ''} onChange={(event) => { const next = pairByPetIds.get(`${focusPetId}:${event.target.value}`); if (next) selectPair(next); }}>{candidates.map(({ partnerId }) => <option key={partnerId} value={partnerId}>{petsById.get(partnerId)?.name ?? partnerId}</option>)}</select></label>
        </div>

        {activePair && activeVerdict ? <div className="compatibility-record__body">
          <div className="selected-pets">{selectedPetIds.map((petId, index) => { const pet = petsById.get(petId); return pet ? <article key={pet.id}><PetAvatar pet={pet} index={pets.findIndex((candidate) => candidate.id === pet.id)} large /><div><h2 id={index === 0 ? 'pair-detail-title' : undefined}>{pet.name}</h2><p>{pet.personality || '性格情報は未登録です'}</p></div></article> : null; })}</div>
          <div className="compatibility-score"><div><strong>{activePair.totalScore}</strong><span>/100</span></div><span className={`verdict verdict--${activeVerdict.tone}`}>{activeVerdict.label}</span><p>ハード制約: <strong>{(activePair.hardConstraints?.length ?? 0) > 0 ? `${activePair.hardConstraints?.length}件あり` : '該当なし'}</strong></p></div>
          <div className="score-breakdown" aria-label="評価内訳">{activePair.factors.map((factor) => { const percentage = factor.maxScore ? Math.round(factor.score / factor.maxScore * 100) : 0; return <div className="score-factor" key={factor.label}><span>{factor.label}</span><strong>{factor.score}/{factor.maxScore}</strong><i><b style={{ width: `${percentage}%` }} /></i></div>; })}</div>
          <div className="analysis-grid">
            <article><h3>スコア算定の説明</h3><p>{activePair.explanation}</p><small>登録プロフィールと採点規則から生成</small></article>
            <article className={activePair.aiExplanation ? '' : 'is-unavailable'}><h3>AI解析による説明</h3><p>{activePair.aiExplanation || 'このペアには保存済みのAI解析データがありません。'}</p><small>{activePair.aiExplanation ? '飼い主入力時に保存された解析結果' : 'AIが稼働中であることを示す表示ではありません'}</small></article>
            <article><h3>注意点</h3>{(activePair.aiCautions?.length ?? 0) > 0 ? <ul>{activePair.aiCautions?.map((item) => <li key={item}>{item}</li>)}</ul> : <p>AI解析由来の注意点は未登録です。初回は距離を取り、スタッフが反応を観察してください。</p>}</article>
            <article><h3>推奨対応</h3>{(activePair.aiRecommendations?.length ?? 0) > 0 ? <ul>{activePair.aiRecommendations?.map((item) => <li key={item}>{item}</li>)}</ul> : <p>AI解析由来の推奨は未登録です。短時間の対面から始め、落ち着きを確認して延長してください。</p>}</article>
          </div>
          {(activePair.hardConstraints?.length ?? 0) > 0 ? <div className="constraint-alert" role="alert"><WarningIcon /><div><strong>このペアは同室にできません</strong>{activePair.hardConstraints?.map((item) => <span key={item}>{item}</span>)}</div></div> : null}
        </div> : <p className="empty-copy">比較できるペアがありません。</p>}
      </section>

      <aside className="candidate-list" aria-labelledby="candidate-list-title"><header><p>全候補</p><h2 id="candidate-list-title">{focusPet?.name ?? '選択中のPet'}から見た相性</h2></header><div className="candidate-list__table-wrap"><table><thead><tr><th>相手・性格</th><th>スコア</th><th>判定</th><th>実績 / 注意点</th></tr></thead><tbody>{candidates.map(({ pair, partnerId }) => { const partner = petsById.get(partnerId); const pairVerdict = verdict(pair.totalScore, (pair.hardConstraints?.length ?? 0) > 0); return <tr className={pair.id === activePairId ? 'is-selected' : ''} key={pair.id}><td><button type="button" onClick={() => selectPair(pair)}><strong>{partner?.name ?? partnerId}</strong><small>{partner?.personality || '性格未登録'}</small></button></td><td><strong>{pair.totalScore}</strong></td><td><span className={`verdict verdict--${pairVerdict.tone}`}>{pairVerdict.label}</span></td><td>{pair.historyLabel ?? ((pair.hardConstraints?.length ?? 0) > 0 ? '安全制約あり' : '交流実績データなし')}</td></tr>; })}</tbody></table></div></aside>
    </div>

    <section className="pet-directory" id="registered-pets" aria-labelledby="pet-directory-title"><div className="section-heading"><div><p>登録プロフィール</p><h2 id="pet-directory-title">Petごとの性格と候補相性</h2></div><span>{pets.length}頭</span></div><div className="pet-directory__grid">{pets.map((pet, index) => { const petPairs = pairs.filter((pair) => pair.petAId === pet.id || pair.petBId === pet.id).sort((a, b) => b.totalScore - a.totalScore); return <article key={pet.id}><header><PetAvatar pet={pet} index={index} /><div><h3>{pet.name}</h3><p>{[pet.breed, pet.ageLabel, pet.sexLabel].filter(Boolean).join('・') || 'プロフィール登録済み'}</p></div></header><p>{pet.personality || '性格情報は未登録です。'}</p><ul>{petPairs.slice(0, 3).map((pair) => { const partnerId = pair.petAId === pet.id ? pair.petBId : pair.petAId; const tone = verdict(pair.totalScore, (pair.hardConstraints?.length ?? 0) > 0); return <li key={pair.id}><span>{petsById.get(partnerId)?.name ?? partnerId}</span><strong className={`score-text score-text--${tone.tone}`}>{tone.label} {pair.totalScore}</strong></li>; })}</ul></article>; })}</div></section>

    <section className="room-results" id="room-assignment" aria-labelledby="room-results-title">
      <div className="section-heading section-heading--row"><div><p>手動調整・最終確定</p><h2 id="room-results-title">部屋ごとの組み合わせ</h2><span>各枠を変更すると、安全制約と未割当をその場で検証します。</span></div><strong className="room-results__overall">全体平均 <span>{scoredDraftRooms.length ? Math.round(scoredDraftRooms.reduce((sum, room) => sum + room.averageScore, 0) / scoredDraftRooms.length) : 0}</span>点</strong></div>
      <div className="room-results__grid">{scoredDraftRooms.map((room, roomIndex) => <article className="room-card" key={room.id}><header><span>{String(roomIndex + 1).padStart(2, '0')}</span><div><h3>{room.name}</h3><p>{room.petIds.length} / {room.capacity}頭</p></div><strong>{room.averageScore}<small>平均</small></strong></header><div className="room-card__slots">{Array.from({ length: room.capacity }, (_, slotIndex) => <label key={`${room.id}-${slotIndex}`}><span>枠 {slotIndex + 1}</span><select value={room.petIds[slotIndex] ?? ''} onChange={(event) => updateRoomSlot(room.id, slotIndex, event.target.value)}><option value="">未割当</option>{pets.map((pet) => <option key={pet.id} value={pet.id}>{pet.name}</option>)}</select></label>)}</div><p className="room-card__note">{room.note}</p></article>)}</div>
      <div className={`assignment-check ${assignmentValidation.valid ? 'is-valid' : 'is-invalid'}`} role={assignmentValidation.valid ? 'status' : 'alert'}><strong>{assignmentValidation.valid ? '確定できます' : `確定前に ${assignmentValidation.issues.length}件の修正が必要です`}</strong>{assignmentValidation.valid ? <span>重複・定員・安全制約・未割当を確認済みです。</span> : <ul>{assignmentValidation.issues.map((issue, index) => <li key={`${issue.code}-${index}`}>{issue.message}</li>)}</ul>}</div>
      <footer className="room-results__footer"><p><strong>最終決定は施設スタッフが行います。</strong> 内容を確認してから保存してください。</p><button className="button button--primary" disabled={!assignmentValidation.valid || scoredDraftRooms.length === 0 || isOptimizing || isConfirmed} onClick={() => onConfirm?.(scoredDraftRooms)} type="button">{isConfirmed ? 'この部屋割りで確定済み' : '検証済みの部屋割りを確定'}</button></footer>
    </section>

    <section className="operation-targets" aria-label="業務情報の確認状況"><article id="today-pets"><h2>今日預かるPet一覧</h2><strong>当日の預かり情報はまだ確認できません</strong><p>登録Pet一覧でプロフィールと相性を確認できます。</p><a href="#registered-pets">登録Pet一覧を見る</a></article><article id="registration-requests"><h2>承認待ち</h2><strong>承認待ち件数はまだ確認できません</strong><p>受付内容は登録Pet一覧から確認してください。</p><a href="#registered-pets">登録Pet一覧を見る</a></article></section>
    {onIssueInvite ? <div className="staff-dashboard__invite"><StaffInvitePanel onIssue={onIssueInvite} issuedByLabel={issuedByLabel} /></div> : null}
  </main>;
}

export default StaffDashboard;
