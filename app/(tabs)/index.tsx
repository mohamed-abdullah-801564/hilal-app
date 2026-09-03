import { useRouter } from "expo-router";
import React, { useRef, useState, useEffect } from "react";
import {
  Animated,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import AudioPlayer from "@/components/AudioPlayer";
import CoinBadge from "@/components/CoinBadge";
import CoinPopup from "@/components/CoinPopup";
import DailyQuizModal from "@/components/DailyQuizModal";
import { useApp } from "@/context/AppContext";
import { useBadges } from "@/context/BadgesContext";
import { BADGE_DEFS, type BadgeId } from "@/services/badges.firebase";
import type { StoredCategory, UnifiedTrack } from "@/data/unifiedStorage";
import { useCategories, useAllCards } from "@/hooks/useFirebaseData";
import type { FBCategory, FBCard } from "@/services/firebase.firestore";
import { todayKey, formatDateTa } from "@/services/dailyQuiz.firebase";

// ─── Adapters ─────────────────────────────────────────────────────────────────
function fbCatToStored(c: FBCategory): StoredCategory {
  return { id: c.id, name: c.name, icon: c.icon, color: c.color, description: c.description, sortOrder: c.sortOrder, createdAt: c.createdAt };
}
function fbCardToTrack(c: FBCard): UnifiedTrack {
  return {
    id: c.id, title: c.titleTa || c.titleEn, categoryId: c.categoryId, categoryName: "",
    subcategoryId: c.subcategoryId, duration: c.duration, audioUrl: c.audioUrl,
    viewCount: c.viewCount, isPremium: c.isPremium, sortOrder: c.sortOrder,
    hasQuiz: c.hasQuiz, isBuiltIn: false, description: c.description,
    fileName: undefined, uploadedAt: c.createdAt,
  };
}

const { width: SCREEN_W } = Dimensions.get("window");
const CARD_GAP = 12;
const CARD_WIDTH = (Math.min(SCREEN_W, 480) - 32 - CARD_GAP) / 2;

// ─── Palette ─────────────────────────────────────────────────────────────────
const C = {
  green:      "#1a7a4a",
  greenLight: "#e8f5ee",
  greenMid:   "#2ea065",
  gold:       "#c8860a",
  goldLight:  "#fff8e6",
  goldBright: "#f0bc42",
  white:      "#ffffff",
  bg:         "#f4faf6",
  bgDark:     "#0a0e0c",
  cardBg:     "#ffffff",
  cardBgDark: "#111816",
  border:     "#d4ead9",
  borderDark: "#1e2e24",
  textMain:   "#0d2414",
  textSub:    "#5a7a64",
  textMainDk: "#e8f5ee",
  textSubDk:  "#6a9a74",
};

// ─── Skeleton Card ────────────────────────────────────────────────────────────
function SkeletonCard({ isDark }: { isDark: boolean }) {
  const pulse = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);
  const bg = isDark ? "#1e2e24" : "#e2ede5";
  return (
    <Animated.View style={[styles.skelCard, { backgroundColor: isDark ? C.cardBgDark : C.cardBg, opacity: pulse, width: CARD_WIDTH }]}>
      <View style={[styles.skelIcon, { backgroundColor: bg }]} />
      <View style={[styles.skelLine1, { backgroundColor: bg }]} />
      <View style={[styles.skelLine2, { backgroundColor: bg }]} />
    </Animated.View>
  );
}

// ─── Category Card ────────────────────────────────────────────────────────────
function CategoryCard({
  cat, trackCount, isDark, isNew, onPress,
}: {
  cat: StoredCategory; trackCount: number; isDark: boolean; isNew: boolean; onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn = () => Animated.spring(scale, { toValue: 0.94, useNativeDriver: true, speed: 30 }).start();
  const onPressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20 }).start();

  return (
    <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}>
      <Animated.View
        style={[
          styles.catCard,
          {
            width: CARD_WIDTH,
            backgroundColor: isDark ? C.cardBgDark : C.cardBg,
            borderColor: isDark ? C.borderDark : C.border,
            transform: [{ scale }],
          },
        ]}
      >
        {/* Accent strip at top */}
        <View style={[styles.catAccent, { backgroundColor: cat.color }]} />

        {/* "New" badge */}
        {isNew && (
          <View style={[styles.newBadge, { backgroundColor: cat.color }]}>
            <Text style={styles.newBadgeTxt}>NEW</Text>
          </View>
        )}

        {/* Icon circle */}
        <View style={[styles.iconCircle, { backgroundColor: cat.color + "18" }]}>
          <Text style={styles.catEmoji}>{cat.icon}</Text>
        </View>

        {/* Name */}
        <Text style={[styles.catName, { color: isDark ? C.textMainDk : C.textMain }]} numberOfLines={2}>
          {cat.name}
        </Text>

        {/* Track count pill */}
        <View style={[styles.countPill, { backgroundColor: cat.color + "18" }]}>
          <Ionicons name="headset-outline" size={10} color={cat.color} />
          <Text style={[styles.countTxt, { color: cat.color }]}>{trackCount} பாடங்கள்</Text>
        </View>

        {/* Arrow */}
        <View style={[styles.arrowChip, { borderColor: cat.color + "44" }]}>
          <Ionicons name="arrow-forward" size={12} color={cat.color} />
        </View>
      </Animated.View>
    </Pressable>
  );
}

// ─── Bismillah Banner ─────────────────────────────────────────────────────────
function BismillahBanner({ isDark }: { isDark: boolean }) {
  return (
    <View style={[styles.bismillah, { backgroundColor: isDark ? "#0d1f16" : C.greenLight, borderColor: isDark ? C.green + "44" : "#b8ddc0" }]}>
      <Text style={[styles.bismillahAr, { color: isDark ? "#7ecfa0" : C.green }]}>
        بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ
      </Text>
      <Text style={[styles.bismillahTa, { color: isDark ? "#5a9a6a" : "#2e7a4e" }]}>
        இஸ்லாமிய ஒலி கற்றல் தளம்
      </Text>
    </View>
  );
}

// ─── Daily Quiz Banner ────────────────────────────────────────────────────────
function DailyQuizBanner({ isDark, onPress }: { isDark: boolean; onPress: () => void }) {
  const today = todayKey();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.dailyCard,
        {
          backgroundColor: isDark ? "#12102a" : "#f0f0ff",
          borderColor:     isDark ? "#6366f144" : "#818cf8",
          opacity:         pressed ? 0.88 : 1,
        },
      ]}
    >
      {/* Left gradient strip */}
      <View style={[styles.dailyStripe, { backgroundColor: "#6366f1" }]} />

      {/* Icon */}
      <View style={[styles.dailyIcon, { backgroundColor: "#6366f122" }]}>
        <Text style={{ fontSize: 26 }}>📅</Text>
      </View>

      {/* Text */}
      <View style={{ flex: 1 }}>
        <View style={[styles.dailyBadge, { backgroundColor: "#6366f1" }]}>
          <Ionicons name="flash" size={10} color="#fff" />
          <Text style={styles.dailyBadgeTxt}>DAILY QUIZ</Text>
        </View>
        <Text style={[styles.dailyTitle, { color: isDark ? "#e0e0ff" : "#1e1b4b" }]}>
          இன்றைய Quiz
        </Text>
        <Text style={[styles.dailyDate, { color: isDark ? "#8880cc" : "#6366f1" }]}>
          {formatDateTa(today)}
        </Text>
      </View>

      {/* Arrow */}
      <View style={[styles.dailyArrow, { backgroundColor: "#6366f122", borderColor: "#6366f144" }]}>
        <Ionicons name="arrow-forward" size={16} color="#6366f1" />
      </View>
    </Pressable>
  );
}

// ─── Shorts Section Banner ───────────────────────────────────────────────────
function ShortsSection({ isDark, onPress }: { isDark: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.shortsBanner,
        {
          backgroundColor: isDark ? "#1f1015" : "#fff0f5",
          borderColor:     isDark ? "#e11d4844" : "#fda4af",
          opacity:         pressed ? 0.88 : 1,
        },
      ]}
    >
      <View style={[styles.shortsIconBox, { backgroundColor: "#e11d4822" }]}>
        <Ionicons name="videocam" size={26} color="#e11d48" />
      </View>
      <View style={{ flex: 1 }}>
        <View style={[styles.shortsBadge, { backgroundColor: "#e11d48" }]}>
          <Ionicons name="play" size={10} color="#fff" />
          <Text style={styles.shortsBadgeTxt}>SHORTS</Text>
        </View>
        <Text style={[styles.shortsTitle, { color: isDark ? "#ffe4e6" : "#881337" }]}>
          🎬 குறும் வீடியோக்கள்
        </Text>
        <Text style={[styles.shortsSub, { color: isDark ? "#fda4af" : "#be123c" }]}>
          குறுகிய இஸ்லாமிய ஒளிப்பதிவுகள்
        </Text>
      </View>
      <View style={[styles.shortsArrow, { backgroundColor: "#e11d4822", borderColor: "#e11d4844" }]}>
        <Ionicons name="arrow-forward" size={16} color="#e11d48" />
      </View>
    </Pressable>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const router = useRouter();
  const { isDarkMode: isDark, toggleDarkMode, favorites, recentTracks, playbackProgress } = useApp();
  const { earnedBadges } = useBadges();

  const hoursListened = Math.floor(
    Object.values(playbackProgress).reduce((sum, p) => sum + p.progressSeconds, 0) / 3600,
  );

  // ── Firebase real-time data (sole source of truth) ──────────────────────
  const { categories: fbCats, loading: fbCatsLoading, error: fbCatError } = useCategories();
  const { cards: fbCards } = useAllCards();

  const [search,        setSearch]        = useState("");
  const [dailyQuizOpen, setDailyQuizOpen] = useState(false);

  // Hidden admin entry: tap the logo 7× quickly → password-gated admin login.
  const adminTapCount = useRef(0);
  const adminTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function handleLogoTap() {
    adminTapCount.current += 1;
    if (adminTapTimer.current) clearTimeout(adminTapTimer.current);
    if (adminTapCount.current >= 7) {
      adminTapCount.current = 0;
      router.push("/admin/login" as any);
      return;
    }
    adminTapTimer.current = setTimeout(() => { adminTapCount.current = 0; }, 1500);
  }

  // Staggered card animation refs
  const cardAnims = useRef<Animated.Value[]>([]).current;

  // Firebase is the ONLY data source — no local seeded fallback
  const loading     = fbCatsLoading;
  const categories: StoredCategory[] = fbCats.map(fbCatToStored);
  const allTracks: UnifiedTrack[]    = fbCards.map(fbCardToTrack);

  // Stagger animation whenever categories change
  useEffect(() => {
    if (loading || categories.length === 0) return;
    if (cardAnims.length !== categories.length) {
      cardAnims.length = 0;
      categories.forEach(() => cardAnims.push(new Animated.Value(0)));
    } else {
      cardAnims.forEach(a => a.setValue(0));
    }
    setTimeout(() => {
      Animated.stagger(
        60,
        cardAnims.map(a =>
          Animated.spring(a, { toValue: 1, useNativeDriver: true, tension: 80, friction: 10 })
        )
      ).start();
    }, 50);
  }, [loading, categories.length]);

  const catCounts = allTracks.reduce<Record<string, number>>((acc, t) => {
    acc[t.categoryId] = (acc[t.categoryId] ?? 0) + 1;
    return acc;
  }, {});

  const filteredCats = categories.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const recentCatIds = new Set(
    [...categories].sort((a, b) => b.createdAt - a.createdAt).slice(0, 2).map(c => c.id)
  );

  const bg = isDark ? C.bgDark : C.bg;
  const textMain = isDark ? C.textMainDk : C.textMain;
  const textSub = isDark ? C.textSubDk : C.textSub;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg }]} edges={["top"]}>

      {/* ─── HEADER ─── */}
      <View style={[styles.header, { backgroundColor: bg, borderBottomColor: isDark ? C.borderDark : C.border }]}>
        <Pressable style={styles.headerLeft} onPress={handleLogoTap}>
          <View style={[styles.logoMark, { backgroundColor: C.green }]}>
            <Text style={styles.logoMarkTxt}>🕌</Text>
          </View>
          <View>
            <Text style={[styles.appName, { color: textMain }]}>Hilal</Text>
            <Text style={[styles.appSub, { color: textSub }]}>செவிகள் சிறக்கட்டும்!</Text>
          </View>
        </Pressable>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <CoinBadge isDark={isDark} />
          <TouchableOpacity
            style={[styles.menuBtn, { backgroundColor: isDark ? "#1a2e20" : C.greenLight, borderColor: isDark ? C.green + "44" : "#b8ddc0" }]}
            onPress={toggleDarkMode}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Toggle dark mode"
          >
            <Ionicons name={isDark ? "sunny-outline" : "moon-outline"} size={20} color={C.green} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ─── SEARCH BAR ─── */}
      <View style={[styles.searchWrap, { borderBottomColor: isDark ? C.borderDark : C.border }]}>
        <View style={[styles.searchBox, { backgroundColor: isDark ? "#111816" : "#fff", borderColor: isDark ? C.borderDark : "#c8dece" }]}>
          <Ionicons name="search-outline" size={17} color={isDark ? "#5a9a6a" : C.green} style={{ marginLeft: 12 }} />
          <TextInput
            style={[styles.searchInput, { color: textMain }]}
            placeholder="பிரிவு தேடுங்கள்..."
            placeholderTextColor={isDark ? "#3a6a44" : "#9abca4"}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch("")} style={styles.searchClear}>
              <Ionicons name="close-circle" size={17} color={isDark ? "#5a9a6a" : C.green} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.searchMic}>
              <Ionicons name="mic-outline" size={17} color={isDark ? "#5a9a6a" : C.green} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Bismillah */}
        <BismillahBanner isDark={isDark} />

        {/* Daily Quiz Banner */}
        <DailyQuizBanner isDark={isDark} onPress={() => setDailyQuizOpen(true)} />

        {/* Firebase error banner — shown only when Firestore is blocked */}
        {fbCatError && fbCats.length === 0 && (
          <View style={styles.fbErrorBanner}>
            <Ionicons name="cloud-offline-outline" size={16} color="#c0392b" />
            <View style={{ flex: 1 }}>
              <Text style={styles.fbErrorTitle}>Firebase அணுகல் பிழை</Text>
              <Text style={styles.fbErrorMsg}>
                Firestore Security Rules → Test mode-ல் வைக்கவும்.{"\n"}
                Error: {fbCatError}
              </Text>
            </View>
          </View>
        )}

        {/* Section heading */}
        <View style={styles.sectionRow}>
          <View style={[styles.sectionAccent, { backgroundColor: C.green }]} />
          <Text style={[styles.sectionTitle, { color: textMain }]}>
            {search ? `"${search}" தேடல் முடிவுகள்` : "📚 பிரிவுகள்"}
          </Text>
          {!loading && !search && (
            <View style={[styles.sectionBadge, { backgroundColor: isDark ? "#1a2e20" : C.greenLight }]}>
              <Text style={[styles.sectionBadgeTxt, { color: C.green }]}>{categories.length}</Text>
            </View>
          )}
        </View>

        {/* ─── GRID ─── */}
        {loading ? (
          <View style={styles.grid}>
            {[0, 1, 2, 3].map(i => <SkeletonCard key={i} isDark={isDark} />)}
          </View>
        ) : filteredCats.length === 0 && search ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>🔍</Text>
            <Text style={[styles.emptyTxt, { color: textSub }]}>
              "{search}" பிரிவு கிடைக்கவில்லை
            </Text>
          </View>
        ) : filteredCats.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>🕌</Text>
            <Text style={[styles.emptyTxt, { color: textSub, fontWeight: "700" }]}>
              Firebase-ல் பிரிவுகள் இல்லை
            </Text>
            <Text style={[styles.emptyTxt, { color: textSub, fontSize: 12, marginTop: 4 }]}>
              Admin → Firebase CMS → Categories tab-ல்{"\n"}பிரிவுகளை சேர்க்கவும்
            </Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {filteredCats.map((cat, i) => {
              const anim = cardAnims[i] ?? new Animated.Value(1);
              return (
                <Animated.View
                  key={cat.id}
                  style={{
                    opacity: anim,
                    transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
                  }}
                >
                  <CategoryCard
                    cat={cat}
                    trackCount={catCounts[cat.id] ?? 0}
                    isDark={isDark}
                    isNew={recentCatIds.has(cat.id) && cat.createdAt > 0}
                    onPress={() => router.push(`/category/${cat.id}` as any)}
                  />
                </Animated.View>
              );
            })}
          </View>
        )}

        {/* Shorts section — placed cleanly below main category grid cards */}
        {!loading && !search && (
          <ShortsSection isDark={isDark} onPress={() => router.push("/shorts" as any)} />
        )}

        {/* Quick stats footer */}
        {!loading && !search && (
          <View style={[styles.statsRow, { backgroundColor: isDark ? "#0d1f16" : C.greenLight, borderColor: isDark ? C.green + "33" : "#b8ddc0" }]}>
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: C.green }]}>{categories.length}</Text>
              <Text style={[styles.statLbl, { color: textSub }]}>பிரிவுகள்</Text>
            </View>
            <View style={[styles.statDiv, { backgroundColor: isDark ? C.green + "33" : "#b8ddc0" }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: C.green }]}>{allTracks.length}</Text>
              <Text style={[styles.statLbl, { color: textSub }]}>பாடங்கள்</Text>
            </View>
            <View style={[styles.statDiv, { backgroundColor: isDark ? C.green + "33" : "#b8ddc0" }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: C.goldBright }]}>
                {allTracks.filter(t => t.hasQuiz).length}
              </Text>
              <Text style={[styles.statLbl, { color: textSub }]}>Quizzes</Text>
            </View>
          </View>
        )}

        {/* ── Your progress + badges (relocated from the old Profile tab) ── */}
        {!loading && !search && (
          <View style={{ marginTop: 22 }}>
            <View style={styles.sectionRow}>
              <View style={[styles.sectionAccent, { backgroundColor: C.goldBright }]} />
              <Text style={[styles.sectionTitle, { color: textMain }]}>🏅 உங்கள் முன்னேற்றம்</Text>
              <View style={[styles.sectionBadge, { backgroundColor: "#c8a84b22" }]}>
                <Text style={[styles.sectionBadgeTxt, { color: C.goldBright }]}>
                  {earnedBadges.size}/{Object.keys(BADGE_DEFS).length}
                </Text>
              </View>
            </View>

            {/* Personal stat chips */}
            <View style={styles.pStatsRow}>
              {[
                { icon: "heart", color: "#ef4444", num: favorites.length,      lbl: "பிடித்தவை" },
                { icon: "headset", color: "#c8a84b", num: hoursListened,        lbl: "மணிகள்"   },
                { icon: "musical-notes", color: "#60a5fa", num: recentTracks.length, lbl: "கேட்டவை" },
              ].map(s => (
                <View
                  key={s.lbl}
                  style={[styles.pStat, { backgroundColor: isDark ? C.cardBgDark : "#fff", borderColor: isDark ? C.borderDark : C.border }]}
                >
                  <Ionicons name={s.icon as any} size={20} color={s.color} />
                  <Text style={[styles.pStatNum, { color: textMain }]}>{s.num}</Text>
                  <Text style={[styles.pStatLbl, { color: textSub }]}>{s.lbl}</Text>
                </View>
              ))}
            </View>

            {/* Badges — 2-column compact grid */}
            <View style={styles.badgeGrid}>
              {(Object.values(BADGE_DEFS) as typeof BADGE_DEFS[BadgeId][]).map(badge => {
                const earned = earnedBadges.has(badge.id as BadgeId);
                return (
                  <View
                    key={badge.id}
                    style={[
                      styles.badgeCard,
                      {
                        backgroundColor: earned ? (isDark ? badge.color + "22" : badge.color + "15") : (isDark ? C.cardBgDark : "#f5f5f5"),
                        borderColor: earned ? badge.color + "55" : (isDark ? C.borderDark : "#e0e0e0"),
                        opacity: earned ? 1 : 0.6,
                      },
                    ]}
                  >
                    <Text style={[styles.badgeIcon, { opacity: earned ? 1 : 0.35 }]}>
                      {earned ? badge.icon : "🔒"}
                    </Text>
                    <Text
                      style={[styles.badgeName, { color: earned ? badge.color : textSub }]}
                      numberOfLines={1}
                    >
                      {badge.titleTa}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        <View style={{ height: 140 }} />
      </ScrollView>

      <CoinPopup />
      <AudioPlayer />

      {/* Daily Quiz Modal */}
      <DailyQuizModal
        visible={dailyQuizOpen}
        onClose={() => setDailyQuizOpen(false)}
        allCards={fbCards}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1 },

  // Header
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  logoMark: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
  },
  logoMarkTxt: { fontSize: 20 },
  appName: { fontSize: 16, fontWeight: "900", letterSpacing: -0.4 },
  appSub: { fontSize: 10, marginTop: 1 },
  menuBtn: {
    width: 42, height: 42, borderRadius: 12, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },

  // Dropdown
  menuBackdrop: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 998,
  },
  dropMenu: {
    position: "absolute", top: 72, right: 16, zIndex: 999,
    borderRadius: 14, borderWidth: 1,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 8,
    minWidth: 200, overflow: "hidden",
  },
  dropItem: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 13, paddingHorizontal: 16, borderBottomWidth: 1,
  },
  dropItemTxt: { fontSize: 14, fontWeight: "600", flex: 1 },

  // Search
  searchWrap: {
    paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1,
  },
  searchBox: {
    flexDirection: "row", alignItems: "center",
    borderRadius: 14, borderWidth: 1.5, height: 46,
  },
  searchInput: { flex: 1, fontSize: 14, paddingHorizontal: 10 },
  searchClear: { paddingHorizontal: 12 },
  searchMic: { paddingHorizontal: 12 },

  // Scroll
  scroll: { paddingHorizontal: 16, paddingTop: 14 },

  // Bismillah
  bismillah: {
    borderRadius: 14, borderWidth: 1,
    paddingVertical: 14, paddingHorizontal: 16,
    alignItems: "center", gap: 4, marginBottom: 14,
  },
  bismillahAr: { fontSize: 17, fontWeight: "700", textAlign: "center" },
  bismillahTa: { fontSize: 11, fontWeight: "500" },

  // Daily Quiz Card
  dailyCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderRadius: 16, borderWidth: 1.5, overflow: "hidden",
    paddingVertical: 14, paddingRight: 14, paddingLeft: 12,
    marginBottom: 14,
  },
  dailyStripe:   { position: "absolute", left: 0, top: 0, bottom: 0, width: 4 },
  dailyIcon:     { width: 52, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  dailyBadge:    { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, alignSelf: "flex-start", marginBottom: 4 },
  dailyBadgeTxt: { fontSize: 9, fontWeight: "900", color: "#fff", letterSpacing: 0.5 },
  dailyTitle:    { fontSize: 16, fontWeight: "800" },
  dailyDate:     { fontSize: 11, marginTop: 2, fontWeight: "500" },
  dailyArrow:    { width: 34, height: 34, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },

  // Featured
  featured: {
    borderRadius: 16, borderWidth: 1.5, padding: 14,
    flexDirection: "row", alignItems: "center", gap: 14,
    marginBottom: 20,
  },
  featuredLeft: { flex: 1, gap: 4 },
  featuredBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, alignSelf: "flex-start",
  },
  featuredBadgeTxt: { fontSize: 10, fontWeight: "800", color: "#000" },
  featuredTitle: { fontSize: 14, fontWeight: "700", lineHeight: 20 },
  featuredCat: { fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  playBtn: {
    width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center",
  },

  // Section
  sectionRow: {
    flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14,
  },
  sectionAccent: { width: 4, height: 18, borderRadius: 2 },
  sectionTitle: { fontSize: 15, fontWeight: "800", flex: 1, letterSpacing: -0.2 },
  sectionBadge: {
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3,
  },
  sectionBadgeTxt: { fontSize: 12, fontWeight: "800" },

  // Play Audio button
  audioBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    borderRadius: 12, paddingVertical: 13, paddingHorizontal: 20,
    marginBottom: 14,
  },
  audioBtnTxt: {
    color: "#fff", fontSize: 15, fontWeight: "700", letterSpacing: 0.2,
  },

  // Firebase error banner
  fbErrorBanner: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    backgroundColor: "#fdf0ef", borderColor: "#e8a89e",
    borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 14,
  },
  fbErrorTitle: { color: "#c0392b", fontWeight: "800", fontSize: 13, marginBottom: 2 },
  fbErrorMsg:   { color: "#a93226", fontSize: 11, lineHeight: 16 },

  // Grid
  grid: {
    flexDirection: "row", flexWrap: "wrap",
    gap: CARD_GAP, marginBottom: 20,
  },

  // Category Card
  catCard: {
    borderRadius: 18, borderWidth: 1,
    paddingTop: 0, paddingBottom: 16, paddingHorizontal: 14,
    alignItems: "center", overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  catAccent: { width: "100%", height: 5, marginBottom: 18, borderRadius: 0 },
  newBadge: {
    position: "absolute", top: 12, right: 10,
    borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, zIndex: 1,
  },
  newBadgeTxt: { color: "#fff", fontSize: 9, fontWeight: "900", letterSpacing: 0.5 },
  iconCircle: {
    width: 58, height: 58, borderRadius: 29,
    alignItems: "center", justifyContent: "center", marginBottom: 10,
  },
  catEmoji: { fontSize: 28 },
  catName: {
    fontSize: 13, fontWeight: "700", textAlign: "center", lineHeight: 18, marginBottom: 8,
  },
  countPill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, marginBottom: 10,
  },
  countTxt: { fontSize: 11, fontWeight: "700" },
  arrowChip: {
    width: 26, height: 26, borderRadius: 13, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },

  // Skeleton
  skelCard: {
    borderRadius: 18, padding: 16,
    alignItems: "center", gap: 10,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  skelIcon: { width: 54, height: 54, borderRadius: 27 },
  skelLine1: { width: 80, height: 12, borderRadius: 6 },
  skelLine2: { width: 52, height: 10, borderRadius: 5 },

  // Stats footer
  statsRow: {
    flexDirection: "row", alignItems: "center",
    borderRadius: 16, borderWidth: 1,
    marginBottom: 10, overflow: "hidden",
  },
  statItem: { flex: 1, alignItems: "center", paddingVertical: 14 },
  statNum: { fontSize: 20, fontWeight: "900" },
  statLbl: { fontSize: 10, marginTop: 2, textTransform: "uppercase", letterSpacing: 0.5 },
  statDiv: { width: 1, height: 36 },

  // Personal progress (relocated from Profile)
  pStatsRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  pStat: { flex: 1, alignItems: "center", gap: 4, paddingVertical: 14, borderRadius: 14, borderWidth: 1 },
  pStatNum: { fontSize: 20, fontWeight: "900" },
  pStatLbl: { fontSize: 10, fontWeight: "600" },
  badgeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  badgeCard: { width: CARD_WIDTH, flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 14, borderWidth: 1.5, paddingVertical: 12, paddingHorizontal: 14 },
  badgeIcon: { fontSize: 26 },
  badgeName: { fontSize: 12, fontWeight: "800", flex: 1 },

  // Empty
  emptyBox: { alignItems: "center", paddingVertical: 40, gap: 10 },
  emptyIcon: { fontSize: 40 },
  emptyTxt: { fontSize: 13 },

  // Shorts Banner
  shortsBanner: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderRadius: 16, borderWidth: 1.5, overflow: "hidden",
    paddingVertical: 14, paddingRight: 14, paddingLeft: 12,
    marginBottom: 14, marginTop: 4,
  },
  shortsIconBox: { width: 52, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  shortsBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, alignSelf: "flex-start", marginBottom: 4 },
  shortsBadgeTxt: { fontSize: 9, fontWeight: "900", color: "#fff", letterSpacing: 0.5 },
  shortsTitle: { fontSize: 16, fontWeight: "800" },
  shortsSub: { fontSize: 11, marginTop: 2, fontWeight: "500" },
  shortsArrow: { width: 34, height: 34, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
});
