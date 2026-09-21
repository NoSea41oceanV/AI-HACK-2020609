import { getFirebaseDb } from "../lib/firebase";
import { FirestoreIntakeRepository } from "./firestoreIntakeRepository";
import { FirestoreOperationRepository } from "./firestoreOperationRepository";
import { FirestorePetRepository } from "./firestorePetRepository";
import { LocalIntakeRepository } from "./localIntakeRepository";
import { LocalOperationRepository } from "./localOperationRepository";
import { LocalPetRepository } from "./localPetRepository";
import type { IntakeRepository, OwnerIntake } from "./intakeRepository";

export * from "./demoData";
export * from "./firestoreIntakeRepository";
export * from "./firestoreOperationRepository";
export * from "./firestorePetRepository";
export * from "./intakeRepository";
export * from "./localIntakeRepository";
export * from "./localOperationRepository";
export * from "./localPetRepository";
export * from "./operationRepository";
export * from "./petRepository";

export const createPetRepository = () => {
  const db = getFirebaseDb();
  return db ? new FirestorePetRepository(db) : new LocalPetRepository();
};

export const createIntakeRepository = (): IntakeRepository => {
  const local = new LocalIntakeRepository();
  const db = getFirebaseDb();
  if (!db) return local;
  const remote = new FirestoreIntakeRepository(db);
  return {
    kind: "mirror",
    async save(intake: OwnerIntake) {
      if (await local.get(intake.id)) throw new Error("同じ受付IDは再送信できません。新しいIDを使用してください。");
      await local.save(intake);
      await remote.save(intake);
    },
    get: (id: string) => local.get(id),
    listRecent: (limitCount?: number) => local.listRecent(limitCount),
  };
};

export const createOperationRepository = () => {
  const db = getFirebaseDb();
  return db ? new FirestoreOperationRepository(db) : new LocalOperationRepository();
};
