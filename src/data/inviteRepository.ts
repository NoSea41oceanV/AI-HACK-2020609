export interface OwnerInvite {
  id: string
  active: true
  facilityId: string
}

export interface InviteRepository {
  readonly kind: 'local' | 'firestore'
  create(token: string, staffId: string): Promise<OwnerInvite>
  get(token: string): Promise<OwnerInvite | null>
}

export interface StaffProfile {
  id: string
  name: string
}

export interface StaffProfileRepository {
  readonly kind: 'firestore'
  listActive(): Promise<StaffProfile[]>
}
