import type {
  MatchingResult,
  PairCompatibility,
  PetProfile as DomainPetProfile,
  RoomDefinition,
  ScoreBreakdown,
} from '../domain/types'

export type { DomainPetProfile, MatchingResult, RoomDefinition }

export const FACTOR_META: ReadonlyArray<{
  key: keyof ScoreBreakdown
  label: string
  maximum: number
}> = [
  { key: 'energy', label: '活動量', maximum: 25 },
  { key: 'size', label: '体格', maximum: 20 },
  { key: 'playStyle', label: '遊び方', maximum: 20 },
  { key: 'sociability', label: '社交性', maximum: 15 },
  { key: 'emotionalBalance', label: '感情バランス', maximum: 10 },
  { key: 'resourceSafety', label: '資源防衛リスク', maximum: 10 },
]

const PLAY_STYLE_LABELS: Readonly<Record<DomainPetProfile['playStyles'][number], string>> = {
  chase: '追いかけ遊び',
  wrestle: '組み合い遊び',
  tug: '引っ張り遊び',
  fetch: '持ってこい遊び',
  gentle: '穏やかな交流',
  solo: 'ひとり遊び',
}

export function playStyleLabel(style: DomainPetProfile['playStyles'][number]): string {
  return PLAY_STYLE_LABELS[style]
}

export function findPair(
  result: MatchingResult | null,
  firstPetId: string,
  secondPetId: string,
): PairCompatibility | null {
  return result?.pairResults.find((pair) => (
    pair.petAId === firstPetId && pair.petBId === secondPetId
  ) || (
    pair.petAId === secondPetId && pair.petBId === firstPetId
  )) ?? null
}

export function petRoomId(result: MatchingResult | null, petId: string): string | null {
  if (result?.status !== 'success') return null
  return result.rooms.find((room) => room.petIds.includes(petId))?.roomId ?? null
}

export function sharesRoom(result: MatchingResult | null, pair: PairCompatibility): boolean {
  if (result?.status !== 'success') return false
  return result.rooms.some((room) => room.petIds.includes(pair.petAId) && room.petIds.includes(pair.petBId))
}

export function roomName(rooms: readonly RoomDefinition[], roomId: string): string {
  return rooms.find((room) => room.id === roomId)?.name ?? roomId
}

export function formatRecordedAt(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function petById(pets: readonly DomainPetProfile[]): ReadonlyMap<string, DomainPetProfile> {
  return new Map(pets.map((pet) => [pet.id, pet]))
}
