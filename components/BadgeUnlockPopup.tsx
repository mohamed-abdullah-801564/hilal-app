import React from "react";
import {
  Animated, Pressable, StyleSheet, Text, View,
} from "react-native";
import { useBadges } from "@/context/BadgesContext";

const RARITY_COLORS: Record<string, string> = {
  common:    "#22c55e",
  rare:      "#f59e0b",
  epic:      "#8b5cf6",
  legendary: "#6366f1",
};

export default function BadgeUnlockPopup() {
  const { newBadge, popupScale, popupOpacity, dismissPopup } = useBadges();
  if (!newBadge) return null;

  const rarityColor = RARITY_COLORS[newBadge.rarity] ?? "#888";

  return (
    <Animated.View
      style={[
        s.wrap,
        { opacity: popupScale, transform: [{ scale: popupScale }] },
        { opacity: popupOpacity },
      ]}
      pointerEvents="box-none"
    >
      <Pressable onPress={dismissPopup} style={s.card}>

        {/* Glow ring */}
        <View style={[s.ring, { borderColor: rarityColor + "66", shadowColor: rarityColor }]}>
          <Text style={s.icon}>{newBadge.icon}</Text>
        </View>

        {/* Rarity tag */}
        <View style={[s.rarityTag, { backgroundColor: rarityColor + "22", borderColor: rarityColor + "55" }]}>
          <Text style={[s.rarityTxt, { color: rarityColor }]}>
            {newBadge.rarity.toUpperCase()}
          </Text>
        </View>

        {/* Texts */}
        <Text style={s.unlocked}>🎉 Badge கிடைத்தது!</Text>
        <Text style={s.title}>{newBadge.titleTa}</Text>
        <Text style={s.desc}>{newBadge.descTa}</Text>

        <Text style={s.dismiss}>தொட்டால் மூடலாம்</Text>
      </Pressable>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: {
    position:       "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems:     "center",
    justifyContent: "center",
    backgroundColor: "#00000077",
    zIndex:          9999,
  },
  card: {
    backgroundColor: "#1a1a2e",
    borderRadius:    24,
    padding:         28,
    alignItems:      "center",
    gap:             10,
    width:           280,
    shadowColor:     "#000",
    shadowOffset:    { width: 0, height: 8 },
    shadowOpacity:   0.4,
    shadowRadius:    20,
    elevation:       20,
    borderWidth:     1,
    borderColor:     "#ffffff18",
  },
  ring: {
    width:           90,
    height:          90,
    borderRadius:    45,
    borderWidth:     3,
    alignItems:      "center",
    justifyContent:  "center",
    backgroundColor: "#ffffff0a",
    shadowOffset:    { width: 0, height: 0 },
    shadowOpacity:   0.8,
    shadowRadius:    14,
    elevation:       10,
    marginBottom:    4,
  },
  icon:       { fontSize: 44 },
  rarityTag: {
    flexDirection:  "row",
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius:   10, borderWidth: 1,
  },
  rarityTxt:  { fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  unlocked:   { fontSize: 13, color: "#aaa", marginTop: 2 },
  title:      { fontSize: 20, fontWeight: "900", color: "#fff", textAlign: "center" },
  desc:       { fontSize: 12, color: "#888", textAlign: "center", lineHeight: 18 },
  dismiss:    { fontSize: 10, color: "#555", marginTop: 8 },
});
