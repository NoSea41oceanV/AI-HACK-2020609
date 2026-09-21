import { initializeApp } from "firebase/app";
import {
  collection,
  connectFirestoreEmulator,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  query,
  setDoc,
  terminate,
  updateDoc,
} from "firebase/firestore";

const projectId = "demo-pawpair";
const app = initializeApp({ projectId });
const db = getFirestore(app);
connectFirestoreEmulator(db, "127.0.0.1", 8189);

const expectAllowed = async (operation, label) => {
  try {
    await operation;
  } catch (error) {
    throw new Error(`${label} should be allowed: ${String(error)}`);
  }
};

const expectDenied = async (operation, label) => {
  try {
    await operation;
  } catch (error) {
    if (String(error).includes("permission-denied") || String(error).includes("PERMISSION_DENIED")) return;
    throw new Error(`${label} failed for an unexpected reason: ${String(error)}`);
  }
  throw new Error(`${label} should be denied`);
};

const suffix = Date.now().toString(36);
const petId = `rules-pet-${suffix}`;
const validPet = {
  name: "デモ犬",
  breed: "mixed",
  ageYears: 4,
  weightKg: 9.5,
  energyLevel: 3,
  sociability: 4,
  anxietyLevel: 2,
  assertiveness: 2,
  resourceGuarding: 0,
  playStyles: ["gentle", "fetch"],
  hardBlockedPetIds: [],
  notes: "synthetic demo data",
  updatedAt: new Date().toISOString(),
};

try {
  await expectAllowed(setDoc(doc(db, "demoPets", petId), validPet), "valid demo pet create");
  await expectDenied(
    setDoc(doc(db, "demoPets", `invalid-${suffix}`), { ...validPet, energyLevel: 99 }),
    "out-of-range pet create",
  );
  await expectDenied(
    setDoc(doc(db, "demoPets", `pii-${suffix}`), { ...validPet, owner: "must-not-be-stored" }),
    "extra owner key on demo pet",
  );
  await expectDenied(getDocs(collection(db, "demoPets")), "unbounded demo pet list");
  await expectAllowed(getDocs(query(collection(db, "demoPets"), limit(26))), "bounded demo pet list");
  await expectDenied(deleteDoc(doc(db, "demoPets", petId)), "demo pet delete");

  const intakeId = `rules-intake-${suffix}`;
  const intake = {
    id: intakeId,
    inviteId: "public-demo",
    owner: { name: "デモ利用者", contact: "demo@example.invalid" },
    pet: {
      name: "デモ犬",
      breed: "mixed",
      ageYears: 4,
      weightKg: 9.5,
      sex: "unknown",
      personality: "synthetic demo personality",
      playStyle: "gentle",
      concerns: "",
    },
    media: {},
    status: "submitted",
    submittedAt: new Date().toISOString(),
  };
  await expectAllowed(setDoc(doc(db, "demoIntakes", intakeId), intake), "valid owner intake create");
  await expectDenied(getDoc(doc(db, "demoIntakes", intakeId)), "owner intake read");
  await expectDenied(getDocs(query(collection(db, "demoIntakes"), limit(1))), "owner intake list");
  await expectDenied(updateDoc(doc(db, "demoIntakes", intakeId), { status: "ready" }), "owner intake update");
  await expectDenied(deleteDoc(doc(db, "demoIntakes", intakeId)), "owner intake delete");

  const snapshotId = `rules-snapshot-${suffix}`;
  const snapshot = {
    id: snapshotId,
    status: "proposed",
    petIds: [petId],
    pairResults: [],
    rooms: [],
    objectiveScore: null,
    createdAt: new Date().toISOString(),
  };
  await expectAllowed(setDoc(doc(db, "demoMatchingSnapshots", snapshotId), snapshot), "valid matching snapshot create");
  await expectDenied(
    setDoc(doc(db, "demoMatchingSnapshots", `pii-${suffix}`), { ...snapshot, id: `pii-${suffix}`, owner: "blocked" }),
    "extra owner key on matching snapshot",
  );
  await expectDenied(getDocs(collection(db, "demoMatchingSnapshots")), "unbounded matching snapshot list");
  await expectAllowed(
    getDocs(query(collection(db, "demoMatchingSnapshots"), limit(25))),
    "bounded matching snapshot list",
  );
  await expectDenied(updateDoc(doc(db, "demoMatchingSnapshots", snapshotId), { status: "confirmed" }), "matching snapshot update");
  await expectDenied(deleteDoc(doc(db, "demoMatchingSnapshots", snapshotId)), "matching snapshot delete");

  const observationId = `rules-observation-${suffix}`;
  const observation = {
    id: observationId,
    scenarioId: "demo-scenario",
    title: "デモ観測",
    facts: [],
    impacts: [],
    recommendation: "staff review",
    observedAt: new Date().toISOString(),
  };
  await expectAllowed(setDoc(doc(db, "demoObservations", observationId), observation), "valid observation create");
  await expectDenied(
    setDoc(doc(db, "demoObservations", `pii-${suffix}`), { ...observation, id: `pii-${suffix}`, contact: "blocked" }),
    "extra contact key on observation",
  );
  await expectDenied(getDocs(collection(db, "demoObservations")), "unbounded observation list");
  await expectAllowed(getDocs(query(collection(db, "demoObservations"), limit(25))), "bounded observation list");
  await expectDenied(updateDoc(doc(db, "demoObservations", observationId), { title: "changed" }), "observation update");
  await expectDenied(deleteDoc(doc(db, "demoObservations", observationId)), "observation delete");

  await expectDenied(getDoc(doc(db, "private", "unknown")), "unspecified collection read");
} finally {
  await terminate(db);
}

console.log("Firestore Rules integration checks passed.");
