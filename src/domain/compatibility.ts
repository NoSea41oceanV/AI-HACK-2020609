import type {
  AiSevenAxisEvaluation,
  PairCompatibility,
  PetProfile,
  ScoreBreakdown,
} from "./types";
import { isPersonalityAxes, type PersonalityAxes } from "./structuredIntake";

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

const normalizeFivePoint = (value: number) => clamp(value, 1, 5);
const normalizeGuarding = (value: number) => clamp(value, 0, 5);
const round = (value: number) => Math.round(value * 10) / 10;

const AI_SEVEN_AXIS_MAXIMUM_CONTRIBUTION = 18 as const;

export const createPairKey = (petAId: string, petBId: string): string =>
  [petAId, petBId].sort((left, right) => left.localeCompare(right)).join("::");

const similarity = (left: number, right: number) =>
  1 - Math.abs(normalizeFivePoint(left) - normalizeFivePoint(right)) / 4;

const hundredPointSimilarity = (left: number, right: number) =>
  1 - Math.abs(left - right) / 100;

interface AiSevenAxisComponents {
  extraversionSimilarity: number;
  sociabilitySimilarity: number;
  emotionalSafety: number;
  resilienceSupport: number;
  resourceSafety: number;
  trainabilitySupport: number;
}

const calculateAiSevenAxisComponents = (
  left: PersonalityAxes,
  right: PersonalityAxes,
): AiSevenAxisComponents => ({
  extraversionSimilarity: hundredPointSimilarity(left.extraversion, right.extraversion),
  sociabilitySimilarity: hundredPointSimilarity(left.sociability, right.sociability),
  // A neurotic pet paired with a highly assertive counterpart is the relevant
  // interaction risk, in either direction.
  emotionalSafety: 1 - Math.max(
    left.neuroticism * right.assertiveness,
    right.neuroticism * left.assertiveness,
  ) / 10_000,
  // For pair safety, the less resilient/trainable member limits the pair.
  resilienceSupport: Math.min(left.resilience, right.resilience) / 100,
  resourceSafety: 1 - Math.max(left.resourceGuarding, right.resourceGuarding) / 100,
  trainabilitySupport: Math.min(left.trainability, right.trainability) / 100,
});

const calculateAiSevenAxisEvaluation = (
  components: AiSevenAxisComponents,
): AiSevenAxisEvaluation => {
  const contributionBreakdown = {
    extraversionSimilarity: round(5 * components.extraversionSimilarity),
    sociabilitySimilarity: round(5 * components.sociabilitySimilarity),
    neuroticismAssertivenessSafety: round(2.5 * components.emotionalSafety),
    trainabilitySupport: round(components.trainabilitySupport),
    resourceGuardingSafety: round(3 * components.resourceSafety),
    resilienceSupport: round(1.5 * components.resilienceSupport),
  };
  const contributionPoints = Object.values(contributionBreakdown)
    .reduce((sum, contribution) => sum + contribution, 0);

  return {
    score: round(contributionPoints / AI_SEVEN_AXIS_MAXIMUM_CONTRIBUTION * 100),
    contributionPoints: round(contributionPoints),
    maximumContributionPoints: AI_SEVEN_AXIS_MAXIMUM_CONTRIBUTION,
    contributionBreakdown,
  };
};

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

  const legacyEmotionalSafety = 1 - clamp((emotionalRisk - 1) / 24, 0, 1);
  const legacyResourceSafety =
    1 - Math.max(normalizeGuarding(petA.resourceGuarding), normalizeGuarding(petB.resourceGuarding)) / 5;
  const aiSevenAxisApplied =
    isPersonalityAxes(petA.personalityAxes) && isPersonalityAxes(petB.personalityAxes);
  const aiSevenAxisMissingPetIds = [petA, petB]
    .filter((pet) => !isPersonalityAxes(pet.personalityAxes))
    .map((pet) => pet.id);
  const aiComponents = aiSevenAxisApplied
    ? calculateAiSevenAxisComponents(petA.personalityAxes!, petB.personalityAxes!)
    : undefined;
  const aiSevenAxisEvaluation = aiComponents
    ? calculateAiSevenAxisEvaluation(aiComponents)
    : undefined;

  const breakdown: ScoreBreakdown = {
    energy: round(aiComponents
      ? 20 * similarity(petA.energyLevel, petB.energyLevel) + 5 * aiComponents.extraversionSimilarity
      : 25 * similarity(petA.energyLevel, petB.energyLevel)),
    size: round(calculateSizeScore(petA, petB)),
    playStyle: round(calculatePlayStyleScore(petA, petB)),
    sociability: round(aiComponents
      ? 10 * similarity(petA.sociability, petB.sociability) + 5 * aiComponents.sociabilitySimilarity
      : 15 * similarity(petA.sociability, petB.sociability)),
    emotionalBalance: round(aiComponents
      ? 6 * legacyEmotionalSafety + 2.5 * aiComponents.emotionalSafety + 1.5 * aiComponents.resilienceSupport
      : 10 * legacyEmotionalSafety),
    resourceSafety: round(aiComponents
      ? 6 * legacyResourceSafety + 3 * aiComponents.resourceSafety + aiComponents.trainabilitySupport
      : 10 * legacyResourceSafety),
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
    aiSevenAxisApplied,
    ...(aiSevenAxisEvaluation ? { aiSevenAxisEvaluation } : {}),
    ...(!aiSevenAxisApplied ? {
      aiSevenAxisFallback: {
        reason: "MISSING_OR_INVALID_AXES" as const,
        petIds: aiSevenAxisMissingPetIds,
      },
    } : {}),
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
