import { getFirebaseDb } from "../lib/firebase";
import { FirestoreIntakeRepository } from "./firestoreIntakeRepository";
import { FirestoreOperationRepository } from "./firestoreOperationRepository";
import { FirestorePetRepository } from "./firestorePetRepository";
import { LocalIntakeRepository } from "./localIntakeRepository";
import { LocalOperationRepository } from "./localOperationRepository";
import { LocalPetRepository } from "./localPetRepository";
import type { IntakeRepository } from "./intakeRepository";

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
  const db = getFirebaseDb();
  return db ? new FirestoreIntakeRepository(db) : new LocalIntakeRepository();
};

export const createOperationRepository = () => {
  const db = getFirebaseDb();
  return db ? new FirestoreOperationRepository(db) : new LocalOperationRepository();
};
