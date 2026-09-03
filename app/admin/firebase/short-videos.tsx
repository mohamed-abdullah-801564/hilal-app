// Admin — Short Video Library (for Audio + Video Visual Mode).
// Mirrors the existing app/admin/firebase/index.tsx CRUD/upload pattern —
// same palette, same native/web picker branching, same upload-progress UX.
// Does not touch app/admin/firebase/index.tsx or the existing card system.

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as DocumentPicker from "expo-document-picker";
import {
  getAllShortVideos,
  addShortVideo,
  updateShortVideo,
  deleteShortVideo,
  type ShortVideo,
} from "@/services/shortVideos.firebase";
import {
  uploadShortVideo,
  deleteStorageFile,
  pickVideoFileWeb,
  type UploadProgress,
} from "@/services/firebase.storage";
import VideoPlayer from "@/components/VideoPlayer";

// ─── Palette (matches app/admin/firebase/index.tsx and bulk-create.tsx) ───────
const C = {
  green:  "#1a7a4a",
  gold:   "#f0bc42",
  bg:     "#f4faf6",
  card:   "#ffffff",
  border: "#d4ead9",
  txt:    "#0d2414",
  sub:    "#5a7a64",
  red:    "#ef4444",
};

function Field({ label, value, onChangeText, placeholder }: {
  label: string; value: string; onChangeText: (v: string) => void; placeholder?: string;
}) {
  return (
    <View style={s.fieldWrap}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        style={s.fieldInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? label}
        placeholderTextColor="#9abca4"
      />
    </View>
  );
}

export default function ShortVideoLibraryScreen() {
  const router = useRouter();
  const [videos, setVideos]     = useState<ShortVideo[]>([]);
  const [loading, setLoading]   = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [title, setTitle]       = useState("");
  const [category, setCategory] = useState("");
  const [previewId, setPreviewId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setVideos(await getAllShortVideos());
    } catch (e: any) {
      Alert.alert("பிழை", e.message ?? "பட்டியல் ஏற்ற முடியவில்லை");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function pickAndUpload() {
    try {
      let source: string | File;
      let name: string;
      if (Platform.OS === "web") {
        const file = await pickVideoFileWeb();
        if (!file) return;
        if (file.size === 0) { Alert.alert("பிழை", `"${file.name}" வீடியோ காலியாக உள்ளது`); return; }
        source = file; name = file.name;
      } else {
        const result = await DocumentPicker.getDocumentAsync({ type: "video/*", copyToCacheDirectory: true });
        if (result.canceled || !result.assets?.[0]) return;
        const asset = result.assets[0];
        source = asset.uri; name = asset.name ?? "short.mp4";
      }

      setUploading(true); setUploadPercent(0);
      const url = await uploadShortVideo(source, `${Date.now()}_${name}`, (p: UploadProgress) => {
        setUploadPercent(p.percent);
      });

      await addShortVideo({
        videoUrl:  url,
        title:     title.trim(),
        category:  category.trim(),
        enabled:   true,
        sortOrder: videos.length,
        duration:  0,
      });

      setTitle(""); setCategory("");
      Alert.alert("✅ சேர்க்கப்பட்டது", `"${name}" Short Video Library-ல் சேமிக்கப்பட்டது`);
      await load();
    } catch (e: any) {
      Alert.alert("பிழை", e.message ?? "பதிவேற்றம் தோல்வி");
    } finally {
      setUploading(false); setUploadPercent(0);
    }
  }

  async function toggleEnabled(v: ShortVideo) {
    // Optimistic update — same pattern as the main CMS's list toggles.
    setVideos(prev => prev.map(x => x.id === v.id ? { ...x, enabled: !x.enabled } : x));
    try {
      await updateShortVideo(v.id, { enabled: !v.enabled });
    } catch (e: any) {
      Alert.alert("பிழை", e.message ?? "புதுப்பிக்க முடியவில்லை");
      await load(); // revert to server truth on failure
    }
  }

  function confirmDelete(v: ShortVideo) {
    Alert.alert(
      "நீக்கவா?",
      `"${v.title || v.id}"-ஐ Short Video Library-ல் இருந்து நீக்க வேண்டுமா? இது Firebase Storage-லிருந்தும் நீக்கப்படும்.`,
      [
        { text: "இல்லை", style: "cancel" },
        {
          text: "நீக்கு", style: "destructive",
          onPress: async () => {
            try {
              await deleteShortVideo(v.id);
              await deleteStorageFile(v.videoUrl).catch(() => {});
              setVideos(prev => prev.filter(x => x.id !== v.id));
            } catch (e: any) {
              Alert.alert("பிழை", e.message ?? "நீக்க முடியவில்லை");
            }
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={10}>
          <Ionicons name="arrow-back" size={20} color={C.txt} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>🎬 Short Video Library</Text>
          <Text style={s.headerSub}>Audio + Video Visual Mode clips — Firebase Storage</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.content}>
        {/* Upload panel */}
        <View style={s.uploadCard}>
          <Text style={s.sectionTitle}>புதிய short video சேர்</Text>
          <Field label="தலைப்பு (விருப்பம்)" value={title} onChangeText={setTitle} placeholder="எ.கா. மசூதி காட்சி" />
          <Field label="வகை (விருப்பம்)" value={category} onChangeText={setCategory} placeholder="எ.கா. nature, mosque" />
          <TouchableOpacity
            style={[s.uploadBtn, uploading && { opacity: 0.6 }]}
            onPress={pickAndUpload}
            disabled={uploading}
            activeOpacity={0.85}
          >
            {uploading ? (
              <>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={s.uploadBtnTxt}>பதிவேற்றுகிறது... {uploadPercent}%</Text>
              </>
            ) : (
              <>
                <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
                <Text style={s.uploadBtnTxt}>வீடியோ தேர்ந்தெடு & பதிவேற்று</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* List */}
        <Text style={s.sectionTitle}>
          {loading ? "ஏற்றுகிறது..." : `${videos.length} short videos`}
        </Text>

        {loading ? (
          <ActivityIndicator color={C.green} style={{ marginTop: 24 }} />
        ) : videos.length === 0 ? (
          <Text style={s.emptyTxt}>இன்னும் எந்த short video-வும் சேர்க்கப்படவில்லை.</Text>
        ) : (
          videos.map(v => (
            <View key={v.id} style={s.row}>
              <TouchableOpacity onPress={() => setPreviewId(p => p === v.id ? null : v.id)} style={s.rowThumb}>
                <Ionicons name={previewId === v.id ? "pause-circle" : "play-circle-outline"} size={28} color={C.green} />
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={s.rowTitle} numberOfLines={1}>{v.title || "(தலைப்பு இல்லை)"}</Text>
                {!!v.category && <Text style={s.rowSub} numberOfLines={1}>{v.category}</Text>}
                {previewId === v.id && (
                  <View style={s.previewBox}>
                    <VideoPlayer uri={v.videoUrl} isDark={false} />
                  </View>
                )}
              </View>
              <Switch
                value={v.enabled}
                onValueChange={() => toggleEnabled(v)}
                trackColor={{ false: "#ccc", true: C.green }}
              />
              <TouchableOpacity onPress={() => confirmDelete(v)} style={s.deleteBtn} hitSlop={8}>
                <Ionicons name="trash-outline" size={18} color={C.red} />
              </TouchableOpacity>
            </View>
          ))
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: "#fff",
  },
  backBtn: { width: 38, height: 38, borderRadius: 10, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 15, fontWeight: "800", color: C.txt },
  headerSub:   { fontSize: 11, color: C.sub, marginTop: 1 },

  content: { padding: 16 },

  uploadCard: {
    backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border,
    padding: 16, marginBottom: 20,
  },
  sectionTitle: { fontSize: 14, fontWeight: "800", color: C.txt, marginBottom: 10 },

  fieldWrap: { marginBottom: 10 },
  fieldLabel: { fontSize: 12, fontWeight: "700", color: C.sub, marginBottom: 4 },
  fieldInput: {
    borderWidth: 1, borderColor: C.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, color: C.txt, backgroundColor: "#fff",
  },

  uploadBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: C.green, borderRadius: 10, paddingVertical: 12, marginTop: 4,
  },
  uploadBtnTxt: { color: "#fff", fontSize: 14, fontWeight: "700" },

  emptyTxt: { color: C.sub, fontSize: 13, textAlign: "center", marginTop: 20 },

  row: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.border,
    padding: 12, marginBottom: 10,
  },
  rowThumb: { width: 28, alignItems: "center" },
  rowTitle: { fontSize: 13, fontWeight: "700", color: C.txt },
  rowSub:   { fontSize: 11, color: C.sub, marginTop: 1 },
  previewBox: { width: "100%", height: 160, borderRadius: 8, overflow: "hidden", marginTop: 8, backgroundColor: "#000" },
  deleteBtn: { padding: 4 },
});
