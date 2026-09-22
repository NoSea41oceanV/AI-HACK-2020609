import type { IntakeAiAnalysis, IntakeMatchingProfile } from "../domain/intakeProfile";

export type PetSex = "male" | "female" | "unknown";
export type IntakeStatus = "submitted" | "analyzing" | "ready" | "error";
export type IntakeMediaKind = "image" | "video";

export interface IntakeMediaMetadata {
  // Metadata only. Raw media, data URLs, and Worker storage IDs are never persisted.
  kind: IntakeMediaKind;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  status: "selected" | "uploaded" | "failed";
}

export interface OwnerIntake {
  id: string;
  inviteId: string;
  facilityId: string;
  owner: { name: string; contact: string };
  pet: {
    name: string;
    breed: string;
    ageYears: number;
    weightKg: number;
    sex: PetSex;
    personality: string;
    playStyle: string;
    concerns: string;
  };
  media: { photo?: IntakeMediaMetadata; video?: IntakeMediaMetadata };
  aiAnalysis?: IntakeAiAnalysis;
  matchingProfile?: IntakeMatchingProfile;
  status: IntakeStatus;
  submittedAt: string;
}

export interface IntakeRepository {
  readonly kind: "local" | "firestore" | "mirror";
  save(intake: OwnerIntake): Promise<void>;
  get(id: string): Promise<OwnerIntake | null>;
  listRecent(limitCount?: number): Promise<OwnerIntake[]>;
}

export const clampIntakeLimit = (limitCount = 20) => Math.min(25, Math.max(1, Math.floor(limitCount)));
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === "string");
const isFiniteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const isScale = (value: unknown, minimum = 1) => isFiniteNumber(value) && Number.isInteger(value) && value >= minimum && value <= 5;

const isMedia = (value: unknown, expectedKind: IntakeMediaKind) => {
  if (!isRecord(value)) return false;
  const allowedKeys = new Set(["kind", "fileName", "contentType", "sizeBytes", "status"]);
  return Object.keys(value).every((key) => allowedKeys.has(key)) &&
    value.kind === expectedKind && typeof value.fileName === "string" && typeof value.contentType === "string" &&
    isFiniteNumber(value.sizeBytes) && value.sizeBytes >= 0 &&
    ["selected", "uploaded", "failed"].includes(String(value.status));
};

const isMatchingProfile = (value: unknown): value is IntakeMatchingProfile => {
  if (!isRecord(value)) return false;
  const allowedStyles = new Set(["chase", "wrestle", "tug", "fetch", "gentle", "solo"]);
  return isScale(value.energyLevel) && isScale(value.sociability) && isScale(value.anxietyLevel) &&
    isScale(value.assertiveness) && isScale(value.resourceGuarding, 0) &&
    isStringArray(value.playStyles) && value.playStyles.every((style) => allowedStyles.has(style)) &&
    isStringArray(value.hardBlockedPetIds);
};

const isAiAnalysis = (value: unknown): value is IntakeAiAnalysis => {
  if (!isRecord(value) || typeof value.summary !== "string" || !isStringArray(value.observations) ||
      !isStringArray(value.compatibilitySignals) || !isStringArray(value.riskFlags) ||
      !isFiniteNumber(value.confidence) || value.confidence < 0 || value.confidence > 1 ||
      !Array.isArray(value.personalityTraits) || !isMatchingProfile(value.matchingProfile)) return false;
  return value.personalityTraits.every((trait) => isRecord(trait) && typeof trait.label === "string" &&
    typeof trait.evidence === "string" && isFiniteNumber(trait.confidence) && trait.confidence >= 0 && trait.confidence <= 1);
};

export const isOwnerIntake = (value: unknown): value is OwnerIntake => {
  if (!isRecord(value) || !isRecord(value.owner) || !isRecord(value.pet) || !isRecord(value.media)) return false;
  const pet = value.pet;
  return typeof value.id === "string" && typeof value.inviteId === "string" && typeof value.facilityId === "string" &&
    typeof value.owner.name === "string" && typeof value.owner.contact === "string" &&
    typeof pet.name === "string" && typeof pet.breed === "string" && isFiniteNumber(pet.ageYears) &&
    isFiniteNumber(pet.weightKg) && ["male", "female", "unknown"].includes(String(pet.sex)) &&
    typeof pet.personality === "string" && typeof pet.playStyle === "string" && typeof pet.concerns === "string" &&
    (value.media.photo === undefined || isMedia(value.media.photo, "image")) &&
    (value.media.video === undefined || isMedia(value.media.video, "video")) &&
    (value.aiAnalysis === undefined || isAiAnalysis(value.aiAnalysis)) &&
    (value.matchingProfile === undefined || isMatchingProfile(value.matchingProfile)) &&
    ["submitted", "analyzing", "ready", "error"].includes(String(value.status)) && typeof value.submittedAt === "string";
};
