import { collection, doc, getDoc, getDocs, query, serverTimestamp, where, writeBatch, type Firestore } from 'firebase/firestore'
import type { Auth } from 'firebase/auth'
import { hashOwnerInviteToken, isOwnerInviteToken } from '../lib/ownerInvite'
import type { InviteRepository, OwnerInvite, StaffProfile, StaffProfileRepository } from './inviteRepository'
import { requireFacilityId } from './firestoreFacilityScope'

const PUBLIC_INVITES = 'registrationInvites'

export class FirestoreInviteRepository implements InviteRepository {
  readonly kind = 'firestore' as const

  constructor(private readonly db: Firestore, private readonly auth: Auth) {}

  async create(token: string, staffId: string): Promise<OwnerInvite> {
    if (!isOwnerInviteToken(token)) throw new Error('招待トークンの形式が不正です。')
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(staffId)) throw new Error('担当スタッフIDの形式が不正です。')
    const facilityId = requireFacilityId(this.auth)
    const inviteHash = await hashOwnerInviteToken(token)
    const batch = writeBatch(this.db)
    batch.set(doc(this.db, PUBLIC_INVITES, inviteHash), { active: true, facilityId })
    batch.set(doc(this.db, 'facilities', facilityId, 'registrationInvites', inviteHash), {
      staffId,
      createdAt: serverTimestamp(),
    })
    await batch.commit()
    return { id: inviteHash, active: true, facilityId }
  }

  async get(token: string): Promise<OwnerInvite | null> {
    if (!isOwnerInviteToken(token)) return null
    const inviteHash = await hashOwnerInviteToken(token)
    const snapshot = await getDoc(doc(this.db, PUBLIC_INVITES, inviteHash))
    if (!snapshot.exists()) return null
    const data = snapshot.data()
    if (data.active !== true || typeof data.facilityId !== 'string' || data.facilityId.length === 0) return null
    return { id: snapshot.id, active: true, facilityId: data.facilityId }
  }
}

export class FirestoreStaffProfileRepository implements StaffProfileRepository {
  readonly kind = 'firestore' as const

  constructor(private readonly db: Firestore, private readonly auth: Auth) {}

  async listActive(): Promise<StaffProfile[]> {
    const facilityId = requireFacilityId(this.auth)
    const result = await getDocs(query(
      collection(this.db, 'facilities', facilityId, 'staffProfiles'),
      where('active', '==', true),
    ))
    return result.docs
      .map((snapshot) => ({ id: snapshot.id, name: snapshot.data().name }))
      .filter((profile): profile is StaffProfile => typeof profile.name === 'string' && profile.name.length > 0)
      .sort((left, right) => left.name.localeCompare(right.name, 'ja'))
  }
}
