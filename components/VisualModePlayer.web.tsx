// Visual Mode short-clip player (web). expo-av's Video has a genuine web
// implementation with no native-module risk, so it's rendered directly —
// same muted/controls-free/parent-driven contract as the native version.

import React from "react";
import { StyleSheet } from "react-native";
import { Video, ResizeMode } from "expo-av";

interface Props {
  uri: string;
  shouldPlay: boolean;
  onEnd: () => void;
}

export default function VisualModePlayer({ uri, shouldPlay, onEnd }: Props) {
  return (
    <Video
      source={{ uri }}
      style={styles.video}
      resizeMode={ResizeMode.COVER}
      isMuted
      shouldPlay={shouldPlay}
      isLooping={false}
      useNativeControls={false}
      onPlaybackStatusUpdate={(status: any) => {
        if (status?.didJustFinish) onEnd();
      }}
    />
  );
}

const styles = StyleSheet.create({
  video: { width: "100%", height: "100%" },
});
