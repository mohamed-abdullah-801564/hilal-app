import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
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

interface GameLevelCardProps {
  track: Track;
  levelNumber: number;
  playlist: Track[];
}

const CATEGORY_COLORS: Record<string, string> = {
  quran: "#f0bc42",
  hadith: "#4ade80",
  iman: "#60a5fa",
  seerah: "#f472b6",
  daily: "#fb923c",
};

export default function GameLevelCard({
  track,
  levelNumber,
  playlist,
}: GameLevelCardProps) {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const { playTrack, currentTrack, isPlaying } = useAudio();
  const router = useRouter();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const isActive = currentTrack?.id === track.id;
  const catColor = CATEGORY_COLORS[track.categoryId] ?? "#f0bc42";
  const hasQuiz = track.hasQuiz === true;
  const isLocked = track.isPremium;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 3,
      useNativeDriver: true,
    }).start();
  };

  const handleAudioPlay = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!isLocked) playTrack(track, playlist);
  };

  const handleQuiz = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push(`/quiz/${track.id}` as any);
  };

  const handleCardPress = () => {
    router.push(`/audio/${track.id}` as any);
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable
        onPress={handleCardPress}
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
                backgroundColor: isLocked
                  ? "#444"
                  : isActive
                    ? catColor
                    : catColor + "33",
                borderColor: isLocked ? "#555" : catColor,
              },
            ]}
          >
            {isLocked ? (
              <Ionicons name="lock-closed" size={16} color="#888" />
            ) : (
              <Text style={[styles.levelNum, { color: isActive ? "#000" : catColor }]}>
                {levelNumber}
              </Text>
            )}
          </View>
          <Text style={[styles.levelLabel, { color: colors.mutedForeground }]}>
            நிலை
          </Text>
        </View>

        <View style={styles.cardBody}>
          <Text
            style={[
              styles.trackTitle,
              {
                color: isLocked
                  ? colors.mutedForeground
                  : isActive
                    ? catColor
                    : colors.foreground,
              },
            ]}
            numberOfLines={2}
          >
            {track.title}
          </Text>
          <View style={styles.metaRow}>
            <Ionicons
              name="time-outline"
              size={11}
              color={colors.mutedForeground}
            />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
              {Math.floor(track.duration / 60)} நிமிடம்
            </Text>
            {isActive && isPlaying && (
              <>
                <View style={[styles.dot, { backgroundColor: catColor }]} />
                <Text style={[styles.metaText, { color: catColor }]}>
                  கேட்கிறது
                </Text>
              </>
            )}
          </View>
        </View>

        <View style={styles.cardActions}>
          {hasQuiz && !isLocked && (
            <Pressable onPress={handleQuiz} style={styles.quizBtnWrapper}>
              <View style={[styles.quizBtn, { borderColor: catColor }]}>
                <Ionicons name="game-controller" size={13} color={catColor} />
                <Text style={[styles.quizBtnText, { color: catColor }]}>
                  QUIZ
                </Text>
              </View>
            </Pressable>
          )}
          <Pressable onPress={handleAudioPlay} style={styles.playBtn}>
            <View
              style={[
                styles.playBtnInner,
                {
                  backgroundColor: isLocked
                    ? "#333"
                    : isActive && isPlaying
                      ? catColor
                      : catColor + "22",
                },
              ]}
            >
              <Ionicons
                name={
                  isLocked
                    ? "lock-closed"
                    : isActive && isPlaying
                      ? "pause"
                      : "play"
                }
                size={18}
                color={isLocked ? "#555" : isActive && isPlaying ? "#000" : catColor}
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
    gap: 6,
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
    gap: 6,
  },
  quizBtnWrapper: {},
  quizBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  quizBtnText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  playBtn: {},
  playBtnInner: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
});
