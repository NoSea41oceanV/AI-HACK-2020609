/** Answers use the exact labels in the PawPals reference form; no implicit defaults. */
export const STRUCTURED_INTAKE_OPTIONS = {
  neuter: ["済み", "未実施"],
  heat: ["いいえ", "はい"],
  mixedVaccine: ["提出済み・有効", "未提出", "期限切れ"],
  rabiesVaccine: ["提出済み・有効", "未提出", "期限切れ"],
  fleaTickPrevention: ["実施済み", "未実施"],
  foodAllergy: ["なし", "あり"],
  multiDogExperience: ["なし", "現在もあり", "過去にあり"],
  facilityExperience: ["月に数回", "週に数回", "ほぼ利用なし"],
  puppySocialization: ["十分経験あり", "少なめ", "不明"],
  firstMeeting: ["少し離れて様子を見る", "様子を見てから近づく", "すぐ近づいて遊びたがる", "苦手そうにする", "分からない"],
  playPreference: ["追いかけたり追いかけられたり", "追いかけるのが好き", "体を使って遊ぶのが好き", "おもちゃで遊ぶのが好き", "あまり遊ばず見ている", "分からない"],
  resourceReaction: ["気にしない", "少し気にすることがある", "取られそうだと嫌がる", "守ろうとすることがある", "そういう場面がない", "分からない"],
  excitement: ["ゆっくりテンションが上がる", "少しずつ盛り上がる", "すぐに走り回るほど元気になる", "吠えることがある", "分からない"],
  recovery: ["すぐ落ち着く", "少し時間がかかる", "かなり時間がかかる", "状況による", "分からない"],
  stressResponse: ["すぐ切り替えられる", "少し離れると落ち着く", "長く気にする", "吠えたり逃げたりする", "分からない"],
} as const;

export const STRUCTURED_INTAKE_TEXT_KEYS = ["medicalHistory", "sensoryJointConcerns", "troubleHistory"] as const;
export type StructuredIntakeAnswers = {
  [K in keyof typeof STRUCTURED_INTAKE_OPTIONS]: (typeof STRUCTURED_INTAKE_OPTIONS)[K][number];
} & { [K in (typeof STRUCTURED_INTAKE_TEXT_KEYS)[number]]: string };

export const STRUCTURED_INTAKE_LABELS: Record<keyof StructuredIntakeAnswers, string> = {
  neuter: "避妊・去勢", heat: "ヒート中", mixedVaccine: "混合ワクチン証明", rabiesVaccine: "狂犬病ワクチン",
  fleaTickPrevention: "ノミ・ダニ予防", foodAllergy: "食物アレルギー", medicalHistory: "既往症・服薬",
  sensoryJointConcerns: "関節・視覚・聴覚など気になること", multiDogExperience: "多頭飼い経験",
  facilityExperience: "ドッグラン・保育園", puppySocialization: "子犬期の社会化", troubleHistory: "過去のトラブル歴",
  firstMeeting: "初めて会う犬には？", playPreference: "他の犬との遊び方は？",
  resourceReaction: "おもちゃやごはんを他の犬が近づいてきたら？", excitement: "楽しくなったときは？",
  recovery: "興奮したあと、落ち着くまで？", stressResponse: "苦手なことがあったときは？",
};

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
export const isStructuredIntakeAnswers = (value: unknown): value is StructuredIntakeAnswers => {
  if (!record(value) || Object.keys(value).length !== Object.keys(STRUCTURED_INTAKE_LABELS).length ||
      !Object.keys(value).every((key) => Object.hasOwn(STRUCTURED_INTAKE_LABELS, key))) return false;
  return Object.entries(STRUCTURED_INTAKE_OPTIONS).every(([key, options]) =>
    typeof value[key] === "string" && (options as readonly string[]).includes(value[key])) &&
    STRUCTURED_INTAKE_TEXT_KEYS.every((key) => typeof value[key] === "string" && value[key].length <= 1_000);
};

export const INTAKE_CONSENT_VERSION = "2026-09" as const;
export interface IntakeConsent { version: typeof INTAKE_CONSENT_VERSION; accepted: true; acceptedAt: string }
export const isIntakeConsent = (value: unknown): value is IntakeConsent => record(value) &&
  Object.keys(value).length === 3 && value.version === INTAKE_CONSENT_VERSION && value.accepted === true &&
  typeof value.acceptedAt === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value.acceptedAt) &&
  Number.isFinite(Date.parse(value.acceptedAt)) && new Date(value.acceptedAt).toISOString() === value.acceptedAt;

export const PERSONALITY_AXIS_KEYS = ["extraversion", "sociability", "neuroticism", "trainability", "resourceGuarding", "assertiveness", "resilience"] as const;
export type PersonalityAxes = Record<(typeof PERSONALITY_AXIS_KEYS)[number], number>;
export const PERSONALITY_AXIS_LABELS: Record<keyof PersonalityAxes, string> = {
  extraversion: "外向性", sociability: "社交性", neuroticism: "神経質性", trainability: "訓練性",
  resourceGuarding: "資源防衛", assertiveness: "自己主張", resilience: "回復力",
};
export const isPersonalityAxes = (value: unknown): value is PersonalityAxes => record(value) &&
  Object.keys(value).length === PERSONALITY_AXIS_KEYS.length && PERSONALITY_AXIS_KEYS.every((key) =>
    Object.hasOwn(value, key) && typeof value[key] === "number" && Number.isInteger(value[key]) && value[key] >= 0 && value[key] <= 100);

export const samePersonalityAxes = (left: PersonalityAxes, right: PersonalityAxes): boolean =>
  PERSONALITY_AXIS_KEYS.every((key) => left[key] === right[key]);
