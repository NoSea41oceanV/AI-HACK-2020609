import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { doc, setDoc } from 'firebase/firestore'

export async function checkStructuredIntakeRules(environment) {
  const facilityId = 'structured-facility'
  const owner = environment.unauthenticatedContext().firestore()
  const staff = environment.authenticatedContext(facilityId).firestore()
  const structured = {
    neuter: '済み', heat: 'いいえ', mixedVaccine: '提出済み・有効', rabiesVaccine: '未提出',
    fleaTickPrevention: '実施済み', foodAllergy: 'なし', medicalHistory: 'なし', sensoryJointConcerns: 'なし',
    multiDogExperience: 'なし', facilityExperience: '月に数回', puppySocialization: '不明', troubleHistory: 'なし',
    firstMeeting: '分からない', playPreference: '分からない', resourceReaction: '分からない',
    excitement: '分からない', recovery: '分からない', stressResponse: '分からない',
  }
  const personalityAxes = { extraversion: 25, sociability: 75, neuroticism: 20, trainability: 50, resourceGuarding: 10, assertiveness: 30, resilience: 60 }
  const profile = { energyLevel: 3, sociability: 3, anxietyLevel: 2, assertiveness: 2, resourceGuarding: 1, playStyles: ['gentle'], hardBlockedPetIds: [], personalityAxes }
  const now = new Date().toISOString()
  let serial = 0
  async function payload() {
    const id = (++serial).toString(16).padStart(64, '0')
    await environment.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), 'facilities', facilityId), { active: true, name: '合成施設' })
      await setDoc(doc(context.firestore(), 'registrationInvites', id), { active: true, facilityId })
    })
    return {
      id, inviteId: id, facilityId, owner: { name: '合成利用者', contact: 'test@example.invalid' },
      pet: { name: '合成犬', breed: 'mixed', ageYears: 2, weightKg: 5, sex: 'unknown', personality: '慎重', playStyle: '穏やか', concerns: '', structured: structuredClone(structured) },
      media: {}, status: 'ready', submittedAt: now,
      consent: { version: '2026-09', accepted: true, acceptedAt: now },
      matchingProfile: structuredClone(profile),
      aiAnalysis: { summary: '合成結果', observations: [], personalityTraits: [], compatibilitySignals: [], riskFlags: [], confidence: 0.5, personalityAxes: structuredClone(personalityAxes), matchingProfile: structuredClone(profile) },
    }
  }
  const save = value => setDoc(doc(owner, 'facilities', facilityId, 'demoIntakes', value.id), value)
  await assertSucceeds(save(await payload()))
  const withMedia = await payload()
  withMedia.media = {
    photo: { kind: 'image', fileName: 'photo.jpg', contentType: 'image/jpeg', sizeBytes: 1024, status: 'selected' },
    video: { kind: 'video', fileName: 'video.mp4', contentType: 'video/mp4', sizeBytes: 2048, status: 'selected' },
  }
  await assertSucceeds(save(withMedia))
  const invalidMedia = await payload()
  invalidMedia.media = { photo: { ...withMedia.media.photo, sizeBytes: 6 * 1024 * 1024 } }
  await assertFails(save(invalidMedia))
  for (const corrupt of [
    value => { delete value.consent },
    value => { value.consent.accepted = false },
    value => { value.consent.version = 'unapproved' },
    value => { value.pet.structured.neuter = 'unknown-option' },
    value => { delete value.pet.structured.recovery },
    value => { value.pet.structured.extra = 'unsaved-field' },
    value => { value.pet.structured.medicalHistory = 'x'.repeat(1001) },
    value => { value.aiAnalysis.personalityAxes.extraversion = 101 },
    value => { value.aiAnalysis.personalityAxes.trainability = 2.5 },
    value => { delete value.aiAnalysis.personalityAxes },
    value => { value.matchingProfile.personalityAxes.resilience = 99 },
  ]) {
    const value = await payload()
    corrupt(value)
    await assertFails(save(value))
  }
  const legacy = await payload()
  delete legacy.pet.structured
  delete legacy.consent
  delete legacy.aiAnalysis
  delete legacy.matchingProfile
  await assertSucceeds(save(legacy))
  const pet = { name: '合成犬', ageYears: 2, weightKg: 5, ...profile, updatedAt: now }
  await assertSucceeds(setDoc(doc(staff, 'facilities', facilityId, 'demoPets', 'axes-pet'), pet))
  await assertFails(setDoc(doc(staff, 'facilities', facilityId, 'demoPets', 'invalid-axes'), { ...pet, personalityAxes: { ...personalityAxes, fakeAxis: 10 } }))
  console.log('Structured intake Rules: complete persistence, consent, axes consistency and legacy compatibility passed.')
}
