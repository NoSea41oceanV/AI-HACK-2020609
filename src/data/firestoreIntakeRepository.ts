import { doc, getDoc, getDocs, limit, orderBy, query, setDoc, type Firestore } from "firebase/firestore";
import type { Auth } from "firebase/auth";
import { clampIntakeLimit, isOwnerIntake, type IntakeRepository, type OwnerIntake } from "./intakeRepository";
import { facilityCollection, requireFacilityId } from "./firestoreFacilityScope";

const COLLECTION_NAME = "demoIntakes";
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export class FirestoreIntakeRepository implements IntakeRepository {
  readonly kind = "firestore" as const;
  constructor(private readonly db: Firestore, private readonly auth: Auth) {}

  async save(intake: OwnerIntake): Promise<void> {
    if (!isOwnerIntake(intake)) throw new Error("OwnerIntake is invalid.");
    if (!["submitted", "ready"].includes(intake.status)) {
      throw new Error("Firestoreの公開デモ受付はsubmittedまたはreadyの初回保存だけを許可します。");
    }
    if (intake.id !== intake.inviteId) throw new Error("受付IDは招待ハッシュと一致する必要があります。");
    // Rules allow create only. Reusing the same document id is intentionally rejected.
    await setDoc(doc(this.db, "facilities", intake.facilityId, COLLECTION_NAME, intake.id), clone(intake));
  }

  async get(id: string): Promise<OwnerIntake | null> {
    const facilityId = requireFacilityId(this.auth);
    const snapshot = await getDoc(doc(this.db, "facilities", facilityId, COLLECTION_NAME, id));
    if (!snapshot.exists()) return null;
    const value = snapshot.data();
    return isOwnerIntake(value) ? value : null;
  }

  async listRecent(limitCount = 20): Promise<OwnerIntake[]> {
    const result = await getDocs(query(
      facilityCollection(this.db, this.auth, COLLECTION_NAME),
      orderBy("submittedAt", "desc"),
      limit(clampIntakeLimit(limitCount)),
    ));
    return result.docs.map((snapshot) => snapshot.data()).filter(isOwnerIntake);
  }
}
