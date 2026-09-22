import { describe, expect, it } from "vitest";
import { calculatePairCompatibility } from "./compatibility";
import type { PersonalityAxes } from "./structuredIntake";
import type { PetProfile } from "./types";

const pet = (id: string, overrides: Partial<PetProfile> = {}): PetProfile => ({
  id,
  name: id.toUpperCase(),
  ageYears: 3,
  weightKg: 8,
  energyLevel: 3,
  sociability: 3,
  anxietyLevel: 2,
  assertiveness: 2,
  resourceGuarding: 1,
  playStyles: ["gentle"],
  ...overrides,
});

const favorableAxes: PersonalityAxes = {
  extraversion: 70,
  sociability: 80,
  neuroticism: 10,
  trainability: 90,
  resourceGuarding: 5,
  assertiveness: 30,
  resilience: 90,
};

describe("calculatePairCompatibility seven-axis scoring", () => {
  it("preserves the exact legacy six-factor calculation when axes are absent", () => {
    const result = calculatePairCompatibility(pet("a"), pet("b"));

    expect(result.breakdown).toEqual({
      energy: 25,
      size: 20,
      playStyle: 20,
      sociability: 15,
      emotionalBalance: 8.8,
      resourceSafety: 8,
    });
    expect(result.score).toBe(96.8);
    expect(result.aiSevenAxisApplied).toBe(false);
    expect(result.aiSevenAxisEvaluation).toBeUndefined();
    expect(result.aiSevenAxisFallback).toEqual({
      reason: "MISSING_OR_INVALID_AXES",
      petIds: ["a", "b"],
    });
  });

  it("does not invent a seven-axis comparison when only one profile has axes", () => {
    const legacy = calculatePairCompatibility(
      pet("a", { personalityAxes: favorableAxes }),
      pet("b"),
    );
    const baseline = calculatePairCompatibility(pet("a"), pet("b"));

    expect(legacy).toMatchObject({
      score: baseline.score,
      breakdown: baseline.breakdown,
      aiSevenAxisApplied: false,
    });
    expect(legacy.aiSevenAxisEvaluation).toBeUndefined();
    expect(legacy.aiSevenAxisFallback).toEqual({
      reason: "MISSING_OR_INVALID_AXES",
      petIds: ["b"],
    });
  });

  it("uses all seven axes within the existing 100-point factors when both profiles have them", () => {
    const result = calculatePairCompatibility(
      pet("a", { personalityAxes: favorableAxes }),
      pet("b", { personalityAxes: favorableAxes }),
    );

    expect(result.aiSevenAxisApplied).toBe(true);
    expect(result.aiSevenAxisEvaluation).toEqual({
      score: 97.2,
      contributionPoints: 17.5,
      maximumContributionPoints: 18,
      contributionBreakdown: {
        extraversionSimilarity: 5,
        sociabilitySimilarity: 5,
        neuroticismAssertivenessSafety: 2.4,
        trainabilitySupport: 0.9,
        resourceGuardingSafety: 2.8,
        resilienceSupport: 1.4,
      },
    });
    expect(result.score).toBe(97.6);
    expect(Object.values(result.breakdown).reduce((sum, value) => sum + value, 0)).toBeCloseTo(result.score, 5);
  });

  it.each([
    ["extraversion", 0],
    ["sociability", 0],
    ["neuroticism", 100],
    ["trainability", 0],
    ["resourceGuarding", 100],
    ["assertiveness", 100],
    ["resilience", 0],
  ] as const)("changes the AI contribution when %s changes materially", (axis, value) => {
    const baseline = calculatePairCompatibility(
      pet("a", { personalityAxes: favorableAxes }),
      pet("b", { personalityAxes: favorableAxes }),
    );
    const changed = calculatePairCompatibility(
      pet("a", { personalityAxes: { ...favorableAxes, [axis]: value } }),
      pet("b", { personalityAxes: favorableAxes }),
    );

    expect(changed.aiSevenAxisEvaluation?.contributionPoints)
      .not.toBe(baseline.aiSevenAxisEvaluation?.contributionPoints);
  });

  it("lets materially different/risky AI axes change the score without bypassing hard blocks", () => {
    const riskyAxesA: PersonalityAxes = {
      extraversion: 0,
      sociability: 0,
      neuroticism: 100,
      trainability: 0,
      resourceGuarding: 100,
      assertiveness: 100,
      resilience: 0,
    };
    const riskyAxesB: PersonalityAxes = { ...riskyAxesA, extraversion: 100, sociability: 100 };
    const result = calculatePairCompatibility(
      pet("a", { personalityAxes: riskyAxesA, hardBlockedPetIds: ["b"] }),
      pet("b", { personalityAxes: riskyAxesB }),
    );

    expect(result.aiSevenAxisEvaluation).toEqual({
      score: 0,
      contributionPoints: 0,
      maximumContributionPoints: 18,
      contributionBreakdown: {
        extraversionSimilarity: 0,
        sociabilitySimilarity: 0,
        neuroticismAssertivenessSafety: 0,
        trainabilitySupport: 0,
        resourceGuardingSafety: 0,
        resilienceSupport: 0,
      },
    });
    expect(result.score).toBe(80.1);
    expect(result.allowed).toBe(false);
    expect(result.hardConstraints).toEqual([
      expect.objectContaining({ code: "EXPLICIT_BLOCK", sourcePetIds: ["a"] }),
    ]);
  });
});
