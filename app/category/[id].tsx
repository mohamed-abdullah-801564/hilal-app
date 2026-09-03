import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Play, Pause, HelpCircle, Clock, Volume2, Music, ChevronDown, ArrowLeft } from "lucide-react-native";
import React, { useState, useEffect, useRef } from "react";
import {
  Animated,
  Pressable,
  Share,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AudioPlayer from "@/components/AudioPlayer";
import QuizModal from "@/components/QuizModal";
import { useAudio } from "@/context/AudioContext";
import type { Track } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { useCategory, useCardsByCategory, useCategories } from "@/hooks/useFirebaseData";
import type { FBCard } from "@/services/firebase.firestore";
import { getCardUrl } from "@/services/deepLinks";

// ─── Adapter: FBCard → Track ──────────────────────────────────────────────────

function fbCardToTrack(c: FBCard, categoryName: string): Track {
  return {
    id:           c.id,
    title:        c.titleTa || c.titleEn,
    categoryId:   c.categoryId,
    categoryName,
    duration:     c.duration,
    audioUrl:     c.audioUrl,
    viewCount:    c.viewCount,
    isPremium:    c.isPremium,
    sortOrder:    c.sortOrder,
    hasQuiz:      c.hasQuiz,
    isBuiltIn:    false,
    description:  c.description,
    fileName:     undefined,
    uploadedAt:   c.createdAt,
  };
}

// ─── Card Row ─────────────────────────────────────────────────────────────────

function CardRow({
  card, index, playlist, color, anim, onShowQuiz, isDark,
}: {
  card: FBCard; index: number; playlist: Track[]; color: string;
  anim: Animated.Value; onShowQuiz: (card: FBCard) => void; isDark: boolean;
}) {
  const { playTrack, currentTrack, isPlaying } = useAudio();
  const router = useRouter();
  const scale  = useRef(new Animated.Value(1)).current;

  const isActive = currentTrack?.id === card.id;
  const track    = fbCardToTrack(card, "");

  const cardBg     = isDark ? "#ffffff0d" : "#00000008";
  const cardBorder = isDark ? "#ffffff22" : "#00000018";
  const textMain   = isDark ? "#ffffff"   : "#1a1a1a";
  const textSub    = isDark ? "#aaaaaa"   : "#666666";
  const metaColor  = isDark ? "#777777"   : "#999999";

  function handlePlay() {
    playTrack(track, playlist);
  }

  async function handleShare() {
    const cardUrl = getCardUrl(card.id);
    await Share.share({ message: cardUrl, url: cardUrl });
  }

  function handleCardPress() {
    router.push(`/audio/${card.id}` as any);
  }

  return (
    <Animated.View style={{
      opacity: anim,
      transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
    }}>
      <Pressable
        onPress={handleCardPress}
        onPressIn={() => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 40 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 22 }).start()}
      >
        <Animated.View style={[
          styles.cardRow,
          {
            borderColor:     isActive ? color : cardBorder,
            borderWidth:     isActive ? 1.5   : 1,
            backgroundColor: isActive ? color + "18" : cardBg,
            transform:       [{ scale }],
          },
        ]}>
          <View style={[styles.indexBubble, { backgroundColor: isActive ? color : color + "33" }]}>
            {isActive && isPlaying ? (
              <Volume2 size={14} color="#fff" strokeWidth={2.5} />
            ) : (
              <Text style={[styles.indexNum, { color: isActive ? "#fff" : color }]}>{index}</Text>
            )}
          </View>

          <View style={styles.titleBlock}>
            <Text style={[styles.tamilTitle, { color: isActive ? color : textMain }]}>
              {card.titleTa || card.titleEn}
            </Text>
            {!!card.titleEn && card.titleEn !== card.titleTa && (
              <Text style={[styles.engTitle, { color: isActive ? color + "cc" : textSub }]} numberOfLines={1}>
                {card.titleEn}
              </Text>
            )}
            <View style={styles.metaRow}>
              {card.duration > 0 && (
                <>
                  <Clock size={10} color={metaColor} strokeWidth={2} />
                  <Text style={[styles.metaTxt, { color: metaColor }]}>{Math.floor(card.duration / 60)} நிமிடம்</Text>
                </>
              )}
              {isActive && isPlaying && (
                <Text style={[styles.nowPlaying, { color }]}>● கேட்கிறது</Text>
              )}
            </View>
          </View>

          <View style={styles.rightBtns}>
            {card.hasQuiz && (
              <TouchableOpacity
                onPress={(e) => { e.stopPropagation?.(); onShowQuiz(card); }}
                style={[styles.quizBtn, { backgroundColor: color + "25", borderColor: color + "66" }]}
                activeOpacity={0.7}
              >
                <HelpCircle size={14} color={color} strokeWidth={2.5} />
                <Text style={[styles.quizBtnTxt, { color }]}>Quiz</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={(e) => { e.stopPropagation?.(); handlePlay(); }}
              style={[styles.playBtn, { backgroundColor: isActive && isPlaying ? color : color + "33" }]}
              activeOpacity={0.75}
            >
              {isActive && isPlaying ? (
                <Pause size={18} color="#fff" strokeWidth={2.5} fill="#fff" />
              ) : (
                <Play size={18} color={color} strokeWidth={2.5} fill={color} />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={(e) => { e.stopPropagation?.(); handleShare(); }}
              style={[styles.shareBtn, { backgroundColor: color + "22" }]}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Share card"
            >
              <Ionicons name="share-social-outline" size={17} color={color} />
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

function SkeletonRow({ color, isDark }: { color: string; isDark: boolean }) {
  const pulse = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1,   duration: 800, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0.4, duration: 800, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);

  const skelBg    = isDark ? "#ffffff0d" : "#00000008";
  const skelLine1 = isDark ? "#ffffff22" : "#00000015";
  const skelLine2 = isDark ? "#ffffff11" : "#0000000d";

  return (
    <Animated.View style={[styles.skelRow, { opacity: pulse, backgroundColor: skelBg }]}>
      <View style={[styles.skelCircle, { backgroundColor: color + "33" }]} />
      <View style={{ flex: 1, gap: 6 }}>
        <View style={[styles.skelLine1, { backgroundColor: skelLine1 }]} />
        <View style={[styles.skelLine2, { backgroundColor: skelLine2 }]} />
      </View>
      <View style={[styles.skelPlayBtn, { backgroundColor: color + "22" }]} />
    </Animated.View>
  );
}

function EmptyCards({ color, isDark }: { color: string; isDark: boolean }) {
  const textMain = isDark ? "#ffffff" : "#1a1a1a";
  const textSub  = isDark ? "#888888" : "#666666";
  return (
    <View style={styles.emptyBox}>
      <View style={[styles.emptyIconBox, { backgroundColor: color + "22" }]}>
        <Music size={40} color={color} strokeWidth={1.5} />
      </View>
      <Text style={[styles.emptyTitle, { color: textMain }]}>பாடங்கள் இல்லை</Text>
      <Text style={[styles.emptyHint, { color: textSub }]}>
        Admin → Firebase CMS → இந்த பிரிவுக்கு பாடங்கள் சேர்க்கவும்
      </Text>
    </View>
  );
}

// ─── Main Screen — Category → Cards ───────────────────────────────────────────

export default function CategoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { isDark } = useColors();

  const bgMain       = isDark ? "#0a1628"   : "#f0f7ff";
  const headerBtnBg  = isDark ? "#ffffff22" : "#00000012";
  const headerTxtClr = isDark ? "#ffffff"   : "#1a1a1a";
  const bcBg         = isDark ? "#00000033" : "#00000008";
  const bcLinkClr    = isDark ? "#888888"   : "#666666";
  const bcSepClr     = isDark ? "#555555"   : "#aaaaaa";
  const sectionTxtClr= isDark ? "#ffffff"   : "#1a1a1a";
  const backIconClr  = isDark ? "#ffffff"   : "#1a1a1a";

  const { categories: allCats } = useCategories();
  const { category, loading: catLoading } = useCategory(id ?? "");
  const { cards, loading: cardsLoading } = useCardsByCategory(id ?? "");

  const loading = catLoading || cardsLoading;
  const [quizCard, setQuizCard] = useState<FBCard | null>(null);
  const [hasTransitioned, setHasTransitioned] = useState(false);

  // Sequence order: Quran → Hadith → Asma-ul-Husna → Seerah
  const nextCategory = React.useMemo(() => {
    if (!category || !allCats.length) return null;
    const getSeqKey = (c: { id: string; name: string; nameEn?: string }) => {
      const text = `${c.id} ${c.nameEn || ""} ${c.name || ""}`.toLowerCase();
      if (text.includes("quran") || text.includes("குர்ஆன்")) return "quran";
      if (text.includes("hadith") || text.includes("hadis") || text.includes("ஹதீஸ்")) return "hadith";
      if (text.includes("asma") || text.includes("husna") || text.includes("அஸ்மா")) return "asma-ul-husna";
      if (text.includes("seerah") || text.includes("nabi") || text.includes("சீரா") || text.includes("வரலாறு")) return "seerah";
      return "";
    };
    const seq = ["quran", "hadith", "asma-ul-husna", "seerah"];
    const curKey = getSeqKey(category);
    const curIdx = seq.indexOf(curKey);
    if (curIdx !== -1 && curIdx < seq.length - 1) {
      const targetKey = seq[curIdx + 1];
      const match = allCats.find(c => getSeqKey(c) === targetKey);
      if (match) return match;
    }
    // Fallback: next in list
    const idxInList = allCats.findIndex(c => c.id === category.id);
    if (idxInList !== -1 && idxInList < allCats.length - 1) {
      return allCats[idxInList + 1];
    }
    return null;
  }, [category, allCats]);

  const handleScroll = (event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 40;
    if (isCloseToBottom && nextCategory && !hasTransitioned) {
      setHasTransitioned(true);
      router.replace(`/category/${nextCategory.id}` as any);
    }
  };

  const categoryName = category?.name ?? "";
  const playlist: Track[] = cards.map(c => fbCardToTrack(c, categoryName));

  const cardAnims = useRef<Animated.Value[]>([]).current;
  useEffect(() => {
    if (loading || cards.length === 0) return;
    cardAnims.length = 0;
    for (let i = 0; i < cards.length; i++) cardAnims.push(new Animated.Value(0));
    setTimeout(() => {
      Animated.stagger(50, cardAnims.map(a =>
        Animated.spring(a, { toValue: 1, useNativeDriver: true, tension: 90, friction: 12 })
      )).start();
    }, 80);
  }, [loading, cards.length]);

  const [visibleCount, setVisibleCount] = useState(20);
  const visibleCards = cards.slice(0, visibleCount);

  const color = category?.color ?? "#f0bc42";
  const screenTitle = category?.name ?? "பாடங்கள்";

  if (!loading && !category) {
    return (
      <View style={[styles.container, { backgroundColor: bgMain }]}>
        <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
          <Pressable onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: headerBtnBg }]}>
            <ArrowLeft size={20} color={backIconClr} strokeWidth={2.5} />
          </Pressable>
          <View style={styles.emptyBox}>
            <Text style={[styles.emptyTitle, { color: headerTxtClr }]}>பிரிவு கிடைக்கவில்லை</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: bgMain }]} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: color + "10" }]} />

      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: headerBtnBg }]}>
            <ArrowLeft size={20} color={backIconClr} strokeWidth={2.5} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: headerTxtClr }]} numberOfLines={1}>{screenTitle}</Text>
            {!!category?.nameEn && (
              <Text style={[styles.headerEn, { color: color + "cc" }]} numberOfLines={1}>
                {category.nameEn}
              </Text>
            )}
          </View>
          {!loading && (
            <View style={[styles.countBadge, { backgroundColor: color + "22", borderColor: color + "55" }]}>
              <Text style={[styles.countTxt, { color }]}>{cards.length}</Text>
            </View>
          )}
        </View>

        <View style={[styles.breadcrumb, { backgroundColor: bcBg }]}>
          <Text style={[styles.bcLink, { color: bcLinkClr }]} onPress={() => router.push("/(tabs)" as any)}>முகப்பு</Text>
          <Text style={[styles.bcSep, { color: bcSepClr }]}> › </Text>
          <Text style={[styles.bcActive, { color }]} numberOfLines={1}>{screenTitle}</Text>
        </View>

        {!loading && (
          <View style={[styles.statsRow, { backgroundColor: color + "15" }]}>
            <Music size={13} color={color} strokeWidth={2} />
            <Text style={[styles.statsTxt, { color }]}>{cards.length} பாடங்கள்</Text>
          </View>
        )}

        {loading ? (
          <View style={styles.scrollContent}>
            {[0, 1, 2, 3, 4].map(i => <SkeletonRow key={i} color={color} isDark={isDark} />)}
          </View>
        ) : cards.length === 0 ? (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <EmptyCards color={color} isDark={isDark} />
          </ScrollView>
        ) : (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={200}
          >
            <View style={styles.sectionRow}>
              <View style={[styles.sectionDot, { backgroundColor: color }]} />
              <Text style={[styles.sectionTitle, { color: sectionTxtClr }]}>பாடங்கள்</Text>
              <View style={[styles.sectionBadge, { backgroundColor: color + "33" }]}>
                <Text style={[styles.sectionBadgeTxt, { color }]}>{cards.length}</Text>
              </View>
            </View>

            {visibleCards.map((card, i) => (
              <CardRow
                key={card.id}
                card={card}
                index={i + 1}
                playlist={playlist}
                color={color}
                anim={cardAnims[i] ?? new Animated.Value(1)}
                onShowQuiz={setQuizCard}
                isDark={isDark}
              />
            ))}

            {visibleCount < cards.length && (
              <Pressable
                onPress={() => setVisibleCount(v => v + 20)}
                style={[styles.loadMoreBtn, { borderColor: color + "55" }]}
              >
                <Text style={[styles.loadMoreTxt, { color }]}>
                  மேலும் {cards.length - visibleCount} பாடங்கள்
                </Text>
                <ChevronDown size={16} color={color} strokeWidth={2.5} />
              </Pressable>
            )}

            {nextCategory && (
              <Pressable
                onPress={() => {
                  setHasTransitioned(true);
                  router.replace(`/category/${nextCategory.id}` as any);
                }}
                style={[
                  styles.nextCatCard,
                  { backgroundColor: nextCategory.color + "18", borderColor: nextCategory.color + "44" }
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.nextCatSub, { color: isDark ? "#aaa" : "#555" }]}>அடுத்த பிரிவு</Text>
                  <Text style={[styles.nextCatTitle, { color: isDark ? "#fff" : "#1a1a1a" }]}>{nextCategory.name}</Text>
                </View>
                <View style={[styles.nextCatArrow, { backgroundColor: nextCategory.color }]}>
                  <Ionicons name="arrow-forward" size={18} color="#fff" />
                </View>
              </Pressable>
            )}

            <View style={{ height: 140 }} />
          </ScrollView>
        )}

        <AudioPlayer />
      </SafeAreaView>

      {quizCard && (
        <QuizModal
          visible={!!quizCard}
          onClose={() => setQuizCard(null)}
          trackId={quizCard.id}
          trackTitle={quizCard.titleTa || quizCard.titleEn}
          firestoreQuestions={quizCard.quiz}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 12, gap: 12,
  },
  backBtn: {
    width: 36, height: 36, alignItems: "center", justifyContent: "center",
    borderRadius: 18,
  },
  headerCenter: { flex: 1 },
  headerTitle:  { fontSize: 16, fontWeight: "800", letterSpacing: -0.3 },
  headerEn:     { fontSize: 11, marginTop: 2 },
  countBadge:   { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 19, borderWidth: 1 },
  countTxt:     { fontSize: 14, fontWeight: "800" },

  breadcrumb: {
    flexDirection: "row", alignItems: "center", flexWrap: "wrap",
    paddingHorizontal: 16, paddingVertical: 8,
  },
  bcLink:   { fontSize: 11 },
  bcSep:    { fontSize: 11 },
  bcActive: { fontSize: 11, fontWeight: "700" },

  statsRow: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  statsTxt: { fontSize: 12, fontWeight: "700" },

  scrollContent: { paddingHorizontal: 14, paddingTop: 14 },

  sectionRow: {
    flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14,
  },
  sectionDot:     { width: 4, height: 18, borderRadius: 2 },
  sectionTitle:   { fontSize: 14, fontWeight: "700", flex: 1 },
  sectionBadge:   { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3 },
  sectionBadgeTxt:{ fontSize: 12, fontWeight: "800" },

  cardRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderRadius: 14, padding: 12, marginBottom: 10,
  },
  indexBubble: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  indexNum: { fontSize: 15, fontWeight: "800" },

  titleBlock: { flex: 1, gap: 2 },
  tamilTitle: { fontSize: 14, fontWeight: "500", lineHeight: 20 },
  engTitle:   { fontSize: 11, lineHeight: 16 },
  metaRow:    { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  metaTxt:    { fontSize: 10 },
  nowPlaying: { fontSize: 10, fontWeight: "700" },

  rightBtns: {
    flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 0,
  },
  quizBtn: {
    flexDirection: "row", alignItems: "center", gap: 3,
    paddingHorizontal: 8, paddingVertical: 6,
    borderRadius: 10, borderWidth: 1,
  },
  quizBtnTxt: { fontSize: 10, fontWeight: "800" },
  playBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  shareBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },

  skelRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderRadius: 14, padding: 12, marginBottom: 10,
  },
  skelCircle:  { width: 36, height: 36, borderRadius: 18 },
  skelLine1:   { height: 14, borderRadius: 7, width: "70%" },
  skelLine2:   { height: 10, borderRadius: 5, width: "45%" },
  skelPlayBtn: { width: 40, height: 40, borderRadius: 20 },

  emptyBox: {
    alignItems: "center", paddingTop: 80, paddingHorizontal: 32, gap: 14,
  },
  emptyIconBox: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: "center", justifyContent: "center",
  },
  emptyTitle: { fontSize: 16, fontWeight: "800", textAlign: "center" },
  emptyHint:  { fontSize: 12, textAlign: "center", lineHeight: 18 },

  loadMoreBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 14, marginTop: 4,
    borderWidth: 1, borderRadius: 10, marginHorizontal: 4,
  },
  loadMoreTxt: { fontSize: 13, fontWeight: "700" },

  nextCatCard: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: 16, borderRadius: 14, borderWidth: 1, marginTop: 16, marginHorizontal: 4,
  },
  nextCatSub: { fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  nextCatTitle: { fontSize: 15, fontWeight: "800", marginTop: 2 },
  nextCatArrow: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
});
