import { describe, expect, it } from "vitest";
import {
  calculateAllPairCompatibilities,
  evaluateManualAssignments,
} from "./index";
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

const rooms: RoomDefinition[] = [
  { id: "room-a", name: "A", capacity: 2, minOccupancy: 2 },
  { id: "room-b", name: "B", capacity: 2, minOccupancy: 2 },
];

describe("evaluateManualAssignments", () => {
  it("evaluates a valid manual swap with deterministic pair metrics", () => {
    const pets = [pet("a"), pet("b"), pet("c"), pet("d")];
    const result = evaluateManualAssignments(
      pets,
      rooms,
      calculateAllPairCompatibilities(pets),
      [
        { roomId: "room-b", petIds: ["d", "b"] },
        { roomId: "room-a", petIds: ["c", "a"] },
      ],
    );

    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.rooms).toEqual([
      {
        roomId: "room-a",
        petIds: ["a", "c"],
        pairKeys: ["a::c"],
        averageCompatibility: expect.any(Number),
        minimumCompatibility: expect.any(Number),
      },
      {
        roomId: "room-b",
        petIds: ["b", "d"],
        pairKeys: ["b::d"],
        averageCompatibility: expect.any(Number),
        minimumCompatibility: expect.any(Number),
      },
    ]);
  });

  it("reports a pet assigned to more than one room", () => {
    const pets = [pet("a"), pet("b"), pet("c")];
    const result = evaluateManualAssignments(
      pets,
      rooms,
      calculateAllPairCompatibilities(pets),
      [
        { roomId: "room-a", petIds: ["a", "b"] },
        { roomId: "room-b", petIds: ["a", "c"] },
      ],
    );

    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: "DUPLICATE_PET",
      roomIds: ["room-a", "room-b"],
      petIds: ["a"],
    }));
  });

  it("reports duplicate entries for the same pet in one room", () => {
    const pets = [pet("a"), pet("b"), pet("c"), pet("d")];
    const result = evaluateManualAssignments(
      pets,
      rooms,
      calculateAllPairCompatibilities(pets),
      [
        { roomId: "room-a", petIds: ["a", "a", "b"] },
        { roomId: "room-b", petIds: ["c", "d"] },
      ],
    );

    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: "DUPLICATE_PET_ENTRY",
      roomIds: ["room-a"],
      petIds: ["a"],
    }));
    expect(result.rooms[0].petIds).toEqual(["a", "b"]);
  });

  it("reports room capacity violations", () => {
    const pets = [pet("a"), pet("b"), pet("c"), pet("d")];
    const result = evaluateManualAssignments(
      pets,
      rooms,
      calculateAllPairCompatibilities(pets),
      [
        { roomId: "room-a", petIds: ["a", "b", "c"] },
        { roomId: "room-b", petIds: ["d"] },
      ],
    );

    expect(result.issues).toContainEqual(expect.objectContaining({
      code: "ROOM_OVER_CAPACITY",
      roomIds: ["room-a"],
      petIds: ["a", "b", "c"],
    }));
  });

  it("reports hard-constraint roommate pairs", () => {
    const pets = [
      pet("a", { hardBlockedPetIds: ["b"] }),
      pet("b"),
      pet("c"),
      pet("d"),
    ];
    const result = evaluateManualAssignments(
      pets,
      rooms,
      calculateAllPairCompatibilities(pets),
      [
        { roomId: "room-a", petIds: ["a", "b"] },
        { roomId: "room-b", petIds: ["c", "d"] },
      ],
    );

    expect(result.issues).toContainEqual(expect.objectContaining({
      code: "HARD_CONSTRAINT_PAIR",
      roomIds: ["room-a"],
      petIds: ["a", "b"],
      pairKey: "a::b",
    }));
  });

  it("reports unassigned pets and rooms below minimum occupancy", () => {
    const pets = [pet("a"), pet("b"), pet("c"), pet("d")];
    const result = evaluateManualAssignments(
      pets,
      rooms,
      calculateAllPairCompatibilities(pets),
      [
        { roomId: "room-a", petIds: ["a", "b"] },
        { roomId: "room-b", petIds: ["c"] },
      ],
    );

    expect(result.unassignedPetIds).toEqual(["d"]);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "ROOM_BELOW_MINIMUM", roomIds: ["room-b"] }),
      expect.objectContaining({ code: "UNASSIGNED_PET", petIds: ["d"] }),
    ]));
  });

  it("reports unknown pet and room identifiers without adding them to evaluated rooms", () => {
    const pets = [pet("a"), pet("b"), pet("c"), pet("d")];
    const result = evaluateManualAssignments(
      pets,
      rooms,
      calculateAllPairCompatibilities(pets),
      [
        { roomId: "room-a", petIds: ["a", "b", "unknown-pet"] },
        { roomId: "room-b", petIds: ["c", "d"] },
        { roomId: "unknown-room", petIds: ["a"] },
      ],
    );

    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: "UNKNOWN_PET",
        roomIds: ["room-a"],
        petIds: ["unknown-pet"],
      }),
      expect.objectContaining({
        code: "UNKNOWN_ROOM",
        roomIds: ["unknown-room"],
      }),
    ]));
    expect(result.rooms.flatMap((room) => room.petIds)).not.toContain("unknown-pet");
    expect(result.rooms.map((room) => room.roomId)).toEqual(["room-a", "room-b"]);
  });

  it("blocks confirmation when a room pair is missing from the evaluation matrix", () => {
    const pets = [pet("a"), pet("b"), pet("c"), pet("d")];
    const pairCompatibilities = calculateAllPairCompatibilities(pets)
      .filter((pair) => pair.pairKey !== "a::b");
    const result = evaluateManualAssignments(
      pets,
      rooms,
      pairCompatibilities,
      [
        { roomId: "room-a", petIds: ["a", "b"] },
        { roomId: "room-b", petIds: ["c", "d"] },
      ],
    );

    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: "MISSING_PAIR_EVALUATION",
      roomIds: ["room-a"],
      petIds: ["a", "b"],
      pairKey: "a::b",
    }));
    expect(result.rooms[0]).toMatchObject({
      pairKeys: ["a::b"],
      averageCompatibility: null,
      minimumCompatibility: null,
    });
  });
});
