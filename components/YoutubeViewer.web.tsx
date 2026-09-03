// Web stand-in for the native in-app YouTube player. Avoids bundling
// react-native-webview / react-native-youtube-iframe for the web platform.

import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

export default function YoutubeViewer({ isDark }: { videoId: string; isDark: boolean }) {
  return (
    <View style={styles.notice}>
      <Ionicons name="logo-youtube" size={48} color="#888" />
      <Text style={[styles.noticeTxt, { color: isDark ? "#aaa" : "#5a7a64" }]}>
        Video playback is available in the installed app.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  notice:    { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32 },
  noticeTxt: { fontSize: 15, textAlign: "center", lineHeight: 22 },
});
