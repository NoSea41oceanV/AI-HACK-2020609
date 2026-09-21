import {
  clampOperationLimit,
  isMatchingSnapshot,
  isObservationRecord,
  type MatchingSnapshot,
  type ObservationRecord,
  type OperationRepository,
} from "./operationRepository";

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}
const defaultStorage = (): StorageLike => typeof localStorage === "undefined" ? new MemoryStorage() : localStorage;
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export class LocalOperationRepository implements OperationRepository {
  readonly kind = "local" as const;
  constructor(
    private readonly storage: StorageLike = defaultStorage(),
    private readonly matchingKey = "pawpair:matching-snapshots:v1",
    private readonly observationKey = "pawpair:observations:v1",
  ) {}

  private read<T>(key: string, guard: (value: unknown) => value is T): T[] {
    const raw = this.storage.getItem(key);
    if (!raw) return [];
    try {
      const value = JSON.parse(raw) as unknown;
      return Array.isArray(value) ? value.filter(guard) : [];
    } catch { return []; }
  }

  private create<T extends { id: string }>(key: string, value: T, guard: (candidate: unknown) => candidate is T) {
    if (!guard(value)) throw new Error("Operation record is invalid.");
    const all = this.read(key, guard);
    if (all.some((item) => item.id === value.id)) throw new Error(`Operation record already exists: ${value.id}`);
    all.push(clone(value));
    this.storage.setItem(key, JSON.stringify(all));
  }

  async saveMatching(snapshot: MatchingSnapshot) { this.create(this.matchingKey, snapshot, isMatchingSnapshot); }
  async listMatchings(limitCount = 20) {
    return this.read(this.matchingKey, isMatchingSnapshot)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || left.id.localeCompare(right.id))
      .slice(0, clampOperationLimit(limitCount)).map(clone);
  }
  async saveObservation(observation: ObservationRecord) { this.create(this.observationKey, observation, isObservationRecord); }
  async listObservations(limitCount = 20) {
    return this.read(this.observationKey, isObservationRecord)
      .sort((left, right) => right.observedAt.localeCompare(left.observedAt) || left.id.localeCompare(right.id))
      .slice(0, clampOperationLimit(limitCount)).map(clone);
  }
}
