// Visual Mode short-clip player (native). Muted, controls-free, fully
// driven by the parent: `shouldPlay` mirrors the master audio's isPlaying
// state, and the clip's own end fires `onEnd` so the parent can advance the
// queue. Kept separate from components/VideoPlayer.native.tsx on purpose —
// that component is a user-controlled, full-featured single-video player
// (native controls, fullscreen); this one has a fundamentally different,
// silent/auto-driven contract, so reusing it would risk that existing
// behavior. Same lazy-require + guard pattern, though, for consistency.

import React, { useRef } from "react";
import { StyleSheet } from "react-native";

let ExpoVideo: any = null;
let ExpoResizeMode: any = null;
let videoUnavailable = false;
try {
  const expoAv = require("expo-av");
  ExpoVideo = expoAv.Video;
  ExpoResizeMode = expoAv.ResizeMode;
  if (!ExpoVideo) videoUnavailable = true;
} catch {
  videoUnavailable = true;
}

interface Props {
  uri: string;
  shouldPlay: boolean;
  onEnd: () => void;
}

export default function VisualModePlayer({ uri, shouldPlay, onEnd }: Props) {
  const ref = useRef<any>(null);
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;

  if (videoUnavailable || !ExpoVideo) {
    // No fallback notice on purpose — Visual Mode is a bonus visual layer.
    // If unavailable, audio playback (the actual feature) is completely
    // unaffected, so we render nothing rather than an error box.
    return null;
  }

  return (
    <ExpoVideo
      ref={ref}
      source={{ uri }}
      style={styles.video}
      resizeMode={ExpoResizeMode.COVER}
      isMuted
      shouldPlay={shouldPlay}
      isLooping={false}
      useNativeControls={false}
      onPlaybackStatusUpdate={(status: any) => {
        if (status?.didJustFinish) onEndRef.current();
      }}
    />
  );
}

const styles = StyleSheet.create({
  video: { width: "100%", height: "100%" },
});
