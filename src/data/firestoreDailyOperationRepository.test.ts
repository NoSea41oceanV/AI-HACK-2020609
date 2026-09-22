import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Auth } from "firebase/auth";
import type { Firestore } from "firebase/firestore";
import { demoPets } from "./demoData";
import { FirestoreDailyOperationRepository } from "./firestoreDailyOperationRepository";

// Optimistic transaction fake stages all writes, checks read versions at commit,
// and retries conflicts. It exercises our concurrency contract without network.
const store = vi.hoisted(() => ({
  docs: new Map<string, Record<string, unknown>>(), versions: new Map<string, number>(), nextId: 0,
  afterRead: null as (() => void) | null,
}));
vi.mock("firebase/firestore", () => {
  type Ref = { path: string; id: string };
  const snapshot = (ref: Ref) => ({ id: ref.id, exists: () => store.docs.has(ref.path), data: () => structuredClone(store.docs.get(ref.path)) });
  return {
    collection: (_db: unknown, ...path: string[]) => ({ path: path.join("/") }),
    doc: (db: { path?: string }, ...segments: string[]) => {
      const path = segments.length ? segments.join("/") : `${db.path}/auto-${++store.nextId}`;
      return { path, id: path.split("/").at(-1) };
    },
    getDoc: async (ref: Ref) => snapshot(ref),
    getDocs: async () => ({ docs: [] }), query: (...args: unknown[]) => args,
    where: (...args: unknown[]) => args, orderBy: (...args: unknown[]) => args, limit: (value: number) => value,
    runTransaction: async (_db: unknown, body: (transaction: unknown) => Promise<unknown>) => {
      for (let attempt = 0; attempt < 5; attempt++) {
        const reads = new Map<string, number>();
        const writes = new Map<string, Record<string, unknown>>();
        const result = await body({
          get: async (ref: Ref) => {
            if (writes.size) throw new Error("read after write");
            reads.set(ref.path, store.versions.get(ref.path) ?? 0);
            const result = snapshot(ref);
            store.afterRead?.();
            return result;
          },
          set: (ref: Ref, value: Record<string, unknown>) => { writes.set(ref.path, structuredClone(value)); },
          update: (ref: Ref, value: Record<string, unknown>) => { writes.set(ref.path, { ...structuredClone(store.docs.get(ref.path)), ...structuredClone(value) }); },
        });
        if ([...reads].some(([path, version]) => (store.versions.get(path) ?? 0) !== version)) continue;
        for (const [path, value] of writes) {
          store.docs.set(path, value);
          store.versions.set(path, (store.versions.get(path) ?? 0) + 1);
        }
        return result;
      }
      throw new Error("transaction contention");
    },
  };
});

const date = "2026-09-22";
const staffId = "staff-a";
let auth: Auth;
let repository: FirestoreDailyOperationRepository;
const path = (suffix: string) => `facilities/facility-a/${suffix}`;
const audits = () => [...store.docs.entries()].filter(([key]) => key.startsWith(path("operationAudit/"))).map(([, value]) => value);
const prepare = async () => {
  const day = await repository.saveDay({ date, petIds: [demoPets[0].id], staffId, expectedRevision: 0 });
  const rooms = await repository.saveRooms({ rooms: [{ id: "room", name: "Room", capacity: 3 }], staffId, expectedRevision: 0 });
  return { day, rooms };
};
const calculate = (expectedRevision = 1) => repository.recalculate({ date, staffId, reason: "新しい配置案", expectedRevision, expectedRoomsRevision: 1 });

beforeEach(() => {
  store.docs.clear(); store.versions.clear(); store.nextId = 0; store.afterRead = null;
  auth = { currentUser: { uid: "facility-a" } } as Auth;
  repository = new FirestoreDailyOperationRepository({} as Firestore, auth);
  store.docs.set(path(`staffProfiles/${staffId}`), { active: true });
  for (const pet of demoPets) store.docs.set(path(`demoPets/${pet.id}`), { ...pet });
});

describe("Firestore daily operation transactions", () => {
  it("atomically supersedes proposals and allows only the saved latest proposal to be decided", async () => {
    await prepare();
    const first = await calculate();
    const second = await calculate(2);
    expect((await repository.getPlan(date, first.id))?.status).toBe("superseded");
    expect(second.sourcePlanId).toBe(first.id);
    await expect(repository.decide({ date, planId: first.id, staffId, decision: "confirmed", reason: "確認", expectedRevision: 3 })).rejects.toThrow("最新");
    const decided = await repository.decide({ date, planId: second.id, staffId, decision: "confirmed", reason: "確認済み", expectedRevision: 3 });
    expect(decided.status).toBe("confirmed");
    expect((await repository.getDay(date))?.revision).toBe(4);
    expect(audits()).toHaveLength(5);
    const event = audits().at(-1)!;
    expect(event).toMatchObject({ action: "confirmed", staffId, reason: "確認済み", sourcePlanId: second.id, planId: second.id });
    expect(decided.lastAuditId).toBe(event.id);
    await expect(repository.decide({ date, planId: second.id, staffId, decision: "rejected", reason: "変更", expectedRevision: 4 })).rejects.toThrow("最新");
  });
  it("rejects simultaneous stale saves and concurrent decisions without partial audits", async () => {
    await prepare();
    const saves = await Promise.allSettled([
      repository.saveDay({ date, petIds: [demoPets[1].id], staffId, expectedRevision: 1 }),
      repository.saveDay({ date, petIds: [demoPets[2].id], staffId, expectedRevision: 1 }),
    ]);
    expect(saves.map(value => value.status).sort()).toEqual(["fulfilled", "rejected"]);
    expect(audits()).toHaveLength(3);
    const plan = await calculate(2);
    const decisions = await Promise.allSettled(["confirmed", "rejected"].map(decision => repository.decide({
      date, planId: plan.id, staffId, decision: decision as "confirmed" | "rejected", reason: "確認", expectedRevision: 3,
    })));
    expect(decisions.map(value => value.status).sort()).toEqual(["fulfilled", "rejected"]);
    expect(audits()).toHaveLength(5);
  });
  it("invalidates a proposal after selection or room settings change", async () => {
    await prepare();
    const plan = await calculate();
    await repository.saveDay({ date, petIds: [demoPets[1].id], staffId, expectedRevision: 2 });
    await expect(repository.decide({ date, planId: plan.id, staffId, decision: "confirmed", reason: "確認", expectedRevision: 3 })).rejects.toThrow("最新");
    const next = await calculate(3);
    await repository.saveRooms({ rooms: [{ id: "room", name: "Room", capacity: 4 }], staffId, expectedRevision: 1 });
    await expect(repository.decide({ date, planId: next.id, staffId, decision: "confirmed", reason: "確認", expectedRevision: 4 })).rejects.toThrow("最新");
  });
  it("rejects foreign or missing dogs, incomplete profiles, other dates and inactive staff", async () => {
    store.docs.set("facilities/other/demoPets/foreign", { ...demoPets[0], id: "foreign" });
    await expect(repository.saveDay({ date, petIds: ["foreign"], staffId, expectedRevision: 0 })).rejects.toThrow("施設");
    expect(audits()).toHaveLength(0);
    await prepare();
    await expect(repository.recalculate({ date, staffId, reason: "計算", expectedRevision: 1, expectedRoomsRevision: 1, profiles: demoPets.slice(0, 2) })).rejects.toThrow("一致");
    store.docs.set(path(`demoPets/${demoPets[0].id}`), { id: demoPets[0].id, name: "Incomplete" });
    await expect(calculate()).rejects.toThrow("不足");
    store.docs.set(path(`demoPets/${demoPets[0].id}`), { ...demoPets[0] });
    const plan = await calculate();
    await expect(repository.getPlan("2026-09-23", plan.id)).rejects.toThrow("日付");
    await repository.saveDay({ date: "2026-09-23", petIds: [demoPets[0].id], staffId, expectedRevision: 0 });
    await expect(repository.decide({ date: "2026-09-23", planId: plan.id, staffId, decision: "confirmed", reason: "確認", expectedRevision: 1 })).rejects.toThrow("日付");
    store.docs.set(path(`staffProfiles/${staffId}`), { active: false });
    await expect(repository.decide({ date, planId: plan.id, staffId, decision: "confirmed", reason: "確認", expectedRevision: 2 })).rejects.toThrow("スタッフ");
  });
  it("captures facility identity once for transaction paths and requires authentication", async () => {
    store.afterRead = () => { Object.assign(auth, { currentUser: { uid: "facility-b" } }); };
    await repository.saveDay({ date, petIds: [demoPets[0].id], staffId, expectedRevision: 0 });
    expect(store.docs.has(path(`dailyOperations/${date}`))).toBe(true);
    expect([...store.docs.keys()].some(key => key.startsWith("facilities/facility-b/"))).toBe(false);
    store.afterRead = null;
    expect(await repository.getDay(date)).toBeNull();
    Object.assign(auth, { currentUser: null });
    await expect(repository.getRooms()).rejects.toThrow("ログイン");
  });
});
