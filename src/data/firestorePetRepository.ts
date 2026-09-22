import {
  doc,
  documentId,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  setDoc,
  startAfter,
  writeBatch,
  type Firestore,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import type { Auth } from "firebase/auth";
import type { PetProfile } from "../domain";
import { clampPageSize, type PetPage, type PetRepository } from "./petRepository";
import { facilityCollection } from "./firestoreFacilityScope";

const COLLECTION_NAME = "demoPets";
const readPet = (snapshot: QueryDocumentSnapshot): PetProfile => ({
  ...(snapshot.data() as Omit<PetProfile, "id">),
  id: snapshot.id,
});

export class FirestorePetRepository implements PetRepository {
  readonly kind = "firestore" as const;
  constructor(private readonly db: Firestore, private readonly auth: Auth) {}

  async listPage(pageSize = 20, cursor: string | null = null): Promise<PetPage> {
    const size = clampPageSize(pageSize);
    const base = facilityCollection(this.db, this.auth, COLLECTION_NAME);
    const pageQuery = cursor
      ? query(base, orderBy(documentId()), startAfter(cursor), limit(size + 1))
      : query(base, orderBy(documentId()), limit(size + 1));
    const documents = (await getDocs(pageQuery)).docs;
    const visibleDocuments = documents.slice(0, size);
    return {
      pets: visibleDocuments.map(readPet),
      nextCursor: documents.length > size ? visibleDocuments.at(-1)?.id ?? null : null,
    };
  }

  async save(pet: PetProfile): Promise<void> {
    const { id, ...data } = pet;
    await setDoc(doc(facilityCollection(this.db, this.auth, COLLECTION_NAME), id), { ...data, updatedAt: new Date().toISOString() });
  }

  async saveIfAbsent(pet: PetProfile): Promise<boolean> {
    const { id, ...data } = pet;
    const reference = doc(facilityCollection(this.db, this.auth, COLLECTION_NAME), id);
    return runTransaction(this.db, async (transaction) => {
      const existing = await transaction.get(reference);
      if (existing.exists()) return false;
      transaction.set(reference, { ...data, updatedAt: pet.updatedAt ?? new Date().toISOString() });
      return true;
    });
  }

  async saveAll(pets: readonly PetProfile[]): Promise<void> {
    const batch = writeBatch(this.db);
    const timestamp = new Date().toISOString();
    for (const pet of pets) {
      const { id, ...data } = pet;
      batch.set(doc(facilityCollection(this.db, this.auth, COLLECTION_NAME), id), { ...data, updatedAt: pet.updatedAt ?? timestamp });
    }
    await batch.commit();
  }

  subscribeRecent(listener: (pets: PetProfile[]) => void, limitCount = 20): () => void {
    const recentQuery = query(
      facilityCollection(this.db, this.auth, COLLECTION_NAME),
      orderBy("updatedAt", "desc"),
      limit(clampPageSize(limitCount)),
    );
    return onSnapshot(recentQuery, (snapshot) => listener(snapshot.docs.map(readPet)));
  }
}
