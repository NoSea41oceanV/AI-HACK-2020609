import { doc, getDocs, limit, orderBy, query, setDoc, type Firestore } from "firebase/firestore";
import type { Auth } from "firebase/auth";
import {
  clampOperationLimit,
  isMatchingSnapshot,
  isObservationRecord,
  type MatchingSnapshot,
  type ObservationRecord,
  type OperationRepository,
} from "./operationRepository";
import { facilityCollection } from "./firestoreFacilityScope";

const MATCHINGS = "demoMatchingSnapshots";
const OBSERVATIONS = "demoObservations";
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export class FirestoreOperationRepository implements OperationRepository {
  readonly kind = "firestore" as const;
  constructor(private readonly db: Firestore, private readonly auth: Auth) {}

  async saveMatching(snapshot: MatchingSnapshot) {
    if (!isMatchingSnapshot(snapshot)) throw new Error("MatchingSnapshot is invalid.");
    await setDoc(doc(facilityCollection(this.db, this.auth, MATCHINGS), snapshot.id), clone(snapshot));
  }
  async listMatchings(limitCount = 20) {
    const result = await getDocs(query(facilityCollection(this.db, this.auth, MATCHINGS), orderBy("createdAt", "desc"), limit(clampOperationLimit(limitCount))));
    return result.docs.map((item) => item.data() as unknown).filter(isMatchingSnapshot);
  }
  async saveObservation(observation: ObservationRecord) {
    if (!isObservationRecord(observation)) throw new Error("ObservationRecord is invalid.");
    await setDoc(doc(facilityCollection(this.db, this.auth, OBSERVATIONS), observation.id), clone(observation));
  }
  async listObservations(limitCount = 20) {
    const result = await getDocs(query(facilityCollection(this.db, this.auth, OBSERVATIONS), orderBy("observedAt", "desc"), limit(clampOperationLimit(limitCount))));
    return result.docs.map((item) => item.data() as unknown).filter(isObservationRecord);
  }
}
