import React, { useEffect } from "react";
import { ActivityIndicator, Platform, StyleSheet, View } from "react-native";

import AudioDetailScreen from "../audio/[id]";
import { PLAY_STORE_URL } from "@/services/deepLinks";

export default function CardDeepLinkScreen() {
  useEffect(() => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.location.replace(PLAY_STORE_URL);
    }
  }, []);

  if (Platform.OS === "web") {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1a7a4a" />
      </View>
    );
  }

  return <AudioDetailScreen />;
}

const styles = StyleSheet.create({
  centered: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
});
