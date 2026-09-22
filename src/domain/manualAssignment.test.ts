import { describe, expect, it } from 'vitest';
import { validateManualAssignments } from './manualAssignment';

const pets = [
  { id: 'a', name: 'あずき' },
  { id: 'b', name: 'ベル' },
  { id: 'c', name: 'ココ' },
];

const pairs = [
  { petAId: 'a', petBId: 'b', allowed: true },
  { petAId: 'a', petBId: 'c', allowed: false },
  { petAId: 'b', petBId: 'c', allowed: true },
];

describe('validateManualAssignments', () => {
  it('accepts a complete assignment that respects capacity and safety constraints', () => {
    expect(validateManualAssignments(pets, [
      { id: 'one', name: 'ルーム1', capacity: 2, petIds: ['a', 'b'] },
      { id: 'two', name: 'ルーム2', capacity: 1, petIds: ['c'] },
    ], pairs)).toEqual({ valid: true, issues: [] });
  });

  it('reports duplicates, unassigned pets, room capacity, and hard constraints together', () => {
    const result = validateManualAssignments(pets, [
      { id: 'one', name: 'ルーム1', capacity: 1, petIds: ['a', 'c'] },
      { id: 'two', name: 'ルーム2', capacity: 2, petIds: ['a'] },
    ], pairs);

    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'ROOM_CAPACITY',
      'HARD_CONSTRAINT',
      'DUPLICATE_PET',
      'UNASSIGNED_PET',
    ]));
    expect(result.issues.some((issue) => issue.message.includes('あずき'))).toBe(true);
  });

  it('rejects stale pet identifiers instead of silently saving them', () => {
    const result = validateManualAssignments(pets, [
      { id: 'one', name: 'ルーム1', capacity: 4, petIds: ['a', 'b', 'c', 'removed-pet'] },
    ], pairs);

    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'UNKNOWN_PET', petIds: ['removed-pet'] }));
  });

  it('fails closed when minimum occupancy or pair score data is missing', () => {
    const result = validateManualAssignments(pets, [
      { id: 'one', name: 'ルーム1', capacity: 3, minOccupancy: 3, petIds: ['a', 'b'] },
      { id: 'two', name: 'ルーム2', capacity: 1, petIds: ['c'] },
    ], pairs.filter((pair) => !(pair.petAId === 'a' && pair.petBId === 'b')));

    expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'MINIMUM_OCCUPANCY',
      'PAIR_DATA_MISSING',
    ]));
  });
});
