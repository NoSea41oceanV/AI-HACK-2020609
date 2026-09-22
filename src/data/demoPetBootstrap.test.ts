import { describe, expect, it } from "vitest";
import type { PetProfile } from "../domain";
import { demoPets } from "./demoData";
import { ensureDemoPets } from "./demoPetBootstrap";

const repositoryWith = (initial: readonly PetProfile[]) => {
  const documents = new Map(initial.map((pet) => [pet.id, structuredClone(pet)]));
  return {
    documents,
    repository: {
      saveIfAbsent: async (pet: PetProfile) => {
        if (documents.has(pet.id)) return false;
        documents.set(pet.id, structuredClone(pet));
        return true;
      },
    },
  };
};

describe("ensureDemoPets", () => {
  it("creates all six fixed demo profiles with matching fields and seven axes", async () => {
    const { documents, repository } = repositoryWith([]);

    await expect(ensureDemoPets(repository)).resolves.toBe(6);
    expect([...documents.keys()]).toEqual(demoPets.map((pet) => pet.id));
    expect(demoPets).toHaveLength(6);
    expect(demoPets.every((pet) => pet.id.startsWith("demo-pet-") && pet.notes?.includes("デモサンプル"))).toBe(true);
    expect(demoPets.every((pet) => Object.keys(pet.personalityAxes ?? {}).length === 7)).toBe(true);
  });

  it("does not overwrite an existing document and only creates missing samples", async () => {
    const existing = { ...demoPets[0], name: "既存のココ" };
    const { documents, repository } = repositoryWith([existing]);

    await expect(ensureDemoPets(repository)).resolves.toBe(5);
    expect(documents.size).toBe(6);
    expect(documents.get(existing.id)?.name).toBe("既存のココ");
    await expect(ensureDemoPets(repository)).resolves.toBe(0);
    expect(documents.get(existing.id)?.name).toBe("既存のココ");
  });

  it("adds the samples even when six or more real pets already exist", async () => {
    const realPets = Array.from({ length: 7 }, (_, index): PetProfile => ({
      ...demoPets[0], id: `real-pet-${index}`, name: `実犬${index}`,
    }));
    const { documents, repository } = repositoryWith(realPets);

    await expect(ensureDemoPets(repository)).resolves.toBe(6);
    expect(documents.size).toBe(13);
    expect(realPets.every((pet) => documents.get(pet.id)?.name === pet.name)).toBe(true);
  });

  it("propagates a storage failure instead of reporting success", async () => {
    const failure = new Error("firestore unavailable");
    const repository = { saveIfAbsent: async () => { throw failure; } };

    await expect(ensureDemoPets(repository)).rejects.toBe(failure);
  });
});
