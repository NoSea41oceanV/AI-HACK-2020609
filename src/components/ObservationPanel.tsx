import { FormEvent, useMemo, useState } from 'react'
import type { PetProfile } from '../pages/StaffDashboard'

export interface ObservationSubmission {
  petAId: string
  petBId: string
  decision: 'review' | 'separate'
  notes: string
}

interface ObservationPanelProps {
  pets: readonly PetProfile[]
  isSubmitting?: boolean
  onSubmit: (submission: ObservationSubmission) => Promise<void>
}

export default function ObservationPanel({ pets, isSubmitting = false, onSubmit }: ObservationPanelProps) {
  const [petAId, setPetAId] = useState(pets[0]?.id ?? '')
  const availableCounterparts = useMemo(
    () => pets.filter((pet) => pet.id !== petAId),
    [petAId, pets],
  )
  const [petBId, setPetBId] = useState(pets[1]?.id ?? '')
  const [decision, setDecision] = useState<ObservationSubmission['decision']>('review')
  const [notes, setNotes] = useState('')
  const [localError, setLocalError] = useState('')
  const selectedPetBId = availableCounterparts.some((pet) => pet.id === petBId)
    ? petBId
    : availableCounterparts[0]?.id ?? ''

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLocalError('')
    if (!petAId || !selectedPetBId || !notes.trim()) {
      setLocalError('2頭と観測内容を入力してください。')
      return
    }
    try {
      await onSubmit({ petAId, petBId: selectedPetBId, decision, notes: notes.trim() })
      setNotes('')
    } catch (error) {
      setLocalError(`${error instanceof Error ? error.message : '観測を保存できませんでした。'} 同じボタンで再試行できます。`)
    }
  }

  return (
    <section className="observation-panel" aria-labelledby="observation-panel-title">
      <div className="observation-panel__heading">
        <div>
          <h2 id="observation-panel-title">当日の観測から再計算</h2>
          <p>スタッフが確認した事実をFirestoreへ記録し、全ペアと部屋割りを更新します。</p>
        </div>
        <span>スタッフ確認</span>
      </div>

      {pets.length >= 2 ? (
        <form onSubmit={handleSubmit}>
          <div className="observation-panel__pair">
            <label>
              <span>観測したペット</span>
              <select value={petAId} onChange={(event) => setPetAId(event.target.value)}>
                {pets.map((pet) => <option value={pet.id} key={pet.id}>{pet.name}</option>)}
              </select>
            </label>
            <span aria-hidden="true">×</span>
            <label>
              <span>相手のペット</span>
              <select value={selectedPetBId} onChange={(event) => setPetBId(event.target.value)}>
                {availableCounterparts.map((pet) => <option value={pet.id} key={pet.id}>{pet.name}</option>)}
              </select>
            </label>
          </div>

          <fieldset>
            <legend>再計算への反映</legend>
            <label className="observation-panel__choice">
              <input
                type="radio"
                name="observation-decision"
                value="review"
                checked={decision === 'review'}
                onChange={() => setDecision('review')}
              />
              <span><strong>記録して再評価</strong><small>プロフィールは変えず、全ペアを再計算します</small></span>
            </label>
            <label className="observation-panel__choice">
              <input
                type="radio"
                name="observation-decision"
                value="separate"
                checked={decision === 'separate'}
                onChange={() => setDecision('separate')}
              />
              <span><strong>安全のため別室にする</strong><small>同室不可制約を保存してから再計算します</small></span>
            </label>
          </fieldset>

          <label className="observation-panel__notes">
            <span>観測した事実</span>
            <textarea
              rows={4}
              maxLength={200}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="例：追走後に一方が壁際へ移動し、距離を取り続けた"
              required
            />
            <small>{notes.length} / 200文字</small>
          </label>

          {localError ? <p className="observation-panel__error" role="alert">{localError}</p> : null}
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? '保存して再計算中…' : '観測を保存して再計算'}
          </button>
        </form>
      ) : (
        <p className="observation-panel__empty">観測によるペア再計算には、Firestoreへ2頭以上の登録が必要です。</p>
      )}
    </section>
  )
}
