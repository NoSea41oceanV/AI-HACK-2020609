import { describe, expect, it } from "vitest";
import { LocalOperationRepository } from "./localOperationRepository";
import { isMatchingSnapshot, isObservationRecord, type MatchingSnapshot, type ObservationRecord } from "./operationRepository";

const matching = (id: string, createdAt = "2026-09-22T00:00:00.000Z"): MatchingSnapshot => ({
  id,
  status: "proposed",
  petIds: ["a", "b"],
  pairResults: [{ pairKey: "a::b", petAId: "a", petBId: "b", score: 82, allowed: true, hardConstraintCodes: [] }],
  rooms: [{ roomId: "room-1", petIds: ["a", "b"], averageCompatibility: 82, minimumCompatibility: 82 }],
  objectiveScore: 32,
  createdAt,
});
const observation = (id: string, observedAt = "2026-09-22T00:00:00.000Z"): ObservationRecord => ({
  id,
  scenarioId: "calm-room",
  title: "落ち着いて過ごしている",
  facts: ["2頭とも伏せている"],
  impacts: ["現行配置を維持"],
  recommendation: "次回観測まで継続",
  observedAt,
});
const memoryStorage = () => {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
};

describe("operation validators", () => {
  it("accepts bounded matching and observation data", () => {
    expect(isMatchingSnapshot(matching("match-1"))).toBe(true);
    expect(isObservationRecord(observation("obs-1"))).toBe(true);
  });

  it("rejects values over collection limits", () => {
    expect(isMatchingSnapshot({ ...matching("too-many-pets"), petIds: Array.from({ length: 21 }, (_, index) => `pet-${index}`) })).toBe(false);
    expect(isMatchingSnapshot({ ...matching("too-many-pairs"), pairResults: Array.from({ length: 191 }, () => matching("x").pairResults[0]) })).toBe(false);
    expect(isMatchingSnapshot({ ...matching("too-many-rooms"), rooms: Array.from({ length: 11 }, () => matching("x").rooms[0]) })).toBe(false);
    expect(isObservationRecord({ ...observation("too-many-facts"), facts: Array.from({ length: 21 }, () => "fact") })).toBe(false);
  });
});

describe("LocalOperationRepository", () => {
  it("creates immutable records and rejects duplicate ids", async () => {
    const repository = new LocalOperationRepository(memoryStorage());
    const value = matching("match-1");
    await repository.saveMatching(value);
    value.petIds.push("changed");
    expect((await repository.listMatchings())[0].petIds).toEqual(["a", "b"]);
    await expect(repository.saveMatching(matching("match-1"))).rejects.toThrow("already exists");
  });

  it("sorts both record types newest-first and caps lists at 25", async () => {
    const repository = new LocalOperationRepository(memoryStorage());
    for (let index = 0; index < 30; index += 1) {
      const timestamp = new Date(Date.UTC(2026, 8, 1, 0, index)).toISOString();
      await repository.saveMatching(matching(`match-${index}`, timestamp));
      await repository.saveObservation(observation(`obs-${index}`, timestamp));
    }
    const matchings = await repository.listMatchings(100);
    const observations = await repository.listObservations(100);
    expect(matchings).toHaveLength(25);
    expect(observations).toHaveLength(25);
    expect(matchings[0].id).toBe("match-29");
    expect(observations[0].id).toBe("obs-29");
  });
});
