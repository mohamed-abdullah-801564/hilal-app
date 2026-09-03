import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useRef } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import type { Track } from "@/context/AppContext";
import { useAudio } from "@/context/AudioContext";
import { useColors } from "@/hooks/useColors";

interface CustomTrackCardProps {
  track: Track;
  levelNumber: number;
  playlist: Track[];
  catColor: string;
}

export default function CustomTrackCard({
  track,
  levelNumber,
  playlist,
  catColor,
}: CustomTrackCardProps) {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const { playTrack, currentTrack, isPlaying } = useAudio();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const isActive = currentTrack?.id === track.id;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, friction: 3, useNativeDriver: true }).start();
  };

  const handlePlay = async () => {
    console.log("[CustomTrackCard] Playing:", track.title, "| URL:", track.audioUrl);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    playTrack(track, playlist);
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable
        onPress={handlePlay}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          styles.card,
          {
            backgroundColor: isDark ? "#111120" : "#ffffff",
            borderColor: isActive ? catColor : isDark ? "#2a2a40" : "#e2e8f0",
            borderWidth: isActive ? 1.5 : 1,
          },
        ]}
      >
        <View style={styles.levelBadge}>
          <View
            style={[
              styles.levelCircle,
              {
                backgroundColor: isActive ? catColor : catColor + "33",
                borderColor: catColor,
              },
            ]}
          >
            <Text style={[styles.levelNum, { color: isActive ? "#000" : catColor }]}>
              {levelNumber}
            </Text>
          </View>
          <Text style={[styles.levelLabel, { color: colors.mutedForeground }]}>நிலை</Text>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.uploadedBadge}>
            <Ionicons name="cloud-upload-outline" size={10} color={catColor} />
            <Text style={[styles.uploadedLabel, { color: catColor }]}>Admin Upload</Text>
          </View>
          <Text
            style={[
              styles.trackTitle,
              { color: isActive ? catColor : colors.foreground },
            ]}
            numberOfLines={2}
          >
            {track.title}
          </Text>
          <View style={styles.metaRow}>
            <Ionicons name="musical-notes-outline" size={11} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
              {track.duration > 0 ? `${Math.floor(track.duration / 60)} நிமிடம்` : "Audio"}
            </Text>
            {isActive && isPlaying && (
              <>
                <View style={[styles.dot, { backgroundColor: catColor }]} />
                <Text style={[styles.metaText, { color: catColor }]}>கேட்கிறது</Text>
              </>
            )}
          </View>
        </View>

        <View style={styles.cardActions}>
          <Pressable onPress={handlePlay} style={styles.playBtn} hitSlop={10}>
            <View
              style={[
                styles.playBtnInner,
                {
                  backgroundColor:
                    isActive && isPlaying ? catColor : catColor + "22",
                },
              ]}
            >
              <Ionicons
                name={isActive && isPlaying ? "pause" : "play"}
                size={18}
                color={isActive && isPlaying ? "#000" : catColor}
              />
            </View>
          </Pressable>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    marginBottom: 8,
    gap: 14,
    borderWidth: 1,
    borderRadius: 8,
  },
  levelBadge: {
    alignItems: "center",
    gap: 4,
    width: 48,
  },
  levelCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  levelNum: {
    fontSize: 16,
    fontWeight: "800",
  },
  levelLabel: {
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  cardBody: {
    flex: 1,
    gap: 4,
  },
  uploadedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  uploadedLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  trackTitle: {
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 11,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  cardActions: {
    alignItems: "center",
  },
  playBtn: {},
  playBtnInner: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
});
