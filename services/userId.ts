import AsyncStorage from "@react-native-async-storage/async-storage";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase.config";

const USER_ID_KEY   = "user_id_v1";
const COUNTER_DOC   = "config/userCounter";

// ── Generate sequential userId via Firestore atomic counter ───────────────────
async function generateUserId(): Promise<string> {
  try {
    const ref  = doc(db, "config", "userCounter");
    const snap = await getDoc(ref);
    const next = snap.exists() ? ((snap.data().count as number) ?? 0) + 1 : 1;
    await setDoc(ref, { count: next }, { merge: true });
    return `U${String(next).padStart(4, "0")}`;
  } catch {
    // Offline fallback: random 4-digit to avoid collision
    const rand = Math.floor(Math.random() * 8999) + 1000;
    return `U${rand}`;
  }
}

// ── Create or retrieve userId ─────────────────────────────────────────────────
export async function getUserId(): Promise<string> {
  const cached = await AsyncStorage.getItem(USER_ID_KEY);
  if (cached) return cached;

  const userId = await generateUserId();
  await AsyncStorage.setItem(USER_ID_KEY, userId);

  // Create Firestore user document
  try {
    await setDoc(doc(db, "users", userId), {
      userId,
      createdAt: new Date().toISOString(),
    }, { merge: true });
  } catch {}

  return userId;
}
