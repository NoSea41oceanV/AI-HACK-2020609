import { isObservationRecord, type ObservationRecord } from "./operationRepository";

/** A staff-authored observation; legacy scenarios are never promoted to this type. */
export interface ManualObservationRecord extends ObservationRecord {
  source: "manual";
  staffId: string;
  petIds: string[];
  /** Facility business date in Asia/Tokyo. */
  operationDate: string;
}

/** Keep id and observedAt unchanged when retrying a submission. */
export type CreateManualObservationInput = Omit<ManualObservationRecord, "source" | "scenarioId">;

export interface ManualObservationRepository {
  readonly kind: "firestore";
  createManual(input: CreateManualObservationInput, expectedFacilityId?: string): Promise<ManualObservationRecord>;
  listManual(limitCount?: number): Promise<ManualObservationRecord[]>;
}

const recordKeys = ["id", "scenarioId", "title", "facts", "impacts", "recommendation", "observedAt", "source", "staffId", "petIds", "operationDate"];
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
export const isObservationDocumentId = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(value);
const isCanonicalTimestamp = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
  Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;

export const operationDateForObservation = (observedAt: string): string => {
  if (!isCanonicalTimestamp(observedAt)) throw new Error("観測日時が正しくありません。");
  return new Date(Date.parse(observedAt) + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
};

export const isManualObservationRecord = (value: unknown): value is ManualObservationRecord => {
  if (!isRecord(value) || !isObservationRecord(value)) return false;
  const record = value as unknown as Record<string, unknown>;
  return Object.keys(record).length === recordKeys.length && recordKeys.every((key) => Object.hasOwn(record, key)) &&
    record.source === "manual" && record.scenarioId === "manual" &&
    isObservationDocumentId(record.id) && isObservationDocumentId(record.staffId) &&
    typeof record.title === "string" && record.title.trim().length > 0 &&
    Array.isArray(record.petIds) && record.petIds.length >= 1 && record.petIds.length <= 2 &&
    record.petIds.every(isObservationDocumentId) && new Set(record.petIds).size === record.petIds.length &&
    Array.isArray(record.facts) && record.facts.length >= 1 && record.facts.every((fact) => typeof fact === "string" && fact.trim().length > 0) &&
    isCanonicalTimestamp(record.observedAt) && record.operationDate === operationDateForObservation(record.observedAt);
};

export function prepareManualObservation(input: CreateManualObservationInput, now = new Date()): ManualObservationRecord {
  const inputKeys = recordKeys.filter((key) => key !== "source" && key !== "scenarioId");
  if (!isRecord(input) || Object.keys(input).length !== inputKeys.length || !inputKeys.every((key) => Object.hasOwn(input, key))) {
    throw new Error("手動観測の入力内容が正しくありません。");
  }
  const record = { ...input, source: "manual" as const, scenarioId: "manual" };
  if (!isManualObservationRecord(record)) throw new Error("手動観測の入力内容が正しくありません。");
  if (Date.parse(record.observedAt) > now.getTime()) throw new Error("未来の観測日時は登録できません。");
  return { ...record, facts: [...record.facts], impacts: [...record.impacts], petIds: [...record.petIds] };
}

/** Compare every persisted field, independent of object property insertion order. */
export function sameManualObservation(left: ManualObservationRecord, right: ManualObservationRecord): boolean {
  return recordKeys.every((key) => JSON.stringify(left[key as keyof ManualObservationRecord]) === JSON.stringify(right[key as keyof ManualObservationRecord]));
}
