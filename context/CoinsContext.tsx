import React, {
  createContext, useCallback, useContext,
  useEffect, useRef, useState,
} from "react";
import { Animated } from "react-native";
import { getUserId }     from "@/services/userId";
import {
  addCoins  as addCoinsFirestore,
  getCachedCoins,
  getCoins,
} from "@/services/coins.firebase";

// ── Types ────────────────────────────────────────────────────────────────────

interface CoinsCtx {
  coins:        number;
  addCoins:     (amount: number, type?: string, note?: string) => Promise<void>;
  popupAmount:  number;
  popupAnim:    Animated.Value;
  popupOpacity: Animated.Value;
}

const CoinsContext = createContext<CoinsCtx>({
  coins:        0,
  addCoins:     async () => {},
  popupAmount:  10,
  popupAnim:    new Animated.Value(0),
  popupOpacity: new Animated.Value(0),
});

// ── Provider ─────────────────────────────────────────────────────────────────

export function CoinsProvider({ children }: { children: React.ReactNode }) {
  const [coins,       setCoins]       = useState(0);
  const [popupAmount, setPopupAmount] = useState(10);

  const popupAnim    = useRef(new Animated.Value(0)).current;
  const popupOpacity = useRef(new Animated.Value(0)).current;
  const uidRef       = useRef("");

  // Load initial coins from cache then Firestore
  useEffect(() => {
    getCachedCoins().then(c => setCoins(c));
    getUserId().then(async uid => {
      uidRef.current = uid;
      const c = await getCoins(uid);
      setCoins(c);
    }).catch(() => {});
  }, []);

  // Floating popup animation
  function triggerPopup(amount: number) {
    setPopupAmount(amount);
    popupAnim.setValue(0);
    popupOpacity.setValue(1);
    Animated.parallel([
      Animated.timing(popupAnim, {
        toValue:         -70,
        duration:        900,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(350),
        Animated.timing(popupOpacity, {
          toValue:         0,
          duration:        550,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }

  const addCoins = useCallback(async (
    amount: number,
    type  = "quiz_reward",
    note  = "",
  ) => {
    const uid    = uidRef.current || await getUserId();
    uidRef.current = uid;
    const newTotal = await addCoinsFirestore(uid, amount, type, note);
    setCoins(newTotal);
    triggerPopup(amount);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <CoinsContext.Provider value={{ coins, addCoins, popupAmount, popupAnim, popupOpacity }}>
      {children}
    </CoinsContext.Provider>
  );
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useCoins(): CoinsCtx {
  return useContext(CoinsContext);
}
