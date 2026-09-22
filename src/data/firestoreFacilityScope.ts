import type { Auth } from 'firebase/auth'
import { collection, type CollectionReference, type DocumentData, type Firestore } from 'firebase/firestore'

export function requireFacilityId(auth: Auth): string {
  const facilityId = auth.currentUser?.uid
  if (!facilityId) throw new Error('施設アカウントでログインしてください。')
  return facilityId
}

export function facilityCollection(
  db: Firestore,
  auth: Auth,
  collectionName: string,
): CollectionReference<DocumentData> {
  return collection(db, 'facilities', requireFacilityId(auth), collectionName)
}
