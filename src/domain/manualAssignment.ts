import { createPairKey } from "./compatibility";
import type {
  PairCompatibility,
  PetProfile,
  RoomAssignment,
  RoomDefinition,
} from "./types";

export type ManualAssignmentIssueCode =
  | "UNKNOWN_PET"
  | "UNKNOWN_ROOM"
  | "DUPLICATE_PET"
  | "DUPLICATE_PET_ENTRY"
  | "ROOM_OVER_CAPACITY"
  | "ROOM_BELOW_MINIMUM"
  | "HARD_CONSTRAINT_PAIR"
  | "MISSING_PAIR_EVALUATION"
  | "UNASSIGNED_PET";

export interface ManualAssignmentIssue {
  code: ManualAssignmentIssueCode;
  message: string;
  roomIds: string[];
  petIds: string[];
  pairKey?: string;
}

export interface ManualAssignmentEvaluation {
  valid: boolean;
  rooms: RoomAssignment[];
  issues: ManualAssignmentIssue[];
  unassignedPetIds: string[];
}

export type ProposedRoomAssignment = Pick<RoomAssignment, "roomId" | "petIds">;

const round = (value: number) => Math.round(value * 10) / 10;

const compareIssue = (left: ManualAssignmentIssue, right: ManualAssignmentIssue) =>
  left.code.localeCompare(right.code) ||
  left.roomIds.join("\u0000").localeCompare(right.roomIds.join("\u0000")) ||
  left.petIds.join("\u0000").localeCompare(right.petIds.join("\u0000")) ||
  (left.pairKey ?? "").localeCompare(right.pairKey ?? "");

/**
 * Normalizes and validates a staff-proposed room plan without mutating its inputs.
 * Only known pets in known rooms are included in the evaluated room assignments.
 */
export const evaluateManualAssignments = (
  pets: readonly PetProfile[],
  rooms: readonly RoomDefinition[],
  pairCompatibilities: readonly PairCompatibility[],
  proposedAssignments: readonly ProposedRoomAssignment[],
): ManualAssignmentEvaluation => {
  const orderedPets = [...pets].sort((left, right) => left.id.localeCompare(right.id));
  const orderedRooms = [...rooms].sort((left, right) => left.id.localeCompare(right.id));
  const petIds = new Set(orderedPets.map((pet) => pet.id));
  const roomIndex = new Map(orderedRooms.map((room) => [room.id, room]));
  const pairIndex = new Map(pairCompatibilities.map((pair) => [pair.pairKey, pair]));
  const proposedByRoom = new Map<string, Set<string>>();
  const issues: ManualAssignmentIssue[] = [];

  for (const proposal of proposedAssignments) {
    const roomIsKnown = roomIndex.has(proposal.roomId);
    if (!roomIsKnown) {
      issues.push({
        code: "UNKNOWN_ROOM",
        message: `登録されていない部屋「${proposal.roomId}」が指定されています。`,
        roomIds: [proposal.roomId],
        petIds: [...new Set(proposal.petIds)].sort(),
      });
    }

    const roomPetIds = proposedByRoom.get(proposal.roomId) ?? new Set<string>();
    for (const petId of proposal.petIds) {
      if (!petIds.has(petId)) {
        issues.push({
          code: "UNKNOWN_PET",
          message: `登録されていない犬「${petId}」が指定されています。`,
          roomIds: [proposal.roomId],
          petIds: [petId],
        });
        continue;
      }
      if (roomIsKnown && roomPetIds.has(petId)) {
        issues.push({
          code: "DUPLICATE_PET_ENTRY",
          message: `犬「${petId}」が同じ部屋に重複して指定されています。`,
          roomIds: [proposal.roomId],
          petIds: [petId],
        });
        continue;
      }
      if (roomIsKnown) roomPetIds.add(petId);
    }
    if (roomIsKnown) proposedByRoom.set(proposal.roomId, roomPetIds);
  }

  const assignedRoomIdsByPet = new Map<string, string[]>();
  for (const room of orderedRooms) {
    for (const petId of proposedByRoom.get(room.id) ?? []) {
      const assignedRoomIds = assignedRoomIdsByPet.get(petId) ?? [];
      assignedRoomIds.push(room.id);
      assignedRoomIdsByPet.set(petId, assignedRoomIds);
    }
  }

  for (const pet of orderedPets) {
    const assignedRoomIds = assignedRoomIdsByPet.get(pet.id) ?? [];
    if (assignedRoomIds.length > 1) {
      issues.push({
        code: "DUPLICATE_PET",
        message: `「${pet.name}」が複数の部屋に割り当てられています。`,
        roomIds: [...assignedRoomIds].sort(),
        petIds: [pet.id],
      });
    }
  }

  const evaluatedRooms = orderedRooms.map((room): RoomAssignment => {
    const assignedPetIds = [...(proposedByRoom.get(room.id) ?? [])].sort();
    const pairs: PairCompatibility[] = [];
    const pairKeys: string[] = [];
    for (let leftIndex = 0; leftIndex < assignedPetIds.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < assignedPetIds.length; rightIndex += 1) {
        const pairKey = createPairKey(assignedPetIds[leftIndex], assignedPetIds[rightIndex]);
        pairKeys.push(pairKey);
        const pair = pairIndex.get(pairKey);
        if (pair) {
          pairs.push(pair);
        } else {
          issues.push({
            code: "MISSING_PAIR_EVALUATION",
            message: `「${room.name}」の組み合わせ評価「${pairKey}」がありません。`,
            roomIds: [room.id],
            petIds: [assignedPetIds[leftIndex], assignedPetIds[rightIndex]],
            pairKey,
          });
        }
      }
    }
    pairs.sort((left, right) => left.pairKey.localeCompare(right.pairKey));

    if (assignedPetIds.length > room.capacity) {
      issues.push({
        code: "ROOM_OVER_CAPACITY",
        message: `「${room.name}」の定員 ${room.capacity} 頭を超えています。`,
        roomIds: [room.id],
        petIds: assignedPetIds,
      });
    }
    const minimumOccupancy = room.minOccupancy ?? 1;
    if (assignedPetIds.length < minimumOccupancy) {
      issues.push({
        code: "ROOM_BELOW_MINIMUM",
        message: `「${room.name}」の最低頭数 ${minimumOccupancy} 頭を満たしていません。`,
        roomIds: [room.id],
        petIds: assignedPetIds,
      });
    }
    for (const pair of pairs) {
      if (!pair.allowed || pair.hardConstraints.length > 0) {
        issues.push({
          code: "HARD_CONSTRAINT_PAIR",
          message: `「${room.name}」に同室不可の組み合わせがあります。`,
          roomIds: [room.id],
          petIds: [pair.petAId, pair.petBId].sort(),
          pairKey: pair.pairKey,
        });
      }
    }

    const scores = pairs.map((pair) => pair.score);
    return {
      roomId: room.id,
      petIds: assignedPetIds,
      pairKeys,
      averageCompatibility: scores.length
        ? round(scores.reduce((total, score) => total + score, 0) / scores.length)
        : null,
      minimumCompatibility: scores.length ? Math.min(...scores) : null,
    };
  });

  const unassignedPetIds = orderedPets
    .filter((pet) => !assignedRoomIdsByPet.has(pet.id))
    .map((pet) => pet.id);
  for (const petId of unassignedPetIds) {
    const pet = orderedPets.find((candidate) => candidate.id === petId)!;
    issues.push({
      code: "UNASSIGNED_PET",
      message: `「${pet.name}」が部屋に割り当てられていません。`,
      roomIds: [],
      petIds: [petId],
    });
  }

  issues.sort(compareIssue);
  return {
    valid: issues.length === 0,
    rooms: evaluatedRooms,
    issues,
    unassignedPetIds,
  };
};
