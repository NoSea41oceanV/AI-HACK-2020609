import { useState } from 'react'
import type { DomainPetProfile, MatchingResult } from './pawPalsModel'
import { FACTOR_META, petById, playStyleLabel } from './pawPalsModel'

interface CompatibilityScreenProps {
  pets: readonly DomainPetProfile[]
  matchingResult: MatchingResult | null
  selectedPetId: string
  onSelectPet: (petId: string) => void
}

function petSummary(pet: DomainPetProfile): string {
  const styles = pet.playStyles.map(playStyleLabel).join('・')
  return `${styles || '遊び方未登録'} / ${pet.weightKg}kg`
}

export default function CompatibilityScreen({ pets, matchingResult, selectedPetId, onSelectPet }: CompatibilityScreenProps) {
  const [requestedCounterpartId, setRequestedCounterpartId] = useState('')
  const petIndex = petById(pets)
  const primary = pets.find((pet) => pet.id === selectedPetId) ?? pets[0] ?? null
  const candidates = primary
    ? matchingResult?.pairResults.filter((pair) => petIndex.has(pair.petAId) && petIndex.has(pair.petBId) && (pair.petAId === primary.id || pair.petBId === primary.id)) ?? []
    : []
  const selectedPair = candidates.find((pair) => (
    pair.petAId === requestedCounterpartId || pair.petBId === requestedCounterpartId
  )) ?? candidates[0] ?? null
  const counterpartId = selectedPair
    ? selectedPair.petAId === primary?.id ? selectedPair.petBId : selectedPair.petAId
    : ''
  const counterpart = petIndex.get(counterpartId) ?? null

  const selectPrimary = (petId: string) => {
    onSelectPet(petId)
    setRequestedCounterpartId('')
  }

  return (
    <section className="screen active" aria-labelledby="compatibility-screen-title">
      <div className="page-title">
        <div>
          <span className="eyebrow">相性カルテ</span>
          <h1 id="compatibility-screen-title">相性カルテ</h1>
          <p>当日の預かり犬について、同室不可の制約と6因子から計算した相性を確認できます。</p>
        </div>
      </div>

      {primary && selectedPair && counterpart ? (
        <div className="match-layout">
          <div className="card pair-card">
            <label className="pawpals-field">
              <span>基準にする犬</span>
              <select value={primary.id} onChange={(event) => selectPrimary(event.target.value)}>
                {pets.map((pet) => <option value={pet.id} key={pet.id}>{pet.name}</option>)}
              </select>
            </label>
            <div className="pair-head">
              <div className="avatar" aria-hidden="true">{primary.name.slice(0, 1)}</div>
              <div><b>{primary.name}</b><small>{petSummary(primary)}</small></div>
              <span>×</span>
              <div className="avatar" aria-hidden="true">{counterpart.name.slice(0, 1)}</div>
              <div><b>{counterpart.name}</b><small>{petSummary(counterpart)}</small></div>
            </div>
            <div className="score-row">
              <div className="score" aria-label={`相性 ${selectedPair.score}%`}>{selectedPair.score}<small>%</small></div>
              <span className={`verdict ${selectedPair.allowed ? 'good' : 'incompatible'}`}>
                {selectedPair.allowed ? 'ハード制約なし' : '同室不可'}
              </span>
            </div>
            <p>相性は登録プロフィールから計算した目安です。安全を保証する確率ではありません。</p>
            <h3>相性の内訳（加重点）</h3>
            <div className="score-breakdown">
              {FACTOR_META.map((factor) => (
                <div key={factor.key}>
                  <span>{factor.label}</span>
                  <b>{selectedPair.breakdown[factor.key]}/{factor.maximum}</b>
                  <em aria-label={`${factor.maximum}点中${selectedPair.breakdown[factor.key]}点`}>
                    {Math.round(selectedPair.breakdown[factor.key] / factor.maximum * 100)}%
                  </em>
                </div>
              ))}
            </div>
            <div className="reason-box">
              <b>判定根拠</b>
              {selectedPair.hardConstraints.length > 0 ? (
                <ul className="pawpals-reasons">
                  {selectedPair.hardConstraints.map((constraint, index) => <li key={`${constraint.code}-${index}`}>明示的な同室不可：{constraint.message}</li>)}
                </ul>
              ) : (
                <p>明示的な同室不可の登録はありません。6因子の加重点から計算した相性は{selectedPair.score}%です。</p>
              )}
            </div>
          </div>

          <div className="card">
            <span className="eyebrow">全候補</span>
            <h2>{primary.name}から見た相性</h2>
            <div className="pawpals-table-wrap">
              <table>
                <thead><tr><th>相手</th><th>相性</th><th>ハード制約</th><th><span className="pawpals-sr-only">選択</span></th></tr></thead>
                <tbody>
                  {candidates.map((pair) => {
                    const otherId = pair.petAId === primary.id ? pair.petBId : pair.petAId
                    const other = petIndex.get(otherId)
                    const active = pair.pairKey === selectedPair.pairKey
                    return (
                      <tr key={pair.pairKey} className={active ? 'pawpals-row-active' : undefined}>
                        <td>{other?.name ?? otherId}</td>
                        <td>{pair.score}%</td>
                        <td><span className={`verdict ${pair.allowed ? 'good' : 'incompatible'}`}>{pair.allowed ? '該当なし' : '同室不可'}</span></td>
                        <td><button type="button" className="pawpals-row-button" onClick={() => setRequestedCounterpartId(otherId)}>{active ? '表示中' : '表示'}</button></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="card pawpals-empty">
          <b>表示できるペアがありません</b>
          <p>{pets.length < 2 ? '相性カルテには当日の預かり犬を2頭以上選択してください。' : '相性計算を実行すると全候補を確認できます。'}</p>
        </div>
      )}
    </section>
  )
}
