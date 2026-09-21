import { describe, expect, it } from "vitest";
import { LocalIntakeRepository } from "./localIntakeRepository";
import { isOwnerIntake, type OwnerIntake } from "./intakeRepository";

const intake = (id: string, submittedAt = "2026-09-22T00:00:00.000Z"): OwnerIntake => ({
  id,
  inviteId: "DEMO",
  owner: { name: "デモ飼い主", contact: "000-0000-0000" },
  pet: {
    name: `ペット${id}`,
    breed: "ミックス",
    ageYears: 3,
    weightKg: 8,
    sex: "unknown",
    personality: "穏やか",
    playStyle: "ボール遊び",
    concerns: "",
  },
  media: {},
  status: "submitted",
  submittedAt,
});

const memoryStorage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
};

describe("LocalIntakeRepository", () => {
  it("saves, gets, and replaces one intake", async () => {
    const repository = new LocalIntakeRepository(memoryStorage());
    await repository.save(intake("one"));
    await repository.save({ ...intake("one"), status: "ready" });

    await expect(repository.get("one")).resolves.toMatchObject({ id: "one", status: "ready" });
    await expect(repository.listRecent()).resolves.toHaveLength(1);
  });

  it("sorts by submittedAt and caps every request at 25", async () => {
    const repository = new LocalIntakeRepository(memoryStorage());
    for (let index = 0; index < 30; index += 1) {
      await repository.save(intake(`intake-${index}`, new Date(Date.UTC(2026, 8, 1, 0, index)).toISOString()));
    }

    const recent = await repository.listRecent(100);
    expect(recent).toHaveLength(25);
    expect(recent[0].id).toBe("intake-29");
    expect(recent.at(-1)?.id).toBe("intake-5");
  });

  it("does not expose mutable internal values", async () => {
    const repository = new LocalIntakeRepository(memoryStorage());
    await repository.save(intake("safe"));
    const value = await repository.get("safe");
    if (!value) throw new Error("missing fixture");
    value.owner.name = "変更";

    await expect(repository.get("safe")).resolves.toMatchObject({ owner: { name: "デモ飼い主" } });
  });

  it("rejects raw or remotely persisted media references", () => {
    expect(isOwnerIntake({
      ...intake("unsafe"),
      media: {
        photo: {
          kind: "image",
          fileName: "pet.jpg",
          contentType: "image/jpeg",
          sizeBytes: 3,
          status: "uploaded",
          mediaId: "demo/persisted.jpg",
        },
      },
    })).toBe(false);
    expect(isOwnerIntake({
      ...intake("unsafe-data"),
      media: {
        photo: {
          kind: "image",
          fileName: "pet.jpg",
          contentType: "image/jpeg",
          sizeBytes: 3,
          status: "selected",
          dataUrl: "data:image/jpeg;base64,/9j/",
        },
      },
    })).toBe(false);
  });
});
