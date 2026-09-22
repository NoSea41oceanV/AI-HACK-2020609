#!/usr/bin/env node

const projectId = 'demo-pawpair'
const authBase = 'http://127.0.0.1:9099'
const firestoreBase = `http://127.0.0.1:8189/v1/projects/${projectId}/databases/(default)/documents`
const email = 'facility-e2e@example.invalid'
const password = 'LocalOnly-PawPair-2026!'

async function authRequest(action) {
  const response = await fetch(`${authBase}/identitytoolkit.googleapis.com/v1/accounts:${action}?key=fake-api-key`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  })
  const payload = await response.json()
  return { response, payload }
}

async function ensureAuthUser() {
  const created = await authRequest('signUp')
  if (created.response.ok) return created.payload.localId
  if (created.payload?.error?.message !== 'EMAIL_EXISTS') {
    throw new Error(`Auth emulator fixture failed: ${created.payload?.error?.message ?? created.response.status}`)
  }
  const signedIn = await authRequest('signInWithPassword')
  if (!signedIn.response.ok) {
    throw new Error(`Auth emulator sign-in failed: ${signedIn.payload?.error?.message ?? signedIn.response.status}`)
  }
  return signedIn.payload.localId
}

async function upsertDocument(path, fields) {
  const response = await fetch(`${firestoreBase}/${path}`, {
    method: 'PATCH',
    headers: { 'authorization': 'Bearer owner', 'content-type': 'application/json' },
    body: JSON.stringify({ fields }),
  })
  if (!response.ok) throw new Error(`Firestore emulator fixture failed for ${path}: HTTP ${response.status}`)
}

const facilityId = await ensureAuthUser()
const createdAt = { timestampValue: new Date().toISOString() }
await upsertDocument(`facilities/${encodeURIComponent(facilityId)}`, {
  active: { booleanValue: true },
  name: { stringValue: 'E2Eデモ施設' },
})
await upsertDocument(`facilities/${encodeURIComponent(facilityId)}/staffProfiles/staff-sora`, {
  active: { booleanValue: true },
  name: { stringValue: 'そら' },
  createdAt,
})
await upsertDocument(`facilities/${encodeURIComponent(facilityId)}/staffProfiles/staff-rin`, {
  active: { booleanValue: true },
  name: { stringValue: 'りん' },
  createdAt,
})

console.log(JSON.stringify({
  projectId,
  authEmulator: authBase,
  firestoreEmulator: 'http://127.0.0.1:8189',
  email,
  password,
  facilityId,
  staffIds: ['staff-sora', 'staff-rin'],
}, null, 2))
