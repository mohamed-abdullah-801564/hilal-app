import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useCoins } from "@/context/CoinsContext";

interface Props { isDark: boolean }

export default function CoinBadge({ isDark }: Props) {
  const { coins } = useCoins();
  return (
    <View style={[
      s.pill,
      {
        backgroundColor: isDark ? "#1a1500" : "#fff8e0",
        borderColor:     isDark ? "#c8860a55" : "#f0bc42",
      },
    ]}>
      <Text style={s.icon}>🪙</Text>
      <Text style={[s.count, { color: isDark ? "#f0bc42" : "#a06000" }]}>
        {coins.toLocaleString()}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  pill:  {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 12, borderWidth: 1.5,
  },
  icon:  { fontSize: 14 },
  count: { fontSize: 13, fontWeight: "800" },
});
