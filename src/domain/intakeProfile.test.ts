import { describe, expect, it } from "vitest";
import { intakeToPetProfile } from "./intakeProfile";
import type { PersonalityAxes } from "./structuredIntake";

const baseSource = {
  intakeId: "intake-1",
  pet: {
    name: "こむぎ",
    breed: "トイプードル",
    ageYears: 3,
    weightKg: 4.2,
    personality: "人懐っこく活発です",
    playStyle: "ボールを持ってくる遊びと追いかけっこが好き",
    concerns: "",
  },
};

describe("intakeToPetProfile", () => {
  it("copies generated axes and leaves legacy profiles without synthetic axes", () => {
    const personalityAxes: PersonalityAxes = { extraversion: 12, sociability: 34, neuroticism: 56, trainability: 78, resourceGuarding: 90, assertiveness: 23, resilience: 45 };
    const matchingProfile = { energyLevel: 3, sociability: 3, anxietyLevel: 3, assertiveness: 3, resourceGuarding: 1, playStyles: [], hardBlockedPetIds: [], personalityAxes };
    const profile = intakeToPetProfile({ ...baseSource, matchingProfile });
    expect(profile.personalityAxes).toEqual(personalityAxes);
    expect(profile.personalityAxes).not.toBe(personalityAxes);
    expect(intakeToPetProfile(baseSource)).not.toHaveProperty("personalityAxes");
    expect(intakeToPetProfile({ ...baseSource, matchingProfile: { ...matchingProfile, personalityAxes: { ...personalityAxes, resilience: 101 } } })).not.toHaveProperty("personalityAxes");
  });
  it("creates a deterministic profile from form text without AI", () => {
    const first = intakeToPetProfile(baseSource);
    expect(intakeToPetProfile(baseSource)).toEqual(first);
    expect(first).toMatchObject({ id: "intake-1", energyLevel: 4, sociability: 4, playStyles: ["chase", "fetch"] });
  });

  it("uses the AI matching profile while defensively clamping values", () => {
    const result = intakeToPetProfile({
      ...baseSource,
      matchingProfile: {
        energyLevel: 9,
        sociability: 4,
        anxietyLevel: 1.4,
        assertiveness: 3,
        resourceGuarding: 0,
        playStyles: ["tug"],
        hardBlockedPetIds: ["pet-z", "pet-z", "pet-a"],
      },
    });
    expect(result.energyLevel).toBe(5);
    expect(result.anxietyLevel).toBe(1);
    expect(result.resourceGuarding).toBe(0);
    expect(result.playStyles).toEqual(["tug"]);
    expect(result.hardBlockedPetIds).toEqual(["pet-a", "pet-z"]);
  });
});
