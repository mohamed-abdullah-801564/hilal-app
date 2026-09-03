import {
  doc, getDoc, setDoc, serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase.config";
import type { FBQuizQuestion } from "./firebase.firestore";

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDateTa(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  const MONTHS_TA = [
    "ஜனவரி","பிப்ரவரி","மார்ச்","ஏப்ரல்","மே","ஜூன்",
    "ஜூலை","ஆகஸ்ட்","செப்டம்பர்","அக்டோபர்","நவம்பர்","டிசம்பர்",
  ];
  return `${d} ${MONTHS_TA[parseInt(m, 10) - 1]} ${y}`;
}
export { formatDateTa };

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DailyQuiz {
  date:      string;
  questions: FBQuizQuestion[];
  createdAt: any;
}

export interface DailyResult {
  score:       number;
  total:       number;
  percentage:  number;
  timeTaken:   number;   // seconds
  completedAt: string;   // ISO date
}

// ─── Get or create today's quiz ───────────────────────────────────────────────

export async function getDailyQuiz(
  allQuestions: FBQuizQuestion[],
): Promise<{ questions: FBQuizQuestion[]; date: string }> {
  const date = todayKey();
  const ref  = doc(db, "dailyQuizzes", date);

  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data() as DailyQuiz;
      if (Array.isArray(data.questions) && data.questions.length > 0) {
        return { questions: data.questions, date };
      }
    }
  } catch {}

  // Generate new quiz for today from all available questions
  const pool     = [...allQuestions].sort(() => Math.random() - 0.5);
  const selected = pool.slice(0, Math.min(10, pool.length));

  if (selected.length === 0) return { questions: [], date };

  try {
    await setDoc(ref, {
      date,
      questions: selected,
      createdAt: serverTimestamp(),
    });
  } catch {}

  return { questions: selected, date };
}

// ─── Check / save user daily result ──────────────────────────────────────────

export async function getDailyResult(
  userId: string,
  date:   string,
): Promise<DailyResult | null> {
  try {
    const snap = await getDoc(doc(db, "users", userId, "dailyQuiz", date));
    return snap.exists() ? (snap.data() as DailyResult) : null;
  } catch {
    return null;
  }
}

export async function saveDailyResult(
  userId:  string,
  date:    string,
  result:  DailyResult,
): Promise<void> {
  try {
    await setDoc(doc(db, "users", userId, "dailyQuiz", date), result);
  } catch {}
}
