export interface MatchingPairSnapshot {
  pairKey: string;
  petAId: string;
  petBId: string;
  score: number;
  allowed: boolean;
  hardConstraintCodes: string[];
}

export interface MatchingRoomSnapshot {
  roomId: string;
  petIds: string[];
  averageCompatibility: number | null;
  minimumCompatibility: number | null;
}

export interface MatchingSnapshot {
  id: string;
  status: "proposed" | "confirmed";
  petIds: string[];
  pairResults: MatchingPairSnapshot[];
  rooms: MatchingRoomSnapshot[];
  objectiveScore: number | null;
  createdAt: string;
}

export interface ObservationRecord {
  id: string;
  scenarioId: string;
  title: string;
  facts: string[];
  impacts: string[];
  recommendation: string;
  observedAt: string;
}

export interface OperationRepository {
  readonly kind: "local" | "firestore";
  saveMatching(snapshot: MatchingSnapshot): Promise<void>;
  listMatchings(limitCount?: number): Promise<MatchingSnapshot[]>;
  saveObservation(observation: ObservationRecord): Promise<void>;
  listObservations(limitCount?: number): Promise<ObservationRecord[]>;
}

export const clampOperationLimit = (limitCount = 20) => Math.min(25, Math.max(1, Math.floor(limitCount)));
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const isFiniteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const isStringArray = (value: unknown, maximum: number): value is string[] =>
  Array.isArray(value) && value.length <= maximum && value.every((item) => typeof item === "string" && item.length <= 200);

const isPair = (value: unknown): value is MatchingPairSnapshot => {
  if (!isRecord(value)) return false;
  return typeof value.pairKey === "string" && value.pairKey.length <= 220 &&
    typeof value.petAId === "string" && value.petAId.length <= 100 &&
    typeof value.petBId === "string" && value.petBId.length <= 100 &&
    isFiniteNumber(value.score) && value.score >= 0 && value.score <= 100 &&
    typeof value.allowed === "boolean" && isStringArray(value.hardConstraintCodes, 20);
};

const isNullableScore = (value: unknown) => value === null || (isFiniteNumber(value) && value >= 0 && value <= 100);
const isRoom = (value: unknown): value is MatchingRoomSnapshot => {
  if (!isRecord(value)) return false;
  return typeof value.roomId === "string" && value.roomId.length <= 100 && isStringArray(value.petIds, 20) &&
    isNullableScore(value.averageCompatibility) && isNullableScore(value.minimumCompatibility);
};

export const isMatchingSnapshot = (value: unknown): value is MatchingSnapshot => {
  if (!isRecord(value)) return false;
  return typeof value.id === "string" && value.id.length > 0 && value.id.length <= 100 &&
    ["proposed", "confirmed"].includes(String(value.status)) && isStringArray(value.petIds, 20) &&
    Array.isArray(value.pairResults) && value.pairResults.length <= 190 && value.pairResults.every(isPair) &&
    Array.isArray(value.rooms) && value.rooms.length <= 10 && value.rooms.every(isRoom) &&
    (value.objectiveScore === null || isFiniteNumber(value.objectiveScore)) &&
    typeof value.createdAt === "string" && value.createdAt.length >= 20 && value.createdAt.length <= 40;
};

export const isObservationRecord = (value: unknown): value is ObservationRecord => {
  if (!isRecord(value)) return false;
  return typeof value.id === "string" && value.id.length > 0 && value.id.length <= 100 &&
    typeof value.scenarioId === "string" && value.scenarioId.length > 0 && value.scenarioId.length <= 100 &&
    typeof value.title === "string" && value.title.length > 0 && value.title.length <= 120 &&
    isStringArray(value.facts, 20) && isStringArray(value.impacts, 20) &&
    typeof value.recommendation === "string" && value.recommendation.length <= 1000 &&
    typeof value.observedAt === "string" && value.observedAt.length >= 20 && value.observedAt.length <= 40;
};
