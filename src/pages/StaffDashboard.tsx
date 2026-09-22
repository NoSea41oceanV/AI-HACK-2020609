import { useEffect, useMemo, useState } from 'react';
import './StaffDashboard.css';
import StaffInvitePanel from '../components/StaffInvitePanel';
export type PetProfile = {
    id: string;
    name: string;
    breed?: string;
    ageLabel?: string;
    sexLabel?: string;
    avatarUrl?: string;
    avatarColor?: string;
    personalitySummary?: string;
    personalityTraits?: string[];
    energyLevel?: number;
    sociability?: number;
    anxietyLevel?: number;
    assertiveness?: number;
    resourceGuarding?: number;
    playStyles?: string[];
    registrationLabel?: string;
    cautionLabel?: string;
};
export type ScoreFactor = {
    label: string;
    score: number;
    maxScore: number;
    note?: string;
};
export type CompatibilityPair = {
    id: string;
    petAId: string;
    petBId: string;
    totalScore: number;
    factors: ScoreFactor[];
    explanation: string;
    reasons?: string[];
    cautions?: string[];
    recommendation?: string;
    hardConstraints?: string[];
};
export type RoomAssignment = {
    id: string;
    name: string;
    capacity: number;
    minOccupancy?: number;
    petIds: string[];
    averageScore: number;
    note?: string;
};
export type StaffDashboardProps = {
    pets: PetProfile[];
    registrationPets?: PetProfile[];
    pairs: CompatibilityPair[];
    rooms: RoomAssignment[];
    pendingApprovalCount?: number;
    selectedPairId?: string;
    isOptimizing?: boolean;
    isConfirmed?: boolean;
    assignmentBaselineLabel?: string;
    updatedAtLabel?: string;
    onIssueInvite?: () => Promise<string>;
    issuedByLabel?: string;
    onSelectPair?: (pairId: string) => void;
    onRunOptimization?: () => void;
    onConfirm?: (rooms: RoomAssignment[], changed: boolean) => void;
};
type ScoreTone = 'excellent' | 'good' | 'watch' | 'blocked';
type DraftIssue = {
    id: string;
    message: string;
};
const PLAY_STYLE_LABELS: Record<string, string> = {
    chase: '追いかけっこ', wrestle: 'じゃれ合い', tug: '引っ張り遊び',
    fetch: '持ってこい', gentle: '穏やかな交流', solo: 'ひとり遊び',
};
const getScoreTone = (score: number, blocked = false): ScoreTone => blocked ? 'blocked' : score >= 80 ? 'excellent' : score >= 65 ? 'good' : 'watch';
const WarningIcon = () => <svg aria-hidden="true" className="warning-icon" viewBox="0 0 24 24"><path d="M12 3.5 21 20H3L12 3.5Z"/><path d="M12 9v5m0 3v.1"/></svg>;
const findRoomId = (items: readonly RoomAssignment[], petId: string) => items.find((room) => room.petIds.includes(petId))?.id ?? '';
const assignmentKey = (items: readonly RoomAssignment[]) => items.map((room) => `${room.id}:${[...room.petIds].sort().join(',')}`).sort().join('|');
export function StaffDashboard({ pets, registrationPets, pairs, rooms, pendingApprovalCount = 0, selectedPairId, isOptimizing = false, isConfirmed = false, assignmentBaselineLabel = 'AI提案', updatedAtLabel = 'たった今更新', onIssueInvite, issuedByLabel, onSelectPair, onRunOptimization, onConfirm, }: StaffDashboardProps) {
    const [internalPairId, setInternalPairId] = useState<string>();
    const [activePetId, setActivePetId] = useState<string>();
    const [draftRooms, setDraftRooms] = useState<RoomAssignment[]>(rooms);
    useEffect(() => setDraftRooms(rooms.map((room) => ({ ...room, petIds: [...room.petIds] }))), [rooms]);
    const todayRows = registrationPets ?? pets;
    const petsById = useMemo(() => new Map(pets.map((pet) => [pet.id, pet])), [pets]);
    const todayRowsById = useMemo(() => new Map(todayRows.map((pet) => [pet.id, pet])), [todayRows]);
    const pairByPetIds = useMemo(() => {
        const map = new Map<string, CompatibilityPair>();
        for (const pair of pairs) {
            map.set(`${pair.petAId}:${pair.petBId}`, pair);
            map.set(`${pair.petBId}:${pair.petAId}`, pair);
        }
        return map;
    }, [pairs]);
    const activePairId = selectedPairId ?? internalPairId ?? pairs[0]?.id;
    const activePair = pairs.find((pair) => pair.id === activePairId);
    const activePet = todayRowsById.get(activePetId ?? '') ?? todayRows[0];
    const activePairNames = activePair ? [petsById.get(activePair.petAId)?.name, petsById.get(activePair.petBId)?.name].filter(Boolean).join(' × ') : '';
    const constrainedPairs = pairs.filter((pair) => (pair.hardConstraints?.length ?? 0) > 0);
    const draftIssues = useMemo(() => {
        const issues: DraftIssue[] = [];
        const placements = new Map<string, string[]>();
        for (const room of draftRooms) {
            if (room.petIds.length > room.capacity)
                issues.push({ id: `capacity-${room.id}`, message: `${room.name}は定員${room.capacity}頭を超えています。` });
            if (room.minOccupancy && room.petIds.length < room.minOccupancy)
                issues.push({ id: `minimum-${room.id}`, message: `${room.name}は最低${room.minOccupancy}頭が必要です。` });
            for (const petId of room.petIds)
                placements.set(petId, [...(placements.get(petId) ?? []), room.id]);
            for (let left = 0; left < room.petIds.length; left += 1)
                for (let right = left + 1; right < room.petIds.length; right += 1) {
                    const pair = pairByPetIds.get(`${room.petIds[left]}:${room.petIds[right]}`);
                    if ((pair?.hardConstraints?.length ?? 0) > 0)
                        issues.push({ id: `blocked-${room.id}-${pair?.id}`, message: `${room.name}に同室不可の組み合わせがあります。` });
                }
        }
        for (const pet of pets) {
            const placed = placements.get(pet.id) ?? [];
            if (!placed.length)
                issues.push({ id: `unassigned-${pet.id}`, message: `${pet.name}が未割当です。` });
            if (placed.length > 1)
                issues.push({ id: `duplicate-${pet.id}`, message: `${pet.name}が複数の部屋に重複しています。` });
        }
        return issues;
    }, [draftRooms, pairByPetIds, pets]);
    const hasChanges = assignmentKey(rooms) !== assignmentKey(draftRooms);
    const attentionCount = new Set([
        ...todayRows.filter((pet) => pet.cautionLabel).map((pet) => `pet:${pet.id}`),
        ...constrainedPairs.map((pair) => `pair:${pair.id}`),
    ]).size;
    const unassignedCount = draftIssues.filter((issue) => issue.id.startsWith('unassigned-')).length;
    const activeCandidates = useMemo(() => activePet ? pairs
        .filter((pair) => pair.petAId === activePet.id || pair.petBId === activePet.id)
        .sort((left, right) => Number((left.hardConstraints?.length ?? 0) > 0) - Number((right.hardConstraints?.length ?? 0) > 0) || right.totalScore - left.totalScore) : [], [activePet, pairs]);
    const reveal = (id: string) => window.setTimeout(() => {
        const element = document.getElementById(id);
        element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        element?.focus({ preventScroll: true });
    }, 0);
    const selectPair = (pair: CompatibilityPair) => { setInternalPairId(pair.id); onSelectPair?.(pair.id); reveal('pair-detail-title'); };
    const selectPet = (petId: string) => { setActivePetId(petId); reveal('pet-detail-title'); };
    const movePet = (petId: string, roomId: string) => setDraftRooms((current) => current.map((room) => ({
        ...room, petIds: room.id === roomId ? [...room.petIds.filter((id) => id !== petId), petId] : room.petIds.filter((id) => id !== petId),
    })));
    const resetDraft = () => setDraftRooms(rooms.map((room) => ({ ...room, petIds: [...room.petIds] })));
    return <main className="staff-dashboard">
    <header className="staff-dashboard__header"><div><span className="staff-dashboard__brand">PAWPAIR</span><h1>本日のケア・マッチング</h1><p>登録状況、注意点、相性と部屋割りを一つの画面で確認します。</p></div><span className="staff-dashboard__updated" aria-label={`データ更新: ${updatedAtLabel}`}><i />{updatedAtLabel}</span></header>

    <nav className="operations-summary" aria-label="対応件数">
      <a href="#assignment-review"><span>承認待ち</span><strong>{pendingApprovalCount}</strong><small>{pendingApprovalCount ? '最新案を確認' : '対応なし'}</small></a>
      <a href="#today-pets"><span>割当対象</span><strong>{pets.length}</strong><small>{pets.length ? '登録プロフィールから採点' : '対象なし'}</small></a>
      <a href="#attention-list"><span>要注意</span><strong>{attentionCount}</strong><small>{attentionCount ? 'カルテを確認' : '注意なし'}</small></a>
      <a href="#assignment-review"><span>未割当</span><strong>{unassignedCount}</strong><small>{unassignedCount ? '割当が必要' : '全頭割当済み'}</small></a>
    </nav>

    {onIssueInvite ? <StaffInvitePanel onIssue={onIssueInvite} issuedByLabel={issuedByLabel}/> : null}

    <section className="today-pets panel" id="today-pets" aria-labelledby="today-pets-title">
      <div className="section-heading"><div><h2 id="today-pets-title">登録Pet一覧</h2><p>来園日データが未登録のため、現在は登録済みの割当対象と受付後の反映待ちを表示します。飼い主の連絡先などは表示しません。</p></div><span>{pets.length}頭が割当対象・{todayRows.length}件受付</span></div>
      {todayRows.length ? <div className="today-pets__table-wrap"><table className="today-pets__table"><thead><tr><th>Pet</th><th>登録状況</th><th>割当状況</th><th>要注意点</th><th><span className="sr-only">詳細</span></th></tr></thead><tbody>{todayRows.map((pet, index) => {
                const room = draftRooms.find((item) => item.petIds.includes(pet.id));
                const isMatchingTarget = petsById.has(pet.id);
                return <tr key={pet.id}><th scope="row"><span className="pet-identity"><i className="pet-avatar" style={{ backgroundColor: pet.avatarColor ?? ['#e2eee8', '#fce8df', '#e8e5f2', '#f8edcf'][index % 4] }}>{pet.avatarUrl ? <img alt="" src={pet.avatarUrl}/> : pet.name.slice(0, 1)}</i><span><strong>{pet.name}</strong><small>{[pet.breed, pet.ageLabel, pet.sexLabel].filter(Boolean).join('・')}</small></span></span></th><td><span className="status-label status-label--ready">{pet.registrationLabel ?? '登録済み'}</span></td><td><span className={room ? 'status-label status-label--assigned' : 'status-label status-label--warning'}>{room?.name ?? (isMatchingTarget ? '未割当' : '採点待ち')}</span></td><td>{pet.cautionLabel ? <span className="attention-text"><WarningIcon />{pet.cautionLabel}</span> : <span className="muted-text">特記事項なし</span>}</td><td><button className="text-button" type="button" onClick={() => selectPet(pet.id)}>詳細を見る</button></td></tr>;
            })}</tbody></table></div> : <div className="empty-state" role="status"><strong>登録Petは0頭です</strong><p>登録情報が反映されると、ここに割当状況が表示されます。</p></div>}
    </section>

    {activePet ? <section className="pet-detail panel" aria-labelledby="pet-detail-title"><div className="section-heading"><div><h2 id="pet-detail-title" tabIndex={-1}>{activePet.name}の性格と候補相性</h2><p>{activePet.personalitySummary || '登録された行動プロフィールから、ケア判断に必要な特徴を表示しています。'}</p></div></div><div className="pet-detail__grid"><div className="trait-summary"><h3>性格情報</h3><div className="trait-summary__tags">{(activePet.personalityTraits?.length ? activePet.personalityTraits : activePet.playStyles?.map((style) => PLAY_STYLE_LABELS[style] ?? style) ?? ['情報を確認中']).map((trait) => <span key={trait}>{trait}</span>)}</div><dl>{[
                ['活動量', activePet.energyLevel], ['社交性', activePet.sociability], ['不安傾向', activePet.anxietyLevel], ['自己主張', activePet.assertiveness], ['資源防衛', activePet.resourceGuarding],
            ].map(([label, value]) => <div key={String(label)}><dt>{label}</dt><dd><span><i style={{ width: `${Math.max(0, Math.min(5, Number(value ?? 0))) * 20}%` }}/></span><b>{value ?? '—'}/5</b></dd></div>)}</dl></div><div className="candidate-list"><h3>各候補との評価</h3>{activeCandidates.length ? <ol>{activeCandidates.map((pair) => {
                    const otherId = pair.petAId === activePet.id ? pair.petBId : pair.petAId;
                    const other = petsById.get(otherId);
                    const blocked = (pair.hardConstraints?.length ?? 0) > 0;
                    return <li key={pair.id}><button type="button" onClick={() => selectPair(pair)}><span><strong>{other?.name ?? otherId}</strong><small>{blocked ? '同室不可' : pair.recommendation ?? '相性カルテを確認'}</small></span><b className={`score-text score-text--${getScoreTone(pair.totalScore, blocked)}`}>{blocked ? '要確認' : `${pair.totalScore}点`}</b></button></li>;
                })}</ol> : <p className="muted-text">比較できる候補がまだいません。</p>}</div></div></section> : null}

    {constrainedPairs.length ? <aside className="constraint-alert" role="alert"><WarningIcon /><div><strong>同室にできない組み合わせが{constrainedPairs.length}組あります</strong><span>相性カルテと部屋割りの検証結果を確認してください。</span></div></aside> : null}
    <section className="attention-list panel" id="attention-list" aria-labelledby="attention-list-title"><div className="section-heading"><div><h2 id="attention-list-title">要注意の対象</h2><p>件数サマリーから移動した確認一覧です。</p></div><span>{attentionCount}件</span></div>{attentionCount ? <ul>{todayRows.filter((pet) => pet.cautionLabel).map((pet) => <li key={`pet-${pet.id}`}><span><strong>{pet.name}</strong><small>{pet.cautionLabel}</small></span><button className="text-button" type="button" onClick={() => selectPet(pet.id)}>犬の詳細へ</button></li>)}{constrainedPairs.map((pair) => <li key={`pair-${pair.id}`}><span><strong>{petsById.get(pair.petAId)?.name ?? pair.petAId} × {petsById.get(pair.petBId)?.name ?? pair.petBId}</strong><small>{pair.hardConstraints?.join(' / ')}</small></span><button className="text-button" type="button" onClick={() => selectPair(pair)}>相性カルテへ</button></li>)}</ul> : <div className="empty-state"><strong>要注意は0件です</strong><p>追加確認が必要な登録・ペアはありません。</p></div>}</section>

    <div className="matching-workspace" id="matching"><section className="compatibility-panel panel" aria-labelledby="compatibility-title"><div className="section-heading"><div><h2 id="compatibility-title">全ペア相性表</h2><p>点数を選ぶと、理由・注意点・推奨対応を表示します。</p></div></div><div className="compatibility-table-wrap"><table className="compatibility-table"><caption className="sr-only">登録ペット全組み合わせの相性スコア</caption><thead><tr><th>Pet</th>{pets.map((pet) => <th key={pet.id}>{pet.name}</th>)}</tr></thead><tbody>{pets.map((rowPet) => <tr key={rowPet.id}><th>{rowPet.name}</th>{pets.map((columnPet) => {
                if (rowPet.id === columnPet.id)
                    return <td className="compatibility-table__self" key={columnPet.id}>—</td>;
                const pair = pairByPetIds.get(`${rowPet.id}:${columnPet.id}`);
                if (!pair)
                    return <td className="compatibility-table__empty" key={columnPet.id}>未</td>;
                const blocked = (pair.hardConstraints?.length ?? 0) > 0;
                return <td key={columnPet.id}><button aria-label={`${rowPet.name}と${columnPet.name}の相性 ${pair.totalScore}点${blocked ? '、同室不可' : ''}`} aria-pressed={pair.id === activePairId} className={`score-cell score-cell--${getScoreTone(pair.totalScore, blocked)}`} onClick={() => selectPair(pair)} type="button">{blocked ? <WarningIcon /> : pair.totalScore}</button></td>;
            })}</tr>)}</tbody></table></div></section>
      <aside className="pair-detail panel" aria-labelledby="pair-detail-title"><div className="section-heading"><div><h2 id="pair-detail-title" tabIndex={-1}>相性カルテ</h2><p>{activePairNames || '表からペアを選択'}</p></div></div>{activePair ? <div className="pair-detail__body"><div className={`pair-detail__score score-text--${getScoreTone(activePair.totalScore, (activePair.hardConstraints?.length ?? 0) > 0)}`}><strong>{activePair.totalScore}</strong><span>/100</span></div><section><h3>相性の理由</h3><ul>{(activePair.reasons?.length ? activePair.reasons : [activePair.explanation]).map((item) => <li key={item}>{item}</li>)}</ul></section><section><h3>注意点</h3><ul>{[...(activePair.cautions ?? []), ...(activePair.hardConstraints ?? [])].map((item) => <li key={item}>{item}</li>)}</ul>{!(activePair.cautions?.length || activePair.hardConstraints?.length) ? <p>特別な制約はありません。初回は通常どおり観察してください。</p> : null}</section><section className="pair-detail__recommendation"><h3>推奨対応</h3><p>{activePair.recommendation ?? 'スタッフが様子を確認できる環境で、短時間から同室を始めてください。'}</p></section></div> : <div className="empty-state"><p>ペアを選択するとカルテが表示されます。</p></div>}</aside></div>

    <section className="assignment-review panel" id="assignment-review" aria-labelledby="assignment-review-title"><div className="section-heading section-heading--actions"><div><h2 id="assignment-review-title">割当案の確認・手動変更</h2><p>変更前後と検証結果を確認し、問題がない割当だけを確定できます。</p></div><button className="button button--secondary" type="button" disabled={!hasChanges || isOptimizing} onClick={resetDraft}>{assignmentBaselineLabel}に戻す</button></div><div className="assignment-editor"><table><thead><tr><th>Pet</th><th>{assignmentBaselineLabel}</th><th>最終案</th><th>変更</th></tr></thead><tbody>{pets.map((pet) => {
            const beforeId = findRoomId(rooms, pet.id);
            const afterId = findRoomId(draftRooms, pet.id);
            const before = rooms.find((room) => room.id === beforeId);
            return <tr key={pet.id}><th>{pet.name}</th><td>{before?.name ?? '未割当'}</td><td><select aria-label={`${pet.name}の最終割当`} value={afterId} onChange={(event) => movePet(pet.id, event.target.value)}><option value="">未割当</option>{draftRooms.map((room) => <option key={room.id} value={room.id}>{room.name}（{room.petIds.length}/{room.capacity}）</option>)}</select></td><td>{beforeId === afterId ? <span className="muted-text">変更なし</span> : <span className="changed-label">変更あり・要再確定</span>}</td></tr>;
        })}</tbody></table></div><div className="assignment-results"><div><h3>部屋制約</h3>{draftRooms.map((room) => <p key={room.id}><strong>{room.name}</strong><span>{room.petIds.map((id) => petsById.get(id)?.name ?? id).join('・') || '未割当'}（{room.petIds.length}/{room.capacity}頭）</span></p>)}</div><div aria-live="polite"><h3>検証結果</h3>{draftIssues.length ? <ul className="validation-errors">{draftIssues.map((issue) => <li key={issue.id}><WarningIcon />{issue.message}</li>)}</ul> : <p className="validation-success">重複・同室不可・定員・未割当の問題はありません。</p>}</div></div><footer className="assignment-review__footer"><p><strong>{hasChanges ? '手動変更があります。再確定が必要です。' : `${assignmentBaselineLabel}のままです。`}</strong> 操作担当のスタッフIDを記録します。スタッフ選択は本人確認を意味しません。</p><div><button className="button button--secondary" type="button" disabled={isOptimizing || pets.length === 0} onClick={onRunOptimization}>{isOptimizing ? '再計算中…' : 'AIで再計算'}</button><button className="button button--primary" type="button" disabled={draftIssues.length > 0 || draftRooms.length === 0 || isOptimizing || (isConfirmed && !hasChanges)} onClick={() => onConfirm?.(draftRooms, hasChanges)}>{isConfirmed && !hasChanges ? '確定済み' : '最終案を確定'}</button></div></footer></section>
  </main>;
}
export default StaffDashboard;
