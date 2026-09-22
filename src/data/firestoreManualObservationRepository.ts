import type { Auth } from "firebase/auth";
import { collection, doc, getDocs, limit, orderBy, query, runTransaction, where, type Firestore } from "firebase/firestore";
import { requireFacilityId } from "./firestoreFacilityScope";
import { clampOperationLimit } from "./operationRepository";
import {
  isManualObservationRecord,
  prepareManualObservation,
  sameManualObservation,
  type CreateManualObservationInput,
  type ManualObservationRepository,
} from "./manualObservationRepository";

export class FirestoreManualObservationRepository implements ManualObservationRepository {
  readonly kind = "firestore" as const;
  constructor(private readonly db: Firestore, private readonly auth: Auth) {}

  async createManual(input: CreateManualObservationInput, expectedFacilityId?: string) {
    // Capture the tenant once, before async work or transaction retries.
    const facilityId = requireFacilityId(this.auth);
    if (expectedFacilityId !== undefined && expectedFacilityId !== facilityId) throw new Error("施設アカウントが変更されました。再度ログインを確認してください。");
    const record = prepareManualObservation(input);
    const reference = doc(this.db, "facilities", facilityId, "demoObservations", record.id);
    const staffReference = doc(this.db, "facilities", facilityId, "staffProfiles", record.staffId);
    const petReferences = record.petIds.map((id) => doc(this.db, "facilities", facilityId, "demoPets", id));
    return runTransaction(this.db, async (transaction) => {
      const existing = await transaction.get(reference);
      if (existing.exists()) {
        const saved = existing.data();
        if (!isManualObservationRecord(saved) || !sameManualObservation(saved, record)) {
          throw new Error("同じIDで異なる観測がすでに保存されています。");
        }
        return saved;
      }
      const staff = await transaction.get(staffReference);
      if (!staff.exists() || staff.data().active !== true) throw new Error("有効な担当スタッフを指定してください。");
      const pets = await Promise.all(petReferences.map((pet) => transaction.get(pet)));
      if (pets.some((pet) => !pet.exists())) throw new Error("施設に登録されたペットを指定してください。");
      transaction.set(reference, record);
      return record;
    });
  }

  async listManual(limitCount = 20) {
    const facilityId = requireFacilityId(this.auth);
    const boundedLimit = clampOperationLimit(Number.isFinite(limitCount) ? limitCount : 20);
    const result = await getDocs(query(
      collection(this.db, "facilities", facilityId, "demoObservations"),
      where("source", "==", "manual"), orderBy("observedAt", "desc"), limit(boundedLimit),
    ));
    // Legacy rows remain readable through OperationRepository, not as real observations.
    return result.docs.map((item) => item.data() as unknown).filter(isManualObservationRecord);
  }
}
