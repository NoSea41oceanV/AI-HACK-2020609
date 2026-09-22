import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { build } from 'esbuild'
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { doc, getDoc, getDocs, collection, query, limit, setDoc, updateDoc, writeBatch } from 'firebase/firestore'

export async function checkDailyOperationsRules(environment) {
  // Compile the production repository, so these are real transaction integration checks.
  const outfile = resolve('node_modules/.cache/pawpals-daily-repository.mjs')
  await build({ entryPoints: ['src/data/firestoreDailyOperationRepository.ts'], outfile, bundle: true, platform: 'node', format: 'esm', packages: 'external' })
  const { FirestoreDailyOperationRepository } = await import(pathToFileURL(outfile).href + `?run=${Date.now()}`)
  const facilityId = 'operations-facility'
  const staffId = 'operator'
  const date = '2026-09-22'
  const db = environment.authenticatedContext(facilityId).firestore()
  const owner = environment.unauthenticatedContext().firestore()
  const stranger = environment.authenticatedContext('operations-other').firestore()
  const ref = (group, id) => doc(db, 'facilities', facilityId, group, id)
  await environment.withSecurityRulesDisabled(async context => {
    const admin = context.firestore()
    await setDoc(doc(admin, 'facilities', facilityId), { active: true, name: '合成施設' })
    await setDoc(doc(admin, 'facilities', facilityId, 'staffProfiles', staffId), { active: true, name: '合成担当' })
    for (const id of ['dog-a', 'dog-b', 'unselected']) await setDoc(doc(admin, 'facilities', facilityId, 'demoPets', id), {
      name: id, ageYears: 3, weightKg: 5, energyLevel: 3, sociability: 3,
      anxietyLevel: 2, assertiveness: 2, resourceGuarding: 0, playStyles: ['gentle'],
      hardBlockedPetIds: [], updatedAt: new Date().toISOString(),
    })
  })
  const repo = new FirestoreDailyOperationRepository(db, { currentUser: { uid: facilityId } })
  const rooms = await assertSucceeds(repo.saveRooms({ rooms: [{ id: 'room-a', name: 'A室', capacity: 3 }, { id: 'room-b', name: 'B室', capacity: 3 }], staffId, expectedRevision: 0 }))
  assert.equal(rooms.rooms[0].minOccupancy, 0)
  let day = await assertSucceeds(repo.saveDay({ date, petIds: ['dog-a', 'dog-b'], staffId, expectedRevision: 0 }))
  let plan = await assertSucceeds(repo.recalculate({ date, staffId, reason: '初回再計算', expectedRevision: day.revision, expectedRoomsRevision: rooms.revision }))
  assert.deepEqual(plan.petIds, ['dog-a', 'dog-b'])
  day = await repo.getDay(date)
  const previousPlan = plan
  plan = await assertSucceeds(repo.recalculate({ date, staffId, reason: '条件確認後に再計算', expectedRevision: day.revision, expectedRoomsRevision: rooms.revision }))
  assert.equal((await repo.getPlan(date, previousPlan.id)).status, 'superseded')
  day = await repo.getDay(date)
  await assert.rejects(repo.decide({ date, planId: previousPlan.id, staffId, decision: 'confirmed', reason: '旧案', expectedRevision: day.revision }))
  plan = await assertSucceeds(repo.decide({ date, planId: plan.id, staffId, decision: 'confirmed', reason: '担当確認済み', expectedRevision: day.revision }))
  assert.equal(plan.status, 'confirmed')
  day = await repo.getDay(date)
  await assert.rejects(repo.decide({ date, planId: plan.id, staffId, decision: 'rejected', reason: '再決定', expectedRevision: day.revision }))
  plan = await assertSucceeds(repo.recalculate({ date, staffId, reason: '別案再検討', expectedRevision: day.revision, expectedRoomsRevision: rooms.revision }))
  day = await repo.getDay(date)
  plan = await assertSucceeds(repo.decide({ date, planId: plan.id, staffId, decision: 'rejected', reason: '観察を優先', expectedRevision: day.revision }))
  const history = await assertSucceeds(repo.listAudit(date))
  assert(history.some(item => item.action === 'confirmed' && item.reason === '担当確認済み'))
  assert(history.some(item => item.action === 'rejected' && item.staffId === staffId))
  // Direct SDK writes must not bypass atomic state changes or audit immutability.
  await assertFails(updateDoc(ref('operationPlans', plan.id), { status: 'confirmed' }))
  await assertFails(updateDoc(ref('dailyOperations', date), { revision: 999 }))
  await assertFails(updateDoc(ref('operationAudit', history[0].id), { reason: 'tampered' }))
  await assertFails(setDoc(ref('operationAudit', 'orphan'), { ...history[0], id: 'orphan' }))
  await assertFails(setDoc(ref('operationPlans', 'forged'), { ...plan, id: 'forged', status: 'proposed' }))
  for (const other of [owner, stranger]) {
    for (const [group, id] of [['dailyOperations', date], ['settings', 'rooms'], ['operationPlans', plan.id], ['operationAudit', history[0].id]]) {
      await assertFails(getDoc(doc(other, 'facilities', facilityId, group, id)))
      await assertFails(setDoc(doc(other, 'facilities', facilityId, group, id), {}))
    }
  }
  await assertFails(getDocs(collection(db, 'facilities', facilityId, 'operationAudit')))
  await assertSucceeds(getDocs(query(collection(db, 'facilities', facilityId, 'operationAudit'), limit(100))))
  // An invalid staff identity and a fabricated head/audit pair are also denied at the data layer.
  const bad = writeBatch(db)
  const current = await repo.getDay(date)
  const time = new Date().toISOString()
  bad.set(ref('dailyOperations', date), { ...current, revision: current.revision + 1, updatedBy: 'not-a-staff', updatedAt: time, lastAuditId: 'fake-actor' })
  bad.set(ref('operationAudit', 'fake-actor'), { ...history[0], id: 'fake-actor', action: 'day_saved', staffId: 'not-a-staff', createdAt: time, dayRevision: current.revision + 1, sourcePlanId: current.latestPlanId, planId: null, roomsRevision: null })
  await assertFails(bad.commit())
  const wideRooms = Array.from({ length: 10 }, (_, i) => ({ id: `wide-${i}`, name: `部屋${i}`, capacity: 20 }))
  const updatedRooms = await assertSucceeds(repo.saveRooms({ rooms: wideRooms, staffId, expectedRevision: rooms.revision }))
  assert.equal(updatedRooms.rooms.length, 10)
  // A selection change must invalidate the old proposal even with a well-formed forged audit.
  day = await repo.getDay(date)
  const stale = await assertSucceeds(repo.recalculate({ date, staffId, reason: '更新前', expectedRevision: day.revision, expectedRoomsRevision: updatedRooms.revision }))
  day = await repo.getDay(date)
  day = await repo.saveDay({ date, petIds: ['dog-a'], staffId, expectedRevision: day.revision })
  const forged = writeBatch(db)
  const forgedTime = new Date().toISOString()
  forged.update(ref('operationPlans', stale.id), { status: 'confirmed', staffId, reason: 'stale bypass', updatedAt: forgedTime, lastAuditId: 'stale-audit' })
  forged.update(ref('dailyOperations', date), { revision: day.revision + 1, lastAuditId: 'stale-audit', updatedAt: forgedTime, updatedBy: staffId })
  forged.set(ref('operationAudit', 'stale-audit'), { id: 'stale-audit', facilityId, date, action: 'confirmed', staffId, reason: 'stale bypass', sourcePlanId: stale.id, planId: stale.id, createdAt: forgedTime, dayRevision: day.revision + 1, roomsRevision: updatedRooms.revision })
  await assertFails(forged.commit())
  console.log('Daily operations Rules: real repository transactions, supersession, decisions, audit and facility isolation passed.')
}
