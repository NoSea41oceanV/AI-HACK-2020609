import type {
  PairCompatibility,
  PetProfile,
  ScoreBreakdown,
} from "./types";

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

const normalizeFivePoint = (value: number) => clamp(value, 1, 5);
const normalizeGuarding = (value: number) => clamp(value, 0, 5);
const round = (value: number) => Math.round(value * 10) / 10;

export const createPairKey = (petAId: string, petBId: string): string =>
  [petAId, petBId].sort((left, right) => left.localeCompare(right)).join("::");

const similarity = (left: number, right: number) =>
  1 - Math.abs(normalizeFivePoint(left) - normalizeFivePoint(right)) / 4;

const calculatePlayStyleScore = (left: PetProfile, right: PetProfile) => {
  const leftStyles = new Set(left.playStyles);
  const rightStyles = new Set(right.playStyles);
  const union = new Set([...leftStyles, ...rightStyles]);

  if (union.size === 0) return 10;

  let overlap = 0;
  for (const style of leftStyles) {
    if (rightStyles.has(style)) overlap += 1;
  }
  return 20 * (overlap / union.size);
};

const calculateSizeScore = (left: PetProfile, right: PetProfile) => {
  const smaller = Math.max(0.5, Math.min(left.weightKg, right.weightKg));
  const larger = Math.max(smaller, Math.max(left.weightKg, right.weightKg));
  const logarithmicGap = Math.log(larger / smaller) / Math.log(4);
  return 20 * (1 - clamp(logarithmicGap, 0, 1));
};

export const calculatePairCompatibility = (
  petA: PetProfile,
  petB: PetProfile,
): PairCompatibility => {
  if (petA.id === petB.id) {
    throw new Error("A pet cannot be compared with itself.");
  }

  const hardConstraints = [];
  const blockedByA = petA.hardBlockedPetIds?.includes(petB.id) ?? false;
  const blockedByB = petB.hardBlockedPetIds?.includes(petA.id) ?? false;
  if (blockedByA || blockedByB) {
    hardConstraints.push({
      code: "EXPLICIT_BLOCK" as const,
      message: `${petA.name} と ${petB.name} は安全上の理由で同室不可です。`,
      sourcePetIds: [
        ...(blockedByA ? [petA.id] : []),
        ...(blockedByB ? [petB.id] : []),
      ],
    });
  }

  const emotionalRisk = Math.max(
    normalizeFivePoint(petA.anxietyLevel) * normalizeFivePoint(petB.assertiveness),
    normalizeFivePoint(petB.anxietyLevel) * normalizeFivePoint(petA.assertiveness),
  );

  const breakdown: ScoreBreakdown = {
    energy: round(25 * similarity(petA.energyLevel, petB.energyLevel)),
    size: round(calculateSizeScore(petA, petB)),
    playStyle: round(calculatePlayStyleScore(petA, petB)),
    sociability: round(15 * similarity(petA.sociability, petB.sociability)),
    emotionalBalance: round(10 * (1 - clamp((emotionalRisk - 1) / 24, 0, 1))),
    resourceSafety: round(
      10 * (1 - Math.max(normalizeGuarding(petA.resourceGuarding), normalizeGuarding(petB.resourceGuarding)) / 5),
    ),
  };

  const score = round(
    breakdown.energy +
      breakdown.size +
      breakdown.playStyle +
      breakdown.sociability +
      breakdown.emotionalBalance +
      breakdown.resourceSafety,
  );

  return {
    pairKey: createPairKey(petA.id, petB.id),
    petAId: petA.id,
    petBId: petB.id,
    score,
    breakdown,
    hardConstraints,
    allowed: hardConstraints.length === 0,
  };
};

export const calculateAllPairCompatibilities = (
  pets: readonly PetProfile[],
): PairCompatibility[] => {
  const orderedPets = [...pets].sort((left, right) => left.id.localeCompare(right.id));
  const results: PairCompatibility[] = [];

  for (let leftIndex = 0; leftIndex < orderedPets.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < orderedPets.length; rightIndex += 1) {
      results.push(calculatePairCompatibility(orderedPets[leftIndex], orderedPets[rightIndex]));
    }
  }

  return results;
};
