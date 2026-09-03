import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import { Home, Heart, Info, Sparkles } from "lucide-react-native";
import React, { useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import RequestModal from "@/components/RequestModal";
import { useColors } from "@/hooks/useColors";

export default function TabLayout() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isDark = colors.isDark;
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";
  const [showRequest, setShowRequest] = useState(false);

  const bottomInset = Platform.OS === "android" ? insets.bottom : 0;
  const navBg = isDark ? "#0a1628" : "#ffffff";
  const navBorder = isDark ? "#1e293b" : "#d4e8d4";

  return (
    <>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: "#f0bc42",
          tabBarInactiveTintColor: colors.mutedForeground,
          headerShown: false,
          tabBarStyle: {
            position: "absolute",
            backgroundColor: isIOS ? "transparent" : navBg,
            borderTopWidth: 1,
            borderTopColor: navBorder,
            elevation: 0,
            height: (isWeb ? 84 : 60) + bottomInset,
            paddingBottom: bottomInset > 0 ? bottomInset + 4 : 6,
          },
          tabBarLabelStyle: {
            fontSize: 9,
            fontWeight: "600",
          },
          tabBarBackground: () =>
            isIOS ? (
              <BlurView
                intensity={100}
                tint={isDark ? "dark" : "light"}
                style={StyleSheet.absoluteFill}
              />
            ) : (
              <View
                style={[
                  StyleSheet.absoluteFill,
                  { backgroundColor: navBg },
                ]}
              />
            ),
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "முகப்பு",
            tabBarIcon: ({ color }) => (
              <Home size={22} color={color} strokeWidth={2} />
            ),
          }}
        />
        <Tabs.Screen
          name="favorites"
          options={{
            title: "பிடித்தவை",
            tabBarIcon: ({ color }) => (
              <Heart size={22} color={color} strokeWidth={2} />
            ),
          }}
        />
        <Tabs.Screen
          name="about"
          options={{
            title: "பற்றி",
            tabBarIcon: ({ color }) => (
              <Info size={22} color={color} strokeWidth={2} />
            ),
          }}
        />
        <Tabs.Screen
          name="request"
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              setShowRequest(true);
            },
          }}
          options={{
            title: "கோரிக்கை",
            tabBarIcon: ({ color }) => (
              <Sparkles size={22} color={color} strokeWidth={2} />
            ),
          }}
        />
        <Tabs.Screen
          name="index 1"
          options={{
            href: null,
          }}
        />
      </Tabs>
      <RequestModal visible={showRequest} onClose={() => setShowRequest(false)} />
    </>
  );
}
