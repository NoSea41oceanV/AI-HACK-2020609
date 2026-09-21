import type { PetProfile } from "../domain";
import { demoPets } from "./demoData";
import { clampPageSize, type PetPage, type PetRepository } from "./petRepository";

const DEFAULT_STORAGE_KEY = "pawpair:demo-pets:v1";
const comparePets = (left: PetProfile, right: PetProfile) =>
  (right.updatedAt ?? "").localeCompare(left.updatedAt ?? "") || left.id.localeCompare(right.id);

export class LocalPetRepository implements PetRepository {
  readonly kind = "local" as const;
  private readonly listeners = new Set<(pets: PetProfile[]) => void>();

  constructor(private readonly storageKey = DEFAULT_STORAGE_KEY) {}

  private read(): PetProfile[] {
    if (typeof localStorage === "undefined") return [...demoPets];
    const raw = localStorage.getItem(this.storageKey);
    if (!raw) {
      localStorage.setItem(this.storageKey, JSON.stringify(demoPets));
      return [...demoPets];
    }
    try {
      return (JSON.parse(raw) as PetProfile[]).sort(comparePets);
    } catch {
      localStorage.setItem(this.storageKey, JSON.stringify(demoPets));
      return [...demoPets];
    }
  }

  private write(pets: readonly PetProfile[]) {
    if (typeof localStorage !== "undefined") localStorage.setItem(this.storageKey, JSON.stringify(pets));
    const current = this.read();
    for (const listener of this.listeners) listener(current);
  }

  async listPage(pageSize = 20, cursor: string | null = null): Promise<PetPage> {
    const pets = this.read();
    const cursorIndex = cursor ? pets.findIndex((pet) => pet.id === cursor) : -1;
    const startIndex = cursorIndex >= 0 ? cursorIndex + 1 : 0;
    const page = pets.slice(startIndex, startIndex + clampPageSize(pageSize));
    return { pets: page, nextCursor: startIndex + page.length < pets.length ? page.at(-1)?.id ?? null : null };
  }

  async save(pet: PetProfile): Promise<void> {
    const current = this.read();
    const nextPet = { ...pet, updatedAt: new Date().toISOString() };
    const index = current.findIndex((item) => item.id === pet.id);
    if (index >= 0) current[index] = nextPet;
    else current.push(nextPet);
    this.write(current.sort(comparePets));
  }

  async saveAll(pets: readonly PetProfile[]): Promise<void> {
    const timestamp = new Date().toISOString();
    this.write(pets.map((pet) => ({ ...pet, updatedAt: pet.updatedAt ?? timestamp })).sort(comparePets));
  }

  subscribeRecent(listener: (pets: PetProfile[]) => void, limitCount = 20): () => void {
    const limitedListener = (pets: PetProfile[]) => listener(pets.slice(0, clampPageSize(limitCount)));
    this.listeners.add(limitedListener);
    limitedListener(this.read());
    const onStorage = (event: StorageEvent) => {
      if (event.key === this.storageKey) limitedListener(this.read());
    };
    if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
    return () => {
      this.listeners.delete(limitedListener);
      if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
    };
  }
}
