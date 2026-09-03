import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
// @ts-ignore - getReactNativePersistence is exported from React Native entrypoint of firebase/auth
import { initializeAuth, getReactNativePersistence, getAuth, type User, type Auth } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";

const firebaseConfig = {
  apiKey:            "AIzaSyDi6rtNdie2ueJPYC2fWgHiM6AG-ao8RMo",
  authDomain:        "bismillah-573d3.firebaseapp.com",
  projectId:         "bismillah-573d3",
  storageBucket:     "bismillah-573d3.firebasestorage.app",
  messagingSenderId: "282242582668",
  appId:             "1:282242582668:web:55658acd7c0d649c2f93a9",
  measurementId:     "G-0RZ46VYWX2",
};

const app  = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const db      = getFirestore(app);
export const storage = getStorage(app);

let authInstance: Auth;
try {
  authInstance = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch {
  authInstance = getAuth(app);
}

export const auth    = authInstance;
export default app;

// ─── ensureAdminSignedIn ──────────────────────────────────────────────────────
// No-op: Storage rules are set to "allow read, write: if true" so auth is not
// required. Kept as a stub so upload code doesn't need changing.
export async function ensureAdminSignedIn(): Promise<User | null> {
  if (auth.currentUser) return auth.currentUser;
  return null;
}
