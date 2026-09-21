import { doc, setDoc, type Firestore } from "firebase/firestore";
import { isOwnerIntake, type IntakeRepository, type OwnerIntake } from "./intakeRepository";

const COLLECTION_NAME = "demoIntakes";
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export class FirestoreIntakeReadUnsupportedError extends Error {
  constructor() {
    super("公開デモの飼い主情報は安全のためFirestoreから読み取りできません。ローカルコピーを使用してください。");
  }
}

export class FirestoreIntakeRepository implements IntakeRepository {
  readonly kind = "firestore" as const;
  constructor(private readonly db: Firestore) {}

  async save(intake: OwnerIntake): Promise<void> {
    if (!isOwnerIntake(intake)) throw new Error("OwnerIntake is invalid.");
    if (!["submitted", "ready"].includes(intake.status)) {
      throw new Error("Firestoreの公開デモ受付はsubmittedまたはreadyの初回保存だけを許可します。");
    }
    // Rules allow create only. Reusing the same document id is intentionally rejected.
    await setDoc(doc(this.db, COLLECTION_NAME, intake.id), clone(intake));
  }

  async get(_id: string): Promise<OwnerIntake | null> {
    throw new FirestoreIntakeReadUnsupportedError();
  }

  async listRecent(_limitCount = 20): Promise<OwnerIntake[]> {
    throw new FirestoreIntakeReadUnsupportedError();
  }
}
