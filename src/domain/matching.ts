import {
  calculateAllPairCompatibilities,
  createPairKey,
} from "./compatibility";
import type {
  MatchingResult,
  PairCompatibility,
  PetProfile,
  RoomAssignment,
  RoomDefinition,
} from "./types";

export interface MatchingOptions {
  /** A score below this value reduces the objective; it is not a hard exclusion. */
  neutralScore?: number;
}

interface Candidate {
  assignments: Map<string, string[]>;
  objectiveScore: number;
  totalCompatibilityScore: number;
  canonicalKey: string;
}

const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);
const round = (value: number) => Math.round(value * 10) / 10;

const buildPairIndex = (pairs: readonly PairCompatibility[]) =>
  new Map(pairs.map((pair) => [pair.pairKey, pair]));

const buildCanonicalKey = (rooms: readonly RoomDefinition[], assignments: Map<string, string[]>) =>
  rooms
    .map((room) => `${room.id}:${[...(assignments.get(room.id) ?? [])].sort().join(",")}`)
    .join("|");

const getRoomPairResults = (
  petIds: readonly string[],
  pairIndex: ReadonlyMap<string, PairCompatibility>,
) => {
  const pairs: PairCompatibility[] = [];
  for (let leftIndex = 0; leftIndex < petIds.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < petIds.length; rightIndex += 1) {
      const pair = pairIndex.get(createPairKey(petIds[leftIndex], petIds[rightIndex]));
      if (!pair) throw new Error("Pair score is missing from the precomputed matrix.");
      pairs.push(pair);
    }
  }
  return pairs;
};

const compareCandidate = (candidate: Candidate, best: Candidate | null) => {
  if (!best) return true;
  if (candidate.objectiveScore !== best.objectiveScore) {
    return candidate.objectiveScore > best.objectiveScore;
  }
  if (candidate.totalCompatibilityScore !== best.totalCompatibilityScore) {
    return candidate.totalCompatibilityScore > best.totalCompatibilityScore;
  }
  return candidate.canonicalKey.localeCompare(best.canonicalKey) < 0;
};

export const createOptimalRoomPlan = (
  pets: readonly PetProfile[],
  rooms: readonly RoomDefinition[],
  options: MatchingOptions = {},
): MatchingResult => {
  // The complete matrix is always calculated first, including blocked pairs.
  const pairResults = calculateAllPairCompatibilities(pets);
  const pairIndex = buildPairIndex(pairResults);
  const neutralScore = options.neutralScore ?? 50;
  const orderedRooms = [...rooms].sort((left, right) => left.id.localeCompare(right.id));
  const minimumRequired = sum(orderedRooms.map((room) => room.minOccupancy ?? 1));
  const totalCapacity = sum(orderedRooms.map((room) => room.capacity));

  if (totalCapacity < pets.length) {
    return {
      status: "infeasible",
      pairResults,
      reason: "INSUFFICIENT_CAPACITY",
      message: `定員 ${totalCapacity} 頭に対して ${pets.length} 頭いるため、全頭を配置できません。`,
      evaluatedAssignments: 0,
    };
  }

  if (minimumRequired > pets.length || orderedRooms.some((room) => (room.minOccupancy ?? 1) > room.capacity)) {
    return {
      status: "infeasible",
      pairResults,
      reason: "MINIMUM_OCCUPANCY_UNSATISFIABLE",
      message: "部屋の最低頭数を満たす配置が作れません。",
      evaluatedAssignments: 0,
    };
  }

  const hardDegree = new Map<string, number>();
  for (const pair of pairResults) {
    if (!pair.allowed) {
      hardDegree.set(pair.petAId, (hardDegree.get(pair.petAId) ?? 0) + 1);
      hardDegree.set(pair.petBId, (hardDegree.get(pair.petBId) ?? 0) + 1);
    }
  }
  const orderedPets = [...pets].sort((left, right) => {
    const degreeDifference = (hardDegree.get(right.id) ?? 0) - (hardDegree.get(left.id) ?? 0);
    return degreeDifference || left.id.localeCompare(right.id);
  });

  const assignments = new Map(orderedRooms.map((room) => [room.id, [] as string[]]));
  let best: Candidate | null = null;
  let evaluatedAssignments = 0;

  const search = (petIndex: number) => {
    if (petIndex === orderedPets.length) {
      if (orderedRooms.some((room) => (assignments.get(room.id)?.length ?? 0) < (room.minOccupancy ?? 1))) {
        return;
      }

      evaluatedAssignments += 1;
      const allPairs = orderedRooms.flatMap((room) =>
        getRoomPairResults(assignments.get(room.id) ?? [], pairIndex),
      );
      const candidate: Candidate = {
        assignments: new Map(
          orderedRooms.map((room) => [room.id, [...(assignments.get(room.id) ?? [])]]),
        ),
        objectiveScore: round(sum(allPairs.map((pair) => pair.score - neutralScore))),
        totalCompatibilityScore: round(sum(allPairs.map((pair) => pair.score))),
        canonicalKey: buildCanonicalKey(orderedRooms, assignments),
      };

      if (compareCandidate(candidate, best)) best = candidate;
      return;
    }

    const pet = orderedPets[petIndex];
    for (const room of orderedRooms) {
      const occupants = assignments.get(room.id) ?? [];
      if (occupants.length >= room.capacity) continue;

      const allowed = occupants.every((occupantId) => {
        const pair = pairIndex.get(createPairKey(pet.id, occupantId));
        return pair?.allowed ?? false;
      });
      if (!allowed) continue;

      occupants.push(pet.id);
      search(petIndex + 1);
      occupants.pop();
    }
  };

  search(0);

  if (!best) {
    return {
      status: "infeasible",
      pairResults,
      reason: "HARD_CONSTRAINTS",
      message: "定員内でハード制約を一件も破らない配置がありません。",
      evaluatedAssignments,
    };
  }

  const winner: Candidate = best;
  const roomAssignments: RoomAssignment[] = orderedRooms.map((room) => {
    const petIds = [...(winner.assignments.get(room.id) ?? [])].sort((left, right) =>
      left.localeCompare(right),
    );
    const pairs = getRoomPairResults(petIds, pairIndex);
    const scores = pairs.map((pair) => pair.score);
    return {
      roomId: room.id,
      petIds,
      pairKeys: pairs.map((pair) => pair.pairKey),
      averageCompatibility: scores.length ? round(sum(scores) / scores.length) : null,
      minimumCompatibility: scores.length ? Math.min(...scores) : null,
    };
  });

  return {
    status: "success",
    pairResults,
    rooms: roomAssignments,
    objectiveScore: winner.objectiveScore,
    totalCompatibilityScore: winner.totalCompatibilityScore,
    evaluatedAssignments,
  };
};
