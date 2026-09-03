// Visual Mode short-clip player.
// Muted, controls-free, driven by the parent.

import React, { useRef } from "react";
import { StyleSheet } from "react-native";

let ExpoVideo: any = null;
let ExpoResizeMode: any = null;
let videoUnavailable = false;

try {
  const expoAv = require("expo-av");
  ExpoVideo = expoAv.Video;
  ExpoResizeMode = expoAv.ResizeMode;

  if (!ExpoVideo) {
    videoUnavailable = true;
  }
} catch {
  videoUnavailable = true;
}

interface Props {
  uri: string;
  shouldPlay: boolean;
  onEnd: () => void;
}

export default function VisualModePlayer({
  uri,
  shouldPlay,
  onEnd,
}: Props) {
  const ref = useRef<any>(null);
  const onEndRef = useRef(onEnd);

  onEndRef.current = onEnd;

  if (videoUnavailable || !ExpoVideo) {
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
        if (status?.didJustFinish) {
          onEndRef.current();
        }
      }}
    />
  );
}

const styles = StyleSheet.create({
  video: {
    width: "100%",
    height: "100%",
  },
});