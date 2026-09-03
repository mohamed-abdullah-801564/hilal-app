import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  collection, doc, getDoc, getDocs, setDoc, addDoc,
  query, where, serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase.config";
import type { LevelId, LevelResult, TrackQuizProgress } from "@/data/quizProgress";
import { sanitizeInput, isRateLimited } from "@/utils/security";

// ─── Constants ────────────────────────────────────────────────────────────────

export const MAX_DAILY_ATTEMPTS = 3;
const ATTEMPTS_LOCAL_KEY        = "quiz_attempts_v1";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function safeParse<T>(raw: string | null, fb: T): T {
  if (!raw) return fb;
  try { return JSON.parse(raw) as T; }
  catch { return fb; }
}

// ─── Cloud Progress Sync ──────────────────────────────────────────────────────

export async function saveProgressToCloud(
  userId: string,
  cardId: string,
  levelId: LevelId,
  result: LevelResult,
): Promise<void> {
  try {
    await setDoc(
      doc(db, "users", userId, "progress", cardId),
      { [`level${levelId}`]: result },
      { merge: true },
    );
  } catch {}
}

export async function loadProgressFromCloud(
  userId: string,
  cardId: string,
): Promise<TrackQuizProgress | null> {
  try {
    const snap = await getDoc(doc(db, "users", userId, "progress", cardId));
    if (!snap.exists()) return null;
    return snap.data() as TrackQuizProgress;
  } catch {
    return null;
  }
}

// ─── Attempt Limit System ─────────────────────────────────────────────────────

export interface AttemptData {
  date:  string;   // "YYYY-MM-DD"
  count: number;
}

function attemptLocalKey(cardId: string, level: LevelId): string {
  return `${cardId}_level${level}`;
}

// Load from AsyncStorage (fast, works offline)
async function loadAttemptLocal(cardId: string, level: LevelId): Promise<AttemptData> {
  const all  = safeParse<Record<string, AttemptData>>(await AsyncStorage.getItem(ATTEMPTS_LOCAL_KEY), {});
  const key  = attemptLocalKey(cardId, level);
  const data = all[key];
  if (!data || data.date !== todayStr()) return { date: todayStr(), count: 0 };
  return data;
}

async function saveAttemptLocal(cardId: string, level: LevelId, data: AttemptData): Promise<void> {
  const all = safeParse<Record<string, AttemptData>>(await AsyncStorage.getItem(ATTEMPTS_LOCAL_KEY), {});
  all[attemptLocalKey(cardId, level)] = data;
  await AsyncStorage.setItem(ATTEMPTS_LOCAL_KEY, JSON.stringify(all));
}

// Sync to Firestore (background, non-blocking)
async function syncAttemptCloud(userId: string, cardId: string, level: LevelId, data: AttemptData): Promise<void> {
  try {
    const key = `${cardId}_level${level}`;
    await setDoc(doc(db, "users", userId, "attempts", key), data, { merge: false });
  } catch {}
}

export async function getAttempts(cardId: string, level: LevelId): Promise<AttemptData> {
  return loadAttemptLocal(cardId, level);
}

export async function incrementAttempt(
  userId: string,
  cardId: string,
  level: LevelId,
): Promise<number> {
  const current = await loadAttemptLocal(cardId, level);
  const newData: AttemptData = { date: todayStr(), count: current.count + 1 };
  await saveAttemptLocal(cardId, level, newData);
  syncAttemptCloud(userId, cardId, level, newData); // background
  return newData.count;
}

export function canAttempt(data: AttemptData): boolean {
  return data.count < MAX_DAILY_ATTEMPTS;
}

export function remainingAttempts(data: AttemptData): number {
  return Math.max(0, MAX_DAILY_ATTEMPTS - data.count);
}

// ─── Leaderboard ─────────────────────────────────────────────────────────────

export interface QuizScore {
  userId:     string;
  cardId:     string;
  level:      number;
  score:      number;
  total:      number;
  percentage: number;
  timeTaken:  number;   // seconds
  createdAt?: any;
}

export async function saveScore(score: Omit<QuizScore, "createdAt">): Promise<void> {
  try {
    const limited = await isRateLimited(`quiz_score_${score.cardId}_${score.level}`, 3000);
    if (limited) return;

    const sanitizedScore: Omit<QuizScore, "createdAt"> = {
      ...score,
      userId: sanitizeInput(score.userId),
      cardId: sanitizeInput(score.cardId),
    };

    await addDoc(collection(db, "quizScores"), {
      ...sanitizedScore,
      createdAt: serverTimestamp(),
    });
  } catch {}
}

export async function getLeaderboard(
  cardId: string,
  level: number,
): Promise<(QuizScore & { id: string; rank: number })[]> {
  try {
    const snap = await getDocs(
      query(collection(db, "quizScores"), where("cardId", "==", cardId)),
    );
    const filtered = snap.docs
      .map(d => ({ id: d.id, ...(d.data() as QuizScore) }))
      .filter(s => s.level === level)
      // Sort: highest % first, then lowest time
      .sort((a, b) =>
        b.percentage !== a.percentage
          ? b.percentage - a.percentage
          : a.timeTaken - b.timeTaken,
      )
      .slice(0, 50);
    return filtered.map((s, i) => ({ ...s, rank: i + 1 }));
  } catch {
    return [];
  }
}
