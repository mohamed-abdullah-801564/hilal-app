import React, { useEffect, useRef, useState } from "react";
import { Animated, Dimensions, Image, StyleSheet, View } from "react-native";
import { getPodcastImageUrls, isAllowedImage } from "@/services/podcastImages.firebase";

// Expanded fallback pool of high quality Islamic architecture, mosques, nature, and geometric patterns (STRICTLY NO HUMAN FIGURES)
const FALLBACK_IMAGES = [
  "https://images.unsplash.com/photo-1542816417-0983cbe0f637?q=80&w=800&auto=format&fit=crop", // Makkah Architecture
  "https://images.unsplash.com/photo-1564769625905-50e93615e769?q=80&w=800&auto=format&fit=crop", // Holy Quran
  "https://images.unsplash.com/photo-1584551246679-0daf3d275d0f?q=80&w=800&auto=format&fit=crop", // Mosque Minaret Architecture
  "https://images.unsplash.com/photo-1591604466107-ec97de577aff?q=80&w=800&auto=format&fit=crop", // Mosque Dome Pattern
  "https://images.unsplash.com/photo-1519817650390-64a93db51149?q=80&w=800&auto=format&fit=crop", // Tasbeeh and Quran
  "https://images.unsplash.com/photo-1512632578888-169bbbc64f33?q=80&w=800&auto=format&fit=crop", // Grand Mosque Archways
  "https://images.unsplash.com/photo-1548625361-185e78345719?q=80&w=800&auto=format&fit=crop", // Blue Mosque Architecture
  "https://images.unsplash.com/photo-1565552645632-d725f8bfc19a?q=80&w=800&auto=format&fit=crop", // Mosque Silhouette Sunset
  "https://images.unsplash.com/photo-1574246604907-db69e30ddb97?q=80&w=800&auto=format&fit=crop", // Islamic Geometric Tilework
  "https://images.unsplash.com/photo-1580418827493-f2b22c0a76cb?q=80&w=800&auto=format&fit=crop", // Minaret & Crescent Moon
  "https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?q=80&w=800&auto=format&fit=crop", // Desert Dunes Sunset
  "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?q=80&w=800&auto=format&fit=crop", // Mountain Mist Nature
  "https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=800&auto=format&fit=crop", // Serene Mountain Lake
  "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=800&auto=format&fit=crop", // Calm Ocean Horizon
  "https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=800&auto=format&fit=crop", // Starry Night Sky
  "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=800&auto=format&fit=crop", // Classic Islamic Arches
  "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=800&auto=format&fit=crop", // Majestic Mountain Peaks
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=800&auto=format&fit=crop", // Golden Sunrise Valley
  "https://images.unsplash.com/photo-1518495973542-4542c06a5843?q=80&w=800&auto=format&fit=crop", // Sunbeams Through Trees
  "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?q=80&w=800&auto=format&fit=crop", // Verdant Nature Landscape
];

type AnimStyle = "fade" | "zoomIn" | "zoomOut" | "panRight" | "panLeft" | "slideUp";
const ANIM_STYLES: AnimStyle[] = ["fade", "zoomIn", "zoomOut", "panRight", "panLeft", "slideUp"];

interface DynamicSlideshowProps {
  currentTrackImage?: string;
  size?: number;
  width?: number;
  height?: number;
  borderRadius?: number;
}

export default function DynamicSlideshow({
  currentTrackImage,
  size = 280,
  width,
  height,
  borderRadius = 16,
}: DynamicSlideshowProps) {
  const [images, setImages] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [animTypeIndex, setAnimTypeIndex] = useState(0);

  const screenWidth = Dimensions.get("window").width;
  const frameWidth = width ?? (screenWidth - 32);
  const frameHeight = height ?? 260;
  const frameRadius = borderRadius ?? 16;

  // Animated values — all useNativeDriver: true
  const opacityAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const translateXAnim = useRef(new Animated.Value(0)).current;
  const translateYAnim = useRef(new Animated.Value(0)).current;

  // 1. Load remote URLs from Firestore on mount & merge with expanded pool
  useEffect(() => {
    let mounted = true;
    getPodcastImageUrls()
      .then((urls) => {
        if (mounted) {
          const allowedRemote = urls.filter(isAllowedImage);
          // Combine remote Firestore URLs with the expanded fallback pool
          const combinedPool = Array.from(new Set([...allowedRemote, ...FALLBACK_IMAGES])).filter(isAllowedImage);
          if (currentTrackImage && isAllowedImage(currentTrackImage) && !combinedPool.includes(currentTrackImage)) {
            setImages([currentTrackImage, ...combinedPool]);
          } else {
            setImages(combinedPool);
          }
        }
      })
      .catch(() => {
        if (mounted) {
          setImages(FALLBACK_IMAGES.filter(isAllowedImage));
        }
      });

    return () => {
      mounted = false;
    };
  }, [currentTrackImage]);

  const activeImages = images.length > 0 ? images.filter(isAllowedImage) : FALLBACK_IMAGES;

  // 2. 3.5-second interval timer + 60fps native driver transitions
  useEffect(() => {
    if (activeImages.length <= 1) return;

    const interval = setInterval(() => {
      const nextIdx = (index + 1) % activeImages.length;
      const nextAnimIdx = (animTypeIndex + 1) % ANIM_STYLES.length;
      const style = ANIM_STYLES[nextAnimIdx];

      // Reset animation values for transition
      opacityAnim.setValue(0);
      scaleAnim.setValue(1);
      translateXAnim.setValue(0);
      translateYAnim.setValue(0);

      setIndex(nextIdx);
      setAnimTypeIndex(nextAnimIdx);

      // Create 60fps animated transitions using useNativeDriver: true
      const animations: Animated.CompositeAnimation[] = [
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ];

      switch (style) {
        case "zoomIn":
          scaleAnim.setValue(1.0);
          animations.push(
            Animated.timing(scaleAnim, {
              toValue: 1.15,
              duration: 3200,
              useNativeDriver: true,
            })
          );
          break;
        case "zoomOut":
          scaleAnim.setValue(1.15);
          animations.push(
            Animated.timing(scaleAnim, {
              toValue: 1.0,
              duration: 3200,
              useNativeDriver: true,
            })
          );
          break;
        case "panRight":
          scaleAnim.setValue(1.08);
          translateXAnim.setValue(-15);
          animations.push(
            Animated.timing(translateXAnim, {
              toValue: 15,
              duration: 3200,
              useNativeDriver: true,
            })
          );
          break;
        case "panLeft":
          scaleAnim.setValue(1.08);
          translateXAnim.setValue(15);
          animations.push(
            Animated.timing(translateXAnim, {
              toValue: -15,
              duration: 3200,
              useNativeDriver: true,
            })
          );
          break;
        case "slideUp":
          translateYAnim.setValue(20);
          animations.push(
            Animated.timing(translateYAnim, {
              toValue: 0,
              duration: 800,
              useNativeDriver: true,
            })
          );
          break;
        case "fade":
        default:
          break;
      }

      Animated.parallel(animations).start();
    }, 3500);

    return () => clearInterval(interval);
  }, [index, animTypeIndex, activeImages.length, opacityAnim, scaleAnim, translateXAnim, translateYAnim]);

  const currentUri = activeImages[index % activeImages.length];

  return (
    <View style={[styles.container, { width: frameWidth, height: frameHeight, borderRadius: frameRadius }]}>
      <Animated.View
        style={[
          styles.animContainer,
          {
            opacity: opacityAnim,
            transform: [
              { scale: scaleAnim },
              { translateX: translateXAnim },
              { translateY: translateYAnim },
            ],
          },
        ]}
      >
        <Image
          source={{ uri: currentUri }}
          style={styles.image}
          resizeMode="cover"
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#c8a84b22",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  animContainer: {
    width: "100%",
    height: "100%",
  },
  image: {
    width: "100%",
    height: "100%",
  },
});
