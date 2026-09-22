import { describe, expect, it } from "vitest";
import { demoPets } from "../data/demoData";
import {
  assertOperationDate, createSelectedRoomPlan, isCurrentPlan, isCurrentProposed, normalizeRooms, normalizeSelectedPetIds,
  type DailyOperationDay, type DailyOperationPlan, type FacilityRoomSettings,
} from "./dailyOperations";

describe("daily operations domain", () => {
  it("accepts calendar dates and rejects impossible or timestamp inputs", () => {
    expect(() => assertOperationDate("2028-02-29")).not.toThrow();
    for (const date of ["2026-02-29", "2026-13-01", "2026-09-22T00:00:00Z", "2026-9-2"]) {
      expect(() => assertOperationDate(date)).toThrow();
    }
  });
  it("normalizes optional minimum occupancy to zero and enforces room bounds", () => {
    expect(normalizeRooms([{ id: "a", name: " Room ", capacity: 2 }])[0]).toEqual({ id: "a", name: "Room", capacity: 2, minOccupancy: 0 });
    expect(() => normalizeRooms([{ id: "a", name: "A", capacity: 1, minOccupancy: 2 }])).toThrow();
    expect(() => normalizeRooms(Array.from({ length: 11 }, (_, i) => ({ id: `r${i}`, name: "A", capacity: 1 })))).toThrow();
    expect(() => normalizeSelectedPetIds(Array.from({ length: 21 }, (_, i) => `p${i}`))).toThrow();
    expect(() => normalizeSelectedPetIds(["a", "a"])).toThrow();
  });
  it("optimizes only an exact, complete selected set and permits unused rooms", () => {
    const rooms = [{ id: "a", name: "A", capacity: 2 }, { id: "b", name: "B", capacity: 2 }];
    const selected = [demoPets[0]];
    const result = createSelectedRoomPlan([selected[0].id], selected, rooms);
    expect(result.rooms.flatMap(room => room.petIds)).toEqual([selected[0].id]);
    expect(result.rooms.some(room => room.petIds.length === 0)).toBe(true);
    expect(() => createSelectedRoomPlan([selected[0].id], demoPets.slice(0, 2), rooms)).toThrow();
    expect(() => createSelectedRoomPlan([selected[0].id], [], rooms)).toThrow();
    expect(() => createSelectedRoomPlan([selected[0].id], [{ ...selected[0], weightKg: 0 }], rooms)).toThrow();
  });
  it("requires the facility, date, current head, selection and both revisions to match", () => {
    const day = { facilityId: "facility", date: "2026-09-22", latestPlanId: "p", revision: 4, selectedPetIds: ["a"] } as DailyOperationDay;
    const rooms = { facilityId: "facility", revision: 2 } as FacilityRoomSettings;
    const plan = { id: "p", facilityId: "facility", date: day.date, status: "proposed", dayRevision: 4, roomsRevision: 2, petIds: ["a"] } as DailyOperationPlan;
    expect(isCurrentProposed(day, rooms, plan)).toBe(true);
    for (const update of [{ date: "2026-09-23" }, { facilityId: "other" }, { id: "old" }, { dayRevision: 3 }, { roomsRevision: 1 }, { petIds: ["b"] }, { status: "confirmed" as const }]) {
      expect(isCurrentProposed(day, rooms, { ...plan, ...update })).toBe(false);
    }
    expect(isCurrentProposed(day, { ...rooms, facilityId: "other" }, plan)).toBe(false);
  });
  it("keeps a just-decided plan current but invalidates it after any later day or room save", () => {
    const day = { facilityId: "facility", date: "2026-09-22", latestPlanId: "p", revision: 5, selectedPetIds: ["a"], lastAuditId: "decision" } as DailyOperationDay;
    const rooms = { facilityId: "facility", revision: 2 } as FacilityRoomSettings;
    const plan = { id: "p", facilityId: "facility", date: day.date, status: "confirmed", dayRevision: 4, roomsRevision: 2, petIds: ["a"], lastAuditId: "decision" } as DailyOperationPlan;
    expect(isCurrentPlan(day, rooms, plan)).toBe(true);
    expect(isCurrentProposed(day, rooms, plan)).toBe(false);
    expect(isCurrentPlan(day, rooms, { ...plan, status: "rejected" })).toBe(true);
    expect(isCurrentPlan({ ...day, revision: 6, lastAuditId: "save" }, rooms, plan)).toBe(false);
    expect(isCurrentPlan({ ...day, lastAuditId: "save" }, rooms, plan)).toBe(false);
    expect(isCurrentPlan(day, { ...rooms, revision: 3 }, plan)).toBe(false);
    expect(isCurrentPlan(day, rooms, { ...plan, status: "superseded" })).toBe(false);
    expect(isCurrentPlan(null, rooms, plan)).toBe(false);
    expect(isCurrentPlan(day, null, plan)).toBe(false);
    expect(isCurrentPlan(day, rooms, null)).toBe(false);
  });
});
