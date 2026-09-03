import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator, Pressable, ScrollView,
  StyleSheet, Text, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useApp } from "@/context/AppContext";
import { getLeaderboard, type QuizScore } from "@/services/quiz.firebase";
import { getUserId } from "@/services/userId";

const LEVEL_CFG = [
  { id: 1, label: "Level 1", labelTa: "ஆரம்ப நிலை", color: "#22c55e" },
  { id: 2, label: "Level 2", labelTa: "இடை நிலை",   color: "#f59e0b" },
  { id: 3, label: "Level 3", labelTa: "உயர் நிலை",   color: "#ef4444" },
];

const MEDAL_COLORS = ["#f0bc42", "#9ca3af", "#cd7f32"];

type Entry = QuizScore & { id: string; rank: number };

export default function LeaderboardScreen() {
  const { cardId, level: levelParam, title } = useLocalSearchParams<{
    cardId: string; level?: string; title?: string;
  }>();
  const router = useRouter();
  const { isDarkMode } = useApp();

  const bg    = isDarkMode ? "#0a0a0a" : "#f5f5f5";
  const card  = isDarkMode ? "#1a1a1a" : "#ffffff";
  const txt   = isDarkMode ? "#f0f0f0" : "#111111";
  const sub   = isDarkMode ? "#888888" : "#666666";
  const bdr   = isDarkMode ? "#2a2a2a" : "#e5e5e5";

  const [activeLevel, setActiveLevel] = useState(Number(levelParam ?? 1) as 1 | 2 | 3);
  const [entries, setEntries]         = useState<Entry[]>([]);
  const [loading, setLoading]         = useState(true);
  const [myId, setMyId]               = useState("");

  useEffect(() => { getUserId().then(setMyId).catch(() => {}); }, []);

  useEffect(() => {
    if (!cardId) return;
    setLoading(true);
    getLeaderboard(cardId, activeLevel)
      .then(setEntries)
      .finally(() => setLoading(false));
  }, [cardId, activeLevel]);

  const cfg = LEVEL_CFG.find(l => l.id === activeLevel)!;

  return (
    <SafeAreaView style={[s.root, { backgroundColor: bg }]} edges={["top"]}>

      {/* Header */}
      <View style={[s.header, { borderBottomColor: bdr }]}>
        <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={txt} />
        </Pressable>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={[s.title, { color: txt }]}>🏆 Leaderboard</Text>
          {!!title && (
            <Text style={[s.sub, { color: sub }]} numberOfLines={1}>{decodeURIComponent(title)}</Text>
          )}
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Level tabs */}
      <View style={[s.tabRow, { backgroundColor: card, borderBottomColor: bdr }]}>
        {LEVEL_CFG.map(l => (
          <Pressable
            key={l.id}
            style={[s.tab, activeLevel === l.id && { borderBottomColor: l.color, borderBottomWidth: 2.5 }]}
            onPress={() => setActiveLevel(l.id as 1 | 2 | 3)}
          >
            <Text style={[s.tabTxt, { color: activeLevel === l.id ? l.color : sub }]}>{l.label}</Text>
            <Text style={[s.tabSub, { color: activeLevel === l.id ? l.color + "aa" : sub + "88" }]}>{l.labelTa}</Text>
          </Pressable>
        ))}
      </View>

      {/* Content */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={cfg.color} />
          <Text style={[s.loadTxt, { color: sub }]}>ஏற்றுகிறது...</Text>
        </View>
      ) : entries.length === 0 ? (
        <View style={s.center}>
          <Ionicons name="trophy-outline" size={64} color={cfg.color + "66"} />
          <Text style={[s.emptyTxt, { color: txt }]}>இன்னும் யாரும் விளையாடவில்லை</Text>
          <Text style={[s.emptySub, { color: sub }]}>முதலில் quiz விளையாடி leaderboard-ல் இடம் பிடியுங்கள்!</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.list} showsVerticalScrollIndicator={false}>

          {/* Top 3 podium */}
          {entries.length >= 1 && (
            <View style={s.podium}>
              {[entries[1], entries[0], entries[2]].filter(Boolean).map((e, i) => {
                const order = [2, 1, 3][i];
                const height = [70, 100, 55][i];
                const medalColor = MEDAL_COLORS[order - 1];
                const isMe = e.userId === myId;
                return (
                  <View key={e.id} style={[s.podiumSlot, { alignItems: "center" }]}>
                    <View style={[s.podiumAvatar, { borderColor: medalColor, backgroundColor: medalColor + "22" }]}>
                      <Text style={[s.podiumAvatarTxt, { color: medalColor }]}>
                        {e.userId.slice(-2).toUpperCase()}
                      </Text>
                    </View>
                    <Text style={[s.podiumId, { color: isMe ? cfg.color : txt }]}>
                      {e.userId}{isMe ? " (நீ)" : ""}
                    </Text>
                    <Text style={[s.podiumPct, { color: sub }]}>{e.percentage}%</Text>
                    <View style={[s.podiumBar, { height, backgroundColor: medalColor + "44", borderColor: medalColor }]}>
                      <Text style={[s.podiumRank, { color: medalColor }]}>
                        {order === 1 ? "🥇" : order === 2 ? "🥈" : "🥉"}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Full list */}
          <View style={[s.listCard, { backgroundColor: card, borderColor: bdr }]}>
            {entries.map((e) => {
              const isMe = e.userId === myId;
              const isTop3 = e.rank <= 3;
              const medalColor = isTop3 ? MEDAL_COLORS[e.rank - 1] : sub;
              return (
                <View
                  key={e.id}
                  style={[
                    s.row,
                    { borderBottomColor: bdr },
                    isMe && { backgroundColor: cfg.color + "12" },
                  ]}
                >
                  {/* Rank */}
                  <View style={[s.rankBox, isTop3 && { backgroundColor: medalColor + "22" }]}>
                    <Text style={[s.rankTxt, { color: isTop3 ? medalColor : sub }]}>
                      {e.rank === 1 ? "🥇" : e.rank === 2 ? "🥈" : e.rank === 3 ? "🥉" : `#${e.rank}`}
                    </Text>
                  </View>

                  {/* User info */}
                  <View style={{ flex: 1 }}>
                    <Text style={[s.userId, { color: isMe ? cfg.color : txt }]}>
                      {e.userId}{isMe ? "  (நீ)" : ""}
                    </Text>
                    <Text style={[s.scoreDetail, { color: sub }]}>
                      {e.score}/{e.total} • {e.timeTaken}s
                    </Text>
                  </View>

                  {/* Percentage */}
                  <View style={[s.pctBox, { backgroundColor: cfg.color + "18" }]}>
                    <Text style={[s.pctTxt, { color: cfg.color }]}>{e.percentage}%</Text>
                  </View>
                </View>
              );
            })}
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1 },
  center:  { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 32 },
  loadTxt: { fontSize: 14, marginTop: 8 },

  header:  { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1 },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title:   { fontSize: 18, fontWeight: "800" },
  sub:     { fontSize: 12, marginTop: 2 },

  tabRow:  { flexDirection: "row", borderBottomWidth: 1 },
  tab:     { flex: 1, alignItems: "center", paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabTxt:  { fontSize: 13, fontWeight: "700" },
  tabSub:  { fontSize: 10, marginTop: 2 },

  list:    { padding: 16, gap: 16 },

  podium:       { flexDirection: "row", justifyContent: "center", alignItems: "flex-end", gap: 8, marginBottom: 16 },
  podiumSlot:   { flex: 1, maxWidth: 110 },
  podiumAvatar: { width: 52, height: 52, borderRadius: 26, borderWidth: 2, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  podiumAvatarTxt: { fontSize: 18, fontWeight: "800" },
  podiumId:     { fontSize: 11, fontWeight: "700", textAlign: "center", marginBottom: 2 },
  podiumPct:    { fontSize: 11, textAlign: "center", marginBottom: 6 },
  podiumBar:    { width: "100%", borderRadius: 8, borderWidth: 1.5, alignItems: "center", justifyContent: "flex-start", paddingTop: 8 },
  podiumRank:   { fontSize: 22 },

  listCard:  { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  row:       { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1 },
  rankBox:   { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  rankTxt:   { fontSize: 14, fontWeight: "800" },
  userId:    { fontSize: 14, fontWeight: "700" },
  scoreDetail: { fontSize: 11, marginTop: 2 },
  pctBox:    { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  pctTxt:    { fontSize: 14, fontWeight: "800" },

  emptyTxt:  { fontSize: 16, fontWeight: "700", textAlign: "center" },
  emptySub:  { fontSize: 13, textAlign: "center", lineHeight: 20 },
});
