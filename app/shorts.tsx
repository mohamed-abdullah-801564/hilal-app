// User-facing Shorts screen — full-screen vertical video feed (Reels-style).
// Data layer and upload flow are completely untouched:
//   - getEnabledShortVideos() (services/shortVideos.firebase.ts) — reused as-is
//   - VideoPlayer — reused; its onError prop already existed and is now
//     actually consumed here (previously unwired — see "why some videos
//     fail" below)
// Category circles filter by the SAME free-text `category` field the admin
// already fills in when uploading a short video — there is no relationship
// in the current data model between this field and the real Quran/Hadith/
// Aqeedah/Seerath Firestore category documents, so filtering is a
// case-insensitive text match against whatever the admin typed, not a real
// foreign-key relationship.

import { useRouter, useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowLeft, Play, RotateCw, Share2, Volume2, VolumeX } from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
  type ViewToken,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import VideoPlayer from "@/components/VideoPlayer";
import { getEnabledShortVideos, type ShortVideo } from "@/services/shortVideos.firebase";
import { cacheMedia, getCachedMediaUri } from "@/services/mediaCache";

const { height: SCREEN_H, width: SCREEN_W } = Dimensions.get("window");
const HEADER_H = 96; // category row + its divider — fixed, part of normal layout (not an overlay)
const ITEM_H = SCREEN_H - HEADER_H;

// ─── Category circles ───────────────────────────────────────────────────────
interface CatDef { key: string; label: string; emoji: string; match: string[] | null }

const CATS: CatDef[] = [
  { key: "all",      label: "All",      emoji: "🌟", match: null },
  { key: "quran",    label: "Quran",    emoji: "📖", match: ["quran", "குர்ஆன்"] },
  { key: "hadith",   label: "Hadith",   emoji: "📜", match: ["hadith", "ஹதீஸ்"] },
  { key: "dua",      label: "Dua",      emoji: "🤲", match: ["dua", "duaa", "துஆ", "பிரார்த்தனை"] },
  { key: "reminder", label: "Reminder", emoji: "💡", match: ["reminder", "நினைவூட்டல்"] },
];

function matchesCategory(video: ShortVideo, cat: CatDef): boolean {
  if (!cat.match) return true;
  const v = (video.category ?? "").toLowerCase();
  return cat.match.some((m) => v.includes(m.toLowerCase()));
}

// ─── One full-screen Short ──────────────────────────────────────────────────

function ShortItem({
  video, isActive, muted,
}: {
  video: ShortVideo; isActive: boolean; muted: boolean;
}) {
  // Resolve a locally-cached copy first (instant start if this clip was
  // already preloaded), falling back to the direct remote URL.
  const [playbackUri, setPlaybackUri] = useState(video.videoUrl);
  const [loaded, setLoaded]   = useState(false);
  const [failed, setFailed]   = useState(false);
  const [paused, setPaused]   = useState(false); // user-initiated pause only
  const [retryTick, setRetryTick] = useState(0);

  // Readiness gate for #5/#6: autoplay only once the player itself reports
  // genuinely playable content, not the instant it becomes the active item.
  // Real signal, not a timer — see handlePlaybackStatus below.
  const [readyToAutoplay, setReadyToAutoplay] = useState(false);
  const TARGET_BUFFER_MS = 5000;

  function handlePlaybackStatus(status: any) {
    if (readyToAutoplay || !status?.isLoaded) return;

    const buffered = status.playableDurationMillis; // real expo-av field;
    // expo-av's own docs: "only present in some cases" — never invented here.
    if (typeof buffered === "number") {
      // Cap the target at the clip's own duration when known, so a clip
      // shorter than 5s (e.g. a 3s Short) can still become ready.
      const target = typeof status.durationMillis === "number"
        ? Math.min(TARGET_BUFFER_MS, status.durationMillis)
        : TARGET_BUFFER_MS;
      if (buffered >= target) setReadyToAutoplay(true);
    } else {
      // playableDurationMillis wasn't reported on this platform/source.
      // Safest real fallback available from the API: the player itself
      // says it's loaded and not currently buffering. This is NOT a
      // 5-second guarantee — see the implementation report.
      if (!status.isBuffering) setReadyToAutoplay(true);
    }
  }

  useEffect(() => {
    let mounted = true;
    getCachedMediaUri(video.videoUrl, "video").then((cached) => {
      if (mounted && cached) setPlaybackUri(cached);
    });
    return () => { mounted = false; };
  }, [video.videoUrl]);

  // Leaving this clip resets the manual-pause flag, so returning to it
  // later autoplays again rather than staying paused from a prior visit.
  useEffect(() => {
    if (!isActive) setPaused(false);
  }, [isActive]);

  async function onShare() {
    try {
      await Share.share({ message: video.videoUrl, url: video.videoUrl });
    } catch {
      // Non-critical — sharing simply won't happen this time.
    }
  }

  function onVideoError(err: any) {
    // Root-cause visibility: previously nothing consumed this callback, so
    // a failing clip just hung on the loading spinner forever with zero
    // diagnostic info. Logged here for real debugging (check device logs /
    // Metro console), and surfaced to the user with a retry option instead
    // of a silent stall.
    console.log(`[Shorts] video failed to load: ${video.title || video.id}`);
    console.log(`[Shorts] url: ${video.videoUrl}`);
    console.log("[Shorts] error:", err);
    setFailed(true);
  }

  function retry() {
    setFailed(false);
    setLoaded(false);
    setReadyToAutoplay(false);
    setRetryTick((t: number) => t + 1);
  }

  const shouldPlay = isActive && !paused && !failed && readyToAutoplay;

  return (
    <View style={styles.item}>
      <Pressable style={StyleSheet.absoluteFill} onPress={() => setPaused((p: boolean) => !p)}>
        <VideoPlayer
          key={retryTick}
          uri={playbackUri}
          isDark
          shouldPlay={shouldPlay}
          isLooping
          useControls={false}
          isMuted={muted}
          resizeMode="cover"
          onLoad={() => { setLoaded(true); setFailed(false); }}
          onError={onVideoError}
          onPlaybackStatus={handlePlaybackStatus}
        />
      </Pressable>

      {/* Loading spinner — shown until this clip is genuinely ready to
          autoplay (see handlePlaybackStatus), not just until onLoad fires */}
      {!readyToAutoplay && isActive && !failed && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color="#f0bc42" />
        </View>
      )}

      {/* Error state — with retry, instead of hanging silently */}
      {failed && (
        <View style={styles.loadingOverlay}>
          <Text style={styles.errorTxt}>இந்த short video-ஐ ஏற்ற முடியவில்லை</Text>
          <Pressable onPress={retry} style={styles.retryBtn}>
            <RotateCw size={16} color="#fff" />
            <Text style={styles.retryTxt}>மீண்டும் முயற்சி</Text>
          </Pressable>
        </View>
      )}

      {/* Manual-pause indicator */}
      {readyToAutoplay && isActive && paused && !failed && (
        <View style={styles.pauseOverlay} pointerEvents="none">
          <View style={styles.pauseCircle}>
            <Play size={30} color="#fff" style={{ marginLeft: 3 }} />
          </View>
        </View>
      )}

      {/* Bottom info overlay */}
      <LinearGradient colors={["transparent", "#000000dd"]} style={styles.bottomGradient} pointerEvents="none">
        <Text style={styles.itemTitle} numberOfLines={2}>
          {video.title || "Short Video"}
        </Text>
        {!!video.category && (
          <View style={styles.catPill}>
            <Text style={styles.catPillTxt}>{video.category}</Text>
          </View>
        )}
      </LinearGradient>

      {/* Right action column */}
      <View style={styles.actionCol}>
        <Pressable onPress={onShare} style={styles.actionBtn} hitSlop={10}>
          <Share2 size={24} color="#fff" />
          <Text style={styles.actionLabel}>Share</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function ShortsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [videos, setVideos]   = useState<ShortVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);
  const [activeCat, setActiveCat] = useState<CatDef>(CATS[0]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [focused, setFocused] = useState(true);
  const [muted, setMuted]     = useState(false);

  const listRef = useRef<FlatList<ShortVideo>>(null);

  useEffect(() => {
    let mounted = true;
    getEnabledShortVideos()
      .then((v) => { if (mounted) setVideos(v); })
      .catch(() => { if (mounted) setError(true); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  // Pause when the screen loses focus (nav away), resume when it returns.
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  const filtered = videos.filter((v: ShortVideo) => matchesCategory(v, activeCat));

  // Reset to the top of the feed whenever the category changes.
  useEffect(() => {
    setActiveIndex(0);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [activeCat.key]);

  // Preload the current clip plus the next 2 (device-side cache only — see
  // services/mediaCache.ts: bounded 350MB LRU, dedupes in-flight downloads,
  // skips re-download if already cached, no Firebase Storage writes — the
  // exact same cache used elsewhere in the app, untouched here).
  useEffect(() => {
    const current = filtered[activeIndex];
    const next1   = filtered[activeIndex + 1];
    const next2   = filtered[activeIndex + 2];
    if (current) void cacheMedia(current.videoUrl, "video");
    if (next1)   void cacheMedia(next1.videoUrl, "video");
    if (next2)   void cacheMedia(next2.videoUrl, "video");
  }, [activeIndex, filtered]);

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setActiveIndex(viewableItems[0].index);
      }
    },
  ).current;

  return (
    <View style={styles.root}>
      {/* ── Header: category row (normal flow, horizontally scrollable,
           NOT an overlay/sticky element) + a thin divider beneath it ── */}
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <ArrowLeft size={20} color="#fff" />
        </Pressable>

        <FlatList
          horizontal
          data={CATS}
          keyExtractor={(c: CatDef) => c.key}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 10, gap: 14 }}
          style={{ flex: 1 }}
          renderItem={({ item }: { item: CatDef }) => {
            const active = item.key === activeCat.key;
            return (
              <Pressable onPress={() => setActiveCat(item)} style={styles.catItem}>
                <View style={[styles.catCircle, active && styles.catCircleActive]}>
                  <Text style={styles.catEmoji}>{item.emoji}</Text>
                </View>
                <Text style={[styles.catLabel, active && styles.catLabelActive]} numberOfLines={1}>
                  {item.label}
                </Text>
              </Pressable>
            );
          }}
        />

        <Pressable
          onPress={() => setMuted((m: boolean) => !m)}
          style={styles.muteBtn}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={muted ? "Unmute" : "Mute"}
        >
          {muted ? <VolumeX size={18} color="#fff" /> : <Volume2 size={18} color="#fff" />}
        </Pressable>
      </View>
      <View style={styles.headerDivider} />

      {/* ── Vertical feed — swipe up/down moves directly between clips ── */}
      <FlatList
        ref={listRef}
        data={filtered}
        keyExtractor={(v: ShortVideo) => v.id}
        renderItem={({ item, index }: { item: ShortVideo; index: number }) => (
          <ShortItem video={item} isActive={focused && index === activeIndex} muted={muted} />
        )}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        getItemLayout={(_: ArrayLike<ShortVideo> | null | undefined, index: number) => ({ length: ITEM_H, offset: ITEM_H * index, index })}
        viewabilityConfig={viewabilityConfig}
        onViewableItemsChanged={onViewableItemsChanged}
        initialNumToRender={2}
        windowSize={3}
        maxToRenderPerBatch={2}
        removeClippedSubviews
        style={{ flex: 1 }}
        ListEmptyComponent={
          !loading && !error ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyEmoji}>🎬</Text>
              <Text style={styles.emptyTxt}>
                {activeCat.key === "all"
                  ? "இன்னும் Shorts சேர்க்கப்படவில்லை"
                  : `${activeCat.label} பிரிவில் Shorts இல்லை`}
              </Text>
            </View>
          ) : null
        }
      />

      {loading && (
        <View style={styles.centerOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color="#f0bc42" />
        </View>
      )}
      {error && !loading && (
        <View style={styles.centerOverlay}>
          <Text style={styles.emptyEmoji}>⚠️</Text>
          <Text style={styles.emptyTxt}>Shorts ஏற்ற முடியவில்லை</Text>
        </View>
      )}
    </View>
  );
}

// ─── Styles — dark theme, existing green/gold palette ──────────────────────
const GOLD  = "#f0bc42";
const GREEN = "#1a7a4a";

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },

  header: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingBottom: 10, backgroundColor: "#000",
  },
  headerDivider: { height: StyleSheet.hairlineWidth, backgroundColor: "#ffffff33" },

  backBtn: {
    width: 34, height: 34, borderRadius: 17, marginLeft: 10,
    backgroundColor: "#ffffff1a", alignItems: "center", justifyContent: "center",
  },
  muteBtn: {
    width: 34, height: 34, borderRadius: 17, marginRight: 10,
    backgroundColor: "#ffffff1a", alignItems: "center", justifyContent: "center",
  },

  item: { width: SCREEN_W, height: ITEM_H, backgroundColor: "#000" },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center", justifyContent: "center", gap: 12,
  },
  errorTxt: { color: "#cfd8d2", fontSize: 14, fontWeight: "600", paddingHorizontal: 32, textAlign: "center" },
  retryBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: GREEN, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 9,
  },
  retryTxt: { color: "#fff", fontSize: 13, fontWeight: "700" },

  pauseOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  pauseCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: "#00000066", alignItems: "center", justifyContent: "center",
  },

  bottomGradient: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    paddingHorizontal: 16, paddingBottom: 24, paddingTop: 60,
  },
  itemTitle: { color: "#fff", fontSize: 16, fontWeight: "800", lineHeight: 22 },
  catPill: {
    marginTop: 8, alignSelf: "flex-start",
    backgroundColor: GREEN + "cc", borderRadius: 14,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  catPillTxt: { color: "#fff", fontSize: 12, fontWeight: "700" },

  actionCol: {
    position: "absolute", right: 12, bottom: 100,
    alignItems: "center", gap: 22,
  },
  actionBtn: { alignItems: "center", gap: 4 },
  actionLabel: { color: "#fff", fontSize: 11, fontWeight: "700" },

  centerOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center", justifyContent: "center", gap: 12,
    backgroundColor: "#000",
  },
  emptyWrap: {
    width: SCREEN_W, height: ITEM_H,
    alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 32,
  },
  emptyEmoji: { fontSize: 44 },
  emptyTxt: { color: "#cfd8d2", fontSize: 15, fontWeight: "600", textAlign: "center" },

  catItem: { alignItems: "center", width: 58 },
  catCircle: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: "#ffffff22", borderWidth: 2, borderColor: "transparent",
    alignItems: "center", justifyContent: "center",
  },
  catCircleActive: { borderColor: GOLD, backgroundColor: GOLD + "22" },
  catEmoji: { fontSize: 18 },
  catLabel: { color: "#cfd8d2", fontSize: 10, fontWeight: "600", marginTop: 3, textAlign: "center" },
  catLabelActive: { color: GOLD, fontWeight: "800" },
});
