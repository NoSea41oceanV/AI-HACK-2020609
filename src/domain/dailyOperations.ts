import { createOptimalRoomPlan } from "./matching";
import { PLAY_STYLES, type MatchingSuccess, type PetProfile, type RoomDefinition } from "./types";

export type DailyPlanStatus = "proposed" | "confirmed" | "rejected" | "superseded";
export interface DailyOperationDay {
  facilityId: string;
  date: string;
  selectedPetIds: string[];
  revision: number;
  latestPlanId: string | null;
  lastAuditId: string;
  updatedAt: string;
  updatedBy: string;
}
export interface FacilityRoomSettings {
  facilityId: string;
  rooms: RoomDefinition[];
  revision: number;
  lastAuditId: string;
  updatedAt: string;
  updatedBy: string;
}
export interface DailyOperationPlan {
  id: string;
  facilityId: string;
  date: string;
  status: DailyPlanStatus;
  petIds: string[];
  rooms: RoomDefinition[];
  roomsRevision: number;
  dayRevision: number;
  result: MatchingSuccess;
  sourcePlanId: string | null;
  createdAt: string;
  updatedAt: string;
  staffId: string;
  reason: string;
  lastAuditId: string;
}
export interface OperationAuditEvent {
  id: string;
  facilityId: string;
  date: string | null;
  action: "day_saved" | "rooms_saved" | "recalculated" | "confirmed" | "rejected";
  staffId: string;
  reason: string;
  sourcePlanId: string | null;
  planId: string | null;
  createdAt: string;
  dayRevision: number | null;
  roomsRevision: number | null;
}

export function assertDocumentId(id: string): void {
  if (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,100}$/.test(id)) throw new Error("IDの形式が不正です。");
}
export function assertOperationDate(date: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`)) ||
      new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) throw new Error("有効な日付をYYYY-MM-DDで指定してください。");
}
export function assertRevision(actual: number, expected: number): void {
  if (!Number.isInteger(expected) || expected < 0 || actual !== expected) throw new Error("データが更新されています。再読み込みしてください。");
}
export function operationReason(reason: string): string {
  if (typeof reason !== "string" || !reason.trim() || reason.trim().length > 1000) throw new Error("操作理由を1〜1000文字で入力してください。");
  return reason.trim();
}
export function normalizeSelectedPetIds(ids: readonly string[]): string[] {
  if (!Array.isArray(ids) || ids.length > 20 || new Set(ids).size !== ids.length) throw new Error("対象犬は重複なく20頭以内で選択してください。");
  ids.forEach(assertDocumentId);
  return [...ids].sort();
}
export function normalizeRooms(rooms: readonly RoomDefinition[]): RoomDefinition[] {
  if (!Array.isArray(rooms) || !rooms.length || rooms.length > 10 || new Set(rooms.map(room => room.id)).size !== rooms.length) {
    throw new Error("部屋は重複なく1〜10室で設定してください。");
  }
  return rooms.map(room => {
    assertDocumentId(room.id);
    const minOccupancy = room.minOccupancy ?? 0;
    if (typeof room.name !== "string" || !room.name.trim() || room.name.trim().length > 100 ||
        !Number.isInteger(room.capacity) || room.capacity < 1 || room.capacity > 20 ||
        !Number.isInteger(minOccupancy) || minOccupancy < 0 || minOccupancy > room.capacity) throw new Error("部屋名と定員を確認してください。");
    return { id: room.id, name: room.name.trim(), capacity: room.capacity, minOccupancy };
  }).sort((a, b) => a.id.localeCompare(b.id));
}
export function isCompleteOperationProfile(value: unknown): value is PetProfile {
  if (!value || typeof value !== "object") return false;
  const pet = value as PetProfile;
  return typeof pet.id === "string" && typeof pet.name === "string" && Boolean(pet.name.trim()) &&
    Number.isFinite(pet.ageYears) && pet.ageYears >= 0 && Number.isFinite(pet.weightKg) && pet.weightKg > 0 &&
    [pet.energyLevel, pet.sociability, pet.anxietyLevel, pet.assertiveness].every(n => Number.isInteger(n) && n >= 1 && n <= 5) &&
    Number.isInteger(pet.resourceGuarding) && pet.resourceGuarding >= 0 && pet.resourceGuarding <= 5 &&
    Array.isArray(pet.playStyles) && pet.playStyles.length > 0 && pet.playStyles.every(style => PLAY_STYLES.includes(style)) &&
    (pet.hardBlockedPetIds === undefined || (Array.isArray(pet.hardBlockedPetIds) && pet.hardBlockedPetIds.every(id => typeof id === "string")));
}
export function createSelectedRoomPlan(ids: readonly string[], profiles: readonly PetProfile[], rooms: readonly RoomDefinition[]): MatchingSuccess {
  const selected = normalizeSelectedPetIds(ids);
  if (!selected.length) throw new Error("当日の対象犬を選択してください。");
  if (profiles.length !== selected.length || new Set(profiles.map(pet => pet.id)).size !== profiles.length ||
      profiles.some(pet => !selected.includes(pet.id) || !isCompleteOperationProfile(pet))) {
    throw new Error("対象外の犬、またはプロフィールが不足している犬が含まれています。");
  }
  const result = createOptimalRoomPlan(profiles, normalizeRooms(rooms));
  if (result.status !== "success") throw new Error(result.message);
  return result;
}
export function isCurrentPlan(day: DailyOperationDay | null, rooms: FacilityRoomSettings | null, plan: DailyOperationPlan | null): boolean {
  if (!day || !rooms || !plan || plan.status === "superseded") return false;
  // A decision increments the head once; the plan retains its calculation revision.
  const expectedDayRevision = plan.dayRevision + (plan.status === "proposed" ? 0 : 1);
  return Boolean(plan.facilityId === day.facilityId &&
    rooms.facilityId === day.facilityId && plan.date === day.date && plan.id === day.latestPlanId &&
    expectedDayRevision === day.revision && plan.roomsRevision === rooms.revision && day.lastAuditId === plan.lastAuditId &&
    JSON.stringify(plan.petIds) === JSON.stringify(day.selectedPetIds));
}
export function isCurrentProposed(day: DailyOperationDay | null, rooms: FacilityRoomSettings | null, plan: DailyOperationPlan | null): boolean {
  return plan?.status === "proposed" && isCurrentPlan(day, rooms, plan);
}
