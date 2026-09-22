import type { PetProfile, RoomDefinition } from "../domain";

export const demoPets: PetProfile[] = [
  {
    id: "demo-pet-coco", name: "ココ", breed: "トイプードル", ageYears: 3, weightKg: 4.2,
    energyLevel: 4, sociability: 5, anxietyLevel: 2, assertiveness: 2, resourceGuarding: 1,
    playStyles: ["chase", "fetch"], notes: "【デモサンプル】追いかけっことボール遊びが好き",
    personalityAxes: { extraversion: 82, sociability: 88, neuroticism: 28, trainability: 86, resourceGuarding: 12, assertiveness: 38, resilience: 78 },
  },
  {
    id: "demo-pet-mugi", name: "むぎ", breed: "柴犬", ageYears: 4, weightKg: 9.8,
    energyLevel: 4, sociability: 4, anxietyLevel: 2, assertiveness: 3, resourceGuarding: 2,
    playStyles: ["chase", "tug"], notes: "【デモサンプル】遊びの誘いが上手",
    personalityAxes: { extraversion: 76, sociability: 70, neuroticism: 32, trainability: 72, resourceGuarding: 30, assertiveness: 58, resilience: 74 },
  },
  {
    id: "demo-pet-leo", name: "レオ", breed: "ゴールデンレトリバー", ageYears: 5, weightKg: 29,
    energyLevel: 3, sociability: 5, anxietyLevel: 1, assertiveness: 2, resourceGuarding: 1,
    playStyles: ["fetch", "gentle"], notes: "【デモサンプル】穏やかで小型犬にも配慮できる",
    personalityAxes: { extraversion: 68, sociability: 92, neuroticism: 16, trainability: 90, resourceGuarding: 8, assertiveness: 30, resilience: 92 },
  },
  {
    id: "demo-pet-sora", name: "そら", breed: "チワワ", ageYears: 8, weightKg: 2.7,
    energyLevel: 2, sociability: 2, anxietyLevel: 4, assertiveness: 2, resourceGuarding: 1,
    playStyles: ["gentle", "solo"], hardBlockedPetIds: ["demo-pet-hana"],
    notes: "【デモサンプル】静かな環境では落ち着いて過ごせる。ハナとは同室不可",
    personalityAxes: { extraversion: 30, sociability: 38, neuroticism: 78, trainability: 64, resourceGuarding: 14, assertiveness: 32, resilience: 46 },
  },
  {
    id: "demo-pet-hana", name: "ハナ", breed: "フレンチブルドッグ", ageYears: 2, weightKg: 10.5,
    energyLevel: 3, sociability: 4, anxietyLevel: 2, assertiveness: 3, resourceGuarding: 2,
    playStyles: ["wrestle", "tug"], notes: "【デモサンプル】短時間の力強い遊びを好む",
    personalityAxes: { extraversion: 74, sociability: 72, neuroticism: 34, trainability: 66, resourceGuarding: 32, assertiveness: 62, resilience: 70 },
  },
  {
    id: "demo-pet-rin", name: "リン", breed: "ミニチュアダックス", ageYears: 6, weightKg: 5.8,
    energyLevel: 2, sociability: 3, anxietyLevel: 3, assertiveness: 2, resourceGuarding: 1,
    playStyles: ["gentle", "solo"], notes: "【デモサンプル】ゆっくりした交流を好む",
    personalityAxes: { extraversion: 42, sociability: 56, neuroticism: 54, trainability: 76, resourceGuarding: 16, assertiveness: 36, resilience: 62 },
  },
];

export const demoRooms: RoomDefinition[] = [
  { id: "sun", name: "ひだまりルーム", capacity: 3, minOccupancy: 1 },
  { id: "garden", name: "ガーデンルーム", capacity: 3, minOccupancy: 1 },
];
