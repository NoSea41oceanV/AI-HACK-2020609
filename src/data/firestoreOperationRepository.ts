import { collection, doc, getDocs, limit, orderBy, query, setDoc, type Firestore } from "firebase/firestore";
import {
  clampOperationLimit,
  isMatchingSnapshot,
  isObservationRecord,
  type MatchingSnapshot,
  type ObservationRecord,
  type OperationRepository,
} from "./operationRepository";

const MATCHINGS = "demoMatchingSnapshots";
const OBSERVATIONS = "demoObservations";
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export class FirestoreOperationRepository implements OperationRepository {
  readonly kind = "firestore" as const;
  constructor(private readonly db: Firestore) {}

  async saveMatching(snapshot: MatchingSnapshot) {
    if (!isMatchingSnapshot(snapshot)) throw new Error("MatchingSnapshot is invalid.");
    await setDoc(doc(this.db, MATCHINGS, snapshot.id), clone(snapshot));
  }
  async listMatchings(limitCount = 20) {
    const result = await getDocs(query(collection(this.db, MATCHINGS), orderBy("createdAt", "desc"), limit(clampOperationLimit(limitCount))));
    return result.docs.map((item) => item.data() as unknown).filter(isMatchingSnapshot);
  }
  async saveObservation(observation: ObservationRecord) {
    if (!isObservationRecord(observation)) throw new Error("ObservationRecord is invalid.");
    await setDoc(doc(this.db, OBSERVATIONS, observation.id), clone(observation));
  }
  async listObservations(limitCount = 20) {
    const result = await getDocs(query(collection(this.db, OBSERVATIONS), orderBy("observedAt", "desc"), limit(clampOperationLimit(limitCount))));
    return result.docs.map((item) => item.data() as unknown).filter(isObservationRecord);
  }
}
