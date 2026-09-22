import type { Auth } from "firebase/auth";
import { collection, doc, getDoc, getDocs, limit, orderBy, query, runTransaction, where, type Firestore, type Transaction } from "firebase/firestore";
import {
  assertDocumentId, assertOperationDate, assertRevision, createSelectedRoomPlan, isCurrentProposed,
  normalizeRooms, normalizeSelectedPetIds, operationReason,
  type DailyOperationDay, type DailyOperationPlan, type FacilityRoomSettings, type OperationAuditEvent,
} from "../domain/dailyOperations";
import type { PetProfile } from "../domain/types";
import type { DailyOperationRepository, DecideDayPlanInput, RecalculateDayInput, SaveDayInput, SaveRoomsInput } from "./dailyOperationRepository";
import { requireFacilityId } from "./firestoreFacilityScope";

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** Every operation captures its facility once, including transaction retries. */
export class FirestoreDailyOperationRepository implements DailyOperationRepository {
  readonly kind = "firestore" as const;
  constructor(private readonly db: Firestore, private readonly auth: Auth) {}

  private ref(facilityId: string, group: string, id: string) {
    return doc(this.db, "facilities", facilityId, group, id);
  }
  private newId(facilityId: string, group: string): string {
    return doc(collection(this.db, "facilities", facilityId, group)).id;
  }
  private async actor(transaction: Transaction, facilityId: string, staffId: string) {
    assertDocumentId(staffId);
    const staff = await transaction.get(this.ref(facilityId, "staffProfiles", staffId));
    if (!staff.exists() || staff.data().active !== true) throw new Error("有効な担当スタッフを選択してください。");
  }
  private scoped<T extends { facilityId: string; date?: string | null }>(data: T, facilityId: string, date?: string): T {
    if (data.facilityId !== facilityId || (date !== undefined && data.date !== date)) throw new Error("施設または日付が一致しません。");
    return data;
  }
  private async profiles(transaction: Transaction, facilityId: string, petIds: readonly string[]): Promise<PetProfile[]> {
    const snapshots = await Promise.all(petIds.map(id => transaction.get(this.ref(facilityId, "demoPets", id))));
    return snapshots.map(snapshot => {
      if (!snapshot.exists()) throw new Error("施設に登録されていない対象犬が含まれています。");
      return { ...snapshot.data(), id: snapshot.id } as PetProfile;
    });
  }

  async getDay(date: string): Promise<DailyOperationDay | null> {
    const facilityId = requireFacilityId(this.auth);
    assertOperationDate(date);
    const snapshot = await getDoc(this.ref(facilityId, "dailyOperations", date));
    return snapshot.exists() ? this.scoped(snapshot.data() as DailyOperationDay, facilityId, date) : null;
  }
  async getPlan(date: string, planId: string): Promise<DailyOperationPlan | null> {
    const facilityId = requireFacilityId(this.auth);
    assertOperationDate(date);
    assertDocumentId(planId);
    const snapshot = await getDoc(this.ref(facilityId, "operationPlans", planId));
    return snapshot.exists() ? this.scoped(snapshot.data() as DailyOperationPlan, facilityId, date) : null;
  }
  async getRooms(): Promise<FacilityRoomSettings | null> {
    const facilityId = requireFacilityId(this.auth);
    const snapshot = await getDoc(this.ref(facilityId, "settings", "rooms"));
    return snapshot.exists() ? this.scoped(snapshot.data() as FacilityRoomSettings, facilityId) : null;
  }

  async saveDay(input: SaveDayInput): Promise<DailyOperationDay> {
    const facilityId = requireFacilityId(this.auth);
    const { date, staffId, expectedRevision } = clone(input);
    const petIds = normalizeSelectedPetIds(input.petIds);
    assertOperationDate(date);
    const reason = operationReason(input.reason ?? "当日の対象犬を保存");
    const auditId = this.newId(facilityId, "operationAudit");
    return runTransaction(this.db, async transaction => {
      await this.actor(transaction, facilityId, staffId);
      const dayRef = this.ref(facilityId, "dailyOperations", date);
      const snapshot = await transaction.get(dayRef);
      const previous = snapshot.exists() ? this.scoped(snapshot.data() as DailyOperationDay, facilityId, date) : null;
      assertRevision(previous?.revision ?? 0, expectedRevision);
      await this.profiles(transaction, facilityId, petIds);
      const now = new Date().toISOString();
      const day: DailyOperationDay = {
        facilityId, date, selectedPetIds: petIds, revision: expectedRevision + 1,
        latestPlanId: previous?.latestPlanId ?? null, lastAuditId: auditId, updatedAt: now, updatedBy: staffId,
      };
      const audit: OperationAuditEvent = {
        id: auditId, facilityId, date, action: "day_saved", staffId, reason,
        sourcePlanId: previous?.latestPlanId ?? null, planId: null, createdAt: now,
        dayRevision: day.revision, roomsRevision: null,
      };
      transaction.set(dayRef, clone(day));
      transaction.set(this.ref(facilityId, "operationAudit", auditId), audit);
      return day;
    });
  }

  async saveRooms(input: SaveRoomsInput): Promise<FacilityRoomSettings> {
    const facilityId = requireFacilityId(this.auth);
    const { staffId, expectedRevision } = clone(input);
    const rooms = normalizeRooms(input.rooms);
    const reason = operationReason(input.reason ?? "施設の部屋設定を保存");
    const auditId = this.newId(facilityId, "operationAudit");
    return runTransaction(this.db, async transaction => {
      await this.actor(transaction, facilityId, staffId);
      const settingsRef = this.ref(facilityId, "settings", "rooms");
      const snapshot = await transaction.get(settingsRef);
      const previous = snapshot.exists() ? this.scoped(snapshot.data() as FacilityRoomSettings, facilityId) : null;
      assertRevision(previous?.revision ?? 0, expectedRevision);
      const now = new Date().toISOString();
      const settings: FacilityRoomSettings = {
        facilityId, rooms, revision: expectedRevision + 1, lastAuditId: auditId, updatedAt: now, updatedBy: staffId,
      };
      const audit: OperationAuditEvent = {
        id: auditId, facilityId, date: null, action: "rooms_saved", staffId, reason,
        sourcePlanId: null, planId: null, createdAt: now, dayRevision: null, roomsRevision: settings.revision,
      };
      transaction.set(settingsRef, clone(settings));
      transaction.set(this.ref(facilityId, "operationAudit", auditId), audit);
      return settings;
    });
  }

  async recalculate(input: RecalculateDayInput): Promise<DailyOperationPlan> {
    const facilityId = requireFacilityId(this.auth);
    const request = clone(input);
    const { date, staffId, expectedRevision, expectedRoomsRevision } = request;
    assertOperationDate(date);
    const reason = operationReason(request.reason);
    const planId = this.newId(facilityId, "operationPlans");
    const auditId = this.newId(facilityId, "operationAudit");
    return runTransaction(this.db, async transaction => {
      await this.actor(transaction, facilityId, staffId);
      const dayRef = this.ref(facilityId, "dailyOperations", date);
      const daySnapshot = await transaction.get(dayRef);
      const roomsSnapshot = await transaction.get(this.ref(facilityId, "settings", "rooms"));
      if (!daySnapshot.exists() || !roomsSnapshot.exists()) throw new Error("対象犬と部屋設定を先に保存してください。");
      const day = this.scoped(daySnapshot.data() as DailyOperationDay, facilityId, date);
      const settings = this.scoped(roomsSnapshot.data() as FacilityRoomSettings, facilityId);
      assertRevision(day.revision, expectedRevision);
      assertRevision(settings.revision, expectedRoomsRevision);
      const petIds = normalizeSelectedPetIds(day.selectedPetIds);
      const pets = await this.profiles(transaction, facilityId, petIds);
      // Optional UI input is checked, but persisted facility profiles are authoritative.
      if (request.profiles) {
        if (request.profiles.length !== petIds.length || new Set(request.profiles.map(pet => pet.id)).size !== petIds.length ||
            request.profiles.some(pet => !petIds.includes(pet.id))) throw new Error("選択対象とプロフィールが一致しません。");
      }
      const previousSnapshot = day.latestPlanId ? await transaction.get(this.ref(facilityId, "operationPlans", day.latestPlanId)) : null;
      const previous = previousSnapshot?.exists() ? this.scoped(previousSnapshot.data() as DailyOperationPlan, facilityId, date) : null;
      const result = createSelectedRoomPlan(petIds, pets, settings.rooms);
      const now = new Date().toISOString();
      const plan: DailyOperationPlan = {
        id: planId, facilityId, date, status: "proposed", petIds, rooms: normalizeRooms(settings.rooms),
        roomsRevision: settings.revision, dayRevision: day.revision + 1, result,
        sourcePlanId: day.latestPlanId, createdAt: now, updatedAt: now, staffId, reason, lastAuditId: auditId,
      };
      const audit: OperationAuditEvent = {
        id: auditId, facilityId, date, action: "recalculated", staffId, reason,
        sourcePlanId: day.latestPlanId, planId, createdAt: now, dayRevision: plan.dayRevision, roomsRevision: settings.revision,
      };
      if (previous?.status === "proposed") {
        transaction.update(this.ref(facilityId, "operationPlans", previous.id), {
          status: "superseded", updatedAt: now, staffId, reason, lastAuditId: auditId,
        });
      }
      transaction.set(this.ref(facilityId, "operationPlans", planId), clone(plan));
      transaction.update(dayRef, { revision: plan.dayRevision, latestPlanId: planId, lastAuditId: auditId, updatedAt: now, updatedBy: staffId });
      transaction.set(this.ref(facilityId, "operationAudit", auditId), audit);
      return plan;
    });
  }

  async decide(input: DecideDayPlanInput): Promise<DailyOperationPlan> {
    const facilityId = requireFacilityId(this.auth);
    const { date, planId, staffId, decision, expectedRevision, reason: rawReason } = clone(input);
    assertOperationDate(date);
    assertDocumentId(planId);
    if (decision !== "confirmed" && decision !== "rejected") throw new Error("決定の種類が不正です。");
    const reason = operationReason(rawReason);
    const auditId = this.newId(facilityId, "operationAudit");
    return runTransaction(this.db, async transaction => {
      await this.actor(transaction, facilityId, staffId);
      const dayRef = this.ref(facilityId, "dailyOperations", date);
      const planRef = this.ref(facilityId, "operationPlans", planId);
      const daySnapshot = await transaction.get(dayRef);
      const roomsSnapshot = await transaction.get(this.ref(facilityId, "settings", "rooms"));
      const planSnapshot = await transaction.get(planRef);
      if (!daySnapshot.exists() || !roomsSnapshot.exists() || !planSnapshot.exists()) throw new Error("保存された最新の配置案が見つかりません。");
      const day = this.scoped(daySnapshot.data() as DailyOperationDay, facilityId, date);
      const rooms = this.scoped(roomsSnapshot.data() as FacilityRoomSettings, facilityId);
      const previous = this.scoped(planSnapshot.data() as DailyOperationPlan, facilityId, date);
      assertRevision(day.revision, expectedRevision);
      if (!isCurrentProposed(day, rooms, previous)) throw new Error("最新の有効な提案だけを確定・拒否できます。再計算してください。");
      const now = new Date().toISOString();
      const plan: DailyOperationPlan = { ...previous, status: decision, staffId, reason, updatedAt: now, lastAuditId: auditId };
      const audit: OperationAuditEvent = {
        id: auditId, facilityId, date, action: decision, staffId, reason, sourcePlanId: planId, planId,
        createdAt: now, dayRevision: day.revision + 1, roomsRevision: rooms.revision,
      };
      transaction.update(planRef, { status: decision, staffId, reason, updatedAt: now, lastAuditId: auditId });
      transaction.update(dayRef, { revision: day.revision + 1, lastAuditId: auditId, updatedAt: now, updatedBy: staffId });
      transaction.set(this.ref(facilityId, "operationAudit", auditId), audit);
      return plan;
    });
  }

  async listAudit(date: string, limitCount = 25): Promise<OperationAuditEvent[]> {
    const facilityId = requireFacilityId(this.auth);
    assertOperationDate(date);
    const count = Number.isFinite(limitCount) ? Math.min(100, Math.max(1, Math.floor(limitCount))) : 25;
    const snapshots = await getDocs(query(collection(this.db, "facilities", facilityId, "operationAudit"),
      where("date", "==", date), orderBy("dayRevision", "desc"), limit(count)));
    return snapshots.docs.map(snapshot => this.scoped(snapshot.data() as OperationAuditEvent, facilityId, date))
      .sort((a, b) => (b.dayRevision ?? 0) - (a.dayRevision ?? 0));
  }
}
