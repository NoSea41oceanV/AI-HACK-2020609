import type { Auth } from "firebase/auth";
import type { Firestore } from "firebase/firestore";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FirestoreManualObservationRepository } from "./firestoreManualObservationRepository";
import { prepareManualObservation, type CreateManualObservationInput } from "./manualObservationRepository";

const fake = vi.hoisted(() => ({
  documents: new Map<string, Record<string, unknown>>(), writes: vi.fn(), reads: [] as string[],
  duringGet: null as (() => void) | null,
  lastQuery: [] as unknown[],
}));
vi.mock("firebase/firestore", () => ({
  collection: (_db: unknown, ...path: string[]) => path.join("/"),
  doc: (_db: unknown, ...path: string[]) => path.join("/"),
  query: (...values: unknown[]) => { fake.lastQuery = values; return values; },
  orderBy: (...values: unknown[]) => values,
  where: (...values: unknown[]) => values,
  limit: (value: number) => value,
  getDocs: async () => ({ docs: [...fake.documents.entries()].filter(([path]) => path.includes("/demoObservations/")).map(([, value]) => ({ data: () => value })) }),
  runTransaction: async (_db: unknown, callback: (transaction: unknown) => Promise<unknown>) => callback({
    get: async (path: string) => {
      fake.reads.push(path);
      fake.duringGet?.();
      return { exists: () => fake.documents.has(path), data: () => fake.documents.get(path) };
    },
    set: (path: string, value: Record<string, unknown>) => { fake.writes(path, value); fake.documents.set(path, structuredClone(value)); },
  }),
}));

const input = (): CreateManualObservationInput => ({ id: "obs-1", title: "落ち着いている", facts: ["伏せている"], impacts: [], recommendation: "", observedAt: "2026-09-20T15:00:00.000Z", operationDate: "2026-09-21", staffId: "staff-1", petIds: ["pet-1", "pet-2"] });
const path = "facilities/facility-1/demoObservations/obs-1";
const makeRepository = () => {
  const auth = { currentUser: { uid: "facility-1" } } as Auth;
  return { auth, repository: new FirestoreManualObservationRepository({} as Firestore, auth) };
};

beforeEach(() => {
  fake.documents.clear(); fake.reads.length = 0; fake.writes.mockClear(); fake.duringGet = null;
  fake.documents.set("facilities/facility-1/staffProfiles/staff-1", { active: true });
  fake.documents.set("facilities/facility-1/demoPets/pet-1", {});
  fake.documents.set("facilities/facility-1/demoPets/pet-2", {});
});

describe("FirestoreManualObservationRepository", () => {
  it("creates once and treats identical retries as idempotent, but never overwrites conflicting payloads", async () => {
    const { repository } = makeRepository();
    const first = await repository.createManual(input());
    expect(await repository.createManual(input())).toEqual(first);
    expect(fake.writes).toHaveBeenCalledTimes(1);
    await expect(repository.createManual({ ...input(), title: "変更" })).rejects.toThrow("同じID");
    expect(fake.documents.get(path)?.title).toBe(input().title);
  });

  it("keeps the captured facility through authentication changes during transaction reads", async () => {
    const { auth, repository } = makeRepository();
    fake.duringGet = () => { Object.assign(auth, { currentUser: { uid: "facility-2" } }); };
    await repository.createManual(input());
    expect(fake.reads).toHaveLength(4);
    expect(fake.reads.every((reference) => reference.startsWith("facilities/facility-1/"))).toBe(true);
    expect(fake.writes.mock.calls[0][0]).toBe(path);
  });

  it("rejects expected-facility mismatch before touching Firestore", async () => {
    const { repository } = makeRepository();
    await expect(repository.createManual(input(), "facility-2")).rejects.toThrow("施設アカウント");
    expect(fake.reads).toHaveLength(0);
  });

  it.each(["missing", "inactive"])("requires an active same-facility staff profile (%s)", async (mode) => {
    fake.documents.delete("facilities/facility-1/staffProfiles/staff-1");
    if (mode === "inactive") fake.documents.set("facilities/facility-1/staffProfiles/staff-1", { active: false });
    fake.documents.set("facilities/facility-2/staffProfiles/staff-1", { active: true });
    await expect(makeRepository().repository.createManual(input())).rejects.toThrow("担当スタッフ");
    expect(fake.writes).not.toHaveBeenCalled();
  });

  it("rejects pets that exist only in another facility", async () => {
    fake.documents.delete("facilities/facility-1/demoPets/pet-2");
    fake.documents.set("facilities/facility-2/demoPets/pet-2", {});
    await expect(makeRepository().repository.createManual(input())).rejects.toThrow("ペット");
    expect(fake.writes).not.toHaveBeenCalled();
  });

  it("does not promote or overwrite legacy scenario observations", async () => {
    const { source: _source, staffId: _staffId, petIds: _petIds, operationDate: _date, ...legacy } = prepareManualObservation(input());
    fake.documents.set(path, { ...legacy, scenarioId: "calm-room" });
    const { repository } = makeRepository();
    expect(await repository.listManual()).toEqual([]);
    await expect(repository.createManual(input())).rejects.toThrow("同じID");
    expect(fake.writes).not.toHaveBeenCalled();
  });

  it("filters manual source in the database before applying the bounded newest-first limit", async () => {
    await makeRepository().repository.listManual(100);
    expect(fake.lastQuery).toEqual(["facilities/facility-1/demoObservations", ["source", "==", "manual"], ["observedAt", "desc"], 25]);
  });
});
