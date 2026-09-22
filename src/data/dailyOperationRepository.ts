import type { PetProfile, RoomDefinition } from "../domain/types";
import type { DailyOperationDay, DailyOperationPlan, FacilityRoomSettings, OperationAuditEvent } from "../domain/dailyOperations";

export interface SaveDayInput {
  date: string;
  petIds: string[];
  staffId: string;
  expectedRevision: number;
  reason?: string;
}
export interface SaveRoomsInput {
  rooms: RoomDefinition[];
  staffId: string;
  expectedRevision: number;
  reason?: string;
}
export interface RecalculateDayInput {
  date: string;
  staffId: string;
  reason: string;
  expectedRevision: number;
  expectedRoomsRevision: number;
  profiles?: PetProfile[];
}
export interface DecideDayPlanInput {
  date: string;
  planId: string;
  staffId: string;
  decision: "confirmed" | "rejected";
  reason: string;
  expectedRevision: number;
}
export interface DailyOperationRepository {
  readonly kind: "firestore";
  getDay(date: string): Promise<DailyOperationDay | null>;
  getPlan(date: string, planId: string): Promise<DailyOperationPlan | null>;
  getRooms(): Promise<FacilityRoomSettings | null>;
  saveDay(input: SaveDayInput): Promise<DailyOperationDay>;
  saveRooms(input: SaveRoomsInput): Promise<FacilityRoomSettings>;
  recalculate(input: RecalculateDayInput): Promise<DailyOperationPlan>;
  decide(input: DecideDayPlanInput): Promise<DailyOperationPlan>;
  listAudit(date: string, limitCount?: number): Promise<OperationAuditEvent[]>;
}
