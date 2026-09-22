import {
  isObservationDocumentId,
  prepareManualObservation,
  type CreateManualObservationInput,
  type ManualObservationRecord,
  type ManualObservationRepository,
} from "../data/manualObservationRepository";

interface OperationEventEnvelope {
  version: 1;
  /** Stable across retries; manual events use the observation document id. */
  eventId: string;
  facilityId: string;
  occurredAt: string;
}

export type OperationEvent =
  | (OperationEventEnvelope & {
    type: "observation.manual.recorded";
    source: "manual";
    payload: CreateManualObservationInput;
  })
  | (OperationEventEnvelope & {
    type: "observation.camera.requested";
    source: "camera";
    /** Reserved input boundary only: this does not claim a camera is connected. */
    payload: { cameraId: string };
  });

export type ObservationIngestionResult =
  | { status: "recorded"; observation: ManualObservationRecord }
  | { status: "unsupported"; reason: "camera-not-implemented" };

export interface ObservationIngestionAdapter {
  ingest(event: OperationEvent): Promise<ObservationIngestionResult>;
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);

/** Runtime validation is required at future external ingestion boundaries. */
export function isOperationEvent(value: unknown): value is OperationEvent {
  if (!isRecord(value) || value.version !== 1 || !isObservationDocumentId(value.eventId) || !isObservationDocumentId(value.facilityId) ||
    typeof value.occurredAt !== "string" || !Number.isFinite(Date.parse(value.occurredAt)) ||
    new Date(value.occurredAt).toISOString() !== value.occurredAt || !isRecord(value.payload)) return false;
  if (value.source === "camera" && value.type === "observation.camera.requested") {
    return Object.keys(value.payload).length === 1 && isObservationDocumentId(value.payload.cameraId);
  }
  if (value.source !== "manual" || value.type !== "observation.manual.recorded" ||
    value.eventId !== value.payload.id || value.occurredAt !== value.payload.observedAt) return false;
  try {
    prepareManualObservation(value.payload as unknown as CreateManualObservationInput);
    return true;
  } catch { return false; }
}

/** Camera ingestion deliberately has no storage or generated-observation fallback. */
export class UnsupportedCameraObservationAdapter implements ObservationIngestionAdapter {
  async ingest(event: OperationEvent): Promise<ObservationIngestionResult> {
    if (!isOperationEvent(event) || event.source !== "camera") throw new Error("Camera ingestion event is invalid.");
    return { status: "unsupported", reason: "camera-not-implemented" };
  }
}

/** Repository retries provide idempotency; the envelope cannot override tenant scope. */
export class ManualObservationIngestionAdapter implements ObservationIngestionAdapter {
  constructor(private readonly facilityId: string, private readonly repository: ManualObservationRepository) {}

  async ingest(event: OperationEvent): Promise<ObservationIngestionResult> {
    if (!isOperationEvent(event) || event.facilityId !== this.facilityId) throw new Error("Observation ingestion event is invalid for this facility.");
    if (event.source === "camera") return { status: "unsupported", reason: "camera-not-implemented" };
    const observation = await this.repository.createManual(event.payload, this.facilityId);
    return { status: "recorded", observation };
  }
}
