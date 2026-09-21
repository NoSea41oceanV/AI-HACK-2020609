import {
  collection,
  doc,
  documentId,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  startAfter,
  writeBatch,
  type Firestore,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import type { PetProfile } from "../domain";
import { clampPageSize, type PetPage, type PetRepository } from "./petRepository";

const COLLECTION_NAME = "demoPets";
const readPet = (snapshot: QueryDocumentSnapshot): PetProfile => ({
  ...(snapshot.data() as Omit<PetProfile, "id">),
  id: snapshot.id,
});

export class FirestorePetRepository implements PetRepository {
  readonly kind = "firestore" as const;
  constructor(private readonly db: Firestore) {}

  async listPage(pageSize = 20, cursor: string | null = null): Promise<PetPage> {
    const size = clampPageSize(pageSize);
    const base = collection(this.db, COLLECTION_NAME);
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
    await setDoc(doc(this.db, COLLECTION_NAME, id), { ...data, updatedAt: new Date().toISOString() });
  }

  async saveAll(pets: readonly PetProfile[]): Promise<void> {
    const batch = writeBatch(this.db);
    const timestamp = new Date().toISOString();
    for (const pet of pets) {
      const { id, ...data } = pet;
      batch.set(doc(this.db, COLLECTION_NAME, id), { ...data, updatedAt: pet.updatedAt ?? timestamp });
    }
    await batch.commit();
  }

  subscribeRecent(listener: (pets: PetProfile[]) => void, limitCount = 20): () => void {
    const recentQuery = query(
      collection(this.db, COLLECTION_NAME),
      orderBy("updatedAt", "desc"),
      limit(clampPageSize(limitCount)),
    );
    return onSnapshot(recentQuery, (snapshot) => listener(snapshot.docs.map(readPet)));
  }
}
