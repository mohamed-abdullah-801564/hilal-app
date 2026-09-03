import * as Haptics from "expo-haptics";
import { useVisualMode } from "@/context/VisualModeContext";
import VisualModePlayer from "@/components/VisualModePlayer";
import DynamicSlideshow from "@/components/DynamicSlideshow";
import {
  ChevronDown,
  Music,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  LoaderCircle,
  X,
} from "lucide-react-native";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAudio } from "@/context/AudioContext";
import { useColors } from "@/hooks/useColors";

const RATES = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");

function MiniPlayer() {
  const colors = useColors();
  const isDark = colors.isDark;
  const {
    currentTrack,
    isPlaying,
    isLoading,
    currentTime,
    duration,
    togglePlay,
    setIsExpanded,
  } = useAudio();

  const progress = duration > 0 ? currentTime / duration : 0;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isPlaying) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.08,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [isPlaying, pulseAnim]);

  if (!currentTrack) return null;

  return (
    <Pressable
      onPress={() => setIsExpanded(true)}
      style={[
        styles.mini,
        {
          backgroundColor: isDark ? "#1a1a1a" : "#ffffff",
          borderColor: isDark ? "#2a2a2a" : "#e2e8f0",
        },
      ]}
    >
      <View style={styles.miniProgress}>
        <View
          style={[
            styles.miniProgressBar,
            { width: `${progress * 100}%`, backgroundColor: "#c8a84b" },
          ]}
        />
      </View>
      <View style={styles.miniContent}>
        <View
          style={[
            styles.miniIcon,
            { backgroundColor: "#c8a84b22" },
          ]}
        >
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <Music size={20} color="#c8a84b" strokeWidth={2} />
          </Animated.View>
        </View>
        <View style={styles.miniInfo}>
          <Text
            style={[styles.miniTitle, { color: colors.foreground }]}
            numberOfLines={1}
          >
            {currentTrack.title}
          </Text>
          <Text
            style={[styles.miniCategory, { color: colors.mutedForeground }]}
            numberOfLines={1}
          >
            {currentTrack.categoryName}
          </Text>
        </View>
        <View style={styles.miniControls}>
          <Pressable
            onPress={async (e) => {
              e.stopPropagation?.();
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              togglePlay();
            }}
          >
            {isLoading ? (
              <LoaderCircle size={28} color="#c8a84b" strokeWidth={2} />
            ) : isPlaying ? (
              <Pause size={36} color="#c8a84b" strokeWidth={2} fill="#c8a84b" />
            ) : (
              <Play size={36} color="#c8a84b" strokeWidth={2} fill="#c8a84b" />
            )}
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

function FullPlayer() {
  const colors = useColors();
  const isDark = colors.isDark;
  const insets = useSafeAreaInsets();
  const {
    currentTrack,
    isPlaying,
    isLoading,
    currentTime,
    duration,
    playbackRate,
    togglePlay,
    seekTo,
    setPlaybackRate,
    stop,
    playNext,
    playPrev,
    setIsExpanded,
    isExpanded,
  } = useAudio();
const {
  visualModeEnabled,
  toggleVisualMode,
  currentClip,
  onClipEnd,
} = useVisualMode();

  const progress = duration > 0 ? currentTime / duration : 0;
  const seekBarWidth = SCREEN_WIDTH - 48;

  const handleSeek = (x: number) => {
    const pct = Math.max(0, Math.min(1, x / seekBarWidth));
    seekTo(pct * duration);
  };

  if (!currentTrack) return null;

  return (
    <Modal
      visible={isExpanded}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setIsExpanded(false)}
    >
      <View
        style={[
          styles.full,
          {
            backgroundColor: isDark ? "#0f0f0f" : "#f8f9fa",
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 16,
          },
        ]}
      >
       <View style={styles.fullHeader}>
  <Pressable
    onPress={() => setIsExpanded(false)}
    style={styles.fullClose}
  >
    <ChevronDown
      size={28}
      color={colors.mutedForeground}
      strokeWidth={2}
    />
  </Pressable>

  <Text
    style={[
      styles.fullHeaderTitle,
      { color: colors.mutedForeground },
    ]}
  >
    இப்போது கேட்கிறீர்கள்
  </Text>

  <Pressable
    onPress={toggleVisualMode}
    style={styles.visualModeButton}
    hitSlop={8}
  >
    <Text style={{ color: colors.mutedForeground }}>
      {visualModeEnabled ? "🎬 ON" : "🎬 OFF"}
    </Text>
  </Pressable>

  <Pressable
    onPress={() => stop()}
    style={styles.fullClose}
    hitSlop={8}
  >
    <X
      size={26}
      color={colors.mutedForeground}
      strokeWidth={2}
    />
  </Pressable>
</View>
        {visualModeEnabled && currentClip ? (
          <View style={styles.visualModeBox}>
            <VisualModePlayer
              uri={currentClip.videoUrl}
              shouldPlay={isPlaying}
              onEnd={onClipEnd}
            />
          </View>
        ) : (
          <View style={styles.fullArtwork}>
            <DynamicSlideshow
              currentTrackImage={currentTrack.thumbnailUrl}
              width={SCREEN_WIDTH - 32}
              height={260}
              borderRadius={16}
            />
          </View>
        )}

        <View style={styles.fullTrackInfo}>
          <Text
            style={[styles.fullTitle, { color: colors.foreground }]}
            numberOfLines={2}
          >
            {currentTrack.title}
          </Text>
          <Text style={[styles.fullCategory, { color: "#c8a84b" }]}>
            {currentTrack.categoryName}
          </Text>
        </View>

        <View style={styles.seekContainer}>
          <Pressable
            style={styles.seekBar}
            onPress={(e) => handleSeek(e.nativeEvent.locationX)}
          >
            <View
              style={[
                styles.seekTrack,
                { backgroundColor: isDark ? "#2a2a2a" : "#e2e8f0" },
              ]}
            >
              <View
                style={[
                  styles.seekFill,
                  {
                    width: `${progress * 100}%`,
                    backgroundColor: "#c8a84b",
                  },
                ]}
              />
            </View>
          </Pressable>
          <View style={styles.seekTimes}>
            <Text style={[styles.seekTime, { color: colors.mutedForeground }]}>
              {formatTime(currentTime)}
            </Text>
            <Text style={[styles.seekTime, { color: colors.mutedForeground }]}>
              {formatTime(duration)}
            </Text>
          </View>
        </View>

        <View style={styles.controls}>
          <Pressable onPress={playPrev} style={styles.ctrlBtn}>
            <SkipBack size={28} color={colors.foreground} strokeWidth={2} fill={colors.foreground} />
          </Pressable>
          <Pressable
            onPress={async () => {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              togglePlay();
            }}
            style={[styles.playBtnLarge, { backgroundColor: "#c8a84b" }]}
          >
            {isLoading ? (
              <LoaderCircle size={32} color="#000" strokeWidth={2} />
            ) : isPlaying ? (
              <Pause size={32} color="#000" strokeWidth={2.5} fill="#000" />
            ) : (
              <Play size={32} color="#000" strokeWidth={2.5} fill="#000" />
            )}
          </Pressable>
          <Pressable onPress={playNext} style={styles.ctrlBtn}>
            <SkipForward size={28} color={colors.foreground} strokeWidth={2} fill={colors.foreground} />
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.ratesContainer}
        >
          {RATES.map((rate) => (
            <Pressable
              key={rate}
              onPress={() => setPlaybackRate(rate)}
              style={[
                styles.rateBtn,
                {
                  backgroundColor:
                    playbackRate === rate
                      ? "#c8a84b"
                      : isDark
                        ? "#1a1a1a"
                        : "#f1f3f4",
                  borderColor:
                    playbackRate === rate ? "#c8a84b" : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.rateBtnText,
                  {
                    color:
                      playbackRate === rate
                        ? "#000"
                        : colors.mutedForeground,
                  },
                ]}
              >
                {rate}x
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

export default function AudioPlayer() {
  const { currentTrack, isExpanded } = useAudio();
  if (!currentTrack) return null;
  return (
    <>
      {!isExpanded && <MiniPlayer />}
      <FullPlayer />
    </>
  );
}

const styles = StyleSheet.create({
  mini: {
    borderTopWidth: 1,
    borderRadius: 0,
    overflow: "hidden",
  },
  miniProgress: {
    height: 2,
    backgroundColor: "transparent",
  },
  miniProgressBar: {
    height: 2,
  },
  miniContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  miniIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  miniInfo: {
    flex: 1,
  },
  miniTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  miniCategory: {
    fontSize: 12,
    marginTop: 2,
  },
  miniControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  full: {
    flex: 1,
    paddingHorizontal: 24,
  },
  fullHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 32,
  },
  visualModeButton: {
  paddingHorizontal: 10,
  paddingVertical: 6,
  borderRadius: 8,
  marginLeft: 8,
},

  fullClose: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  fullHeaderTitle: {
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  fullArtwork: {
    alignItems: "center",
    marginBottom: 24,
  },

  visualModeBox: {
    width: SCREEN_WIDTH - 32,
    height: 260,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#000",
    alignSelf: "center",
  },

artworkCircle: {
  width: 220,
  height: 220,
  borderRadius: 110,
  alignItems: "center",
  justifyContent: "center",
},
  artworkInner: {
    width: 160,
    height: 160,
    borderRadius: 80,
    alignItems: "center",
    justifyContent: "center",
  },
  fullTrackInfo: {
    alignItems: "center",
    marginBottom: 32,
    gap: 6,
  },
  fullTitle: {
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 30,
  },
  fullCategory: {
    fontSize: 15,
    fontWeight: "500",
  },
  seekContainer: {
    marginBottom: 32,
  },
  seekBar: {
    paddingVertical: 10,
  },
  seekTrack: {
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  seekFill: {
    height: 4,
    borderRadius: 2,
  },
  seekTimes: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  seekTime: {
    fontSize: 12,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 32,
    marginBottom: 32,
  },
  ctrlBtn: {
    padding: 8,
  },
  playBtnLarge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  ratesContainer: {
    gap: 8,
    paddingHorizontal: 4,
    alignItems: "center",
  },
  rateBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  rateBtnText: {
    fontSize: 13,
    fontWeight: "600",
  },
});
