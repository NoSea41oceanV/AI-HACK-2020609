import { useMemo, useState } from 'react';
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
  hardConstraints?: string[];
};

export type RoomAssignment = {
  id: string;
  name: string;
  capacity: number;
  petIds: string[];
  averageScore: number;
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
  onConfirm?: (rooms: RoomAssignment[]) => void;
};

type ScoreTone = 'excellent' | 'good' | 'watch' | 'blocked';

const getScoreTone = (score: number, hasConstraint = false): ScoreTone => {
  if (hasConstraint) return 'blocked';
  if (score >= 80) return 'excellent';
  if (score >= 65) return 'good';
  return 'watch';
};

const PawMark = () => (
  <svg aria-hidden="true" className="staff-dashboard__paw" viewBox="0 0 40 40">
    <path d="M19.9 19.1c-5.6 0-10.3 5.2-10.3 10 0 3.7 3 6.1 6.5 5.1 2.5-.7 5.2-.7 7.7 0 3.5 1 6.5-1.4 6.5-5.1-.1-4.8-4.8-10-10.4-10Z" />
    <ellipse cx="8.8" cy="17.8" rx="4.1" ry="5.4" transform="rotate(-25 8.8 17.8)" />
    <ellipse cx="31.2" cy="17.8" rx="4.1" ry="5.4" transform="rotate(25 31.2 17.8)" />
    <ellipse cx="15.2" cy="9.3" rx="4.1" ry="5.4" transform="rotate(-8 15.2 9.3)" />
    <ellipse cx="24.8" cy="9.3" rx="4.1" ry="5.4" transform="rotate(8 24.8 9.3)" />
  </svg>
);

const FlowArrow = () => (
  <svg aria-hidden="true" className="matching-flow__arrow" viewBox="0 0 28 28">
    <path d="M5 14h17m-6-6 6 6-6 6" />
  </svg>
);

const WarningIcon = () => (
  <svg aria-hidden="true" className="warning-icon" viewBox="0 0 24 24">
    <path d="M12 3.5 21 20H3L12 3.5Z" />
    <path d="M12 9v5m0 3v.1" />
  </svg>
);

export function StaffDashboard({
  pets,
  pairs,
  rooms,
  selectedPairId,
  isOptimizing = false,
  isConfirmed = false,
  updatedAtLabel = 'たった今更新',
  onIssueInvite,
  issuedByLabel,
  onSelectPair,
  onRunOptimization,
  onConfirm,
}: StaffDashboardProps) {
  const [internalPairId, setInternalPairId] = useState<string | undefined>();

  const petsById = useMemo(() => new Map(pets.map((pet) => [pet.id, pet])), [pets]);
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
  const activePairNames = activePair
    ? [petsById.get(activePair.petAId)?.name, petsById.get(activePair.petBId)?.name].filter(Boolean).join(' × ')
    : '';
  const constrainedPairs = pairs.filter((pair) => (pair.hardConstraints?.length ?? 0) > 0);

  const selectPair = (pair: CompatibilityPair) => {
    setInternalPairId(pair.id);
    onSelectPair?.(pair.id);
  };

  return (
    <main className="staff-dashboard">
      <header className="staff-dashboard__header">
        <a className="staff-dashboard__brand" href="#matching" aria-label="PAWPAIR マッチング画面">
          <span className="staff-dashboard__brand-mark"><PawMark /></span>
          <span>PAWPAIR</span>
        </a>
        <div className="staff-dashboard__header-copy">
          <h1>本日のグループマッチング</h1>
          <p>{pets.length}頭・{rooms.length}部屋を、相性が最もよくなる組み合わせへ</p>
        </div>
        <span className="staff-dashboard__updated" aria-label={`データ更新: ${updatedAtLabel}`}>
          <span aria-hidden="true" className="staff-dashboard__updated-dot" />
          {updatedAtLabel}
        </span>
      </header>

      {onIssueInvite ? <StaffInvitePanel onIssue={onIssueInvite} issuedByLabel={issuedByLabel} /> : null}

      <section className="matching-flow" aria-labelledby="matching-flow-title">
        <h2 id="matching-flow-title" className="sr-only">マッチングの処理順序</h2>
        <div className="matching-flow__step matching-flow__step--complete">
          <span className="matching-flow__number">1</span>
          <span><strong>全ペアを採点</strong><small>{pairs.length}組の相性スコアを比較</small></span>
        </div>
        <FlowArrow />
        <div className={`matching-flow__step ${isOptimizing ? 'matching-flow__step--active' : 'matching-flow__step--ready'}`}>
          <span className="matching-flow__number">2</span>
          <span><strong>全体を最適化</strong><small>定員内で部屋全体の相性を最大化</small></span>
        </div>
        <button
          className="button button--secondary matching-flow__action"
          disabled={isOptimizing || pets.length === 0}
          onClick={onRunOptimization}
          type="button"
        >
          {isOptimizing ? '最適化しています…' : '割当を再計算'}
        </button>
      </section>

      {constrainedPairs.length > 0 ? (
        <aside className="constraint-alert" role="alert">
          <WarningIcon />
          <div>
            <strong>同室にできない組み合わせが {constrainedPairs.length}組あります</strong>
            <span>ハード制約はスコア計算後に判定され、最適化では同室候補から除外されます。</span>
          </div>
        </aside>
      ) : null}

      <div className="staff-dashboard__workspace" id="matching">
        <aside className="pet-roster" aria-labelledby="pet-roster-title">
          <div className="section-heading">
            <div>
              <h2 id="pet-roster-title">本日のペット</h2>
              <p>登録済み {pets.length}頭</p>
            </div>
          </div>
          <ul className="pet-roster__list">
            {pets.map((pet, index) => (
              <li className="pet-roster__item" key={pet.id}>
                <span
                  className="pet-avatar"
                  style={{ backgroundColor: pet.avatarColor ?? ['#dcebe4', '#fde0d9', '#e7e1f3', '#f5e7bd'][index % 4] }}
                >
                  {pet.avatarUrl ? <img alt="" src={pet.avatarUrl} /> : pet.name.slice(0, 1)}
                </span>
                <span className="pet-roster__identity">
                  <strong>{pet.name}</strong>
                  <small>{[pet.breed, pet.ageLabel, pet.sexLabel].filter(Boolean).join('・') || 'プロフィール登録済み'}</small>
                </span>
                <span className="pet-roster__status">採点済</span>
              </li>
            ))}
          </ul>
        </aside>

        <section className="compatibility-panel" aria-labelledby="compatibility-title">
          <div className="section-heading section-heading--row">
            <div>
              <h2 id="compatibility-title">全ペア相性マトリクス</h2>
              <p>セルを選ぶと採点根拠を確認できます</p>
            </div>
            <div className="score-legend" aria-label="相性スコアの凡例">
              <span><i className="score-dot score-dot--excellent" />80–100</span>
              <span><i className="score-dot score-dot--good" />65–79</span>
              <span><i className="score-dot score-dot--watch" />0–64</span>
            </div>
          </div>

          <div className="compatibility-table-wrap">
            <table className="compatibility-table">
              <caption className="sr-only">登録ペット全組み合わせの相性スコア</caption>
              <thead>
                <tr>
                  <th scope="col">ペット</th>
                  {pets.map((pet) => <th scope="col" key={pet.id}>{pet.name}</th>)}
                </tr>
              </thead>
              <tbody>
                {pets.map((rowPet) => (
                  <tr key={rowPet.id}>
                    <th scope="row">{rowPet.name}</th>
                    {pets.map((columnPet) => {
                      if (rowPet.id === columnPet.id) {
                        return <td className="compatibility-table__self" key={columnPet.id}>—</td>;
                      }
                      const pair = pairByPetIds.get(`${rowPet.id}:${columnPet.id}`);
                      if (!pair) return <td className="compatibility-table__empty" key={columnPet.id}>未</td>;
                      const hasConstraint = (pair.hardConstraints?.length ?? 0) > 0;
                      const tone = getScoreTone(pair.totalScore, hasConstraint);
                      const isSelected = pair.id === activePairId;
                      return (
                        <td key={columnPet.id}>
                          <button
                            aria-label={`${rowPet.name}と${columnPet.name}の相性 ${pair.totalScore}点${hasConstraint ? '、同室不可' : ''}`}
                            aria-pressed={isSelected}
                            className={`score-cell score-cell--${tone} ${isSelected ? 'score-cell--selected' : ''}`}
                            onClick={() => selectPair(pair)}
                            type="button"
                          >
                            {hasConstraint ? <WarningIcon /> : pair.totalScore}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="pair-detail" aria-labelledby="pair-detail-title">
          <div className="section-heading">
            <div>
              <h2 id="pair-detail-title">選択ペアの採点根拠</h2>
              <p>{activePairNames || 'マトリクスからペアを選択'}</p>
            </div>
          </div>
          {activePair ? (
            <div className="pair-detail__body">
              <div className={`pair-detail__score pair-detail__score--${getScoreTone(activePair.totalScore, (activePair.hardConstraints?.length ?? 0) > 0)}`}>
                <strong>{activePair.totalScore}</strong><span>/ 100</span>
              </div>
              <div className="pair-detail__factors">
                {activePair.factors.map((factor) => {
                  const percentage = factor.maxScore > 0 ? Math.min(100, Math.max(0, factor.score / factor.maxScore * 100)) : 0;
                  return (
                    <div className="score-factor" key={factor.label}>
                      <div className="score-factor__label">
                        <span>{factor.label}</span><strong>{factor.score}/{factor.maxScore}</strong>
                      </div>
                      <span className="score-factor__track"><i style={{ width: `${percentage}%` }} /></span>
                      {factor.note ? <small>{factor.note}</small> : null}
                    </div>
                  );
                })}
              </div>
              <p className="pair-detail__explanation">{activePair.explanation}</p>
              {(activePair.hardConstraints?.length ?? 0) > 0 ? (
                <div className="pair-detail__warning">
                  <WarningIcon />
                  <div><strong>同室不可</strong>{activePair.hardConstraints?.map((constraint) => <span key={constraint}>{constraint}</span>)}</div>
                </div>
              ) : null}
            </div>
          ) : <p className="pair-detail__empty">ペアを選択すると、性格・体格・活動量などの内訳が表示されます。</p>}
        </aside>
      </div>

      <section className="room-results" aria-labelledby="room-results-title">
        <div className="section-heading section-heading--row">
          <div>
            <h2 id="room-results-title">全体最適化した部屋割り</h2>
            <p>低い相性も含め、定員の中で全体の平均相性が最も高くなる案です</p>
          </div>
          <strong className="room-results__overall">
            全体平均 <span>{rooms.length ? Math.round(rooms.reduce((sum, room) => sum + room.averageScore, 0) / rooms.length) : 0}</span>点
          </strong>
        </div>
        <div className="room-results__grid">
          {rooms.map((room, roomIndex) => (
            <article className="room-card" key={room.id}>
              <header className="room-card__header">
                <span className={`room-card__number room-card__number--${roomIndex % 3}`}>{String(roomIndex + 1).padStart(2, '0')}</span>
                <div><h3>{room.name}</h3><p>{room.petIds.length} / {room.capacity}頭</p></div>
                <strong className={`room-card__average room-card__average--${getScoreTone(room.averageScore)}`}>{room.averageScore}<small>平均</small></strong>
              </header>
              <div className="room-card__pets">
                {room.petIds.map((petId) => {
                  const pet = petsById.get(petId);
                  return pet ? <span className="room-card__pet" key={pet.id}>{pet.name}</span> : null;
                })}
              </div>
              {room.note ? <p className="room-card__note">{room.note}</p> : null}
            </article>
          ))}
        </div>
        <footer className="room-results__footer">
          <p><strong>最終決定は施設オペレーターが行います。</strong> 相性スコアと制約を確認してから確定してください。</p>
          <button
            className="button button--primary"
            disabled={rooms.length === 0 || isOptimizing || isConfirmed}
            onClick={() => onConfirm?.(rooms)}
            type="button"
          >
            {isConfirmed ? 'この部屋割りで確定済み' : 'この部屋割りで確定'}
          </button>
        </footer>
      </section>
    </main>
  );
}

export default StaffDashboard;
