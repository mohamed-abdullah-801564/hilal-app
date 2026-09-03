import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState, useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  Share,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AudioPlayer from "@/components/AudioPlayer";
import QuizModal from "@/components/QuizModal";
import { useAudio } from "@/context/AudioContext";
import { useApp } from "@/context/AppContext";
import { getCardById, getPodcastImageUrls, type FBCard } from "@/services/firebase.firestore";
import PodcastImageSlideshow from "@/components/PodcastImageSlideshow";
import { slideKindFromUrl } from "@/services/firebase.storage";
import PdfViewer from "@/components/PdfViewer";
import VideoPlayer from "@/components/VideoPlayer";
import type { Track } from "@/context/AppContext";
import { getCardUrl } from "@/services/deepLinks";
import { cacheMedia, getCachedMediaUri } from "@/services/mediaCache";

// ─── Tab definition ───────────────────────────────────────────────────────────
type TabKey = "explanation" | "video" | "podcast" | "quiz" | "read" | "slide";
const TABS: { key: TabKey; icon: string; label: string }[] = [
  { key: "explanation", icon: "volume-high",       label: "ஒலி"     },
  { key: "video",       icon: "videocam",          label: "Video"   },
  { key: "podcast",     icon: "mic",               label: "Podcast" },
  { key: "quiz",        icon: "help-circle",       label: "Quiz"    },
  { key: "read",        icon: "book-outline",      label: "படிக்க"  },
  { key: "slide",       icon: "easel-outline",     label: "Slide"   },
];

// ─── FBCard → Track adapter ───────────────────────────────────────────────────
function fbCardToTrack(c: FBCard): Track {
  return {
    id:          c.id,
    title:       c.titleTa || c.titleEn,
    categoryId:  c.categoryId,
    categoryName: "",
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

// ─── Audio Tab ────────────────────────────────────────────────────────────────
function AudioTab({ url, label, card, isDark }: { url: string; label: string; card: FBCard; isDark: boolean }) {
  const { playTrack, preloadTrack, currentTrack, isPlaying, togglePlay } = useAudio();
  const track = fbCardToTrack({ ...card, audioUrl: url });
  const isActive = currentTrack?.id === card.id;

  useEffect(() => {
    if (url) preloadTrack(track);
  }, [url, card.id, preloadTrack]);

  const handlePlay = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (isActive) togglePlay();
    else playTrack(track, [track]);
  };

  if (!url) {
    return (
      <View style={styles.emptyTab}>
        <Ionicons name="musical-note-outline" size={48} color="#888" />
        <Text style={[styles.emptyTabTxt, { color: isDark ? "#888" : "#aaa" }]}>
          {label} ஒலி இன்னும் சேர்க்கப்படவில்லை
        </Text>
      </View>
    );
  }

  const playing = isActive && isPlaying;
  return (
    <View style={styles.audioTab}>
      {/* Single, clean play/pause control — the title already shows in the top bar */}
      <Pressable
        onPress={handlePlay}
        style={[styles.audioPlayCircle, { backgroundColor: playing ? "#1a7a4a" : (isDark ? "#1a3a2a" : "#e8f5ee") }]}
        accessibilityRole="button"
        accessibilityLabel={playing ? "Pause" : "Play"}
      >
        <Ionicons
          name={playing ? "pause" : "play"}
          size={64}
          color={playing ? "#fff" : "#1a7a4a"}
          style={playing ? undefined : { marginLeft: 6 }}
        />
      </Pressable>
    </View>
  );
}

function PodcastTab({ card, isDark }: { card: FBCard; isDark: boolean }) {
  const [imageUrls, setImageUrls] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    console.log("[PodcastImages] PodcastTab fetch start");
    getPodcastImageUrls()
      .then(urls => {
        console.log("[PodcastImages] PodcastTab fetch ok, count:", urls.length);
        if (!cancelled) setImageUrls(urls);
      })
      .catch((e) => {
        console.error("[PodcastImages] PodcastTab fetch error:", e?.code, e?.message ?? e);
        if (!cancelled) setImageUrls([]);
      });
    return () => { cancelled = true; };
  }, []);

  const title = card.titleTa || card.titleEn;

  const player = (
    <AudioTab
      url={card.podcastAudioUrl ?? ""}
      label="Podcast"
      card={{ ...card, audioUrl: card.podcastAudioUrl ?? "" }}
      isDark={isDark}
    />
  );

  // No shared images → the podcast player renders exactly as it did before,
  // with no empty slideshow container taking up space.
  if (imageUrls.length === 0) return player;

  return (
    <View style={{ flex: 1 }}>
      <PodcastImageSlideshow urls={imageUrls} title={title} />
      <View style={{ flex: 1 }}>{player}</View>
    </View>
  );
}

// ─── Video Tab ────────────────────────────────────────────────────────────────
// YouTube links are rendered in-app via the embedded YouTube player (no browser
// redirect). Direct video files/URLs (.mp4 etc.) play through expo-av, and going
// fullscreen rotates to landscape (restored to portrait on exit).

// Extract a YouTube video id from the common URL shapes (watch / youtu.be /
// shorts / embed). Returns "" when the URL is not a YouTube link.
function youtubeId(url: string): string {
  const patterns = [
    /youtube\.com\/watch\?(?:.*&)?v=([\w-]{11})/i,
    /youtu\.be\/([\w-]{11})/i,
    /youtube\.com\/shorts\/([\w-]{11})/i,
    /youtube\.com\/embed\/([\w-]{11})/i,
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m?.[1]) return m[1];
  }
  return "";
}

function VideoTab({ url, isDark }: { url: string; isDark: boolean }) {
  const [status, setStatus] = useState<{ error?: boolean }>({});
  const [playbackUrl, setPlaybackUrl] = useState(url);
  const loadStartedAtRef = useRef(0);

  useEffect(() => {
    let mounted = true;
    setStatus({});
    setPlaybackUrl(url);
    loadStartedAtRef.current = Date.now();

    if (!url || youtubeId(url)) {
      return () => {
        mounted = false;
      };
    }

    getCachedMediaUri(url, "video").then((cachedUri) => {
      if (mounted && cachedUri) {
        setPlaybackUrl(cachedUri);
      }
    });
    void cacheMedia(url, "video");

    return () => {
      mounted = false;
    };
  }, [url]);

  if (!url) {
    return (
      <View style={styles.emptyTab}>
        <Ionicons name="videocam-outline" size={48} color="#888" />
        <Text style={[styles.emptyTabTxt, { color: isDark ? "#888" : "#aaa" }]}>
          வீடியோ இன்னும் சேர்க்கப்படவில்லை
        </Text>
      </View>
    );
  }

  // ── YouTube / non-playable page link, or playback error → in-app message ──
  if (youtubeId(url) || status.error) {
    return (
      <View style={styles.emptyTab}>
        <Ionicons name="videocam-off-outline" size={48} color="#ef4444" />
        <Text style={[styles.emptyTabTxt, { color: isDark ? "#aaa" : "#5a7a64" }]}>
          இந்த வீடியோ வடிவம் செயலியில் இயக்க முடியாது. நேரடி வீடியோ கோப்பை (.mp4) பதிவேற்றவும்.
        </Text>
      </View>
    );
  }

  // ── Direct video file/URL → expo-av ──
  return (
    <ScrollView contentContainerStyle={styles.videoCont} showsVerticalScrollIndicator={false}>
      <View style={styles.videoFrame}>
        <VideoPlayer
          uri={playbackUrl}
          isDark={isDark}
          onLoad={() => {
            console.log(`[media] video ready in ${Date.now() - loadStartedAtRef.current}ms`);
          }}
          onError={() => setStatus({ error: true })}
        />
      </View>
    </ScrollView>
  );
}

// ─── Read Tab ─────────────────────────────────────────────────────────────────
function ReadTab({ content, isDark }: { content: string; isDark: boolean }) {
  if (!content) {
    return (
      <View style={styles.emptyTab}>
        <Ionicons name="book-outline" size={48} color="#888" />
        <Text style={[styles.emptyTabTxt, { color: isDark ? "#888" : "#aaa" }]}>
          படிக்கும் உரை இன்னும் சேர்க்கப்படவில்லை
        </Text>
      </View>
    );
  }
  return (
    <ScrollView style={styles.readScroll} showsVerticalScrollIndicator={false}>
      <Text style={[styles.readContent, { color: isDark ? "#e8e8e8" : "#1a1a1a" }]}>
        {content}
      </Text>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ─── Slide Tab ────────────────────────────────────────────────────────────────
// Slides render entirely in-app (no external browser):
//   • pdf   → native multi-page, vertically-scrollable PdfViewer
//   • image → legacy image slides still render inline with <Image>
//   • ppt   → not natively renderable in RN → in-app "convert to PDF" message

function PptNotice({ isDark }: { isDark: boolean }) {
  return (
    <View style={styles.emptyTab}>
      <Ionicons name="easel-outline" size={48} color="#d24400" />
      <Text style={[styles.docTitle, { color: isDark ? "#fff" : "#0d2414" }]}>
        PowerPoint ஆதரிக்கப்படவில்லை
      </Text>
      <Text style={[styles.emptyTabTxt, { color: isDark ? "#888" : "#5a7a64" }]}>
        இந்த ஸ்லைடு PDF ஆக மாற்றி மீண்டும் பதிவேற்றப்பட வேண்டும்.
      </Text>
    </View>
  );
}

function SlideTab({ imageUrl, docUrl, isDark }: { imageUrl: string; docUrl: string; isDark: boolean }) {
  // The document field (PDF) takes priority; fall back to the legacy image field.
  const src = docUrl || imageUrl;

  // TEMP DEBUG LOG — remove after root cause is confirmed
  console.log("[SlideTab][DEBUG] imageUrl =", imageUrl);
  console.log("[SlideTab][DEBUG] docUrl   =", docUrl);
  console.log("[SlideTab][DEBUG] src (passed to PdfViewer) =", src);

  if (!src) {
    return (
      <View style={styles.emptyTab}>
        <Ionicons name="easel-outline" size={48} color="#888" />
        <Text style={[styles.emptyTabTxt, { color: isDark ? "#888" : "#aaa" }]}>
          Slide இன்னும் சேர்க்கப்படவில்லை
        </Text>
      </View>
    );
  }

  const kind = slideKindFromUrl(src);
  // TEMP DEBUG LOG — remove after root cause is confirmed
  console.log("[SlideTab][DEBUG] detected kind =", kind);

  if (kind === "ppt") {
    return <PptNotice isDark={isDark} />;
  }

  if (kind === "image") {
    return (
      <ScrollView contentContainerStyle={styles.slideCont} showsVerticalScrollIndicator={false}>
        <Image source={{ uri: src }} style={styles.slideImage} resizeMode="contain" />
      </ScrollView>
    );
  }

  // pdf — or a doc URL with no obvious extension (the field is PDF-only) → native viewer
  return <PdfViewer url={src} isDark={isDark} />;
}

// ─── Quiz Tab ─────────────────────────────────────────────────────────────────
function QuizTab({ card, isDark }: { card: FBCard; isDark: boolean }) {
  const [showQuiz, setShowQuiz] = useState(false);

  if (!card.hasQuiz || !card.quiz?.length) {
    return (
      <View style={styles.emptyTab}>
        <Ionicons name="help-circle-outline" size={48} color="#888" />
        <Text style={[styles.emptyTabTxt, { color: isDark ? "#888" : "#aaa" }]}>
          Quiz இன்னும் சேர்க்கப்படவில்லை
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.quizTab}>
      <View style={[styles.quizArtwork, { backgroundColor: isDark ? "#1a1a3a" : "#f0f4ff" }]}>
        <Ionicons name="game-controller" size={64} color="#4a6ef5" />
      </View>
      <Text style={[styles.quizTabTitle, { color: isDark ? "#fff" : "#0d2414" }]}>
        {card.quizTitleTa || card.titleTa || "வினாடி வினா"}
      </Text>
      <Text style={[styles.quizTabSub, { color: isDark ? "#aaa" : "#5a7a64" }]}>
        {card.quiz.length} கேள்விகள் உள்ளன
      </Text>
      <Pressable
        onPress={() => setShowQuiz(true)}
        style={[styles.playBtn, { backgroundColor: "#4a6ef5" }]}
      >
        <Ionicons name="play" size={22} color="#fff" />
        <Text style={styles.playBtnTxt}>Quiz தொடங்கு</Text>
      </Pressable>
      <QuizModal
        visible={showQuiz}
        onClose={() => setShowQuiz(false)}
        trackId={card.id}
        trackTitle={card.titleTa || card.titleEn}
        categoryId={card.categoryId}
        firestoreQuestions={card.quiz}
        prizeEnabled={false}
      />
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Screen
// ═══════════════════════════════════════════════════════════════════════════════
export default function AudioDetailScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isFavorite, addFavorite, removeFavorite } = useApp();
  const [card, setCard] = useState<FBCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("explanation");

  const bg  = isDark ? "#0a0a0a" : "#f4f8f5";
  const fg  = isDark ? "#ffffff" : "#0d2414";
  const sub = isDark ? "#888"    : "#5a7a64";

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    getCardById(id)
      .then(c => { setCard(c); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  if (loading) {
    return (
      <View style={[styles.root, { backgroundColor: bg, paddingTop: topPad + 20 }]}>
        <ActivityIndicator size="large" color="#1a7a4a" />
      </View>
    );
  }

  if (!card) {
    return (
      <View style={[styles.root, { backgroundColor: bg }]}>
        <View style={[styles.topBar, { paddingTop: topPad + 16 }]}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={fg} />
          </Pressable>
        </View>
        <View style={styles.emptyCenter}>
          <Text style={{ color: sub, fontSize: 16 }}>பாடம் கிடைக்கவில்லை</Text>
        </View>
      </View>
    );
  }

  const fav = isFavorite(card.id);
  const cardUrl = getCardUrl(card.id);

  async function handleShareCard() {
    await Share.share({ message: cardUrl, url: cardUrl });
  }

  return (
    <View style={[styles.root, { backgroundColor: bg }]}>

      {/* ── Top bar ── */}
      <View style={[styles.topBar, { paddingTop: topPad + 8, backgroundColor: bg }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={fg} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardTitle, { color: fg }]}>
            {card.titleTa || card.titleEn}
          </Text>
          {!!(card.titleTa && card.titleEn) && (
            <Text style={[styles.cardTitleEn, { color: sub }]} numberOfLines={1}>
              {card.titleEn}
            </Text>
          )}
        </View>
        <Pressable
          onPress={() => { fav ? removeFavorite(card.id) : addFavorite(card.id); }}
          style={styles.favBtn}
        >
          <Ionicons
            name={fav ? "heart" : "heart-outline"}
            size={24}
            color={fav ? "#ef4444" : sub}
          />
        </Pressable>
        <Pressable
          onPress={handleShareCard}
          style={styles.favBtn}
          accessibilityRole="button"
          accessibilityLabel="Share card"
        >
          <Ionicons name="share-social-outline" size={23} color={sub} />
        </Pressable>
      </View>

      {/* ── Tab content (fills the full vertical space; Read text starts at top) ── */}
      <View style={{ flex: 1 }}>
        {activeTab === "explanation" && (
          <AudioTab url={card.audioUrl} label="விளக்கம்" card={card} isDark={isDark} />
        )}
        {activeTab === "video" && (
          <VideoTab url={card.videoUrl ?? ""} isDark={isDark} />
        )}
        {activeTab === "podcast" && (
          <PodcastTab card={card} isDark={isDark} />
        )}
        {activeTab === "quiz" && (
          <QuizTab card={card} isDark={isDark} />
        )}
        {activeTab === "read" && (
          <ReadTab content={card.readContent ?? ""} isDark={isDark} />
        )}
        {activeTab === "slide" && (
          <SlideTab imageUrl={card.slideImageUrl ?? ""} docUrl={card.slideDocUrl ?? ""} isDark={isDark} />
        )}
      </View>

      {/* ── Feature grid (3×2) — same TABS/activeTab/setActiveTab as before,
           relocated here from the old bottom strip and restyled as larger
           circular buttons ── */}
      <View style={[styles.gridWrap, { backgroundColor: bg, borderTopColor: isDark ? "#1c1c1c" : "#e2ede6" }]}>
        {[TABS.slice(0, 3), TABS.slice(3, 6)].map((row, rowIdx) => (
          <View key={rowIdx} style={styles.gridRow}>
            {row.map(tab => {
              const active = activeTab === tab.key;
              return (
                <Pressable
                  key={tab.key}
                  onPress={() => setActiveTab(tab.key)}
                  style={styles.gridBtn}
                  accessibilityRole="button"
                  accessibilityLabel={tab.label}
                >
                  <View
                    style={[
                      styles.gridIconCircle,
                      { backgroundColor: active ? "#1a7a4a" : (isDark ? "#1a1a1a" : "#eaf3ee") },
                    ]}
                  >
                    <Ionicons
                      name={tab.icon as any}
                      size={22}
                      color={active ? "#fff" : sub}
                    />
                  </View>
                  <Text
                    style={[
                      styles.gridLabel,
                      { color: active ? "#1a7a4a" : sub, fontWeight: active ? "700" : "500" },
                    ]}
                    numberOfLines={1}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      {/* ── Global mini player ── */}
      <AudioPlayer />
    </View>
  );
}

const styles = StyleSheet.create({
  root:        { flex: 1 },
  emptyCenter: { flex: 1, alignItems: "center", justifyContent: "center" },

  topBar: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingBottom: 10,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  favBtn:  { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  cardTitle:   { fontSize: 17, fontWeight: "600", lineHeight: 23 },
  cardTitleEn: { fontSize: 12, marginTop: 2 },

  gridWrap: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    gap: 12,
    transform: [{ translateY: -12 }],
  },
  gridRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  gridBtn: {
    flex: 1, alignItems: "center", justifyContent: "center", gap: 6,
  },
  gridIconCircle: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: "center", justifyContent: "center",
  },
  gridLabel: { fontSize: 12 },

  // Video tab
  videoCont:   { flexGrow: 1, justifyContent: "center", padding: 16 },
  videoFrame:  { width: "100%", aspectRatio: 16 / 9, borderRadius: 12, overflow: "hidden", backgroundColor: "#000" },
  videoPlayer: { width: "100%", height: "100%" },

  // Doc slide
  docBadge: { width: 110, height: 110, borderRadius: 28, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  docTitle: { fontSize: 19, fontWeight: "800", textAlign: "center" },

  // Audio tab
  audioTab: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, gap: 16 },
  audioPlayCircle: { width: 132, height: 132, borderRadius: 66, alignItems: "center", justifyContent: "center" },
  audioArtwork: { width: 180, height: 180, borderRadius: 90, alignItems: "center", justifyContent: "center" },
  audioTabTitle: { fontSize: 20, fontWeight: "800", textAlign: "center" },
  audioTabDesc:  { fontSize: 14, textAlign: "center", lineHeight: 22 },
  playBtn: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 14, paddingHorizontal: 32, borderRadius: 16,
  },
  playBtnTxt: { color: "#fff", fontSize: 16, fontWeight: "700" },

  // Quiz tab
  quizTab: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, gap: 16 },
  quizArtwork: { width: 160, height: 160, borderRadius: 80, alignItems: "center", justifyContent: "center" },
  quizTabTitle: { fontSize: 20, fontWeight: "800", textAlign: "center" },
  quizTabSub:   { fontSize: 14, textAlign: "center" },

  // Read tab — text begins at the very top of the content area
  readScroll:  { flex: 1, paddingHorizontal: 20, paddingTop: 4 },
  readContent: { fontSize: 16, lineHeight: 30 },

  // Slide tab
  slideCont:  { padding: 16, alignItems: "center" },
  slideImage: { width: "100%", height: 500, borderRadius: 12 },

  // Empty state
  emptyTab:    { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32 },
  emptyTabTxt: { fontSize: 15, textAlign: "center", lineHeight: 22 },
});
