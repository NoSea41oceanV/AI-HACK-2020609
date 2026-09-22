import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore, type Firestore } from "firebase/firestore";

export interface FirebaseClientConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
}

const envConfig: Partial<FirebaseClientConfig> = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const hasFirebaseConfig = (config = envConfig): config is FirebaseClientConfig =>
  Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);

let app: FirebaseApp | null = null;
let authEmulatorConnected = false;
let firestoreEmulatorConnected = false;

const localEmulatorUrl = (value: string | undefined): URL | null => {
  if (!value?.trim()) return null;
  const url = new URL(value.trim());
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(url.hostname) || !url.port) {
    throw new Error("Firebase emulator URL must use http://127.0.0.1:<port> or http://localhost:<port>.");
  }
  return url;
};

export const getFirebaseApp = (): FirebaseApp | null => {
  if (!hasFirebaseConfig()) return null;
  if (!app) app = getApps()[0] ?? initializeApp(envConfig);
  return app;
};

export const getFirebaseDb = (): Firestore | null => {
  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) return null;
  const db = getFirestore(firebaseApp);
  const emulator = localEmulatorUrl(import.meta.env.VITE_FIRESTORE_EMULATOR_URL);
  if (emulator && !firestoreEmulatorConnected) {
    connectFirestoreEmulator(db, emulator.hostname, Number(emulator.port));
    firestoreEmulatorConnected = true;
  }
  return db;
};

export const getFirebaseAuth = (): Auth | null => {
  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) return null;
  const auth = getAuth(firebaseApp);
  const emulator = localEmulatorUrl(import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_URL);
  if (emulator && !authEmulatorConnected) {
    connectAuthEmulator(auth, emulator.toString(), { disableWarnings: true });
    authEmulatorConnected = true;
  }
  return auth;
};
