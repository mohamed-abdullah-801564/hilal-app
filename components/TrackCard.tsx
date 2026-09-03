import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { useApp } from "@/context/AppContext";
import type { Track } from "@/context/AppContext";
import { useAudio } from "@/context/AudioContext";
import { useColors } from "@/hooks/useColors";

interface TrackCardProps {
  track: Track;
  playlist?: Track[];
  variant?: "horizontal" | "compact" | "featured";
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const CATEGORY_COLORS: Record<string, string> = {
  quran: "#c8a84b",
  hadith: "#4ade80",
  iman: "#60a5fa",
  seerah: "#f472b6",
  daily: "#fb923c",
};

export default function TrackCard({
  track,
  playlist,
  variant = "horizontal",
}: TrackCardProps) {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const { playTrack, currentTrack, isPlaying } = useAudio();
  const { isFavorite, addFavorite, removeFavorite } = useApp();
  const router = useRouter();
  const isActive = currentTrack?.id === track.id;
  const fav = isFavorite(track.id);
  const catColor = CATEGORY_COLORS[track.categoryId] ?? colors.primary;

  const handlePlay = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    playTrack(track, playlist);
  };

  const handleFav = async (e: any) => {
    e.stopPropagation?.();
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fav ? removeFavorite(track.id) : addFavorite(track.id);
  };

  const handlePress = () => {
    router.push(`/audio/${track.id}` as any);
  };

  if (variant === "compact") {
    return (
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [
          styles.compact,
          {
            backgroundColor: isDark ? "#1a1a1a" : "#ffffff",
            borderColor: isActive ? catColor : colors.border,
            borderWidth: isActive ? 1.5 : 1,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <View style={[styles.compactDot, { backgroundColor: catColor }]} />
        <View style={styles.compactInfo}>
          <Text
            style={[
              styles.compactTitle,
              { color: colors.foreground },
              isActive && { color: catColor },
            ]}
            numberOfLines={1}
          >
            {track.title}
          </Text>
          <Text style={[styles.compactMeta, { color: colors.mutedForeground }]}>
            {formatDuration(track.duration)} · {track.viewCount.toLocaleString()} கேட்டார்கள்
          </Text>
        </View>
        <Pressable onPress={handlePlay} style={styles.compactPlay}>
          <Ionicons
            name={isActive && isPlaying ? "pause-circle" : "play-circle"}
            size={32}
            color={isActive ? catColor : colors.mutedForeground}
          />
        </Pressable>
      </Pressable>
    );
  }

  if (variant === "featured") {
    return (
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [
          styles.featured,
          {
            backgroundColor: isDark ? "#1a1a1a" : "#ffffff",
            borderColor: catColor,
            borderWidth: 1,
            opacity: pressed ? 0.9 : 1,
          },
        ]}
      >
        <View
          style={[styles.featuredBadge, { backgroundColor: catColor + "22" }]}
        >
          <Text style={[styles.featuredBadgeText, { color: catColor }]}>
            {track.categoryName}
          </Text>
        </View>
        <Text
          style={[styles.featuredTitle, { color: colors.foreground }]}
          numberOfLines={2}
        >
          {track.title}
        </Text>
        <View style={styles.featuredMeta}>
          <Text
            style={[styles.featuredMetaText, { color: colors.mutedForeground }]}
          >
            {formatDuration(track.duration)}
          </Text>
          <Pressable onPress={handlePlay} style={styles.featuredPlay}>
            <View style={[styles.playBtn, { backgroundColor: catColor }]}>
              <Ionicons
                name={isActive && isPlaying ? "pause" : "play"}
                size={18}
                color="#000"
              />
            </View>
          </Pressable>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: isDark ? "#1a1a1a" : "#ffffff",
          borderColor: isActive ? catColor : colors.border,
          borderWidth: isActive ? 1.5 : 1,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={[styles.thumbnail, { backgroundColor: catColor + "22" }]}>
        {track.thumbnailUrl ? (
          <Image source={{ uri: track.thumbnailUrl }} style={styles.thumbnailImg} />
        ) : (
          <Ionicons name="musical-notes" size={28} color={catColor} />
        )}
        {track.isPremium && (
          <View style={styles.premiumBadge}>
            <Ionicons name="star" size={10} color="#000" />
          </View>
        )}
      </View>
      <View style={styles.info}>
        <Text
          style={[
            styles.title,
            { color: colors.foreground },
            isActive && { color: catColor },
          ]}
        >
          {track.title}
        </Text>
        <Text style={[styles.meta, { color: colors.mutedForeground }]}>
          {track.categoryName} · {formatDuration(track.duration)}
        </Text>
        <Text style={[styles.views, { color: colors.mutedForeground }]}>
          {track.viewCount.toLocaleString()} கேட்டார்கள்
        </Text>
      </View>
      <View style={styles.actions}>
        <Pressable onPress={handleFav} style={styles.actionBtn}>
          <Ionicons
            name={fav ? "heart" : "heart-outline"}
            size={20}
            color={fav ? "#ef4444" : colors.mutedForeground}
          />
        </Pressable>
        <Pressable onPress={handlePlay} style={styles.actionBtn}>
          <Ionicons
            name={isActive && isPlaying ? "pause-circle" : "play-circle"}
            size={36}
            color={isActive ? catColor : colors.primary}
          />
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    gap: 12,
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    flexShrink: 0,
  },
  thumbnailImg: {
    width: "100%",
    height: "100%",
  },
  premiumBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "#c8a84b",
    borderRadius: 10,
    width: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  info: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
  },
  meta: {
    fontSize: 12,
  },
  views: {
    fontSize: 11,
  },
  actions: {
    alignItems: "center",
    gap: 4,
  },
  actionBtn: {
    padding: 4,
  },
  compact: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    padding: 10,
    marginBottom: 6,
    gap: 10,
  },
  compactDot: {
    width: 4,
    height: 36,
    borderRadius: 2,
  },
  compactInfo: {
    flex: 1,
  },
  compactTitle: {
    fontSize: 14,
    fontWeight: "500",
  },
  compactMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  compactPlay: {
    padding: 2,
  },
  featured: {
    borderRadius: 14,
    padding: 14,
    gap: 8,
    minWidth: 200,
    maxWidth: 240,
  },
  featuredBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  featuredBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  featuredTitle: {
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
  },
  featuredMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  featuredMetaText: {
    fontSize: 12,
  },
  featuredPlay: {},
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
});
