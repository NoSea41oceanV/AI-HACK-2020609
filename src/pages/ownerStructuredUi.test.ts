import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import OwnerForm, { createOwnerRegistrationPayload } from './OwnerForm'
import PersonalityAxesDisplay from '../components/PersonalityAxesDisplay'
import ProfileScreen from '../pawpals/ProfileScreen'
import { STRUCTURED_INTAKE_LABELS, STRUCTURED_INTAKE_OPTIONS, type PersonalityAxes } from '../domain/structuredIntake'
import type { DomainPetProfile } from '../pawpals/pawPalsModel'

const axes: PersonalityAxes = { extraversion: 0, sociability: 76, neuroticism: 34, trainability: 71, resourceGuarding: 58, assertiveness: 48, resilience: 100 }

function completedAnswers() {
  const values = new FormData()
  for (const [key, options] of Object.entries(STRUCTURED_INTAKE_OPTIONS)) values.set(key, options[0])
  for (const key of ['medicalHistory', 'sensoryJointConcerns', 'troubleHistory']) values.set(key, 'なし')
  values.set('concerns', ' 花火が苦手です。 ')
  values.set('consent', 'accepted')
  return values
}

describe('owner structured registration UI', () => {
  it('preserves structured answers and optional concerns with a versioned UTC consent record', () => {
    const values = completedAnswers()
    values.set('firstMeeting', '分からない')
    const payload = createOwnerRegistrationPayload(values, 'invite-test', { photo: null, video: null })
    expect(payload.pet.structured.firstMeeting).toBe('分からない')
    expect(payload.pet.structured.medicalHistory).toBe('なし')
    expect(payload.pet.concerns).toBe('花火が苦手です。')
    expect(payload.pet.playStyle).toBe(values.get('playPreference'))
    expect(payload.pet.personality).toContain('分からない')
    expect(payload.consent).toMatchObject({ version: '2026-09', accepted: true })
    expect(new Date(payload.consent.acceptedAt).toISOString()).toBe(payload.consent.acceptedAt)
  })

  it('rejects missing answers and missing consent instead of supplying defaults', () => {
    const missingAnswer = completedAnswers()
    missingAnswer.delete('recovery')
    expect(() => createOwnerRegistrationPayload(missingAnswer, 'invite-test', { photo: null, video: null })).toThrow('必須項目')
    const emptyHistory = completedAnswers()
    emptyHistory.set('medicalHistory', '   ')
    expect(() => createOwnerRegistrationPayload(emptyHistory, 'invite-test', { photo: null, video: null })).toThrow('必須項目')
    const missingConsent = completedAnswers()
    missingConsent.delete('consent')
    expect(() => createOwnerRegistrationPayload(missingConsent, 'invite-test', { photo: null, video: null })).toThrow('同意')
  })

  it('renders every required question once with blank selections and explicit unchecked consent', () => {
    const html = renderToStaticMarkup(createElement(OwnerForm, { inviteId: 'invite-test', onSubmit: () => undefined }))
    for (const key of Object.keys(STRUCTURED_INTAKE_LABELS)) {
      expect(html.match(new RegExp(`name="${key}"`, 'g'))).toHaveLength(1)
      expect(html).toMatch(new RegExp(`(?:select|textarea)[^>]*name="${key}"[^>]*required=""`))
    }
    expect(html.match(/<option value="" disabled="" selected="">/g)).toHaveLength(Object.keys(STRUCTURED_INTAKE_OPTIONS).length + 2)
    expect(html).toContain('name="consent"')
    expect(html).toMatch(/<input(?=[^>]*name="consent")(?=[^>]*required="")[^>]*>/)
    expect(html).not.toContain('checked=""')
    expect(html).toContain('氏名・連絡先はAIに送りません')
    expect(html).toContain('動画本体は保存しません')
    expect(html).toContain('name="concerns"')
  })
})

describe('saved seven-axis presentation', () => {
  it('displays all saved values including zero and one hundred without five-axis conversion', () => {
    const html = renderToStaticMarkup(createElement(PersonalityAxesDisplay, { axes }))
    expect(html.match(/<meter /g)).toHaveLength(7)
    expect(html).toContain('value="0"')
    expect(html).toContain('value="100"')
    expect(html).toContain('訓練性')
    expect(html).not.toContain('旧形式')
  })

  it('does not display bars when axes are missing or invalid', () => {
    for (const value of [undefined, { ...axes, resilience: 101 }, { ...axes, trainability: 20.5 }]) {
      const html = renderToStaticMarkup(createElement(PersonalityAxesDisplay, { axes: value }))
      expect(html).toContain('保存済みの7軸データがありません')
      expect(html).not.toContain('<meter')
    }
  })

  it('keeps a legacy profile readable without inventing seven axes from old five-axis scores', () => {
    const pet: DomainPetProfile = { id: 'legacy', name: '旧プロフィール', breed: '柴犬', ageYears: 4, weightKg: 8, energyLevel: 4, sociability: 4, anxietyLevel: 2, assertiveness: 3, resourceGuarding: 1, playStyles: ['gentle'] }
    const html = renderToStaticMarkup(createElement(ProfileScreen, { pets: [pet], selectedPetId: pet.id, onSelectPet: () => undefined, onOpenCompatibility: () => undefined, onOpenMap: () => undefined, onSavePetProfile: async () => undefined }))
    expect(html).toContain('旧プロフィール')
    expect(html).toContain('保存済みの7軸データがありません')
    expect(html).not.toContain('<meter')
    expect(html).not.toContain('/5')
  })

  it('shows saved facility notes in the profile book', () => {
    const pet: DomainPetProfile = { id: 'facility-notes', name: '施設メモ犬', ageYears: 4, weightKg: 8, energyLevel: 4, sociability: 4, anxietyLevel: 2, assertiveness: 3, resourceGuarding: 1, playStyles: ['gentle'], tabooNotes: '食器を守るため単独で給餌', facilityNotes: '午前中は静かな場所で休ませる', hardBlockedPetIds: ['counterpart'], hardBlockedPetReasons: { counterpart: '食事中は同室不可' } }
    const counterpart: DomainPetProfile = { ...pet, id: 'counterpart', name: '相手犬', hardBlockedPetIds: [pet.id], hardBlockedPetReasons: { [pet.id]: '相手側の理由' } }
    const html = renderToStaticMarkup(createElement(ProfileScreen, { pets: [pet, counterpart], selectedPetId: pet.id, onSelectPet: () => undefined, onOpenCompatibility: () => undefined, onOpenMap: () => undefined, onSavePetProfile: async () => undefined }))
    expect(html).toContain('スタッフ共有メモ')
    expect(html).toContain('登録時メモ')
    expect(html).toContain('共有メモ')
    expect(html).toContain('禁忌事項')
    expect(html).toContain('食器を守るため単独で給餌')
    expect(html).toContain('犬ごとの同室不可・理由')
    expect(html).toContain('相手犬を同室不可にする')
    expect(html).toContain('食事中は同室不可')
    expect(html).toContain('相手犬側からも同室不可：相手側の理由')
    expect(html).toContain('共有メモ・禁忌事項を保存')
    expect(html).not.toContain('保存済みの施設情報')
    expect(html).not.toContain('<b>スタッフメモ</b>')
  })
})
