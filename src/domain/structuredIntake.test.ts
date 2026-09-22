import { describe, expect, it } from "vitest";
import { isIntakeConsent, isPersonalityAxes, isStructuredIntakeAnswers, PERSONALITY_AXIS_KEYS, STRUCTURED_INTAKE_OPTIONS } from "./structuredIntake";

const answers = () => ({
  ...Object.fromEntries(Object.entries(STRUCTURED_INTAKE_OPTIONS).map(([key, options]) => [key, options[0]])),
  medicalHistory: "なし", sensoryJointConcerns: "なし", troubleHistory: "なし",
});
const axes = () => Object.fromEntries(PERSONALITY_AXIS_KEYS.map((key, index) => [key, index * 15]));

describe("structured intake contract", () => {
  it("accepts every mock option but rejects omissions, unknown keys, and invented answers", () => {
    expect(isStructuredIntakeAnswers(answers())).toBe(true);
    for (const [key, options] of Object.entries(STRUCTURED_INTAKE_OPTIONS)) {
      for (const option of options) expect(isStructuredIntakeAnswers({ ...answers(), [key]: option })).toBe(true);
      expect(isStructuredIntakeAnswers({ ...answers(), [key]: "未選択" })).toBe(false);
    }
    expect(isStructuredIntakeAnswers({ ...answers(), ownerName: "unexpected" })).toBe(false);
    expect(isStructuredIntakeAnswers({ ...answers(), heat: undefined })).toBe(false);
    expect(isStructuredIntakeAnswers({ ...answers(), medicalHistory: "a".repeat(1001) })).toBe(false);
  });
  it("requires seven bounded integers without substituting values", () => {
    expect(isPersonalityAxes(axes())).toBe(true);
    for (const invalid of [-1, 101, 4.5, NaN, Infinity, "50", undefined]) {
      expect(isPersonalityAxes({ ...axes(), trainability: invalid })).toBe(false);
    }
    expect(isPersonalityAxes({ ...axes(), extra: 50 })).toBe(false);
    expect(isPersonalityAxes({ ...axes(), resilience: 100 })).toBe(true);
  });
  it("records explicit versioned consent with a timestamp", () => {
    const consent = { version: "2026-09", accepted: true, acceptedAt: "2026-09-22T01:02:03.000Z" };
    expect(isIntakeConsent(consent)).toBe(true);
    expect(isIntakeConsent({ ...consent, accepted: false })).toBe(false);
    expect(isIntakeConsent({ ...consent, version: "2026-08" })).toBe(false);
    expect(isIntakeConsent({ ...consent, acceptedAt: "yesterday" })).toBe(false);
    expect(isIntakeConsent({ ...consent, acceptedAt: "2026-02-30T01:02:03.000Z" })).toBe(false);
    expect(isIntakeConsent({ ...consent, acceptedAt: "2026-09-22T01:02:03Z" })).toBe(false);
    expect(isIntakeConsent({ ...consent, owner: "unexpected" })).toBe(false);
  });
});
