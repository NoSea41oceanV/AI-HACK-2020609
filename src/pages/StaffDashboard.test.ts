import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import StaffDashboard, { type CompatibilityPair, type PetProfile, type RoomAssignment } from './StaffDashboard';

const pets: PetProfile[] = [
  { id: 'a', name: 'あずき', personality: '慎重' },
  { id: 'b', name: 'ベル', personality: '友好的' },
  { id: 'c', name: 'ココ', personality: '活発' },
];
const pairs: CompatibilityPair[] = [
  { id: 'ab', petAId: 'a', petBId: 'b', totalScore: 85, factors: [], explanation: '規則による説明' },
  { id: 'ac', petAId: 'a', petBId: 'c', totalScore: 90, factors: [], explanation: '規則による説明', hardConstraints: ['別室の記録あり'] },
  { id: 'bc', petAId: 'b', petBId: 'c', totalScore: 70, factors: [], explanation: '規則による説明' },
];
const rooms: RoomAssignment[] = [
  { id: 'one', name: 'ルーム1', capacity: 2, petIds: ['a', 'b'], averageScore: 85 },
  { id: 'two', name: 'ルーム2', capacity: 1, petIds: ['c'], averageScore: 100 },
];

describe('StaffDashboard evidence and confirmation', () => {
  it('keeps rule explanations distinct from absent AI results and unknown operational counts', () => {
    const html = renderToStaticMarkup(createElement(StaffDashboard, { pets, pairs, rooms }));
    expect(html).toContain('スコア算定の説明');
    expect(html).toContain('規則による説明');
    expect(html).toContain('保存済みのAI解析データがありません');
    expect(html).not.toContain('AIエージェント稼働中');
    expect(html).toContain('未設定');
    expect(html).toContain('交流実績データなし');
    expect(html).toContain('安全制約あり');
  });

  it('shows saved AI evidence, cautions and recommendations when supplied', () => {
    const analyzed = { ...pairs[0], aiExplanation: '保存された解析の要約', aiCautions: ['初対面では距離を確保'], aiRecommendations: ['短時間から開始'] };
    const html = renderToStaticMarkup(createElement(StaffDashboard, { pets, pairs: [analyzed, ...pairs.slice(1)], rooms }));
    expect(html).toContain('保存された解析の要約');
    expect(html).toContain('初対面では距離を確保');
    expect(html).toContain('短時間から開始');
  });

  it('blocks confirmation of a high-scoring but forbidden pair', () => {
    const invalidRooms = [
      { ...rooms[0], petIds: ['a', 'c'] },
      { ...rooms[1], petIds: ['b'] },
    ];
    const html = renderToStaticMarkup(createElement(StaffDashboard, { pets, pairs, rooms: invalidRooms, selectedPairId: "ac" }));
    expect(html).toContain('このペアは同室にできません');
    expect(html).toContain('同室不可の安全制約');
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>検証済みの部屋割りを確定/);
  });
});

