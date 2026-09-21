import {
  clampIntakeLimit,
  isOwnerIntake,
  type IntakeRepository,
  type OwnerIntake,
} from "./intakeRepository";

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

const defaultStorage = (): StorageLike =>
  typeof localStorage === "undefined" ? new MemoryStorage() : localStorage;

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export class LocalIntakeRepository implements IntakeRepository {
  readonly kind = "local" as const;

  constructor(
    private readonly storage: StorageLike = defaultStorage(),
    private readonly storageKey = "pawpair:owner-intakes:v1",
  ) {}

  private readAll(): OwnerIntake[] {
    const raw = this.storage.getItem(this.storageKey);
    if (!raw) return [];
    try {
      const value = JSON.parse(raw) as unknown;
      return Array.isArray(value) ? value.filter(isOwnerIntake) : [];
    } catch {
      return [];
    }
  }

  async save(intake: OwnerIntake): Promise<void> {
    if (!isOwnerIntake(intake)) throw new Error("OwnerIntake is invalid.");
    const all = this.readAll();
    const index = all.findIndex((item) => item.id === intake.id);
    if (index >= 0) all[index] = clone(intake);
    else all.push(clone(intake));
    this.storage.setItem(this.storageKey, JSON.stringify(all));
  }

  async get(id: string): Promise<OwnerIntake | null> {
    const found = this.readAll().find((item) => item.id === id);
    return found ? clone(found) : null;
  }

  async listRecent(limitCount = 20): Promise<OwnerIntake[]> {
    return this.readAll()
      .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt) || left.id.localeCompare(right.id))
      .slice(0, clampIntakeLimit(limitCount))
      .map(clone);
  }
}
