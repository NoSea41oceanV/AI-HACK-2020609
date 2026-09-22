import type { PetProfile } from './types'

const normalizedStrings = (values: readonly string[] | undefined) =>
  [...new Set(values ?? [])].sort((left, right) => left.localeCompare(right))

const matchingInputs = (pet: PetProfile) => ({
  weightKg: pet.weightKg,
  energyLevel: pet.energyLevel,
  sociability: pet.sociability,
  anxietyLevel: pet.anxietyLevel,
  assertiveness: pet.assertiveness,
  resourceGuarding: pet.resourceGuarding,
  playStyles: normalizedStrings(pet.playStyles),
  hardBlockedPetIds: normalizedStrings(pet.hardBlockedPetIds),
  personalityAxes: pet.personalityAxes ?? null,
})

/** Notes and block reasons are rendered live; only calculation inputs stale a saved plan. */
export function profileChangeRequiresRecalculation(before: PetProfile, after: PetProfile): boolean {
  return JSON.stringify(matchingInputs(before)) !== JSON.stringify(matchingInputs(after))
}
