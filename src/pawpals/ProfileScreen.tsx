import { useEffect, useState } from 'react'
import type { DomainPetProfile } from './pawPalsModel'
import { petPhotoUrl, playStyleLabel } from './pawPalsModel'
import PersonalityAxesDisplay from '../components/PersonalityAxesDisplay'

interface ProfileScreenProps {
  pets: readonly DomainPetProfile[]
  selectedPetId: string
  onSelectPet: (petId: string) => void
  onOpenCompatibility: () => void
  onOpenMap: () => void
  onSavePetProfile: (pet: DomainPetProfile) => Promise<void>
}

function PetAvatar({ pet }: { pet: DomainPetProfile }) {
  return <img className="pawpals-avatar-image" src={petPhotoUrl(pet)} alt="" />
}

export default function ProfileScreen({
  pets,
  selectedPetId,
  onSelectPet,
  onOpenCompatibility,
  onOpenMap,
  onSavePetProfile,
}: ProfileScreenProps) {
  const selectedPet = pets.find((pet) => pet.id === selectedPetId) ?? pets[0] ?? null
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [tabooNotes, setTabooNotes] = useState(() => selectedPet?.tabooNotes ?? '')
  const [facilityNotes, setFacilityNotes] = useState(() => selectedPet?.facilityNotes ?? '')
  const [hardBlockedPetIds, setHardBlockedPetIds] = useState<string[]>(() => selectedPet?.hardBlockedPetIds ?? [])
  const [hardBlockedPetReasons, setHardBlockedPetReasons] = useState<Record<string, string>>(() => selectedPet?.hardBlockedPetReasons ?? {})
  useEffect(() => {
    setTabooNotes(selectedPet?.tabooNotes ?? '')
    setFacilityNotes(selectedPet?.facilityNotes ?? '')
    setHardBlockedPetIds(selectedPet?.hardBlockedPetIds ?? [])
    setHardBlockedPetReasons(selectedPet?.hardBlockedPetReasons ?? {})
    setSaveError('')
  }, [selectedPet?.id, selectedPet?.tabooNotes, selectedPet?.facilityNotes, selectedPet?.hardBlockedPetIds, selectedPet?.hardBlockedPetReasons])
  function setPairBlocked(petId: string, blocked: boolean) {
    setHardBlockedPetIds((current) => blocked
      ? [...new Set([...current, petId])].sort((left, right) => left.localeCompare(right))
      : current.filter((id) => id !== petId))
    if (!blocked) setHardBlockedPetReasons((current) => {
      const next = { ...current }
      delete next[petId]
      return next
    })
  }
  async function saveNotes() {
    if (!selectedPet) return
    setSaving(true)
    setSaveError('')
    const blockedIds = [...new Set(hardBlockedPetIds.filter((id) => id !== selectedPet.id))]
      .sort((left, right) => left.localeCompare(right))
    const blockedReasons = Object.fromEntries(blockedIds.flatMap((id) => {
      const reason = hardBlockedPetReasons[id]?.trim()
      return reason ? [[id, reason]] : []
    }))
    try {
      await onSavePetProfile({
        ...selectedPet,
        tabooNotes: tabooNotes.trim(),
        facilityNotes: facilityNotes.trim(),
        hardBlockedPetIds: blockedIds,
        hardBlockedPetReasons: blockedReasons,
      })
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : '施設情報を保存できませんでした。')
    }
    finally { setSaving(false) }
  }

  return (
    <section className="screen active" aria-labelledby="profile-screen-title">
      <div className="page-title">
        <div>
          <span className="eyebrow">プロフィール</span>
          <h1 id="profile-screen-title">プロフィール帳</h1>
        </div>
        <div className="date-chip">登録犬：{pets.length}頭</div>
      </div>
      {selectedPet ? (
        <div className="profile-layout">
          <div className="card dog-list" aria-label="登録犬一覧">
            {pets.map((pet) => (
              <button
                type="button"
                className={`dog-select ${pet.id === selectedPet.id ? 'active' : ''}`}
                key={pet.id}
                onClick={() => onSelectPet(pet.id)}
                aria-pressed={pet.id === selectedPet.id}
              >
                <span className="dog-select__identity"><img src={petPhotoUrl(pet)} alt="" />{pet.name}</span>
                <small>{pet.breed || '犬種未登録'} / {pet.ageYears}歳 / {pet.weightKg}kg</small>
              </button>
            ))}
          </div>
          <div className="card profile-detail">
            <div className="profile-head">
              <div className="avatar"><PetAvatar pet={selectedPet} /></div>
              <div>
                <span className="eyebrow">登録プロフィール</span>
                <h2>{selectedPet.name}</h2>
                <p>{selectedPet.breed || '犬種未登録'} / {selectedPet.ageYears}歳 / {selectedPet.weightKg}kg</p>
              </div>
              <span className="verdict good">登録済み</span>
            </div>
            <div className="tags">
              {selectedPet.playStyles.length > 0
                ? selectedPet.playStyles.map((style) => <span key={style}>{playStyleLabel(style)}</span>)
                : <span>遊び方未登録</span>}
            </div>
            <PersonalityAxesDisplay axes={selectedPet.personalityAxes} />
            <div className="profile-note">
              <b>スタッフ共有メモ</b>
              <div className="profile-note__registration">
                <span>登録時メモ</span>
                <p>{selectedPet.notes?.trim() || '登録時メモは登録されていません。'}</p>
              </div>
              <label className="profile-note__facility">共有メモ<textarea value={facilityNotes} disabled={saving} onChange={(event) => setFacilityNotes(event.target.value)} maxLength={1000} rows={3} placeholder="施設での様子、引き継ぎ、対応メモなど" /></label>
            </div>
            <div className="taboo-alert profile-taboo-box" aria-label={`${selectedPet.name}の禁忌事項`}>
              <b>禁忌事項</b>
              <p>{selectedPet.tabooNotes?.trim() || '登録されていません。'}</p>
              <label>全体の禁忌事項<textarea value={tabooNotes} disabled={saving} onChange={(event) => setTabooNotes(event.target.value)} maxLength={1000} rows={3} placeholder="同室を避けたい条件、触れてほしくない場所など" /></label>
              <fieldset>
                <legend>犬ごとの同室不可・理由</legend>
                {pets.filter((pet) => pet.id !== selectedPet.id).map((pet) => {
                  const blocked = hardBlockedPetIds.includes(pet.id)
                  const blockedByOther = pet.hardBlockedPetIds?.includes(selectedPet.id) ?? false
                  return <div key={pet.id}>
                    <label><input type="checkbox" checked={blocked} disabled={saving} onChange={(event) => setPairBlocked(pet.id, event.target.checked)} />{pet.name}を同室不可にする</label>
                    {blocked ? <label>{pet.name}との同室不可理由<textarea value={hardBlockedPetReasons[pet.id] ?? ''} disabled={saving} onChange={(event) => setHardBlockedPetReasons((current) => ({ ...current, [pet.id]: event.target.value }))} maxLength={1000} rows={2} placeholder="例：食事中に資源防衛があるため" /></label> : null}
                    {blockedByOther ? <p>{pet.name}側からも同室不可：{pet.hardBlockedPetReasons?.[selectedPet.id]?.trim() || '理由未登録'}</p> : null}
                  </div>
                })}
                {pets.length < 2 ? <p>同室不可の相手として選べる犬はまだいません。</p> : null}
              </fieldset>
              {saveError ? <p role="alert">{saveError}</p> : null}
              <button type="button" className="primary profile-save" disabled={saving} onClick={() => void saveNotes()}>{saving ? '保存中…' : '共有メモ・禁忌事項を保存'}</button>
            </div>
            <div className="history">
              <h3>禁忌事項の登録状況</h3>
              <div><span>同室不可として登録された相手</span><b>{selectedPet.hardBlockedPetIds?.length ?? 0}頭</b></div>
              {selectedPet.updatedAt ? <div><span>最終更新</span><b>{new Date(selectedPet.updatedAt).toLocaleString('ja-JP')}</b></div> : null}
            </div>
            <div className="profile-links">
              <button type="button" className="secondary" onClick={onOpenCompatibility}>この犬の相性カルテを見る</button>
              <button type="button" className="secondary" onClick={onOpenMap}>この犬をマップで見る</button>
            </div>
          </div>
        </div>
      ) : (
        <div className="card pawpals-empty"><b>登録済みの犬はいません</b><p>飼い主入力タブから登録URLを発行してください。</p></div>
      )}
    </section>
  )
}
