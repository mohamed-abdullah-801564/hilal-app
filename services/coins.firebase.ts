import AsyncStorage from "@react-native-async-storage/async-storage";
import { db } from "./firebase.config";
import {
  doc, getDoc, setDoc, updateDoc, increment,
  collection, addDoc, serverTimestamp,
} from "firebase/firestore";

const COINS_CACHE_KEY = "user_coins_cache_v1";

// ── Read ────────────────────────────────────────────────────────────────────

export async function getCoins(uid: string): Promise<number> {
  try {
    const snap   = await getDoc(doc(db, "users", uid));
    const coins  = (snap.data()?.coins as number) ?? 0;
    await cacheCoins(coins);
    return coins;
  } catch {
    return getCachedCoins();
  }
}

// ── Write ───────────────────────────────────────────────────────────────────

export async function addCoins(
  uid:    string,
  amount: number,
  type:   string = "quiz_reward",
  note:   string = "",
): Promise<number> {
  const ref = doc(db, "users", uid);

  try {
    await updateDoc(ref, { coins: increment(amount) });
  } catch {
    await setDoc(ref, { coins: amount }, { merge: true });
  }

  try {
    await addDoc(collection(db, "users", uid, "transactions"), {
      type,
      coins:     amount,
      note,
      createdAt: serverTimestamp(),
    });
  } catch {}

  const snap  = await getDoc(ref).catch(() => null);
  const total = (snap?.data()?.coins as number) ?? amount;
  await cacheCoins(total);
  return total;
}

// ── AsyncStorage cache ───────────────────────────────────────────────────────

export async function cacheCoins(amount: number): Promise<void> {
  try { await AsyncStorage.setItem(COINS_CACHE_KEY, String(amount)); } catch {}
}

export async function getCachedCoins(): Promise<number> {
  try {
    const val = await AsyncStorage.getItem(COINS_CACHE_KEY);
    return val ? parseInt(val, 10) : 0;
  } catch { return 0; }
}
