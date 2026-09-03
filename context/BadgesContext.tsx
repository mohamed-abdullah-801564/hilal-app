import React, {
  createContext, useCallback, useContext,
  useEffect, useRef, useState,
} from "react";
import { Animated } from "react-native";
import { getUserId } from "@/services/userId";
import {
  getUserBadges, earnBadge,
  checkDaily7Streak,
  type BadgeId, type BadgeDef, BADGE_DEFS,
} from "@/services/badges.firebase";

// ── Context shape ─────────────────────────────────────────────────────────────

interface BadgesCtx {
  earnedBadges:   Set<BadgeId>;
  checkAndAward:  (badgeId: BadgeId) => Promise<void>;
  checkDaily7:    () => Promise<void>;
  newBadge:       BadgeDef | null;
  popupScale:     Animated.Value;
  popupOpacity:   Animated.Value;
  dismissPopup:   () => void;
}

const BadgesContext = createContext<BadgesCtx>({
  earnedBadges:  new Set(),
  checkAndAward: async () => {},
  checkDaily7:   async () => {},
  newBadge:      null,
  popupScale:    new Animated.Value(0),
  popupOpacity:  new Animated.Value(0),
  dismissPopup:  () => {},
});

// ── Provider ──────────────────────────────────────────────────────────────────

export function BadgesProvider({ children }: { children: React.ReactNode }) {
  const [earnedBadges, setEarnedBadges] = useState<Set<BadgeId>>(new Set());
  const [newBadge,     setNewBadge]     = useState<BadgeDef | null>(null);

  const popupScale   = useRef(new Animated.Value(0)).current;
  const popupOpacity = useRef(new Animated.Value(0)).current;
  const uidRef       = useRef("");
  const popupTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load badges on mount
  useEffect(() => {
    getUserId().then(async uid => {
      uidRef.current = uid;
      const badges = await getUserBadges(uid);
      setEarnedBadges(badges);
    }).catch(() => {});
  }, []);

  function showPopup(badge: BadgeDef) {
    setNewBadge(badge);
    popupScale.setValue(0.4);
    popupOpacity.setValue(0);
    Animated.parallel([
      Animated.spring(popupScale,   { toValue: 1,   useNativeDriver: true, tension: 120, friction: 7 }),
      Animated.timing(popupOpacity, { toValue: 1,   duration: 200, useNativeDriver: true }),
    ]).start();
    if (popupTimer.current) clearTimeout(popupTimer.current);
    popupTimer.current = setTimeout(dismissPopup, 3800);
  }

  const dismissPopup = useCallback(() => {
    Animated.parallel([
      Animated.timing(popupScale,   { toValue: 0.8, duration: 260, useNativeDriver: true }),
      Animated.timing(popupOpacity, { toValue: 0,   duration: 260, useNativeDriver: true }),
    ]).start(() => setNewBadge(null));
  }, [popupOpacity, popupScale]);

  const checkAndAward = useCallback(async (badgeId: BadgeId) => {
    const uid = uidRef.current || await getUserId();
    uidRef.current = uid;

    if (earnedBadges.has(badgeId)) return; // already earned
    const isNew = await earnBadge(uid, badgeId);
    if (!isNew) return;

    setEarnedBadges(prev => new Set([...prev, badgeId]));
    showPopup(BADGE_DEFS[badgeId]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [earnedBadges]);

  const checkDaily7 = useCallback(async () => {
    const uid = uidRef.current || await getUserId();
    uidRef.current = uid;

    if (earnedBadges.has("DAILY_7")) return;
    const has7 = await checkDaily7Streak(uid);
    if (has7) await checkAndAward("DAILY_7");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [earnedBadges, checkAndAward]);

  return (
    <BadgesContext.Provider value={{
      earnedBadges, checkAndAward, checkDaily7,
      newBadge, popupScale, popupOpacity, dismissPopup,
    }}>
      {children}
    </BadgesContext.Provider>
  );
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useBadges(): BadgesCtx {
  return useContext(BadgesContext);
}
