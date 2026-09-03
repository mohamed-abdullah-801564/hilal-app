import React, { useEffect, useRef } from "react";
import { Animated, Dimensions, StyleSheet, View } from "react-native";

const { width: W, height: H } = Dimensions.get("window");

interface Star {
  x: number;
  y: number;
  size: number;
  anim: Animated.Value;
  delay: number;
}

function useTwinkleStars(count: number): Star[] {
  const stars = useRef<Star[]>([]);
  if (stars.current.length === 0) {
    stars.current = Array.from({ length: count }, () => ({
      x: Math.random() * W,
      y: Math.random() * H * 0.65,
      size: 1 + Math.random() * 2.5,
      anim: new Animated.Value(0.2 + Math.random() * 0.6),
      delay: Math.random() * 3000,
    }));
  }
  return stars.current;
}

export default function GameWorldBackground() {
  const stars = useTwinkleStars(60);
  const moonAnim = useRef(new Animated.Value(0)).current;
  const tree1Anim = useRef(new Animated.Value(0)).current;
  const tree2Anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(moonAnim, {
          toValue: 1,
          duration: 4000,
          useNativeDriver: true,
        }),
        Animated.timing(moonAnim, {
          toValue: 0,
          duration: 4000,
          useNativeDriver: true,
        }),
      ]),
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(tree1Anim, {
          toValue: 1,
          duration: 2800,
          useNativeDriver: true,
        }),
        Animated.timing(tree1Anim, {
          toValue: -1,
          duration: 2800,
          useNativeDriver: true,
        }),
      ]),
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(tree2Anim, {
          toValue: 1,
          duration: 3400,
          useNativeDriver: true,
        }),
        Animated.timing(tree2Anim, {
          toValue: -1,
          duration: 3400,
          useNativeDriver: true,
        }),
      ]),
    ).start();

    stars.forEach((star) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(star.delay),
          Animated.timing(star.anim, {
            toValue: 1,
            duration: 1000 + Math.random() * 1500,
            useNativeDriver: true,
          }),
          Animated.timing(star.anim, {
            toValue: 0.15,
            duration: 1000 + Math.random() * 1500,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    });
  }, []);

  const moonGlow = moonAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.7, 1],
  });

  const tree1Rotate = tree1Anim.interpolate({
    inputRange: [-1, 1],
    outputRange: ["-3deg", "3deg"],
  });

  const tree2Rotate = tree2Anim.interpolate({
    inputRange: [-1, 1],
    outputRange: ["4deg", "-4deg"],
  });

  return (
    <View style={styles.bg} pointerEvents="none">
      <View style={styles.gradientBg} />
      {stars.map((star, i) => (
        <Animated.View
          key={i}
          style={[
            styles.star,
            {
              left: star.x,
              top: star.y,
              width: star.size,
              height: star.size,
              borderRadius: star.size / 2,
              opacity: star.anim,
            },
          ]}
        />
      ))}
      <Animated.View
        style={[
          styles.moonContainer,
          {
            opacity: moonGlow,
          },
        ]}
      >
        <View style={styles.moonGlow} />
        <View style={styles.moon} />
      </Animated.View>
      <View style={styles.treeLine}>
        <Animated.View
          style={[
            styles.tree,
            { height: 80, left: 20 },
            { transform: [{ rotate: tree1Rotate }, { translateY: 0 }] },
          ]}
        >
          <View style={[styles.treeTrunk, { height: 25 }]} />
          <View style={[styles.treeTop, { width: 32, height: 55, borderRadius: 16 }]} />
        </Animated.View>
        <Animated.View
          style={[
            styles.tree,
            { height: 110, left: 60 },
            { transform: [{ rotate: tree2Rotate }] },
          ]}
        >
          <View style={[styles.treeTrunk, { height: 35 }]} />
          <View style={[styles.treeTop, { width: 40, height: 80, borderRadius: 20 }]} />
        </Animated.View>
        <Animated.View
          style={[
            styles.tree,
            { height: 90, right: 30 },
            { transform: [{ rotate: tree1Rotate }] },
          ]}
        >
          <View style={[styles.treeTrunk, { height: 28 }]} />
          <View style={[styles.treeTop, { width: 36, height: 65, borderRadius: 18 }]} />
        </Animated.View>
        <Animated.View
          style={[
            styles.tree,
            { height: 120, right: 80 },
            { transform: [{ rotate: tree2Rotate }] },
          ]}
        >
          <View style={[styles.treeTrunk, { height: 40 }]} />
          <View style={[styles.treeTop, { width: 44, height: 85, borderRadius: 22 }]} />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  gradientBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#0f0a2e",
  },
  star: {
    position: "absolute",
    backgroundColor: "#ffffff",
  },
  moonContainer: {
    position: "absolute",
    top: 40,
    right: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  moonGlow: {
    position: "absolute",
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#f0e0a033",
    transform: [{ scale: 1.8 }],
  },
  moon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#f0e0a0",
    shadowColor: "#f0e0a0",
    shadowOpacity: 0.8,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  treeLine: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 130,
    flexDirection: "row",
    alignItems: "flex-end",
  },
  tree: {
    position: "absolute",
    bottom: 0,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  treeTrunk: {
    width: 8,
    backgroundColor: "#2d1a0a",
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  treeTop: {
    position: "absolute",
    bottom: "60%",
    backgroundColor: "#0d3321",
    shadowColor: "#1a5533",
    shadowOpacity: 0.6,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -4 },
  },
});
