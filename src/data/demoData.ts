import type { PetProfile, RoomDefinition } from "../domain";
const sampleAxes = { extraversion: 50, sociability: 50, neuroticism: 50, trainability: 50, resourceGuarding: 50, assertiveness: 50, resilience: 50 } as const;

export const demoPets: PetProfile[] = [
  { id: "coco", name: "ココ", breed: "トイプードル", ageYears: 3, weightKg: 4.2, energyLevel: 4, sociability: 5, anxietyLevel: 2, assertiveness: 2, resourceGuarding: 1, playStyles: ["chase", "fetch"], notes: "追いかけっことボール遊びが好き", personalityAxes: { ...sampleAxes, extraversion: 72, sociability: 84 } },
  { id: "mugi", name: "むぎ", breed: "柴犬", ageYears: 4, weightKg: 9.8, energyLevel: 4, sociability: 4, anxietyLevel: 2, assertiveness: 3, resourceGuarding: 2, playStyles: ["chase", "tug"], notes: "遊びの誘いが上手", personalityAxes: { ...sampleAxes, assertiveness: 68, resilience: 70 } },
  { id: "leo", name: "レオ", breed: "ゴールデンレトリバー", ageYears: 5, weightKg: 29, energyLevel: 3, sociability: 5, anxietyLevel: 1, assertiveness: 2, resourceGuarding: 1, playStyles: ["fetch", "gentle"], notes: "穏やかで小型犬にも配慮できる", personalityAxes: { ...sampleAxes, sociability: 90, resilience: 82 } },
  { id: "sora", name: "そら", breed: "チワワ", ageYears: 8, weightKg: 2.7, energyLevel: 2, sociability: 2, anxietyLevel: 4, assertiveness: 2, resourceGuarding: 1, playStyles: ["gentle", "solo"], notes: "静かな環境では落ち着いて過ごせる", personalityAxes: { ...sampleAxes, neuroticism: 78, sociability: 36 } },
  { id: "hana", name: "ハナ", breed: "フレンチブルドッグ", ageYears: 2, weightKg: 10.5, energyLevel: 3, sociability: 4, anxietyLevel: 2, assertiveness: 3, resourceGuarding: 2, playStyles: ["wrestle", "tug"], notes: "短時間の力強い遊びを好む", personalityAxes: { ...sampleAxes, extraversion: 66, assertiveness: 61 } },
  { id: "rin", name: "リン", breed: "ミニチュアダックス", ageYears: 6, weightKg: 5.8, energyLevel: 2, sociability: 3, anxietyLevel: 3, assertiveness: 2, resourceGuarding: 1, playStyles: ["gentle", "solo"], notes: "ゆっくりした交流を好む", personalityAxes: { ...sampleAxes, trainability: 72, neuroticism: 62 } },
];

export const demoRooms: RoomDefinition[] = [
  { id: "sun", name: "ひだまりルーム", capacity: 3, minOccupancy: 1 },
  { id: "garden", name: "ガーデンルーム", capacity: 3, minOccupancy: 1 },
];
