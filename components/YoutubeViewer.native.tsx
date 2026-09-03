// In-app YouTube player (Android/iOS). Renders the YouTube embedded player
// inside the app via react-native-youtube-iframe (react-native-webview under
// the hood) — nothing is handed off to the YouTube app or a browser.
// Going fullscreen rotates to landscape and restores portrait on exit.
// The libraries are require()'d lazily + guarded so a missing native module
// (e.g. Expo Go) shows an in-app notice instead of crashing.

import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { lockLandscape, lockPortrait } from "@/services/orientation";

let YoutubePlayer: any = null;
let unavailable = false;
try {
  YoutubePlayer = require("react-native-youtube-iframe").default;
} catch {
  unavailable = true;
}

function Notice({ icon, text, isDark }: { icon: any; text: string; isDark: boolean }) {
  return (
    <View style={styles.notice}>
      <Ionicons name={icon} size={48} color="#888" />
      <Text style={[styles.noticeTxt, { color: isDark ? "#aaa" : "#5a7a64" }]}>{text}</Text>
    </View>
  );
}

export default function YoutubeViewer({ videoId, isDark }: { videoId: string; isDark: boolean }) {
  const { width } = useWindowDimensions();
  const [error, setError] = useState(false);
  const height = Math.round((width - 32) * 9 / 16);

  // Restore portrait if we unmount while still fullscreen.
  useEffect(() => () => { lockPortrait(); }, []);

  const onFullScreenChange = useCallback((isFull: boolean) => {
    if (isFull) lockLandscape();
    else lockPortrait();
  }, []);

  if (unavailable || !YoutubePlayer) {
    return <Notice icon="logo-youtube" text="YouTube player requires the installed app build." isDark={isDark} />;
  }
  if (error) {
    return <Notice icon="alert-circle-outline" text="வீடியோவை ஏற்ற முடியவில்லை. மீண்டும் முயற்சிக்கவும்." isDark={isDark} />;
  }

  return (
    <View style={[styles.root, { backgroundColor: isDark ? "#0a0a0a" : "#f4f8f5" }]}>
      <View style={styles.frame}>
        <YoutubePlayer
          height={height}
          videoId={videoId}
          play={false}
          webViewProps={{ allowsFullscreenVideo: true }}
          onFullScreenChange={onFullScreenChange}
          onError={() => setError(true)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root:      { flex: 1, paddingTop: 16, paddingHorizontal: 16 },
  frame:     { borderRadius: 12, overflow: "hidden", backgroundColor: "#000" },
  notice:    { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32 },
  noticeTxt: { fontSize: 15, textAlign: "center", lineHeight: 22 },
});
