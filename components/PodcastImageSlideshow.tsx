import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";

const FADE_MS = 1000;
const HOLD_MS = 2000;
const KEN_BURNS_MS = FADE_MS + HOLD_MS;

const H_PAD = 16;
const V_PAD = 8;
const MIN_FRAME_H = 180;

/** Frame is 16:9, clamped so it can never collapse to an unusable height. */
function frameHeightFor(width: number): number {
  return Math.max(MIN_FRAME_H, Math.round((width * 9) / 16));
}

/** Content width available inside the horizontal padding. */
function initialFrameWidth(): number {
  const w = Dimensions.get("window").width;
  return Math.max(1, Math.round(w) - H_PAD * 2);
}

const MOTIONS = [
  { from: { scale: 1.04, x: 0 },   to: { scale: 1.10, x: 0 } },
  { from: { scale: 1.10, x: 0 },   to: { scale: 1.04, x: 0 } },
  { from: { scale: 1.06, x: 8 },   to: { scale: 1.10, x: -8 } },
  { from: { scale: 1.10, x: 0 },   to: { scale: 1.04, x: 0 } },
  { from: { scale: 1.06, x: -8 },  to: { scale: 1.10, x: 8 } },
  { from: { scale: 1.04, x: 0 },   to: { scale: 1.08, x: 0 } },
] as const;

type MotionAnims = {
  scale: Animated.Value;
  translateX: Animated.Value;
};

function makeMotion(): MotionAnims {
  return {
    scale: new Animated.Value(1.04),
    translateX: new Animated.Value(0),
  };
}

function startKenBurns(motion: MotionAnims, motionIndex: number): Animated.CompositeAnimation {
  const preset = MOTIONS[motionIndex % MOTIONS.length];
  motion.scale.setValue(preset.from.scale);
  motion.translateX.setValue(preset.from.x);
  return Animated.parallel([
    Animated.timing(motion.scale, {
      toValue: preset.to.scale,
      duration: KEN_BURNS_MS,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }),
    Animated.timing(motion.translateX, {
      toValue: preset.to.x,
      duration: KEN_BURNS_MS,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }),
  ]);
}

/**
 * Opacity lives on the outer wrapper and the Ken Burns transform on the inner
 * one: on Android, driving opacity and transform on the same node (especially an
 * Animated.Image) can leave the image unpainted. The Image itself is a plain
 * Image with explicit pixel width/height so it never depends on parent layout
 * resolution to become visible.
 */
function SlideLayer({
  uri,
  opacity,
  motion,
  width,
  height,
  onFailed,
}: {
  uri: string;
  opacity: Animated.Value;
  motion: MotionAnims;
  width: number;
  height: number;
  onFailed: (uri: string) => void;
}) {
  if (!uri) return null;
  return (
    <Animated.View pointerEvents="none" style={[styles.layer, { width, height, opacity }]}>
      <Animated.View
        style={[
          styles.layer,
          {
            width,
            height,
            transform: [{ scale: motion.scale }, { translateX: motion.translateX }],
          },
        ]}
      >
        <Image
          source={{ uri }}
          style={{ width, height }}
          resizeMode="cover"
          onLoad={() => console.log("[PodcastImages] image loaded", { uri, width, height })}
          onError={(e) => {
            console.log("[PodcastImages] image error", uri, e.nativeEvent?.error);
            onFailed(uri);
          }}
        />
      </Animated.View>
    </Animated.View>
  );
}

export default function PodcastImageSlideshow({
  urls,
  title = "",
}: {
  urls: string[];
  title?: string;
}) {
  // A URL that cannot be decoded would otherwise hold its slot as a blank
  // frame, so it is dropped from the rotation the first time it errors.
  const [failed, setFailed] = useState<Record<string, true>>({});
  const markFailed = useCallback((uri: string) => {
    setFailed(prev => (prev[uri] ? prev : { ...prev, [uri]: true }));
  }, []);

  const validUrls = urls.filter(
    u => typeof u === "string" && u.length > 0 && !failed[u],
  );
  const urlsKey = validUrls.join("\0");

  // Seeded from the window width so the very first paint already has real,
  // non-zero pixel dimensions — onLayout only refines it.
  const [frameW, setFrameW] = useState(initialFrameWidth);
  const frameH = frameHeightFor(frameW);

  const [uriA, setUriA] = useState(validUrls[0] ?? "");
  const [uriB, setUriB] = useState("");

  const opacityA = useRef(new Animated.Value(1)).current;
  const opacityB = useRef(new Animated.Value(0)).current;
  const motionA = useRef(makeMotion()).current;
  const motionB = useRef(makeMotion()).current;
  const aIsFront = useRef(true);

  useEffect(() => {
    console.log("[PodcastImages] slideshow mounted");
    console.log("[PodcastImages] urls count", validUrls.length);
    console.log("[PodcastImages] urls", validUrls);
    return () => console.log("[PodcastImages] slideshow unmounted");
  }, [urlsKey]);

  useEffect(() => {
    console.log("[PodcastImages] frame dimensions", { width: frameW, height: frameH });
  }, [frameW, frameH]);

  useEffect(() => {
    if (validUrls.length === 0) return;

    let cancelled = false;
    let holdTimer: ReturnType<typeof setTimeout> | undefined;
    let kenBurnsAnim: Animated.CompositeAnimation | undefined;
    let fadeAnim: Animated.CompositeAnimation | undefined;
    let shownIndex = 0;
    let motionIndex = 0;

    // First image is front and fully opaque before anything animates.
    aIsFront.current = true;
    opacityA.setValue(1);
    opacityB.setValue(0);
    setUriA(validUrls[0]);
    setUriB(validUrls.length > 1 ? validUrls[1] : "");
    console.log("[PodcastImages] rendering image", validUrls[0]);

    const frontOpacity = () => (aIsFront.current ? opacityA : opacityB);
    const rearOpacity = () => (aIsFront.current ? opacityB : opacityA);
    const frontMotion = () => (aIsFront.current ? motionA : motionB);
    const rearMotion = () => (aIsFront.current ? motionB : motionA);

    const setRearUri = (uri: string) => {
      if (aIsFront.current) setUriB(uri);
      else setUriA(uri);
    };

    const stopKenBurns = () => {
      kenBurnsAnim?.stop();
      kenBurnsAnim = undefined;
    };
    const stopFade = () => {
      fadeAnim?.stop();
      fadeAnim = undefined;
    };

    const playKenBurns = (motion: MotionAnims, index: number) => {
      stopKenBurns();
      kenBurnsAnim = startKenBurns(motion, index);
      kenBurnsAnim.start();
    };

    // Only the current and the next image are ever mounted.
    const preloadNext = (fromIndex: number) => {
      if (validUrls.length < 2) return;
      const nextUri = validUrls[(fromIndex + 1) % validUrls.length];
      setRearUri(nextUri);
      rearOpacity().setValue(0);
    };

    const scheduleAdvance = (fromIndex: number) => {
      if (holdTimer) clearTimeout(holdTimer);
      preloadNext(fromIndex);
      holdTimer = setTimeout(() => {
        if (cancelled) return;

        // Single image: keep the motion looping, nothing to crossfade to.
        if (validUrls.length < 2) {
          motionIndex += 1;
          playKenBurns(frontMotion(), motionIndex);
          scheduleAdvance(0);
          return;
        }

        const nextIndex = (fromIndex + 1) % validUrls.length;
        motionIndex += 1;
        const incomingOp = rearOpacity();
        const outgoingOp = frontOpacity();
        incomingOp.setValue(0);
        playKenBurns(rearMotion(), motionIndex);
        console.log("[PodcastImages] rendering image", validUrls[nextIndex]);

        stopFade();
        fadeAnim = Animated.parallel([
          Animated.timing(incomingOp, {
            toValue: 1,
            duration: FADE_MS,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(outgoingOp, {
            toValue: 0,
            duration: FADE_MS,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]);
        fadeAnim.start(({ finished }) => {
          if (!finished || cancelled) return;
          aIsFront.current = !aIsFront.current;
          shownIndex = nextIndex;
          scheduleAdvance(shownIndex);
        });
      }, HOLD_MS);
    };

    playKenBurns(motionA, 0);
    scheduleAdvance(0);
    console.log("[PodcastImages] timer/animation started", {
      holdMs: HOLD_MS,
      fadeMs: FADE_MS,
      urlCount: validUrls.length,
    });

    return () => {
      cancelled = true;
      if (holdTimer) clearTimeout(holdTimer);
      stopKenBurns();
      stopFade();
      opacityA.stopAnimation();
      opacityB.stopAnimation();
      motionA.scale.stopAnimation();
      motionA.translateX.stopAnimation();
      motionB.scale.stopAnimation();
      motionB.translateX.stopAnimation();
    };
  }, [urlsKey]);

  const onWrapLayout = (e: LayoutChangeEvent) => {
    const inner = Math.round(e.nativeEvent.layout.width) - H_PAD * 2;
    if (inner > 0 && inner !== frameW) setFrameW(inner);
  };

  // Nothing loadable left → render nothing rather than an empty container.
  if (validUrls.length === 0) return null;
  if (!uriA && !uriB) return null;

  return (
    <View style={styles.wrap} onLayout={onWrapLayout} pointerEvents="none">
      <View style={[styles.frame, { width: frameW, height: frameH }]}>
        <SlideLayer uri={uriB} opacity={opacityB} motion={motionB} width={frameW} height={frameH} onFailed={markFailed} />
        <SlideLayer uri={uriA} opacity={opacityA} motion={motionA} width={frameW} height={frameH} onFailed={markFailed} />
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.58)"]}
          locations={[0.45, 1]}
          style={styles.gradient}
          pointerEvents="none"
        />
        {!!title && (
          <View style={styles.titleWrap} pointerEvents="none">
            <Text style={styles.title} numberOfLines={2}>
              {title}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    flexGrow: 0,
    flexShrink: 0,
    paddingHorizontal: H_PAD,
    paddingTop: V_PAD,
    paddingBottom: V_PAD,
  },
  frame: {
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#0d1a14",
    borderWidth: 1,
    borderColor: "rgba(192,168,75,0.38)",
  },
  layer: {
    position: "absolute",
    top: 0,
    left: 0,
  },
  gradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "42%",
  },
  titleWrap: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 12,
  },
  title: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 20,
    textShadowColor: "rgba(0,0,0,0.65)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});
