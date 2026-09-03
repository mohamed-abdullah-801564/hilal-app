import { db } from "./firebase.config";
import {
  doc, getDoc, setDoc, collection,
  query, orderBy, getDocs, Timestamp,
} from "firebase/firestore";

// ── Badge definitions ─────────────────────────────────────────────────────────

export const BADGE_DEFS = {
  FULL_SCORE: {
    id:      "FULL_SCORE",
    icon:    "🎯",
    titleTa: "நிறைவான மதிப்பெண்",
    descTa:  "ஒரு நிலையில் 100% மதிப்பெண் பெற்றது",
    color:   "#f59e0b",
    rarity:  "rare",
  },
  STREAK_5: {
    id:      "STREAK_5",
    icon:    "🔥",
    titleTa: "5 தொடர் வெற்றி",
    descTa:  "5 கேள்விகள் தொடர்ச்சியாக சரியாக பதிலளித்தது",
    color:   "#ef4444",
    rarity:  "common",
  },
  LEVEL_MASTER: {
    id:      "LEVEL_MASTER",
    icon:    "🏆",
    titleTa: "Level Master",
    descTa:  "3 நிலைகளும் வெற்றிகரமாக முடித்தது",
    color:   "#8b5cf6",
    rarity:  "epic",
  },
  DAILY_7: {
    id:      "DAILY_7",
    icon:    "📅",
    titleTa: "7 நாள் தொடர்",
    descTa:  "7 நாட்கள் தொடர்ச்சியாக Daily Quiz விளையாடியது",
    color:   "#6366f1",
    rarity:  "legendary",
  },
} as const;

export type BadgeId  = keyof typeof BADGE_DEFS;
export type BadgeDef = typeof BADGE_DEFS[BadgeId];

// ── Load ──────────────────────────────────────────────────────────────────────

export async function getUserBadges(uid: string): Promise<Set<BadgeId>> {
  try {
    const snap = await getDocs(collection(db, "users", uid, "badges"));
    const ids  = snap.docs.map(d => d.id as BadgeId);
    return new Set(ids);
  } catch {
    return new Set();
  }
}

// ── Save ──────────────────────────────────────────────────────────────────────

/** Returns true if newly earned, false if already had it */
export async function earnBadge(uid: string, badgeId: BadgeId): Promise<boolean> {
  const ref = doc(db, "users", uid, "badges", badgeId);
  try {
    const existing = await getDoc(ref);
    if (existing.exists()) return false; // already earned
    await setDoc(ref, { badgeId, earnedAt: Timestamp.now() });
    return true;
  } catch {
    return false;
  }
}

// ── DAILY_7 check ─────────────────────────────────────────────────────────────

/** Check if user has completed daily quiz on 7 consecutive days (including today) */
export async function checkDaily7Streak(uid: string): Promise<boolean> {
  try {
    const snap = await getDocs(
      query(collection(db, "users", uid, "dailyQuiz"), orderBy("__name__", "desc")),
    );
    const dates = snap.docs.map(d => d.id).sort().reverse(); // YYYY-MM-DD, newest first
    if (dates.length < 7) return false;

    // Check 7 consecutive days ending today
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const d  = new Date(today);
      d.setDate(today.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      if (!dates.includes(key)) return false;
    }
    return true;
  } catch {
    return false;
  }
}
