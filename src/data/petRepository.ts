import type { PetProfile } from "../domain";

export interface PetPage {
  pets: PetProfile[];
  nextCursor: string | null;
}

export interface PetRepository {
  readonly kind: "local" | "firestore";
  listPage(pageSize?: number, cursor?: string | null): Promise<PetPage>;
  save(pet: PetProfile): Promise<void>;
  saveAll(pets: readonly PetProfile[]): Promise<void>;
  subscribeRecent(listener: (pets: PetProfile[]) => void, limitCount?: number): () => void;
}

export const clampPageSize = (pageSize = 20) => Math.min(25, Math.max(1, pageSize));
