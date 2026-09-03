import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AudioPlayer from "@/components/AudioPlayer";
import { useColors } from "@/hooks/useColors";

export default function AboutScreen() {
  const colors = useColors();
  const isDark = colors.isDark;
  const insets = useSafeAreaInsets();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 + 84 : insets.bottom + 60;

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: isDark ? "#0f0f0f" : "#f8f9fa" },
      ]}
    >
      <ScrollView
        contentContainerStyle={{
          paddingTop: topPad + 16,
          paddingBottom: botPad + 80,
          paddingHorizontal: 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={["#c8a84b22", "transparent"]}
          style={styles.heroBanner}
        >
          <Ionicons name="moon" size={40} color="#c8a84b" />
          <Text style={[styles.appName, { color: "#c8a84b" }]}>
            Hilal
          </Text>
          <Text style={[styles.tagline, { color: colors.foreground }]}>
            செவிகள் சிறக்கட்டும்!{"\n"}சிந்தனை மாறட்டும்!
          </Text>
          <Text style={[styles.introPara, { color: colors.mutedForeground }]}>
            தமிழ் பேசும் முஸ்லிம்களுக்காக உருவாக்கப்பட்ட இஸ்லாமிய அறிவு கற்றல்
            தளம். குர்ஆன் விளக்கம், ஹதீஸ் பாடங்கள், நபி வரலாறு, ஈமான்
            அடிப்படைகள் மற்றும் அன்றாட வழிகாட்டி — அனைத்தும் தமிழில்.
          </Text>
        </LinearGradient>

        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          பிரிவுகள்
        </Text>

        {[
          {
            icon: "book",
            name: "குர்ஆன் விளக்கம்",
            desc: "குர்ஆனின் பொருள் விளக்கம் மற்றும் தஃப்சீர் பாடங்கள்",
            color: "#c8a84b",
          },
          {
            icon: "document-text",
            name: "ஹதீஸ் விளக்கம்",
            desc: "நபி (ஸல்) வழிமுறைகள் மற்றும் ஹதீஸ் விளக்கங்கள்",
            color: "#4ade80",
          },
          {
            icon: "heart",
            name: "ஈமான் அடிப்படைகள்",
            desc: "அ஖ீதா, தவ்ஹீத், அஸ்மாவுல் ஹுஸ்னா",
            color: "#60a5fa",
          },
          {
            icon: "star",
            name: "நபி வரலாறு",
            desc: "இறைத்தூதர் (ஸல்) அவர்களின் வாழ்க்கை வரலாறு",
            color: "#f472b6",
          },
          {
            icon: "sunny",
            name: "அன்றாட வழிகாட்டி",
            desc: "தினசரி துஆக்கள் மற்றும் வழிகாட்டல்கள்",
            color: "#fb923c",
          },
        ].map((cat) => (
          <View
            key={cat.name}
            style={[
              styles.catCard,
              { backgroundColor: isDark ? "#1a1a1a" : "#ffffff" },
            ]}
          >
            <View
              style={[
                styles.catIcon,
                { backgroundColor: cat.color + "22" },
              ]}
            >
              <Ionicons name={cat.icon as any} size={22} color={cat.color} />
            </View>
            <View style={styles.catInfo}>
              <Text style={[styles.catName, { color: colors.foreground }]}>
                {cat.name}
              </Text>
              <Text style={[styles.catDesc, { color: colors.mutedForeground }]}>
                {cat.desc}
              </Text>
            </View>
          </View>
        ))}

        <View
          style={[
            styles.timeCard,
            { backgroundColor: isDark ? "#1a1a1a" : "#ffffff" },
          ]}
        >
          <Text style={[styles.timeTitle, { color: colors.foreground }]}>
            நேரம் முதலீடு
          </Text>
          <Text style={[styles.timeText, { color: colors.mutedForeground }]}>
            "உங்கள் நேரம் உங்கள் முதலீடு. அதை இஸ்லாமிய அறிவு கற்பதில்
            செலவிடுங்கள்."
          </Text>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          தொடர்பு
        </Text>

        <View
          style={[
            styles.contactCard,
            { backgroundColor: isDark ? "#1a1a1a" : "#ffffff" },
          ]}
        >
          <View style={styles.contactRow}>
            <Ionicons name="mail" size={20} color="#c8a84b" />
            <Text style={[styles.contactText, { color: colors.foreground }]}>
              islamicaudiohub@gmail.com
            </Text>
          </View>
        </View>

        <Text style={[styles.footer, { color: colors.mutedForeground }]}>
          Hilal © 2026{"\n"}அல்லாஹ்வின் மீது நம்பிக்கையுடன் உருவாக்கப்பட்டது
        </Text>
      </ScrollView>

      <View
        style={[
          styles.playerBar,
          { bottom: botPad - (Platform.OS === "web" ? 84 : 60) },
        ]}
      >
        <AudioPlayer />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  heroBanner: {
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    gap: 10,
    marginBottom: 24,
  },
  appName: {
    fontSize: 24,
    fontWeight: "800",
  },
  tagline: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 28,
  },
  introPara: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 22,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
  },
  catCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    gap: 14,
  },
  catIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  catInfo: {
    flex: 1,
  },
  catName: {
    fontSize: 15,
    fontWeight: "600",
  },
  catDesc: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 18,
  },
  timeCard: {
    borderRadius: 14,
    padding: 20,
    marginTop: 8,
    marginBottom: 24,
    borderLeftWidth: 3,
    borderLeftColor: "#c8a84b",
  },
  timeTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
  },
  timeText: {
    fontSize: 14,
    lineHeight: 22,
    fontStyle: "italic",
  },
  contactCard: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    gap: 0,
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
  },
  contactText: {
    fontSize: 14,
  },
  divider: {
    height: 1,
    marginHorizontal: -4,
  },
  policyLinks: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    marginBottom: 24,
  },
  policyLink: {
    fontSize: 12,
    textDecorationLine: "underline",
  },
  footer: {
    fontSize: 12,
    textAlign: "center",
    lineHeight: 20,
  },
  playerBar: {
    position: "absolute",
    left: 0,
    right: 0,
  },
});
