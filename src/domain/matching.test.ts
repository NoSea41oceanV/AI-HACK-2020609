import { describe, expect, it } from "vitest";
import { calculateAllPairCompatibilities, createOptimalRoomPlan } from "./index";
import type { PetProfile, RoomDefinition } from "./types";

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

const twoDoubleRooms: RoomDefinition[] = [
  { id: "room-a", name: "A", capacity: 2, minOccupancy: 2 },
  { id: "room-b", name: "B", capacity: 2, minOccupancy: 2 },
];

describe("calculateAllPairCompatibilities", () => {
  it("scores every pair before grouping and retains hard-constraint metadata", () => {
    const pets = [pet("a", { hardBlockedPetIds: ["c"] }), pet("b"), pet("c")];
    const pairs = calculateAllPairCompatibilities(pets);

    expect(pairs).toHaveLength(3);
    expect(pairs.find((pair) => pair.pairKey === "a::c")).toMatchObject({ allowed: false });
    expect(pairs.every((pair) => Number.isFinite(pair.score))).toBe(true);
  });
});

describe("createOptimalRoomPlan", () => {
  it("uses the precomputed full matrix to choose the globally best fixed-size grouping", () => {
    const pets = [
      pet("a", { energyLevel: 5, sociability: 5, playStyles: ["chase"] }),
      pet("b", { energyLevel: 5, sociability: 5, playStyles: ["chase"] }),
      pet("c", { energyLevel: 1, sociability: 1, playStyles: ["solo"] }),
      pet("d", { energyLevel: 1, sociability: 1, playStyles: ["solo"] }),
    ];

    const result = createOptimalRoomPlan(pets, twoDoubleRooms);

    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.pairResults).toHaveLength(6);
    expect(result.rooms.map((room) => room.petIds)).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("reports insufficient total room capacity", () => {
    const result = createOptimalRoomPlan(
      [pet("a"), pet("b"), pet("c")],
      [{ id: "only", name: "Only", capacity: 2 }],
    );

    expect(result).toMatchObject({ status: "infeasible", reason: "INSUFFICIENT_CAPACITY" });
  });

  it("keeps a low-scoring roommate pair when room head-count constraints force it", () => {
    const pets = [
      pet("a", { energyLevel: 5, sociability: 5, playStyles: ["chase"] }),
      pet("b", { energyLevel: 5, sociability: 5, playStyles: ["chase"] }),
      pet("c", { energyLevel: 1, sociability: 1, anxietyLevel: 5, playStyles: ["solo"] }),
      pet("d", { energyLevel: 5, sociability: 1, assertiveness: 5, resourceGuarding: 5, playStyles: ["tug"] }),
    ];
    const result = createOptimalRoomPlan(pets, twoDoubleRooms, { neutralScore: 60 });

    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.rooms.flatMap((room) => room.minimumCompatibility ?? []).some((score) => score < 60)).toBe(true);
  });

  it("returns an explicit infeasible result instead of violating a hard constraint", () => {
    const pets = [pet("a", { hardBlockedPetIds: ["b"] }), pet("b"), pet("c")];
    const result = createOptimalRoomPlan(pets, [
      { id: "only", name: "Only", capacity: 3, minOccupancy: 3 },
    ]);

    expect(result).toMatchObject({ status: "infeasible", reason: "HARD_CONSTRAINTS" });
    expect(result.pairResults).toHaveLength(3);
  });

  it("is deterministic across input ordering", () => {
    const pets = [pet("a"), pet("b"), pet("c"), pet("d")];
    const forward = createOptimalRoomPlan(pets, twoDoubleRooms);
    const reversed = createOptimalRoomPlan([...pets].reverse(), [...twoDoubleRooms].reverse());

    expect(reversed).toEqual(forward);
  });
});
