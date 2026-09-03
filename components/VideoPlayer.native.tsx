// Native inline video player (Android/iOS).
// expo-av's Video resolves its native view manager (ExpoVideoView) the
// instant it's imported, not when it's rendered. expo-av is require()'d
// lazily here and guarded so a missing/unregistered native module shows an
// in-app message instead of crashing the screen that renders this component
// — the same defensive pattern already used by PdfViewer/YoutubeViewer.

import { Ionicons } from "@expo/vector-icons";
import React, { useRef } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { lockLandscape, lockPortrait } from "@/services/orientation";

let ExpoVideo: any = null;
let ExpoResizeMode: any = null;
let ExpoVideoFullscreenUpdate: any = null;
let videoUnavailable = false;
try {
  const expoAv = require("expo-av");
  ExpoVideo = expoAv.Video;
  ExpoResizeMode = expoAv.ResizeMode;
  ExpoVideoFullscreenUpdate = expoAv.VideoFullscreenUpdate;
  if (!ExpoVideo) videoUnavailable = true;
} catch {
  videoUnavailable = true;
}

interface Props {
  uri: string;
  isDark: boolean;
  onLoad?: () => void;
  onError?: () => void;
  // Additive, optional — every default below matches this component's
  // original hardcoded behavior exactly, so existing callers (the card
  // detail Video tab) are unaffected. Added for the Shorts feed, which
  // needs autoplay/no-controls/looping/cover-fill instead.
  shouldPlay?: boolean;
  isLooping?: boolean;
  useControls?: boolean;
  isMuted?: boolean;
  resizeMode?: "contain" | "cover";
  // Additive — raw expo-av AVPlaybackStatus passthrough, for callers that
  // need real readiness/buffering info beyond onLoad/onError (e.g. the
  // Shorts feed's buffered-content gate). Fires on every native status
  // update; existing callers that don't pass this are unaffected.
  onPlaybackStatus?: (status: any) => void;
}

function Notice({ icon, text, isDark }: { icon: any; text: string; isDark: boolean }) {
  return (
    <View style={styles.notice}>
      <Ionicons name={icon} size={48} color="#888" />
      <Text style={[styles.noticeTxt, { color: isDark ? "#aaa" : "#5a7a64" }]}>{text}</Text>
    </View>
  );
}

export default function VideoPlayer({
  uri, isDark, onLoad, onError,
  shouldPlay = false,
  isLooping = false,
  useControls = true,
  isMuted = false,
  resizeMode = "contain",
  onPlaybackStatus,
}: Props) {
  const videoRef = useRef<any>(null);

  if (videoUnavailable || !ExpoVideo) {
    return (
      <Notice
        icon="videocam-off-outline"
        text="Video player requires the installed app build."
        isDark={isDark}
      />
    );
  }

  // Native fullscreen events only apply when useControls is true (the
  // card-detail Video tab's single-instance use case, which has iOS's
  // built-in fullscreen button / the Android manual button below). The
  // Shorts feed uses useControls=false and can have multiple VideoPlayer
  // instances mounted at once (FlatList windowing keeps neighbors warm) —
  // wiring onFullscreenUpdate on every instance let concurrent native
  // presentation-state events race each other, producing "This
  // presentation change has been interrupted by a newer change request."
  // With no fullscreen entry point in this mode, there's nothing to wire.
  const handleFullscreenUpdate = useControls
    ? (event: any) => {
        const update = event?.fullscreenUpdate;
        if (update === ExpoVideoFullscreenUpdate?.PLAYER_WILL_PRESENT) {
          void lockLandscape();
        } else if (update === ExpoVideoFullscreenUpdate?.PLAYER_WILL_DISMISS) {
          void lockPortrait();
        }
      }
    : undefined;

  // Android's default native controls have no fullscreen button (iOS's do),
  // so this triggers the same native presentFullscreenPlayer() manually.
  // Only relevant when useControls is true — see above.
  const enterFullscreen = () => {
    videoRef.current?.presentFullscreenPlayer?.();
  };

  return (
    <View style={styles.container}>
      <ExpoVideo
        ref={videoRef}
        source={{ uri }}
        style={styles.video}
        useNativeControls={useControls}
        resizeMode={resizeMode === "cover" ? ExpoResizeMode.COVER : ExpoResizeMode.CONTAIN}
        shouldPlay={shouldPlay}
        isLooping={isLooping}
        isMuted={isMuted}
        progressUpdateIntervalMillis={250}
        onLoad={onLoad}
        onError={onError}
        onPlaybackStatusUpdate={onPlaybackStatus}
        {...(handleFullscreenUpdate ? { onFullscreenUpdate: handleFullscreenUpdate } : {})}
      />
      {useControls && Platform.OS === "android" && (
        <Pressable
          onPress={enterFullscreen}
          style={styles.fullscreenBtn}
          accessibilityRole="button"
          accessibilityLabel="Fullscreen"
          hitSlop={8}
        >
          <Ionicons name="expand" size={18} color="#fff" />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: "100%", height: "100%" },
  video:     { width: "100%", height: "100%" },
  fullscreenBtn: {
    position: "absolute", right: 10, bottom: 10,
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: "#000000aa", alignItems: "center", justifyContent: "center",
  },
  notice:    { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32 },
  noticeTxt: { fontSize: 15, textAlign: "center", lineHeight: 22 },
});
