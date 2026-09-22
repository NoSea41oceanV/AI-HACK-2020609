import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { build } from 'esbuild'
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'

export async function checkManualObservationRules(environment) {
  const outfile = resolve('node_modules/.cache/pawpals-manual-repository.mjs')
  await build({ entryPoints: ['src/data/firestoreManualObservationRepository.ts'], outfile, bundle: true, platform: 'node', format: 'esm', packages: 'external' })
  const { FirestoreManualObservationRepository } = await import(pathToFileURL(outfile).href + `?run=${Date.now()}`)
  const facilityId = 'observation-facility'
  const db = environment.authenticatedContext(facilityId).firestore()
  const outsider = environment.authenticatedContext('observation-other').firestore()
  const owner = environment.unauthenticatedContext().firestore()
  const ref = (id, source = db) => doc(source, 'facilities', facilityId, 'demoObservations', id)
  await environment.withSecurityRulesDisabled(async context => {
    const admin = context.firestore()
    await setDoc(doc(admin, 'facilities', facilityId), { active: true, name: '合成施設' })
    await setDoc(doc(admin, 'facilities', facilityId, 'staffProfiles', 'staff'), { active: true, name: '担当' })
    await setDoc(doc(admin, 'facilities', facilityId, 'demoPets', 'dog'), { name: '合成犬' })
    await setDoc(doc(admin, 'facilities', 'observation-other', 'demoPets', 'other-dog'), { name: '他施設犬' })
    await setDoc(doc(admin, 'facilities', facilityId, 'demoObservations', 'legacy'), {
      id: 'legacy', scenarioId: 'demo', title: '旧保存シナリオ', facts: [], impacts: [], recommendation: '', observedAt: '2026-01-01T00:00:00.000Z',
    })
  })
  const observedAt = new Date(Date.now() - 1000).toISOString()
  const operationDate = new Date(Date.parse(observedAt) + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const input = { id: 'manual-test', staffId: 'staff', petIds: ['dog'], title: '手動で確認', facts: ['他犬と距離を取った'], impacts: [], recommendation: 'スタッフが継続確認', observedAt, operationDate }
  const repo = new FirestoreManualObservationRepository(db, { currentUser: { uid: facilityId } })
  const saved = await assertSucceeds(repo.createManual(input))
  assert.deepEqual(await assertSucceeds(repo.createManual(input)), saved)
  await assert.rejects(repo.createManual({ ...input, title: '別内容' }))
  await assertSucceeds(getDoc(ref('legacy')))
  assert.deepEqual((await repo.listManual()).map(item => item.id), ['manual-test'])
  await assertFails(updateDoc(ref(saved.id), { title: '上書き' }))
  for (const other of [owner, outsider]) {
    await assertFails(getDoc(ref(saved.id, other)))
    await assertFails(setDoc(ref('foreign', other), { ...saved, id: 'foreign' }))
  }
  let serial = 0
  for (const corruption of [
    value => { value.source = 'camera' },
    value => { value.staffId = 'unknown' },
    value => { value.petIds = ['other-dog'] },
    value => { value.petIds = ['dog', 'dog'] },
    value => { value.operationDate = '2026-01-01' },
    value => { value.observedAt = '2099-01-01T00:00:00.000Z'; value.operationDate = '2099-01-01' },
    value => { value.severity = 'critical' },
    value => { value.facts = [] },
  ]) {
    const value = { ...saved, id: `invalid-${++serial}` }
    corruption(value)
    await assertFails(setDoc(ref(value.id), value))
  }
  const legacy = (await getDoc(ref('legacy'))).data()
  await assertFails(setDoc(ref('new-demo'), { ...legacy, id: 'new-demo' }))
  console.log('Manual observation Rules: real records, idempotency, timestamps, legacy reads and facility isolation passed.')
}
