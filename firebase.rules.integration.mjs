import { readFile } from 'node:fs/promises'
import { checkStructuredIntakeRules } from './scripts/structured-intake.rules-cases.mjs'
import { checkDailyOperationsRules } from './scripts/daily-operations.rules-cases.mjs'
import { checkManualObservationRules } from './scripts/manual-observation.rules-cases.mjs'
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing'
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'

// Keep contract fixtures and rules isolated from interactive UI emulator sessions.
const projectId = `demo-pawpals-${Date.now().toString(36)}`
const rules = await readFile(new URL('./firestore.rules', import.meta.url), 'utf8')
const environment = await initializeTestEnvironment({
  projectId,
  firestore: { host: '127.0.0.1', port: 8189, rules },
})

const facilityA = 'facility-a'
const facilityB = 'facility-b'
const nonFacility = 'signed-in-but-not-a-facility'
const staffA = 'staff-a'
const staffB = 'staff-b'
const inviteA = 'a'.repeat(64)
const inviteB = 'b'.repeat(64)
const missingInvite = 'c'.repeat(64)
const now = Timestamp.fromDate(new Date('2026-09-22T00:00:00.000Z'))

const pet = {
  name: 'デモ犬', breed: 'mixed', ageYears: 4, weightKg: 9.5,
  energyLevel: 3, sociability: 4, anxietyLevel: 2, assertiveness: 2,
  resourceGuarding: 0, playStyles: ['gentle', 'fetch'], hardBlockedPetIds: [],
  notes: 'synthetic demo data', updatedAt: new Date().toISOString(),
}

const intake = (inviteId, facilityId = facilityA) => ({
  id: inviteId,
  inviteId,
  facilityId,
  owner: { name: 'デモ利用者', contact: 'demo@example.invalid' },
  pet: {
    name: 'デモ犬', breed: 'mixed', ageYears: 4, weightKg: 9.5, sex: 'unknown',
    personality: 'synthetic demo personality', playStyle: 'gentle', concerns: '',
  },
  media: {},
  status: 'submitted',
  submittedAt: new Date().toISOString(),
})

const matching = (id, petId) => ({
  id, status: 'proposed', petIds: [petId], pairResults: [], rooms: [],
  objectiveScore: null, createdAt: new Date().toISOString(),
})

const observation = (id) => ({
  id, scenarioId: 'demo-scenario', title: 'デモ観測', facts: [], impacts: [],
  recommendation: 'staff review', observedAt: new Date().toISOString(),
})

try {
  await environment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore()
    await setDoc(doc(db, 'facilities', facilityA), { active: true, name: '施設A' })
    await setDoc(doc(db, 'facilities', facilityB), { active: true, name: '施設B' })
    await setDoc(doc(db, 'facilities', facilityA, 'staffProfiles', staffA), { active: true, name: '担当A', createdAt: now })
    await setDoc(doc(db, 'facilities', facilityB, 'staffProfiles', staffB), { active: true, name: '担当B', createdAt: now })
  })

  const dbA = environment.authenticatedContext(facilityA).firestore()
  const dbB = environment.authenticatedContext(facilityB).firestore()
  const dbUnknown = environment.authenticatedContext(nonFacility).firestore()
  const dbOwner = environment.unauthenticatedContext().firestore()

  const inviteBatchA = writeBatch(dbA)
  inviteBatchA.set(doc(dbA, 'registrationInvites', inviteA), { active: true, facilityId: facilityA })
  inviteBatchA.set(doc(dbA, 'facilities', facilityA, 'registrationInvites', inviteA), { staffId: staffA, createdAt: serverTimestamp() })
  await assertSucceeds(inviteBatchA.commit())

  const inviteBatchB = writeBatch(dbB)
  inviteBatchB.set(doc(dbB, 'registrationInvites', inviteB), { active: true, facilityId: facilityB })
  inviteBatchB.set(doc(dbB, 'facilities', facilityB, 'registrationInvites', inviteB), { staffId: staffB, createdAt: serverTimestamp() })
  await assertSucceeds(inviteBatchB.commit())

  await assertSucceeds(getDoc(doc(dbOwner, 'registrationInvites', inviteA)))
  await assertFails(getDocs(collection(dbOwner, 'registrationInvites')))
  await assertFails(setDoc(doc(dbA, 'registrationInvites', missingInvite), { active: true, facilityId: facilityA }))
  await assertFails(setDoc(doc(dbUnknown, 'registrationInvites', missingInvite), { active: true, facilityId: nonFacility }))
  await assertFails(updateDoc(doc(dbA, 'registrationInvites', inviteA), { active: false }))
  await assertFails(deleteDoc(doc(dbA, 'registrationInvites', inviteA)))

  const intakePathA = doc(dbOwner, 'facilities', facilityA, 'demoIntakes', inviteA)
  await assertSucceeds(setDoc(intakePathA, intake(inviteA)))
  await assertFails(setDoc(intakePathA, intake(inviteA)))
  await assertFails(setDoc(doc(dbOwner, 'facilities', facilityA, 'demoIntakes', missingInvite), intake(missingInvite)))
  await assertFails(setDoc(doc(dbOwner, 'facilities', facilityB, 'demoIntakes', inviteA), intake(inviteA, facilityB)))
  await assertFails(setDoc(doc(dbOwner, 'facilities', facilityA, 'demoIntakes', 'different-id'), intake(inviteA)))
  await assertFails(getDoc(doc(dbOwner, 'facilities', facilityA, 'demoIntakes', inviteA)))
  await assertFails(getDocs(query(collection(dbOwner, 'facilities', facilityA, 'demoIntakes'), limit(1))))
  await assertSucceeds(getDoc(doc(dbA, 'facilities', facilityA, 'demoIntakes', inviteA)))
  await assertSucceeds(getDocs(query(collection(dbA, 'facilities', facilityA, 'demoIntakes'), limit(25))))
  await assertFails(getDoc(doc(dbB, 'facilities', facilityA, 'demoIntakes', inviteA)))

  const petId = `rules-pet-${Date.now().toString(36)}`
  await assertSucceeds(setDoc(doc(dbA, 'facilities', facilityA, 'demoPets', petId), pet))
  await assertFails(getDoc(doc(dbOwner, 'facilities', facilityA, 'demoPets', petId)))
  await assertFails(getDoc(doc(dbB, 'facilities', facilityA, 'demoPets', petId)))
  await assertFails(setDoc(doc(dbOwner, 'facilities', facilityA, 'demoPets', 'owner-write'), pet))
  await assertFails(setDoc(doc(dbA, 'facilities', facilityA, 'demoPets', 'invalid'), { ...pet, energyLevel: 99 }))
  await assertFails(getDocs(collection(dbA, 'facilities', facilityA, 'demoPets')))
  await assertSucceeds(getDocs(query(collection(dbA, 'facilities', facilityA, 'demoPets'), limit(26))))

  const petPath = doc(dbA, 'facilities', facilityA, 'demoPets', petId)
  const blockedIds = Array.from({ length: 50 }, (_, index) => `Pet_${index}-`.padEnd(100, 'x'))
  const completePet = {
    ...pet, facilityNotes: '施'.repeat(1000), tabooNotes: '注'.repeat(1000),
    hardBlockedPetIds: blockedIds,
    hardBlockedPetReasons: Object.fromEntries(blockedIds.map(id => [id, '理'.repeat(1000)])),
    personalityAxes: { extraversion: 25, sociability: 75, neuroticism: 20, trainability: 50, resourceGuarding: 10, assertiveness: 30, resilience: 60 },
    photoUrl: 'https://example.invalid/pet.png',
  }
  // Exercise the complete 50-entry map with every optional field: Rules have a
  // 1,000-expression ceiling, so a smaller success case is not sufficient.
  await assertSucceeds(setDoc(doc(dbA, 'facilities', facilityA, 'demoPets', 'full-profile'), completePet))
  await assertSucceeds(setDoc(petPath, completePet))
  await assertSucceeds(updateDoc(petPath, { hardBlockedPetReasons: { [blockedIds[0]]: '', [blockedIds[1]]: '改行\n区切り/|\u0000🐕' } }))
  await assertSucceeds(updateDoc(petPath, { facilityNotes: '', tabooNotes: '', hardBlockedPetReasons: {} }))
  const { hardBlockedPetIds: omittedIds, ...withoutBlockedIds } = pet
  await assertSucceeds(setDoc(petPath, { ...withoutBlockedIds, hardBlockedPetReasons: {} }))
  await assertFails(setDoc(petPath, { ...withoutBlockedIds, hardBlockedPetReasons: { other: 'reason' } }))
  for (const field of ['facilityNotes', 'tabooNotes']) {
    for (const value of ['x'.repeat(1001), 123]) {
      await assertFails(setDoc(petPath, { ...pet, [field]: value }))
    }
  }
  for (const reasons of [null, [], { other: 'not blocked' }]) {
    await assertFails(setDoc(petPath, { ...pet, hardBlockedPetReasons: reasons }))
  }
  for (const invalidId of ['unsafe/id', 'unsafe.id', '犬', 'x'.repeat(101)]) {
    await assertFails(setDoc(petPath, { ...pet, hardBlockedPetIds: [invalidId], hardBlockedPetReasons: { [invalidId]: 'reason' } }))
    await assertFails(setDoc(petPath, { ...pet, hardBlockedPetIds: [invalidId] }))
  }
  const tooManyIds = [...blockedIds, 'extra']
  await assertFails(setDoc(petPath, { ...pet, hardBlockedPetIds: tooManyIds, hardBlockedPetReasons: Object.fromEntries(tooManyIds.map(id => [id, 'reason'])) }))
  for (const value of ['x'.repeat(1001), 123, null, true, [], {}]) {
    await assertFails(setDoc(petPath, { ...completePet, hardBlockedPetReasons: { ...completePet.hardBlockedPetReasons, [blockedIds[49]]: value } }))
  }
  await assertFails(setDoc(petPath, { ...completePet, unexpectedField: true }))
  await assertFails(setDoc(doc(dbOwner, 'facilities', facilityA, 'demoPets', 'owner-notes'), completePet))
  await assertFails(setDoc(doc(dbB, 'facilities', facilityA, 'demoPets', 'other-facility-notes'), completePet))
  await assertSucceeds(setDoc(petPath, completePet))
  await assertFails(updateDoc(petPath, { hardBlockedPetIds: [] }))
  await assertSucceeds(updateDoc(petPath, { hardBlockedPetIds: [], hardBlockedPetReasons: {} }))

  const snapshot = matching(`snapshot-${Date.now().toString(36)}`, petId)
  await assertSucceeds(setDoc(doc(dbA, 'facilities', facilityA, 'demoMatchingSnapshots', snapshot.id), snapshot))
  await assertFails(setDoc(doc(dbOwner, 'facilities', facilityA, 'demoMatchingSnapshots', 'owner'), matching('owner', petId)))
  const observed = observation(`observation-${Date.now().toString(36)}`)
  // Old demo rows remain readable, but cannot masquerade as new real observations.
  await environment.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'facilities', facilityA, 'demoObservations', observed.id), observed)
  })
  await assertSucceeds(getDoc(doc(dbA, 'facilities', facilityA, 'demoObservations', observed.id)))
  await assertFails(setDoc(doc(dbB, 'facilities', facilityA, 'demoObservations', 'other'), observation('other')))

  await assertSucceeds(getDocs(query(
    collection(dbA, 'facilities', facilityA, 'staffProfiles'),
    where('active', '==', true),
  )))
  await assertFails(getDocs(collection(dbOwner, 'facilities', facilityA, 'staffProfiles')))
  await assertFails(getDocs(collection(dbB, 'facilities', facilityA, 'staffProfiles')))
  await assertFails(setDoc(doc(dbA, 'facilities', facilityA, 'staffProfiles', 'self-added'), { active: true, name: 'self' }))
  await assertFails(setDoc(doc(dbUnknown, 'facilities', nonFacility), { active: true, name: 'self-elevated' }))
  await assertFails(getDoc(doc(dbOwner, 'private', 'unknown')))

  await checkStructuredIntakeRules(environment)
  await checkDailyOperationsRules(environment)
  await checkManualObservationRules(environment)
  console.log('Firestore Rules facility/invite isolation checks passed.')
} finally {
  await environment.cleanup()
}
