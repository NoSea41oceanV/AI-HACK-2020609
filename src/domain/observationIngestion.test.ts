import { describe, expect, it, vi } from "vitest";
import { isObservationRecord } from "../data/operationRepository";
import { isManualObservationRecord, isObservationDocumentId, operationDateForObservation, prepareManualObservation, type CreateManualObservationInput, type ManualObservationRepository } from "../data/manualObservationRepository";
import { isOperationEvent, ManualObservationIngestionAdapter, UnsupportedCameraObservationAdapter, type OperationEvent } from "./observationIngestion";

const input = (): CreateManualObservationInput => ({
  id: "observation-1", title: "スタッフによる観測", facts: ["2頭が離れて伏せている"], impacts: [], recommendation: "",
  staffId: "staff-1", petIds: ["pet-1", "pet-2"], observedAt: "2026-09-20T15:10:00.000Z", operationDate: "2026-09-21",
});
const event = (): OperationEvent => ({
  version: 1, eventId: "observation-1", facilityId: "facility-1", occurredAt: input().observedAt,
  source: "manual", type: "observation.manual.recorded", payload: input(),
});

describe("manual observation contract", () => {
  it("uses the same bounded ASCII identifier contract as Firestore rules", () => {
    expect(isObservationDocumentId("manual_observation-01")).toBe(true);
    expect(isObservationDocumentId("a".repeat(100))).toBe(true);
    for (const value of ["", "a".repeat(101), "staff 1", "スタッフ", "pet/1", "pet.1"]) {
      expect(isObservationDocumentId(value)).toBe(false);
    }
  });

  it("uses Japan business dates across the UTC midnight boundary and retains legacy read compatibility", () => {
    const record = prepareManualObservation(input(), new Date("2026-09-21T00:00:00.000Z"));
    expect(record.operationDate).toBe("2026-09-21");
    expect(operationDateForObservation("2026-09-20T14:59:59.999Z")).toBe("2026-09-20");
    expect(operationDateForObservation("2026-09-20T15:00:00.000Z")).toBe("2026-09-21");
    expect(isObservationRecord(record)).toBe(true);
    const { source: _source, staffId: _staffId, petIds: _petIds, operationDate: _date, ...legacy } = record;
    expect(isObservationRecord(legacy)).toBe(true);
    expect(isManualObservationRecord(legacy)).toBe(false);
  });

  it.each([
    { staffId: "" }, { staffId: "../elsewhere" }, { petIds: [] }, { petIds: ["pet-1", "pet-1"] },
    { petIds: ["pet-1", "pet-2", "pet-3"] }, { facts: [] }, { facts: ["  "] }, { title: "  " },
    { observedAt: "2026-02-30T00:00:00.000Z" }, { operationDate: "2026-09-20" },
    { severity: "critical" }, { source: "camera" }, { scenarioId: "calm-room" },
  ])("rejects invalid or unsupported payload fields %j", (patch) => {
    expect(() => prepareManualObservation({ ...input(), ...patch })).toThrow();
  });

  it("rejects future timestamps even when their operation date matches", () => {
    expect(() => prepareManualObservation(input(), new Date("2026-09-20T15:09:59.999Z"))).toThrow("未来");
  });
});

describe("operation event boundary", () => {
  it("accepts valid manual envelopes but rejects mismatched sources, ids, times and invalid payloads", () => {
    expect(isOperationEvent(event())).toBe(true);
    expect(isOperationEvent({ ...event(), source: "camera" })).toBe(false);
    expect(isOperationEvent({ ...event(), eventId: "different" })).toBe(false);
    expect(isOperationEvent({ ...event(), occurredAt: "2026-09-20T16:10:00.000Z" })).toBe(false);
    expect(isOperationEvent({ ...event(), payload: { ...input(), petIds: [] } })).toBe(false);
    expect(isOperationEvent({ ...event(), version: 2 })).toBe(false);
  });

  it("forwards the fixed expected facility and refuses another facility", async () => {
    const createManual = vi.fn().mockResolvedValue(prepareManualObservation(input()));
    const repository: ManualObservationRepository = { kind: "firestore", createManual, listManual: async () => [] };
    const adapter = new ManualObservationIngestionAdapter("facility-1", repository);
    expect((await adapter.ingest(event())).status).toBe("recorded");
    expect(createManual).toHaveBeenCalledWith(input(), "facility-1");
    await expect(adapter.ingest({ ...event(), facilityId: "facility-2" })).rejects.toThrow("facility");
    expect(createManual).toHaveBeenCalledTimes(1);
  });

  it("returns explicit unsupported camera ingestion without saving any observations", async () => {
    const createManual = vi.fn();
    const adapter = new ManualObservationIngestionAdapter("facility-1", { kind: "firestore", createManual, listManual: async () => [] });
    const camera: OperationEvent = { version: 1, eventId: "camera-event-1", facilityId: "facility-1", occurredAt: input().observedAt, source: "camera", type: "observation.camera.requested", payload: { cameraId: "camera-1" } };
    expect(isOperationEvent(camera)).toBe(true);
    expect(await adapter.ingest(camera)).toEqual({ status: "unsupported", reason: "camera-not-implemented" });
    expect(await new UnsupportedCameraObservationAdapter().ingest(camera)).toEqual({ status: "unsupported", reason: "camera-not-implemented" });
    expect(createManual).not.toHaveBeenCalled();
  });
});
