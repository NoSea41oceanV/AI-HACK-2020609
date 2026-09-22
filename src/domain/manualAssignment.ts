export type ManualAssignmentPet = {
  id: string;
  name: string;
};

export type ManualAssignmentRoom = {
  id: string;
  name: string;
  capacity: number;
  minOccupancy?: number;
  petIds: readonly string[];
};

export type ManualAssignmentPair = {
  petAId: string;
  petBId: string;
  allowed: boolean;
};

export type ManualAssignmentIssueCode =
  | 'DUPLICATE_PET'
  | 'ROOM_CAPACITY'
  | 'MINIMUM_OCCUPANCY'
  | 'HARD_CONSTRAINT'
  | 'PAIR_DATA_MISSING'
  | 'UNASSIGNED_PET'
  | 'UNKNOWN_PET';

export type ManualAssignmentIssue = {
  code: ManualAssignmentIssueCode;
  message: string;
  petIds: string[];
  roomIds: string[];
};

export type ManualAssignmentValidation = {
  valid: boolean;
  issues: ManualAssignmentIssue[];
};

const pairKey = (left: string, right: string) => [left, right].sort().join('::');

export function validateManualAssignments(
  pets: readonly ManualAssignmentPet[],
  rooms: readonly ManualAssignmentRoom[],
  pairs: readonly ManualAssignmentPair[],
): ManualAssignmentValidation {
  const issues: ManualAssignmentIssue[] = [];
  const petById = new Map(pets.map((pet) => [pet.id, pet]));
  const assignedRooms = new Map<string, string[]>();
  const blockedPairs = new Set(pairs.filter((pair) => !pair.allowed).map((pair) => pairKey(pair.petAId, pair.petBId)));
  const knownPairs = new Set(pairs.map((pair) => pairKey(pair.petAId, pair.petBId)));

  for (const room of rooms) {
    if (room.petIds.length > room.capacity) {
      issues.push({
        code: 'ROOM_CAPACITY',
        message: `${room.name}は定員${room.capacity}頭を超えています。`,
        petIds: [...room.petIds],
        roomIds: [room.id],
      });
    }
    if (room.petIds.length < (room.minOccupancy ?? 0)) {
      issues.push({
        code: 'MINIMUM_OCCUPANCY',
        message: `${room.name}は最低${room.minOccupancy}頭の割当が必要です。`,
        petIds: [...room.petIds],
        roomIds: [room.id],
      });
    }

    for (const petId of room.petIds) {
      if (!petById.has(petId)) {
        issues.push({
          code: 'UNKNOWN_PET',
          message: `${room.name}に現在の登録一覧にないPetが含まれています。`,
          petIds: [petId],
          roomIds: [room.id],
        });
        continue;
      }
      assignedRooms.set(petId, [...(assignedRooms.get(petId) ?? []), room.id]);
    }

    for (let leftIndex = 0; leftIndex < room.petIds.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < room.petIds.length; rightIndex += 1) {
        const leftId = room.petIds[leftIndex];
        const rightId = room.petIds[rightIndex];
        if (leftId === rightId) continue;
        const leftName = petById.get(leftId)?.name ?? leftId;
        const rightName = petById.get(rightId)?.name ?? rightId;
        if (!knownPairs.has(pairKey(leftId, rightId))) {
          issues.push({
            code: 'PAIR_DATA_MISSING',
            message: `${room.name}の${leftName}と${rightName}は相性データを確認できないため確定できません。`,
            petIds: [leftId, rightId],
            roomIds: [room.id],
          });
          continue;
        }
        if (!blockedPairs.has(pairKey(leftId, rightId))) continue;
        issues.push({
          code: 'HARD_CONSTRAINT',
          message: `${room.name}の${leftName}と${rightName}には同室不可の安全制約があります。`,
          petIds: [leftId, rightId],
          roomIds: [room.id],
        });
      }
    }
  }

  for (const pet of pets) {
    const roomIds = assignedRooms.get(pet.id) ?? [];
    if (roomIds.length === 0) {
      issues.push({
        code: 'UNASSIGNED_PET',
        message: `${pet.name}の部屋が未割当です。`,
        petIds: [pet.id],
        roomIds: [],
      });
    } else if (roomIds.length > 1) {
      issues.push({
        code: 'DUPLICATE_PET',
        message: `${pet.name}が複数の部屋または枠に重複しています。`,
        petIds: [pet.id],
        roomIds,
      });
    }
  }

  return { valid: issues.length === 0, issues };
}
