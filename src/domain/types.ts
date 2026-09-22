import type { PersonalityAxes } from "./structuredIntake";

export const PLAY_STYLES = [
  "chase",
  "wrestle",
  "tug",
  "fetch",
  "gentle",
  "solo",
] as const;

export type PlayStyle = (typeof PLAY_STYLES)[number];

export interface PetProfile {
  /** Present only when an AI analysis actually produced the seven axes. */
  personalityAxes?: PersonalityAxes;
  id: string;
  name: string;
  breed?: string;
  ageYears: number;
  weightKg: number;
  energyLevel: number;
  sociability: number;
  anxietyLevel: number;
  assertiveness: number;
  resourceGuarding: number;
  playStyles: PlayStyle[];
  hardBlockedPetIds?: string[];
  notes?: string;
  photoUrl?: string;
  updatedAt?: string;
}

export interface RoomDefinition {
  id: string;
  name: string;
  capacity: number;
  minOccupancy?: number;
}

export interface ScoreBreakdown {
  energy: number;
  size: number;
  playStyle: number;
  sociability: number;
  emotionalBalance: number;
  resourceSafety: number;
}

export interface AiSevenAxisEvaluation {
  /** Normalized compatibility/safety index derived from all seven AI axes. */
  score: number;
  /** Points contributed to the 100-point score before factor-level rounding. */
  contributionPoints: number;
  /** The seven axes can influence at most 18 of the 100 points. */
  maximumContributionPoints: 18;
  contributionBreakdown: {
    extraversionSimilarity: number;
    sociabilitySimilarity: number;
    /** Joint cross-risk contribution using neuroticism and counterpart assertiveness. */
    neuroticismAssertivenessSafety: number;
    trainabilitySupport: number;
    resourceGuardingSafety: number;
    resilienceSupport: number;
  };
}

export interface AiSevenAxisFallback {
  reason: "MISSING_OR_INVALID_AXES";
  petIds: string[];
}

export type HardConstraintCode = "EXPLICIT_BLOCK";

export interface HardConstraintViolation {
  code: HardConstraintCode;
  message: string;
  sourcePetIds: string[];
}

export interface PairCompatibility {
  pairKey: string;
  petAId: string;
  petBId: string;
  score: number;
  breakdown: ScoreBreakdown;
  /** False for legacy profiles and whenever either pet has no valid seven-axis analysis. */
  aiSevenAxisApplied: boolean;
  aiSevenAxisEvaluation?: AiSevenAxisEvaluation;
  aiSevenAxisFallback?: AiSevenAxisFallback;
  hardConstraints: HardConstraintViolation[];
  allowed: boolean;
}

export interface RoomAssignment {
  roomId: string;
  petIds: string[];
  pairKeys: string[];
  averageCompatibility: number | null;
  minimumCompatibility: number | null;
}

export interface MatchingSuccess {
  status: "success";
  pairResults: PairCompatibility[];
  rooms: RoomAssignment[];
  objectiveScore: number;
  totalCompatibilityScore: number;
  evaluatedAssignments: number;
}

export interface MatchingInfeasible {
  status: "infeasible";
  pairResults: PairCompatibility[];
  reason: "INSUFFICIENT_CAPACITY" | "MINIMUM_OCCUPANCY_UNSATISFIABLE" | "HARD_CONSTRAINTS";
  message: string;
  evaluatedAssignments: number;
}

export type MatchingResult = MatchingSuccess | MatchingInfeasible;
