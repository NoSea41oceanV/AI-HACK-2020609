import { demoPets } from "./demoData";
import type { PetRepository } from "./petRepository";

/**
 * Ensures the six fixed demo profiles exist without changing an existing
 * document. A failed write is intentionally allowed to reject so the caller
 * can surface the Firestore error instead of pretending a local fallback won.
 */
export const ensureDemoPets = async (
  repository: Pick<PetRepository, "saveIfAbsent">,
): Promise<number> => {
  let created = 0;
  for (const pet of demoPets) {
    if (await repository.saveIfAbsent(pet)) created += 1;
  }
  return created;
};
