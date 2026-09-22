import { getFirebaseAuth, getFirebaseDb } from "../lib/firebase";
import { FirestoreIntakeRepository } from "./firestoreIntakeRepository";
import { FirestoreInviteRepository, FirestoreStaffProfileRepository } from "./firestoreInviteRepository";
import { FirestoreDailyOperationRepository } from "./firestoreDailyOperationRepository";
import { FirestoreOperationRepository } from "./firestoreOperationRepository";
import { FirestorePetRepository } from "./firestorePetRepository";
import { LocalIntakeRepository } from "./localIntakeRepository";
import { LocalOperationRepository } from "./localOperationRepository";
import { LocalPetRepository } from "./localPetRepository";
import type { IntakeRepository } from "./intakeRepository";

export * from "./demoData";
export * from "./firestoreIntakeRepository";
export * from "./firestoreInviteRepository";
export * from "./dailyOperationRepository";
export * from "./firestoreDailyOperationRepository";
export * from "./firestoreOperationRepository";
export * from "./firestorePetRepository";
export * from "./intakeRepository";
export * from "./inviteRepository";
export * from "./localIntakeRepository";
export * from "./localOperationRepository";
export * from "./localPetRepository";
export * from "./operationRepository";
export * from "./petRepository";

export const createPetRepository = () => {
  const db = getFirebaseDb();
  const auth = getFirebaseAuth();
  return db && auth ? new FirestorePetRepository(db, auth) : new LocalPetRepository();
};

export const createIntakeRepository = (): IntakeRepository => {
  const db = getFirebaseDb();
  const auth = getFirebaseAuth();
  return db && auth ? new FirestoreIntakeRepository(db, auth) : new LocalIntakeRepository();
};

export const createInviteRepository = () => {
  const db = getFirebaseDb();
  const auth = getFirebaseAuth();
  return db && auth ? new FirestoreInviteRepository(db, auth) : null;
};

export const createStaffProfileRepository = () => {
  const db = getFirebaseDb();
  const auth = getFirebaseAuth();
  return db && auth ? new FirestoreStaffProfileRepository(db, auth) : null;
};

export const createDailyOperationRepository = () => {
  const db = getFirebaseDb();
  const auth = getFirebaseAuth();
  return db && auth ? new FirestoreDailyOperationRepository(db, auth) : null;
};

export const createOperationRepository = () => {
  const db = getFirebaseDb();
  const auth = getFirebaseAuth();
  return db && auth ? new FirestoreOperationRepository(db, auth) : new LocalOperationRepository();
};
