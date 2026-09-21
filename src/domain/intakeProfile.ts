import { PLAY_STYLES, type PetProfile, type PlayStyle } from "./types";

export interface IntakeMatchingProfile {
  energyLevel: number;
  sociability: number;
  anxietyLevel: number;
  assertiveness: number;
  resourceGuarding: number;
  playStyles: PlayStyle[];
  hardBlockedPetIds: string[];
}

export interface IntakeAiAnalysis {
  summary: string;
  observations: string[];
  personalityTraits: Array<{ label: string; evidence: string; confidence: number }>;
  compatibilitySignals: string[];
  riskFlags: string[];
  confidence: number;
  matchingProfile: IntakeMatchingProfile;
}

export interface IntakeProfileSource {
  intakeId: string;
  pet: {
    name: string;
    breed: string;
    ageYears: number;
    weightKg: number;
    personality: string;
    playStyle: string;
    concerns: string;
  };
  matchingProfile?: IntakeMatchingProfile;
}

const clampScale = (value: number, fallback: number) =>
  Number.isFinite(value) ? Math.min(5, Math.max(1, Math.round(value))) : fallback;
const clampGuarding = (value: number, fallback: number) =>
  Number.isFinite(value) ? Math.min(5, Math.max(0, Math.round(value))) : fallback;
const includesAny = (value: string, keywords: readonly string[]) => keywords.some((keyword) => value.includes(keyword));

const inferPlayStyles = (text: string): PlayStyle[] => {
  const styles: PlayStyle[] = [];
  const rules: Array<[PlayStyle, string[]]> = [
    ["chase", ["追いかけ", "走り回", "chase"]],
    ["wrestle", ["取っ組", "じゃれ合", "wrestl"]],
    ["tug", ["引っ張", "ロープ", "tug"]],
    ["fetch", ["ボール", "持ってくる", "fetch"]],
    ["gentle", ["穏やか", "ゆっくり", "優しく", "gentle"]],
    ["solo", ["ひとり", "一人", "単独", "solo"]],
  ];
  for (const [style, keywords] of rules) if (includesAny(text, keywords)) styles.push(style);
  return styles.length ? styles : ["gentle"];
};

const validAiPlayStyles = (styles: readonly string[] | undefined): PlayStyle[] => {
  if (!styles) return [];
  const allowed = new Set<string>(PLAY_STYLES);
  return [...new Set(styles.filter((style): style is PlayStyle => allowed.has(style)))];
};

export const intakeToPetProfile = (source: IntakeProfileSource): PetProfile => {
  const combined = `${source.pet.personality} ${source.pet.playStyle} ${source.pet.concerns}`.toLowerCase();
  const inferred = {
    energyLevel: includesAny(combined, ["活発", "元気", "走", "high energy", "active"]) ? 4 :
      includesAny(combined, ["静か", "おとなしい", "calm", "quiet"]) ? 2 : 3,
    sociability: includesAny(combined, ["犬が好き", "友好的", "人懐", "friendly", "social"]) ? 4 :
      includesAny(combined, ["犬が苦手", "警戒", "怖が", "shy", "nervous"]) ? 2 : 3,
    anxietyLevel: includesAny(combined, ["不安", "怖が", "警戒", "緊張", "anxious", "nervous"]) ? 4 :
      includesAny(combined, ["落ち着", "穏やか", "relaxed", "calm"]) ? 2 : 3,
    assertiveness: includesAny(combined, ["強気", "押しが強", "主張", "assertive", "pushy"]) ? 4 :
      includesAny(combined, ["控えめ", "おとなしい", "shy", "gentle"]) ? 2 : 3,
    resourceGuarding: includesAny(combined, ["取られる", "守る", "唸", "独占", "resource guard"]) ? 4 : 1,
    playStyles: inferPlayStyles(combined),
  };
  const ai = source.matchingProfile;
  const aiStyles = validAiPlayStyles(ai?.playStyles);

  return {
    id: source.intakeId,
    name: source.pet.name.trim(),
    breed: source.pet.breed.trim(),
    ageYears: Math.max(0, source.pet.ageYears),
    weightKg: Math.max(0.1, source.pet.weightKg),
    energyLevel: clampScale(ai?.energyLevel ?? Number.NaN, inferred.energyLevel),
    sociability: clampScale(ai?.sociability ?? Number.NaN, inferred.sociability),
    anxietyLevel: clampScale(ai?.anxietyLevel ?? Number.NaN, inferred.anxietyLevel),
    assertiveness: clampScale(ai?.assertiveness ?? Number.NaN, inferred.assertiveness),
    resourceGuarding: clampGuarding(ai?.resourceGuarding ?? Number.NaN, inferred.resourceGuarding),
    playStyles: aiStyles.length ? aiStyles : inferred.playStyles,
    hardBlockedPetIds: [...new Set(ai?.hardBlockedPetIds.filter(Boolean) ?? [])].sort(),
    notes: [source.pet.personality, source.pet.playStyle, source.pet.concerns]
      .map((value) => value.trim()).filter(Boolean).join(" / ").slice(0, 500),
  };
};
