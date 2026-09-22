import type { DomainPetProfile } from './pawPalsModel'
import { petPhotoUrl, playStyleLabel } from './pawPalsModel'
import PersonalityAxesDisplay from '../components/PersonalityAxesDisplay'

interface ProfileScreenProps {
  pets: readonly DomainPetProfile[]
  selectedPetId: string
  onSelectPet: (petId: string) => void
  onOpenCompatibility: () => void
  onOpenMap: () => void
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
}: ProfileScreenProps) {
  const selectedPet = pets.find((pet) => pet.id === selectedPetId) ?? pets[0] ?? null

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
              <p>{selectedPet.notes?.trim() || '共有メモは登録されていません。'}</p>
            </div>
            <div className="history">
              <h3>安全制約</h3>
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
