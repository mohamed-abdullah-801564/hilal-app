import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  Platform, ScrollView, StyleSheet, Text, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AudioPlayer from "@/components/AudioPlayer";
import TrackCard from "@/components/TrackCard";
import { useApp } from "@/context/AppContext";
import type { Track } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { useAllCards, useCategories } from "@/hooks/useFirebaseData";
import type { FBCard } from "@/services/firebase.firestore";

// FBCard → Track (favorites store the Firebase card id)
function fbCardToTrack(c: FBCard, categoryName: string): Track {
  return {
    id:          c.id,
    title:       c.titleTa || c.titleEn,
    categoryId:  c.categoryId,
    categoryName,
    duration:    c.duration,
    audioUrl:    c.audioUrl,
    viewCount:   c.viewCount,
    isPremium:   c.isPremium,
    sortOrder:   c.sortOrder,
    hasQuiz:     c.hasQuiz,
    isBuiltIn:   false,
    description: c.description,
    fileName:    undefined,
    uploadedAt:  c.createdAt,
  };
}

export default function FavoritesScreen() {
  const colors = useColors();
  const isDark = colors.isDark;
  const insets = useSafeAreaInsets();
  const { favorites } = useApp();

  // Firebase is the single source of truth (same as Home) — fixes favorites
  // never showing up because the old code read from empty local storage.
  const { cards } = useAllCards();
  const { categories } = useCategories();
  const catName = (id: string) => categories.find(c => c.id === id)?.name ?? "";

  const favTracks: Track[] = cards
    .filter(c => favorites.includes(c.id))
    .map(c => fbCardToTrack(c, catName(c.categoryId)));

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 + 84 : insets.bottom + 60;

  return (
    <View style={[styles.root, { backgroundColor: isDark ? "#0f0f0f" : "#f8f9fa" }]}>
      <ScrollView
        contentContainerStyle={{ paddingTop: topPad + 16, paddingBottom: botPad + 80, paddingHorizontal: 16 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, { color: colors.foreground }]}>பிடித்தவை</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          {favTracks.length} பாடங்கள் சேமிக்கப்பட்டன
        </Text>

        {favTracks.length === 0 ? (
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: isDark ? "#1a1a1a" : "#ffffff" }]}>
              <Ionicons name="heart-outline" size={48} color={colors.mutedForeground} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>பிடித்தவை இல்லை</Text>
            <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
              பாடங்களை ❤️ அழுத்தி சேர்க்கவும்
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {favTracks.map((track) => (
              <TrackCard key={track.id} track={track} playlist={favTracks} />
            ))}
          </View>
        )}
      </ScrollView>
      <AudioPlayer />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  title: { fontSize: 26, fontWeight: "700", marginBottom: 4 },
  subtitle: { fontSize: 14, marginBottom: 24 },
  empty: { alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 16 },
  emptyIcon: {
    width: 96, height: 96, borderRadius: 48,
    alignItems: "center", justifyContent: "center", marginBottom: 8,
  },
  emptyTitle: { fontSize: 20, fontWeight: "700" },
  emptySubtitle: { fontSize: 14, textAlign: "center" },
  list: { gap: 12 },
});
