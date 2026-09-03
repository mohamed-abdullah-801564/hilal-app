// Web video player. Unlike react-native-pdf / react-native-youtube-iframe,
// expo-av's Video has a genuine web implementation (backed by an HTML5
// <video> element under the hood) with no native-module lookup involved, so
// there's no crash risk on this platform — we render it directly to keep
// existing web playback behavior unchanged.

import React from "react";
import { StyleSheet } from "react-native";
import { Video, ResizeMode } from "expo-av";

interface Props {
  uri: string;
  isDark: boolean;
  onLoad?: () => void;
  onError?: () => void;
  shouldPlay?: boolean;
  isLooping?: boolean;
  useControls?: boolean;
  isMuted?: boolean;
  resizeMode?: "contain" | "cover";
  onPlaybackStatus?: (status: any) => void;
}

export default function VideoPlayer({
  uri, onLoad, onError,
  shouldPlay = false,
  isLooping = false,
  useControls = true,
  isMuted = false,
  resizeMode = "contain",
  onPlaybackStatus,
}: Props) {
  return (
    <Video
      source={{ uri }}
      style={styles.video}
      useNativeControls={useControls}
      resizeMode={resizeMode === "cover" ? ResizeMode.COVER : ResizeMode.CONTAIN}
      shouldPlay={shouldPlay}
      isLooping={isLooping}
      isMuted={isMuted}
      progressUpdateIntervalMillis={250}
      onLoad={onLoad}
      onError={onError}
      onPlaybackStatusUpdate={onPlaybackStatus}
    />
  );
}

const styles = StyleSheet.create({
  video: { width: "100%", height: "100%" },
});
