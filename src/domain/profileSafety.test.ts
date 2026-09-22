import { describe, expect, it } from 'vitest'
import type { PetProfile } from './types'
import { profileChangeRequiresRecalculation } from './profileSafety'

const pet: PetProfile = {
  id: 'a', name: 'A', ageYears: 3, weightKg: 8, energyLevel: 3,
  sociability: 3, anxietyLevel: 2, assertiveness: 2, resourceGuarding: 1,
  playStyles: ['gentle'], hardBlockedPetIds: ['b'], hardBlockedPetReasons: { b: '理由' },
}

describe('profile plan invalidation', () => {
  it('invalidates a saved calculation when a block or score input changes', () => {
    expect(profileChangeRequiresRecalculation(pet, { ...pet, hardBlockedPetIds: [] })).toBe(true)
    expect(profileChangeRequiresRecalculation(pet, { ...pet, weightKg: 12 })).toBe(true)
    expect(profileChangeRequiresRecalculation(pet, { ...pet, playStyles: ['fetch'] })).toBe(true)
  })

  it('does not invalidate for live notes, reasons, or ordering-only changes', () => {
    expect(profileChangeRequiresRecalculation(pet, { ...pet, facilityNotes: '引き継ぎ' })).toBe(false)
    expect(profileChangeRequiresRecalculation(pet, { ...pet, tabooNotes: '食事は単独' })).toBe(false)
    expect(profileChangeRequiresRecalculation(pet, { ...pet, hardBlockedPetReasons: { b: '更新理由' } })).toBe(false)
    expect(profileChangeRequiresRecalculation(
      { ...pet, hardBlockedPetIds: ['b', 'c'] },
      { ...pet, hardBlockedPetIds: ['c', 'b', 'b'] },
    )).toBe(false)
  })
})
