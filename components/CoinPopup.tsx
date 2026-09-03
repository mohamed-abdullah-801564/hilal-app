import React from "react";
import { Animated, StyleSheet, Text } from "react-native";
import { useCoins } from "@/context/CoinsContext";

export default function CoinPopup() {
  const { popupAmount, popupAnim, popupOpacity } = useCoins();

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        s.wrap,
        {
          opacity:   popupOpacity,
          transform: [{ translateY: popupAnim }],
        },
      ]}
    >
      <Text style={s.txt}>🪙 +{popupAmount}</Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: {
    position:         "absolute",
    alignSelf:        "center",
    bottom:           160,
    backgroundColor:  "#f0bc42",
    paddingHorizontal: 20,
    paddingVertical:   9,
    borderRadius:     24,
    shadowColor:      "#000",
    shadowOffset:     { width: 0, height: 4 },
    shadowOpacity:    0.22,
    shadowRadius:     10,
    elevation:        12,
    zIndex:           9999,
  },
  txt: {
    fontSize:   18,
    fontWeight: "900",
    color:      "#5a3700",
    letterSpacing: 0.3,
  },
});
