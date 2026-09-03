import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState, useEffect, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as DocumentPicker from "expo-document-picker";
import {
  addCategory, updateCategory, deleteCategory, getCategories,
  addCard, updateCard, deleteCard, getCards,
  getPodcastImageUrls, addPodcastImageUrls, removePodcastImageUrl,
  type FBCategory,
  type FBCard,
} from "@/services/firebase.firestore";
import {
  uploadAudio, uploadImage, uploadVideo, uploadDoc,
  pickAudioFileWeb, pickImageFileWeb, pickVideoFileWeb, pickDocFileWeb,
  type UploadProgress,
} from "@/services/firebase.storage";

/** True if this file is already represented in the stored URL list. */
function podcastImageUrlAlreadyStored(urls: string[], fileName: string): boolean {
  const lower = fileName.toLowerCase();
  const encoded = encodeURIComponent(fileName).toLowerCase();
  return urls.some(u => {
    try {
      const decoded = decodeURIComponent(u).toLowerCase();
      if (decoded.includes(lower)) return true;
    } catch { /* malformed URI — fall through to raw compare */ }
    return u.toLowerCase().includes(encoded) || u.toLowerCase().includes(lower);
  });
}

/** Web multi-file picker — same <input type="file"> approach as pickImageFileWeb. */
function pickPodcastImageFilesWeb(): Promise<File[]> {
  return new Promise(resolve => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = true;
    input.style.display = "none";

    input.onchange = (e: Event) => {
      const files = Array.from((e.target as HTMLInputElement).files ?? []);
      if (document.body.contains(input)) document.body.removeChild(input);
      resolve(files);
    };

    input.addEventListener("cancel", () => {
      if (document.body.contains(input)) document.body.removeChild(input);
      resolve([]);
    });

    document.body.appendChild(input);
    input.click();
  });
}

// ─── Palette ──────────────────────────────────────────────────────────────────
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

// ─── Shared Field ─────────────────────────────────────────────────────────────
function Field({ label, value, onChangeText, placeholder, multiline }: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; multiline?: boolean;
}) {
  return (
    <View style={s.fieldWrap}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        style={[s.fieldInput, multiline && { height: 80, textAlignVertical: "top" }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? label}
        placeholderTextColor="#9abca4"
        multiline={multiline}
      />
    </View>
  );
}

// ─── UploadRow ────────────────────────────────────────────────────────────────
function UploadRow({ url, label, isImage, uploading, phase, percent, onUpload, onClear }: {
  url: string; label: string; isImage?: boolean;
  uploading: boolean; phase: "reading" | "uploading"; percent: number;
  onUpload: () => void; onClear: () => void;
}) {
  if (url) {
    return (
      <View style={[s.audioRow, { backgroundColor: "#e8f5ee", borderColor: "#a8d8b8", marginBottom: 8 }]}>
        <Ionicons name="checkmark-circle" size={18} color={C.green} />
        <Text style={[s.audioTxt, { color: C.green, flex: 1 }]} numberOfLines={1}>
          {isImage ? "🖼️ " : "🔊 "}{url.split("/").pop()?.split("?")[0]}
        </Text>
        <Pressable onPress={onClear} hitSlop={8}>
          <Ionicons name="close-circle" size={16} color={C.red} />
        </Pressable>
      </View>
    );
  }
  if (uploading) {
    return (
      <View style={s.uploadProgressWrap}>
        <View style={s.audioRow}>
          <ActivityIndicator size="small" color={C.green} />
          <Text style={s.audioTxt}>
            {phase === "reading" ? "📂 கோப்பு படிக்கிறது..." : `☁️ பதிவேற்றுகிறது… ${percent}%`}
          </Text>
        </View>
        {phase === "uploading" && (
          <View style={s.progressBar}>
            <View style={[s.progressFill, { width: `${percent}%` as any }]} />
          </View>
        )}
      </View>
    );
  }
  return (
    <TouchableOpacity style={[s.btn, { backgroundColor: C.gold, marginBottom: 8 }]} onPress={onUpload}>
      <Ionicons name="cloud-upload-outline" size={16} color="#000" />
      <Text style={[s.btnTxt, { color: "#000" }]}>📁 {label}</Text>
    </TouchableOpacity>
  );
}

// ─── Breadcrumb ───────────────────────────────────────────────────────────────
function Breadcrumb({
  cat, onHome,
}: {
  cat: FBCategory | null;
  onHome: () => void;
}) {
  return (
    <View style={s.breadcrumb}>
      <Pressable onPress={onHome} hitSlop={8}>
        <Text style={[s.bcItem, !cat && s.bcActive]}>பிரிவுகள்</Text>
      </Pressable>
      {cat && (
        <>
          <Ionicons name="chevron-forward" size={12} color={C.sub} />
          <Text style={[s.bcItem, s.bcActive]} numberOfLines={1}>
            {cat.icon} {cat.name}
          </Text>
        </>
      )}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LEVEL 1 — Categories
// ═══════════════════════════════════════════════════════════════════════════════
function CategoriesView({ onSelect }: { onSelect: (cat: FBCategory) => void }) {
  const [cats,    setCats]    = useState<FBCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editId,  setEditId]  = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", nameEn: "", icon: "📖", color: "#f0bc42", description: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try { setCats(await getCategories()); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setEditId(null);
    setForm({ name: "", nameEn: "", icon: "📖", color: "#f0bc42", description: "" });
    setShowForm(true);
  }
  function openEdit(cat: FBCategory) {
    setEditId(cat.id);
    setForm({ name: cat.name, nameEn: cat.nameEn, icon: cat.icon, color: cat.color, description: cat.description });
    setShowForm(true);
  }
  function cancelForm() { setShowForm(false); setEditId(null); }

  async function save() {
    if (!form.name.trim()) { Alert.alert("தவறு", "தமிழ் பெயர் கட்டாயம்"); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(), nameEn: form.nameEn.trim(),
        icon: form.icon || "📖", color: form.color || "#f0bc42",
        description: form.description.trim(),
        sortOrder: editId ? (cats.find(c => c.id === editId)?.sortOrder ?? 99) : cats.length + 1,
      };
      if (editId) await updateCategory(editId, payload);
      else        await addCategory(payload);
      cancelForm();
      await load();
    } catch (e: any) { Alert.alert("பிழை", e.message); }
    finally { setSaving(false); }
  }

  async function remove(cat: FBCategory) {
    Alert.alert("நீக்கு", `"${cat.name}" நீக்கவா?`, [
      { text: "இல்லை", style: "cancel" },
      { text: "ஆம்", style: "destructive", onPress: async () => {
        try { await deleteCategory(cat.id); await load(); }
        catch (e: any) { Alert.alert("பிழை", e.message); }
      }},
    ]);
  }

  return (
    <ScrollView contentContainerStyle={s.mgr} showsVerticalScrollIndicator={false}>

      {/* Add/Edit form */}
      {showForm ? (
        <View style={s.formCard}>
          <Text style={s.formTitle}>{editId ? "✏️ பிரிவு திருத்து" : "➕ புதிய பிரிவு சேர்"}</Text>
          <Field label="தமிழ் பெயர் *" value={form.name}        onChangeText={v => setForm(f => ({ ...f, name: v }))}        placeholder="குர்ஆன் விளக்கம்" />
          <Field label="English Name"   value={form.nameEn}      onChangeText={v => setForm(f => ({ ...f, nameEn: v }))}      placeholder="Quran Explanation" />
          <Field label="Icon (emoji)"   value={form.icon}        onChangeText={v => setForm(f => ({ ...f, icon: v }))}        placeholder="📖" />
          <Field label="Color (hex)"    value={form.color}       onChangeText={v => setForm(f => ({ ...f, color: v }))}       placeholder="#f0bc42" />
          <Field label="விளக்கம்"       value={form.description} onChangeText={v => setForm(f => ({ ...f, description: v }))} multiline />
          <View style={s.formBtns}>
            <TouchableOpacity style={[s.btn, s.btnGray]} onPress={cancelForm}>
              <Text style={s.btnTxt}>ரத்து</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.btn, s.btnGreen, { flex: 1 }]} onPress={save} disabled={saving}>
              {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.btnTxt}>{editId ? "சேமி" : "➕ சேர்"}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity style={[s.btn, s.btnGreen, { marginBottom: 16 }]} onPress={openAdd} activeOpacity={0.85}>
          <Ionicons name="add-circle-outline" size={18} color="#fff" />
          <Text style={s.btnTxt}>+ புதிய பிரிவு சேர்</Text>
        </TouchableOpacity>
      )}

      {/* Category list */}
      <Text style={s.listTitle}>பிரிவுகள் ({cats.length}) — tap to drill in ›</Text>
      {loading ? (
        <ActivityIndicator color={C.green} style={{ marginTop: 20 }} />
      ) : cats.length === 0 ? (
        <Text style={s.emptyTxt}>இன்னும் பிரிவுகள் இல்லை.</Text>
      ) : (
        cats.map(cat => (
          <Pressable key={cat.id} onPress={() => onSelect(cat)} style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1 }]}>
            <View style={[s.listRow, { borderLeftWidth: 3, borderLeftColor: cat.color }]}>
              <Text style={s.rowIcon}>{cat.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.rowMain}>{cat.name}</Text>
                {!!cat.nameEn && <Text style={s.rowSub}>{cat.nameEn}</Text>}
              </View>
              <View style={[s.colorDot, { backgroundColor: cat.color }]} />
              <Pressable onPress={e => { e.stopPropagation(); openEdit(cat); }} style={s.iconBtn} hitSlop={10}>
                <Ionicons name="pencil" size={16} color={C.green} />
              </Pressable>
              <Pressable onPress={e => { e.stopPropagation(); remove(cat); }} style={s.iconBtn} hitSlop={10}>
                <Ionicons name="trash" size={16} color={C.red} />
              </Pressable>
              <Ionicons name="chevron-forward" size={16} color={C.sub} style={{ marginLeft: 4 }} />
            </View>
          </Pressable>
        ))
      )}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ─── Paste-format template (shown to user) ────────────────────────────────────
const PASTE_FORMAT = `Tamil Title: <text>
English Title: <text>
Description: <text>

Quiz:
Q1: <question>
A) <option>
B) <option>
C) <option>
Answer: <correct option>

Q2: <question>
A) <option>
B) <option>
C) <option>
Answer: <correct option>

(3–5 questions, or skip Quiz section completely)`;

// ─── Paste parser ─────────────────────────────────────────────────────────────
type ParsedContent = { titleTa: string; titleEn: string; description: string; quiz: import("@/services/firebase.firestore").FBQuizQuestion[] };

function parsePastedContent(raw: string): { data?: ParsedContent; error?: string } {
  const lines = raw.split("\n").map(l => l.trim());

  const pick = (prefix: string) =>
    lines.find(l => l.toLowerCase().startsWith(prefix.toLowerCase()))
      ?.slice(prefix.length).trim() ?? "";

  const titleTa    = pick("Tamil Title:");
  const titleEn    = pick("English Title:");
  const description = pick("Description:");

  if (!titleTa)    return { error: '"Tamil Title:" கண்டுபிடிக்கவில்லை' };
  if (!titleEn)    return { error: '"English Title:" கண்டுபிடிக்கவில்லை' };
  if (!description) return { error: '"Description:" கண்டுபிடிக்கவில்லை' };

  const quizStart = lines.findIndex(l => /^quiz:/i.test(l));
  const quiz: import("@/services/firebase.firestore").FBQuizQuestion[] = [];

  if (quizStart !== -1) {
    // Collect non-empty lines after "Quiz:"
    const qLines = lines.slice(quizStart + 1).filter(l => l !== "");
    let i = 0;
    while (i < qLines.length) {
      const qm = qLines[i].match(/^Q\d+[:.)]\s*(.+)/i);
      if (!qm) { i++; continue; }
      const question = qm[1].trim();

      // Scan ahead for A), B), C), Answer:
      const block = qLines.slice(i + 1, i + 10);
      const optA = block.find(l => /^A[).:]\s*/i.test(l))?.replace(/^A[).:]\s*/i, "").trim();
      const optB = block.find(l => /^B[).:]\s*/i.test(l))?.replace(/^B[).:]\s*/i, "").trim();
      const optC = block.find(l => /^C[).:]\s*/i.test(l))?.replace(/^C[).:]\s*/i, "").trim();
      const ansLine = block.find(l => /^Answer:/i.test(l));
      const ansLetter = ansLine?.replace(/^Answer:\s*/i, "").trim().toUpperCase()[0];

      if (!optA || !optB || !optC) return { error: `Q${quiz.length + 1}: A, B, C options கண்டுபிடிக்கவில்லை` };
      if (!ansLetter || !["A","B","C"].includes(ansLetter)) return { error: `Q${quiz.length + 1}: Answer: A / B / C என்று எழுதவும்` };

      quiz.push({ question, options: [optA, optB, optC], correctIndex: ["A","B","C"].indexOf(ansLetter) });
      i += 1 + block.findIndex(l => /^Answer:/i.test(l)) + 1;
    }
  }

  return { data: { titleTa, titleEn, description, quiz } };
}

// ═══════════════════════════════════════════════════════════════════════════════
// LEVEL 2 — Cards (filtered by categoryId === cat.id)
// ═══════════════════════════════════════════════════════════════════════════════
function CardsView({
  cat, router,
}: { cat: FBCategory; router: ReturnType<typeof useRouter> }) {
  const [cards,       setCards]       = useState<FBCard[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [uploading,      setUploading]      = useState<"" | "audio" | "podcast" | "video" | "slide" | "slidedoc">("");
  const [uploadPhase,    setUploadPhase]    = useState<"reading" | "uploading">("reading");
  const [uploadPercent,  setUploadPercent]  = useState(0);
  const [podcastImages,          setPodcastImages]          = useState<string[]>([]);
  const [podcastImgUploading,    setPodcastImgUploading]    = useState(false);
  const [podcastImgPhase,        setPodcastImgPhase]        = useState<"reading" | "uploading">("reading");
  const [podcastImgPercent,      setPodcastImgPercent]      = useState(0);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [showForm,      setShowForm]      = useState(false);
  const [editId,        setEditId]        = useState<string | null>(null);

  // Input mode
  const [inputMode,  setInputMode]  = useState<"manual" | "paste">("manual");
  const [pasteText,  setPasteText]  = useState("");
  const [pasteError, setPasteError] = useState("");
  const [parsedOk,   setParsedOk]   = useState(false);
  const [showFormat, setShowFormat] = useState(false);

  const [form, setForm] = useState<{
    titleTa: string; titleEn: string; description: string;
    audioUrl: string; podcastAudioUrl: string; videoUrl: string;
    readContent: string; slideImageUrl: string; slideDocUrl: string;
    quiz: import("@/services/firebase.firestore").FBQuizQuestion[];
    tracks: import("@/services/firebase.firestore").FBTrackItem[];
  }>({ titleTa: "", titleEn: "", description: "", audioUrl: "", podcastAudioUrl: "", videoUrl: "", readContent: "", slideImageUrl: "", slideDocUrl: "", quiz: [], tracks: [] });

  // ── Cards for this category (categoryId filter) ───────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try { setCards(await getCards(undefined, cat.id)); } finally { setLoading(false); }
  }, [cat.id]);

  useEffect(() => { load(); }, [load]);

  const loadPodcastImages = useCallback(async () => {
    try { setPodcastImages(await getPodcastImageUrls()); }
    catch (e: any) { console.error("[Podcast Images] load failed:", e?.message ?? e); }
  }, []);

  useEffect(() => { loadPodcastImages(); }, [loadPodcastImages]);

  function openAdd()  { setShowTypeModal(true); }
  function cancelForm() {
    setShowForm(false);
    setEditId(null);
    setForm({ titleTa: "", titleEn: "", description: "", audioUrl: "", podcastAudioUrl: "", videoUrl: "", readContent: "", slideImageUrl: "", slideDocUrl: "", quiz: [], tracks: [] });
    setInputMode("manual");
    setPasteText(""); setPasteError(""); setParsedOk(false); setShowFormat(false);
  }
  function chooseSingle() { setShowTypeModal(false); setShowForm(true); }
  function chooseBulk()   { setShowTypeModal(false); router.push("/admin/firebase/bulk-create" as any); }

  function openEdit(card: FBCard) {
    setEditId(card.id);
    setForm({
      titleTa: card.titleTa, titleEn: card.titleEn, description: card.description,
      audioUrl: card.audioUrl, podcastAudioUrl: card.podcastAudioUrl ?? "",
      videoUrl: card.videoUrl ?? "",
      readContent: card.readContent ?? "", slideImageUrl: card.slideImageUrl ?? "",
      slideDocUrl: card.slideDocUrl ?? "",
      quiz: card.quiz ?? [],
      tracks: card.tracks ?? [],
    });
    setInputMode("manual");
    setPasteText(""); setPasteError(""); setParsedOk(false); setShowFormat(false);
    setShowForm(true);
  }

  function handleParse() {
    setPasteError("");
    if (!pasteText.trim()) { setPasteError("உள்ளடக்கம் ஒட்டவும்"); return; }
    const result = parsePastedContent(pasteText);
    if (result.error) { setPasteError(result.error); setParsedOk(false); return; }
    const { titleTa, titleEn, description, quiz } = result.data!;
    setForm(f => ({ ...f, titleTa, titleEn, description, quiz }));
    setParsedOk(true);
    setPasteError("");
  }

  async function pickAndUploadAudio(field: "audioUrl" | "podcastAudioUrl") {
    try {
      let source: string | File;
      let name: string;
      if (Platform.OS === "web") {
        const file = await pickAudioFileWeb();
        if (!file) return;
        if (file.size === 0) { Alert.alert("பிழை", `"${file.name}" கோப்பு காலியாக உள்ளது`); return; }
        source = file; name = file.name;
      } else {
        const result = await DocumentPicker.getDocumentAsync({ type: "audio/*", copyToCacheDirectory: true });
        if (result.canceled || !result.assets?.[0]) return;
        const asset = result.assets[0];
        source = asset.uri; name = asset.name ?? "audio.mp3";
      }
      const uploadKey = field === "audioUrl" ? "audio" : "podcast";
      setUploading(uploadKey as any); setUploadPhase("reading"); setUploadPercent(0);
      const url = await uploadAudio(source, `${Date.now()}_${name}`, (p: UploadProgress) => {
        if (p.percent > 0) setUploadPhase("uploading");
        setUploadPercent(p.percent);
      });
      setForm(f => ({ ...f, [field]: url }));
      Alert.alert("✅ பதிவேற்றம் வெற்றி", `"${name}" Firebase Storage-ல் சேமிக்கப்பட்டது`);
    } catch (e: any) { Alert.alert("பிழை", e.message ?? "பதிவேற்றம் தோல்வி"); }
    finally { setUploading(""); setUploadPhase("reading"); }
  }

  async function pickAndUploadPodcastImages() {
    try {
      const files: Array<{ source: string | File; name: string }> = [];

      if (Platform.OS === "web") {
        const picked = await pickPodcastImageFilesWeb();
        if (!picked.length) return;
        for (const file of picked) {
          if (file.size === 0) {
            Alert.alert("பிழை", `"${file.name}" படம் காலியாக உள்ளது`);
            continue;
          }
          files.push({ source: file, name: file.name });
        }
      } else {
        const result = await DocumentPicker.getDocumentAsync({
          type: ["image/*"],
          copyToCacheDirectory: true,
          multiple: true,
        });
        if (result.canceled || !result.assets?.length) return;
        for (const asset of result.assets) {
          files.push({ source: asset.uri, name: asset.name ?? "image.jpg" });
        }
      }

      if (!files.length) return;

      const existing = podcastImages.length ? podcastImages : await getPodcastImageUrls();
      const seenNames = new Set<string>();
      const toUpload = files.filter(f => {
        const key = f.name.toLowerCase();
        if (seenNames.has(key) || podcastImageUrlAlreadyStored(existing, f.name)) return false;
        seenNames.add(key);
        return true;
      });
      const skipped = files.length - toUpload.length;

      if (!toUpload.length) {
        Alert.alert("Podcast Images", "இந்த படங்கள் ஏற்கனவே உள்ளன — மீண்டும் பதிவேற்றவில்லை.");
        return;
      }

      setPodcastImgUploading(true);
      setPodcastImgPhase("reading");
      setPodcastImgPercent(0);
      console.log("[PodcastImages] admin upload", { fileCount: toUpload.length });

      const newUrls: string[] = [];
      for (let i = 0; i < toUpload.length; i++) {
        const { source, name } = toUpload[i];
        setPodcastImgPhase("reading");
        const url = await uploadImage(source, `${Date.now()}_${name}`, (p: UploadProgress) => {
          if (p.percent > 0) setPodcastImgPhase("uploading");
          const overall = Math.round(((i + p.percent / 100) / toUpload.length) * 100);
          setPodcastImgPercent(overall);
        });
        if (!existing.includes(url) && !newUrls.includes(url)) {
          newUrls.push(url);
        }
      }

      console.log("[PodcastImages] admin upload storage urls", newUrls.length);
      if (newUrls.length) {
        const next = await addPodcastImageUrls(newUrls);
        console.log("[PodcastImages] admin firestore saved count:", next.length);
        setPodcastImages(next);
      }

      const parts = [`${newUrls.length} படம் பதிவேற்றப்பட்டது`];
      if (skipped > 0) parts.push(`${skipped} ஏற்கனவே உள்ளது`);
      Alert.alert("✅ Podcast Images", parts.join(" — "));
    } catch (e: any) {
      Alert.alert("பிழை", e.message ?? "படம் பதிவேற்றம் தோல்வி");
    } finally {
      setPodcastImgUploading(false);
      setPodcastImgPhase("reading");
      setPodcastImgPercent(0);
    }
  }

  async function deletePodcastImage(url: string) {
    Alert.alert("நீக்கு", "இந்த படத்தை நீக்கவா?", [
      { text: "இல்லை", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        try {
          const next = await removePodcastImageUrl(url);
          setPodcastImages(next);
        } catch (e: any) {
          Alert.alert("பிழை", e.message ?? "படம் நீக்க முடியவில்லை");
        }
      }},
    ]);
  }

  async function pickAndUploadSlide() {
    try {
      let source: string | File;
      let name: string;
      if (Platform.OS === "web") {
        const file = await pickImageFileWeb();
        if (!file) return;
        if (file.size === 0) { Alert.alert("பிழை", `"${file.name}" படம் காலியாக உள்ளது`); return; }
        source = file; name = file.name;
      } else {
        const result = await DocumentPicker.getDocumentAsync({
          type: ["image/*"],
          copyToCacheDirectory: true,
        });
        if (result.canceled || !result.assets?.[0]) return;
        const asset = result.assets[0];
        source = asset.uri; name = asset.name ?? "slide.jpg";
      }
      setUploading("slide"); setUploadPhase("reading"); setUploadPercent(0);
      const url = await uploadImage(source, `${Date.now()}_${name}`, (p: UploadProgress) => {
        if (p.percent > 0) setUploadPhase("uploading");
        setUploadPercent(p.percent);
      });
      setForm(f => ({ ...f, slideImageUrl: url }));
      Alert.alert("✅ படம் வெற்றி", `"${name}" Firebase Storage-ல் சேமிக்கப்பட்டது`);
    } catch (e: any) { Alert.alert("பிழை", e.message ?? "படம் பதிவேற்றம் தோல்வி"); }
    finally { setUploading(""); setUploadPhase("reading"); }
  }

  async function pickAndUploadVideo() {
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
        source = asset.uri; name = asset.name ?? "video.mp4";
      }
      setUploading("video"); setUploadPhase("reading"); setUploadPercent(0);
      const url = await uploadVideo(source, `${Date.now()}_${name}`, (p: UploadProgress) => {
        if (p.percent > 0) setUploadPhase("uploading");
        setUploadPercent(p.percent);
      });
      setForm(f => ({ ...f, videoUrl: url }));
      Alert.alert("✅ வீடியோ வெற்றி", `"${name}" Firebase Storage-ல் சேமிக்கப்பட்டது`);
    } catch (e: any) { Alert.alert("பிழை", e.message ?? "வீடியோ பதிவேற்றம் தோல்வி"); }
    finally { setUploading(""); setUploadPhase("reading"); }
  }

  async function pickAndUploadDoc() {
    try {
      let source: string | File;
      let name: string;
      if (Platform.OS === "web") {
        const file = await pickDocFileWeb();
        if (!file) return;
        if (file.size === 0) { Alert.alert("பிழை", `"${file.name}" ஆவணம் காலியாக உள்ளது`); return; }
        source = file; name = file.name;
      } else {
        const result = await DocumentPicker.getDocumentAsync({
          type: ["application/pdf"],
          copyToCacheDirectory: true,
        });
        if (result.canceled || !result.assets?.[0]) return;
        const asset = result.assets[0];
        source = asset.uri; name = asset.name ?? "slide.pdf";
      }
      setUploading("slidedoc"); setUploadPhase("reading"); setUploadPercent(0);
      const url = await uploadDoc(source, `${Date.now()}_${name}`, (p: UploadProgress) => {
        if (p.percent > 0) setUploadPhase("uploading");
        setUploadPercent(p.percent);
      });
      setForm(f => ({ ...f, slideDocUrl: url }));
      Alert.alert("✅ ஆவணம் வெற்றி", `"${name}" Firebase Storage-ல் சேமிக்கப்பட்டது`);
    } catch (e: any) { Alert.alert("பிழை", e.message ?? "ஆவணம் பதிவேற்றம் தோல்வி"); }
    finally { setUploading(""); setUploadPhase("reading"); }
  }

  async function save() {
    if (!form.titleTa.trim()) { Alert.alert("தவறு", "தமிழ் தலைப்பு கட்டாயம்"); return; }
    if (inputMode === "paste" && !parsedOk) { Alert.alert("தவறு", 'முதலில் "உள்ளடக்கம் ஏற்று" அழுத்தவும்'); return; }
    setSaving(true);
    try {
      const hasQuiz = form.quiz.length > 0;
      const existing = editId ? cards.find(c => c.id === editId) : null;
      const payload = {
        categoryId:      cat.id,
        subcategoryId:   existing?.subcategoryId ?? "",
        titleTa:         form.titleTa.trim(),
        titleEn:         form.titleEn.trim(),
        audioUrl:        form.audioUrl.trim(),
        podcastAudioUrl: form.podcastAudioUrl.trim(),
        videoUrl:        form.videoUrl.trim(),
        readContent:     form.readContent.trim(),
        slideImageUrl:   form.slideImageUrl.trim(),
        slideDocUrl:     form.slideDocUrl.trim(),
        description:     form.description.trim(),
        isPremium: false,
        hasQuiz,
        quiz:       hasQuiz ? form.quiz : [],
        quizTitleTa: "",
        quizTitleEn: "",
        tracks:      form.tracks ?? [],
        viewCount: 0, duration: 0,
        sortOrder: editId
          ? (cards.find(c => c.id === editId)?.sortOrder ?? 99)
          : cards.length + 1,
      };
      if (editId) await updateCard(editId, payload);
      else        await addCard(payload);
      cancelForm();
      await load();
    } catch (e: any) { Alert.alert("பிழை", e.message); }
    finally { setSaving(false); }
  }

  async function remove(card: FBCard) {
    Alert.alert("நீக்கு", `"${card.titleTa || card.titleEn}" நீக்கவா?`, [
      { text: "இல்லை", style: "cancel" },
      { text: "ஆம்", style: "destructive", onPress: async () => {
        try { await deleteCard(card.id); await load(); }
        catch (e: any) { Alert.alert("பிழை", e.message); }
      }},
    ]);
  }

  async function moveCard(index: number, direction: "up" | "down") {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= cards.length) return;

    const currentCard = cards[index];
    const targetCard  = cards[targetIndex];

    let newOrderCurrent = targetCard.sortOrder;
    let newOrderTarget  = currentCard.sortOrder;

    if (newOrderCurrent === newOrderTarget) {
      newOrderCurrent = targetIndex + 1;
      newOrderTarget  = index + 1;
    }

    const nextCards = [...cards];
    nextCards[index] = { ...currentCard, sortOrder: newOrderCurrent };
    nextCards[targetIndex] = { ...targetCard, sortOrder: newOrderTarget };
    nextCards.sort((a, b) => a.sortOrder - b.sortOrder);
    setCards(nextCards);

    try {
      await Promise.all([
        updateCard(currentCard.id, { sortOrder: newOrderCurrent }),
        updateCard(targetCard.id, { sortOrder: newOrderTarget }),
      ]);
    } catch (e: any) {
      Alert.alert("பிழை", e.message ?? "வரிசை மாற்ற முடியவில்லை");
      await load();
    }
  }

  return (
    <ScrollView contentContainerStyle={s.mgr} showsVerticalScrollIndicator={false}>

      {/* ── Type-selection modal ── */}
      <Modal visible={showTypeModal} transparent animationType="fade" onRequestClose={() => setShowTypeModal(false)}>
        <Pressable style={s.modalOverlay} onPress={() => setShowTypeModal(false)}>
          <Pressable style={s.modalBox} onPress={e => e.stopPropagation()}>
            <Text style={s.modalTitle}>Card சேர்க்கும் முறை</Text>
            <Text style={s.modalSub}>எந்த முறையில் Card சேர்க்க விரும்புகிறீர்கள்?</Text>

            <TouchableOpacity style={s.typeCard} onPress={chooseSingle} activeOpacity={0.8}>
              <View style={[s.typeIcon, { backgroundColor: "#e8f5ee" }]}>
                <Ionicons name="create-outline" size={26} color={C.green} />
              </View>
              <View style={s.typeInfo}>
                <Text style={s.typeTitle}>Single Card</Text>
                <Text style={s.typeSub}>ஒரே ஒரு Card-ஐ படிவம் மூலம் சேர்க்கவும்</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={C.sub} />
            </TouchableOpacity>

            <TouchableOpacity style={[s.typeCard, { borderColor: "#f0bc4244" }]} onPress={chooseBulk} activeOpacity={0.8}>
              <View style={[s.typeIcon, { backgroundColor: "#fff8e6" }]}>
                <Ionicons name="layers-outline" size={26} color={C.gold} />
              </View>
              <View style={s.typeInfo}>
                <Text style={s.typeTitle}>Bulk Card Upload</Text>
                <Text style={s.typeSub}>பல Cards-ஐ ஒரே நேரத்தில் CSV / paste மூலம் சேர்க்கவும்</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={C.sub} />
            </TouchableOpacity>

            <TouchableOpacity style={s.modalCancel} onPress={() => setShowTypeModal(false)}>
              <Text style={s.modalCancelTxt}>ரத்து</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Context badge */}
      <View style={s.ctxRow}>
        <View style={[s.ctxBadge, { borderColor: cat.color + "55", backgroundColor: cat.color + "11" }]}>
          <Text style={[s.ctxBadgeTxt, { color: cat.color }]}>{cat.icon} {cat.name}</Text>
        </View>
      </View>

      {/* Add card form or trigger button */}
      {showForm ? (
        <View style={s.formCard}>
          <Text style={s.formTitle}>{editId ? "✏️ Card திருத்து" : "➕ புதிய Card சேர்"}</Text>
          <Text style={s.lockedBadge}>📍 {cat.name}</Text>

          {/* ── Mode toggle ── */}
          <View style={s.modeToggle}>
            <Pressable
              style={[s.modeBtn, inputMode === "manual" && s.modeBtnActive]}
              onPress={() => { setInputMode("manual"); setPasteError(""); setParsedOk(false); }}
            >
              <Ionicons name="create-outline" size={15} color={inputMode === "manual" ? "#fff" : C.sub} />
              <Text style={[s.modeBtnTxt, inputMode === "manual" && { color: "#fff" }]}>✏️ Manual</Text>
            </Pressable>
            <Pressable
              style={[s.modeBtn, inputMode === "paste" && s.modeBtnActive]}
              onPress={() => setInputMode("paste")}
            >
              <Ionicons name="clipboard-outline" size={15} color={inputMode === "paste" ? "#fff" : C.sub} />
              <Text style={[s.modeBtnTxt, inputMode === "paste" && { color: "#fff" }]}>📋 Paste Content</Text>
            </Pressable>
          </View>

          {/* ════════ PASTE MODE ════════ */}
          {inputMode === "paste" && (
            <View>
              {/* Format guide toggle */}
              <View style={s.fmtHeader}>
                <Pressable style={s.fmtToggleBtn} onPress={() => setShowFormat(v => !v)}>
                  <Ionicons name={showFormat ? "chevron-up" : "chevron-down"} size={14} color={C.green} />
                  <Text style={s.fmtToggleTxt}>{showFormat ? "Format மறை" : "📄 Format காட்டு"}</Text>
                </Pressable>
              </View>

              {showFormat && (
                <View style={s.fmtBox}>
                  <Text style={s.fmtTitle}>📋 இந்த format-ல் ஒட்டவும்:</Text>
                  <Text style={s.fmtCode}>{PASTE_FORMAT}</Text>
                </View>
              )}

              {/* Paste textarea */}
              <Text style={s.fieldLabel}>உள்ளடக்கத்தை இங்கே ஒட்டவும் *</Text>
              <TextInput
                style={s.pasteArea}
                value={pasteText}
                onChangeText={t => { setPasteText(t); setParsedOk(false); setPasteError(""); }}
                placeholder={"Tamil Title: ...\nEnglish Title: ...\nDescription: ...\n\nQuiz:\nQ1: ..."}
                placeholderTextColor="#9abca4"
                multiline
                textAlignVertical="top"
              />

              {/* Error */}
              {!!pasteError && (
                <View style={s.parseError}>
                  <Ionicons name="alert-circle" size={15} color={C.red} />
                  <Text style={s.parseErrorTxt}>⚠️ {pasteError}</Text>
                </View>
              )}

              {/* Parse button */}
              <TouchableOpacity
                style={[s.btn, parsedOk ? { backgroundColor: C.green, opacity: 0.85 } : { backgroundColor: "#2563eb" }, { marginBottom: 12 }]}
                onPress={handleParse}
                activeOpacity={0.85}
              >
                <Ionicons name={parsedOk ? "checkmark-circle" : "refresh-circle-outline"} size={18} color="#fff" />
                <Text style={s.btnTxt}>{parsedOk ? "✅ ஏற்றப்பட்டது — மீண்டும் பாரு" : "✅ உள்ளடக்கம் ஏற்று"}</Text>
              </TouchableOpacity>

              {/* Parsed preview */}
              {parsedOk && (
                <View style={s.parsedPreview}>
                  <Text style={s.parsedTitle}>📝 பாரசர் முடிவு:</Text>
                  <Text style={s.parsedRow}><Text style={s.parsedKey}>Tamil Title: </Text>{form.titleTa}</Text>
                  <Text style={s.parsedRow}><Text style={s.parsedKey}>English Title: </Text>{form.titleEn}</Text>
                  <Text style={s.parsedRow}><Text style={s.parsedKey}>Description: </Text>{form.description}</Text>
                  {form.quiz.length > 0 && (
                    <Text style={s.parsedRow}>
                      <Text style={s.parsedKey}>Quiz: </Text>{form.quiz.length} கேள்விகள் ✅
                    </Text>
                  )}
                </View>
              )}
            </View>
          )}

          {/* ════════ MANUAL MODE ════════ */}
          {inputMode === "manual" && (
            <View>
              <Field label="தமிழ் தலைப்பு *" value={form.titleTa}     onChangeText={v => setForm(f => ({ ...f, titleTa: v }))}     placeholder="அல்-ஃபாத்திஹா — பாடம் 1" />
              <Field label="English Title"    value={form.titleEn}     onChangeText={v => setForm(f => ({ ...f, titleEn: v }))}     placeholder="Al-Fatiha — Lesson 1" />
              <Field label="விளக்கம்"          value={form.description} onChangeText={v => setForm(f => ({ ...f, description: v }))} multiline />
            </View>
          )}

          {/* ── 1. Explanation Audio ── */}
          <Text style={[s.sectionHeader]}>🔊 விளக்க ஒலி (Explanation Audio)</Text>
          <UploadRow
            url={form.audioUrl} label="ஒலி கோப்பு பதிவேற்று"
            uploading={uploading === "audio"} phase={uploadPhase} percent={uploadPercent}
            onUpload={() => pickAndUploadAudio("audioUrl")}
            onClear={() => setForm(f => ({ ...f, audioUrl: "" }))}
          />
          <Field label="அல்லது URL ஒட்டு" value={form.audioUrl} onChangeText={v => setForm(f => ({ ...f, audioUrl: v }))} placeholder="https://..." />

          {/* ── 2. Podcast Audio ── */}
          <Text style={[s.sectionHeader]}>🎙️ Podcast ஒலி</Text>
          <UploadRow
            url={form.podcastAudioUrl} label="Podcast கோப்பு பதிவேற்று"
            uploading={uploading === "podcast"} phase={uploadPhase} percent={uploadPercent}
            onUpload={() => pickAndUploadAudio("podcastAudioUrl")}
            onClear={() => setForm(f => ({ ...f, podcastAudioUrl: "" }))}
          />
          <Field label="அல்லது Podcast URL" value={form.podcastAudioUrl} onChangeText={v => setForm(f => ({ ...f, podcastAudioUrl: v }))} placeholder="https://..." />

          {/* ── 2b. Podcast Images (shared config collection — not stored on the card) ── */}
          <Text style={[s.sectionHeader]}>🖼️ Podcast Images</Text>
          <Text style={s.podcastImgHint}>எல்லா podcast-களுக்கும் பொதுவான படங்கள். Card-ல் சேமிக்கப்படாது.</Text>
          {podcastImages.length > 0 && (
            <View style={s.podcastImgGrid}>
              {podcastImages.map(url => (
                <View key={url} style={s.podcastImgCell}>
                  <Image source={{ uri: url }} style={s.podcastImgThumb} resizeMode="cover" />
                  <TouchableOpacity style={s.podcastImgDel} onPress={() => deletePodcastImage(url)} activeOpacity={0.85}>
                    <Text style={s.podcastImgDelTxt}>Delete</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
          {podcastImgUploading ? (
            <View style={s.uploadProgressWrap}>
              <View style={s.audioRow}>
                <ActivityIndicator size="small" color={C.green} />
                <Text style={s.audioTxt}>
                  {podcastImgPhase === "reading" ? "📂 படங்கள் படிக்கிறது..." : `☁️ பதிவேற்றுகிறது… ${podcastImgPercent}%`}
                </Text>
              </View>
              {podcastImgPhase === "uploading" && (
                <View style={s.progressBar}>
                  <View style={[s.progressFill, { width: `${podcastImgPercent}%` as any }]} />
                </View>
              )}
            </View>
          ) : (
            <TouchableOpacity style={[s.btn, { backgroundColor: C.gold, marginBottom: 8 }]} onPress={pickAndUploadPodcastImages}>
              <Ionicons name="images-outline" size={16} color="#000" />
              <Text style={[s.btnTxt, { color: "#000" }]}>📁 படங்கள் பதிவேற்று</Text>
            </TouchableOpacity>
          )}

          {/* ── 3. Video ── */}
          <Text style={[s.sectionHeader]}>🎬 வீடியோ (Video)</Text>
          <UploadRow
            url={form.videoUrl} label="வீடியோ கோப்பு பதிவேற்று (.mp4)"
            uploading={uploading === "video"} phase={uploadPhase} percent={uploadPercent}
            onUpload={pickAndUploadVideo}
            onClear={() => setForm(f => ({ ...f, videoUrl: "" }))}
          />
          <Field label="அல்லது வீடியோ URL" value={form.videoUrl} onChangeText={v => setForm(f => ({ ...f, videoUrl: v }))} placeholder="https://...  (.mp4 / YouTube-alladhu direct link)" />

          {/* ── 4. Read Content ── */}
          <Text style={[s.sectionHeader]}>📖 படிக்கும் உரை (Read Content)</Text>
          <Field label="உரை உள்ளடக்கம்" value={form.readContent} onChangeText={v => setForm(f => ({ ...f, readContent: v }))} multiline placeholder="இங்கே பாடத்தின் உரை எழுதவும்…" />

          {/* ── 5. Slide (PDF document only) ── */}
          <Text style={[s.sectionHeader]}>📄 Slide — PDF ஆவணம்</Text>
          <UploadRow
            url={form.slideDocUrl} label="PDF பதிவேற்று (.pdf)" isImage
            uploading={uploading === "slidedoc"} phase={uploadPhase} percent={uploadPercent}
            onUpload={pickAndUploadDoc}
            onClear={() => setForm(f => ({ ...f, slideDocUrl: "" }))}
          />
          <Field label="அல்லது PDF URL" value={form.slideDocUrl} onChangeText={v => setForm(f => ({ ...f, slideDocUrl: v }))} placeholder="https://....pdf" />
          <Text style={s.pdfHint}>PowerPoint (.ppt/.pptx) ஆதரிக்கப்படவில்லை — PDF ஆக மாற்றி பதிவேற்றவும்.</Text>

          {/* ── 6. Multi-Track / Multi-Part Section ── */}
          <View style={{ marginTop: 18, paddingTop: 14, borderTopWidth: 1, borderTopColor: C.border }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: C.txt }}>🎶 பல பாகங்கள் / Tracks ({form.tracks.length})</Text>
              <TouchableOpacity
                style={[s.btn, s.btnGreen, { paddingHorizontal: 12, paddingVertical: 6 }]}
                onPress={() => {
                  const newTrack: import("@/services/firebase.firestore").FBTrackItem = {
                    id: `tr_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                    titleTa: `பாகம் ${form.tracks.length + 1} (Ayah ${form.tracks.length * 5 + 1}-${(form.tracks.length + 1) * 5})`,
                    titleEn: `Track ${form.tracks.length + 1}`,
                    audioUrl: "", podcastAudioUrl: "", videoUrl: "", readContent: "", slideImageUrl: "", slideDocUrl: "", quiz: []
                  };
                  setForm(f => ({ ...f, tracks: [...f.tracks, newTrack] }));
                }}
              >
                <Ionicons name="add" size={16} color="#fff" />
                <Text style={[s.btnTxt, { fontSize: 12 }]}>+ Track சேர்</Text>
              </TouchableOpacity>
            </View>

            {form.tracks.map((tr, idx) => (
              <View key={tr.id} style={{ backgroundColor: "#f0f7f2", borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: C.border }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: C.green }}>Track #{idx + 1}</Text>
                  <TouchableOpacity
                    onPress={() => setForm(f => ({ ...f, tracks: f.tracks.filter(t => t.id !== tr.id) }))}
                    hitSlop={8}
                  >
                    <Ionicons name="trash-outline" size={16} color={C.red} />
                  </TouchableOpacity>
                </View>
                <Field
                  label="Track Tamil Title *"
                  value={tr.titleTa}
                  onChangeText={v => setForm(f => ({ ...f, tracks: f.tracks.map(t => t.id === tr.id ? { ...t, titleTa: v } : t) }))}
                  placeholder="Ayah 1-5 / பாகம் 1"
                />
                <Field
                  label="Track English Title"
                  value={tr.titleEn}
                  onChangeText={v => setForm(f => ({ ...f, tracks: f.tracks.map(t => t.id === tr.id ? { ...t, titleEn: v } : t) }))}
                  placeholder="Ayah 1-5 / Part 1"
                />
                <Field
                  label="Track Audio URL"
                  value={tr.audioUrl ?? ""}
                  onChangeText={v => setForm(f => ({ ...f, tracks: f.tracks.map(t => t.id === tr.id ? { ...t, audioUrl: v } : t) }))}
                  placeholder="https://..."
                />
                <Field
                  label="Track Podcast Audio URL"
                  value={tr.podcastAudioUrl ?? ""}
                  onChangeText={v => setForm(f => ({ ...f, tracks: f.tracks.map(t => t.id === tr.id ? { ...t, podcastAudioUrl: v } : t) }))}
                  placeholder="https://..."
                />
                <Field
                  label="Track Video URL"
                  value={tr.videoUrl ?? ""}
                  onChangeText={v => setForm(f => ({ ...f, tracks: f.tracks.map(t => t.id === tr.id ? { ...t, videoUrl: v } : t) }))}
                  placeholder="https://..."
                />
                <Field
                  label="Track Read Content"
                  value={tr.readContent ?? ""}
                  onChangeText={v => setForm(f => ({ ...f, tracks: f.tracks.map(t => t.id === tr.id ? { ...t, readContent: v } : t) }))}
                  multiline
                  placeholder="Track reading text..."
                />
                <Field
                  label="Track Slide PDF / Image URL"
                  value={tr.slideDocUrl ?? tr.slideImageUrl ?? ""}
                  onChangeText={v => setForm(f => ({ ...f, tracks: f.tracks.map(t => t.id === tr.id ? { ...t, slideDocUrl: v, slideImageUrl: v } : t) }))}
                  placeholder="https://...pdf"
                />

                {/* Track Quiz Section */}
                <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.border + "88" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <Text style={{ fontSize: 12, fontWeight: "700", color: C.green }}>
                      🧩 Track Quiz ({(tr.quiz ?? []).length} கேள்விகள்)
                    </Text>
                    <TouchableOpacity
                      style={[s.btn, s.btnGreen, { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }]}
                      onPress={() => {
                        const newQ = { question: "", options: ["Option A", "Option B", "Option C"], correctIndex: 0 };
                        const nextQuiz = [...(tr.quiz || []), newQ];
                        setForm(f => ({ ...f, tracks: f.tracks.map(t => t.id === tr.id ? { ...t, hasQuiz: true, quiz: nextQuiz } : t) }));
                      }}
                    >
                      <Text style={[s.btnTxt, { fontSize: 11 }]}>+ Q சேர்</Text>
                    </TouchableOpacity>
                  </View>
                  {(tr.quiz || []).map((q, qIdx) => (
                    <View key={qIdx} style={{ backgroundColor: "#fff", padding: 8, borderRadius: 8, marginBottom: 6, borderWidth: 1, borderColor: C.border }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <Text style={{ fontSize: 11, fontWeight: "700", color: C.txt }}>Q{qIdx + 1}</Text>
                        <TouchableOpacity
                          onPress={() => {
                            const nextQuiz = (tr.quiz || []).filter((_, i) => i !== qIdx);
                            setForm(f => ({ ...f, tracks: f.tracks.map(t => t.id === tr.id ? { ...t, hasQuiz: nextQuiz.length > 0, quiz: nextQuiz } : t) }));
                          }}
                        >
                          <Ionicons name="close-circle" size={14} color={C.red} />
                        </TouchableOpacity>
                      </View>
                      <TextInput
                        style={[s.fieldInput, { fontSize: 12, paddingVertical: 4, marginBottom: 4 }]}
                        value={q.question}
                        onChangeText={v => {
                          const nextQuiz = [...(tr.quiz || [])];
                          nextQuiz[qIdx] = { ...nextQuiz[qIdx], question: v };
                          setForm(f => ({ ...f, tracks: f.tracks.map(t => t.id === tr.id ? { ...t, quiz: nextQuiz } : t) }));
                        }}
                        placeholder="கேள்வி"
                      />
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>

          <View style={s.formBtns}>
            <TouchableOpacity style={[s.btn, s.btnGray]} onPress={cancelForm}>
              <Text style={s.btnTxt}>ரத்து</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.btn, s.btnGreen, { flex: 1 }]} onPress={save} disabled={saving}>
              {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.btnTxt}>{editId ? "சேமி" : "➕ Card சேர்"}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity style={[s.btn, s.btnGreen, { marginBottom: 16 }]} onPress={openAdd} activeOpacity={0.85}>
          <Ionicons name="add-circle-outline" size={18} color="#fff" />
          <Text style={s.btnTxt}>+ Add Card</Text>
        </TouchableOpacity>
      )}

      {/* Card list — this category */}
      <Text style={s.listTitle}>Cards ({cards.length}) — {cat.name}</Text>
      {loading ? (
        <ActivityIndicator color={C.green} style={{ marginTop: 20 }} />
      ) : cards.length === 0 ? (
        <Text style={s.emptyTxt}>இந்த பிரிவில் இன்னும் Cards இல்லை.</Text>
      ) : (
        cards.map((card, index) => (
          <View key={card.id} style={s.listRow}>
            {/* Reorder Buttons (Move Up / Move Down) */}
            <View style={{ flexDirection: "column", gap: 3, marginRight: 2 }}>
              <Pressable
                onPress={() => moveCard(index, "up")}
                disabled={index === 0}
                style={[
                  s.iconBtn,
                  { width: 26, height: 22, borderColor: C.border },
                  index === 0 && { opacity: 0.25 },
                ]}
                hitSlop={4}
              >
                <Ionicons name="arrow-up" size={13} color={C.green} />
              </Pressable>
              <Pressable
                onPress={() => moveCard(index, "down")}
                disabled={index === cards.length - 1}
                style={[
                  s.iconBtn,
                  { width: 26, height: 22, borderColor: C.border },
                  index === cards.length - 1 && { opacity: 0.25 },
                ]}
                hitSlop={4}
              >
                <Ionicons name="arrow-down" size={13} color={C.green} />
              </Pressable>
            </View>

            <View style={[s.audioIcon, { backgroundColor: card.audioUrl ? "#e8f5ee" : "#f5e8e8" }]}>
              <Ionicons name={card.audioUrl ? "musical-note" : "musical-note-outline"} size={16} color={card.audioUrl ? C.green : C.red} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.rowMain} numberOfLines={1}>{card.titleTa || card.titleEn}</Text>
              {!!card.titleEn && card.titleTa && <Text style={s.rowSub} numberOfLines={1}>{card.titleEn}</Text>}
              {card.hasQuiz && (
                <View style={s.quizPill}>
                  <Ionicons name="help-circle" size={11} color={C.green} />
                  <Text style={s.quizPillTxt}>{(card.quiz ?? []).length} கேள்விகள்</Text>
                </View>
              )}
            </View>
            <Pressable
              onPress={() => router.push(`/admin/firebase/quiz/${card.id}` as any)}
              style={[s.iconBtn, { backgroundColor: "#e8f5ee", borderColor: C.green + "55" }]}
              hitSlop={10}
            >
              <Ionicons name="help-circle-outline" size={16} color={C.green} />
            </Pressable>
            <Pressable onPress={() => openEdit(card)} style={s.iconBtn} hitSlop={10}>
              <Ionicons name="pencil" size={16} color={C.green} />
            </Pressable>
            <Pressable onPress={() => remove(card)} style={s.iconBtn} hitSlop={10}>
              <Ionicons name="trash" size={16} color={C.red} />
            </Pressable>
          </View>
        ))
      )}
      <View style={{ height: 80 }} />
    </ScrollView>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT — Drill-down navigation controller
// ═══════════════════════════════════════════════════════════════════════════════
export default function FirebaseAdminScreen() {
  const router = useRouter();
  const [selectedCat, setSelectedCat] = useState<FBCategory | null>(null);

  function goBack() {
    if (selectedCat) { setSelectedCat(null); return; }
    router.back();
  }
  function goToCategories() { setSelectedCat(null); }

  return (
    <View style={s.webWrapper}>
    <SafeAreaView style={s.safe} edges={["top"]}>

      {/* ── Header ── */}
      <View style={s.header}>
        <Pressable onPress={goBack} style={s.backBtn} hitSlop={10}>
          <Ionicons name="arrow-back" size={20} color={C.green} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>🔥 Firebase CMS</Text>
          <Breadcrumb
            cat={selectedCat}
            onHome={goToCategories}
          />
        </View>
      </View>

      {/* ── Short Video Library ── */}
      <Pressable
        style={s.shortVideoCard}
        onPress={() => router.push("/admin/firebase/short-videos")}
       
      >
        <View style={s.shortVideoIcon}>
          <Ionicons name="videocam-outline" size={24} color={C.green} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={s.shortVideoTitle}>🎬 Short Video Library</Text>
          <Text style={s.shortVideoSub}>
            Short videos upload & manage
          </Text>
        </View>

        <Ionicons
          name="chevron-forward"
          size={20}
          color={C.green}
        />
      </Pressable>

      {/* ── Drill-down: Categories → Cards ── */}
      {!selectedCat && (
        <CategoriesView
          onSelect={cat => setSelectedCat(cat)}
        />
      )}

      {selectedCat && (
        <CardsView
          cat={selectedCat}
          router={router}
        />
      )}

    </SafeAreaView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  shortVideoCard: {
  flexDirection: "row",
  alignItems: "center",
  gap: 12,
  backgroundColor: C.card,
  borderRadius: 14,
  borderWidth: 1,
  borderColor: C.border,
  padding: 14,
  marginHorizontal: 16,
  marginBottom: 16,
},

shortVideoIcon: {
  width: 46,
  height: 46,
  borderRadius: 12,
  backgroundColor: "#e8f5ee",
  alignItems: "center",
  justifyContent: "center",
},

shortVideoTitle: {
  fontSize: 15,
  fontWeight: "800",
  color: C.txt,
},

shortVideoSub: {
  fontSize: 11,
  color: C.sub,
  marginTop: 3,
},
  webWrapper: {
    flex: 1,
    backgroundColor: Platform.OS === "web" ? "#e8ede9" : C.bg,
    alignItems: Platform.OS === "web" ? "center" : "stretch",
  },
  safe: {
    flex: 1,
    backgroundColor: C.bg,
    width: Platform.OS === "web" ? 480 : "100%",
    maxWidth: Platform.OS === "web" ? 480 : undefined,
    ...(Platform.OS === "web" ? {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.15,
      shadowRadius: 20,
    } : {}),
  },

  header: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: "#fff",
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 10, borderWidth: 1,
    borderColor: C.border, alignItems: "center", justifyContent: "center",
  },
  headerTitle: { fontSize: 15, fontWeight: "800", color: C.txt },

  breadcrumb: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2, flexWrap: "wrap" },
  bcItem:     { fontSize: 11, color: C.sub },
  bcActive:   { color: C.green, fontWeight: "700" },

  mgr:  { padding: 16 },

  ctxRow:     { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" },
  ctxBadge:   { borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  ctxBadgeTxt:{ fontSize: 12, fontWeight: "700" },

  formCard:    { backgroundColor: "#fff", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border, marginBottom: 20 },
  formTitle:   { fontSize: 15, fontWeight: "800", color: C.txt, marginBottom: 14 },
  formBtns:    { flexDirection: "row", gap: 10, marginTop: 6 },
  lockedBadge: { fontSize: 11, color: C.sub, backgroundColor: "#f0f8f3", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 14 },

  fieldWrap:   { marginBottom: 12 },
  fieldLabel:  { fontSize: 12, fontWeight: "600", color: C.sub, marginBottom: 6 },
  fieldInput:  { borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: C.txt, backgroundColor: C.bg },

  btn:         { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: 12 },
  btnGreen:    { backgroundColor: C.green },
  btnGray:     { backgroundColor: "#ccc", paddingHorizontal: 20 },
  btnTxt:      { color: "#fff", fontWeight: "700", fontSize: 14 },

  audioRow:           { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 10, marginBottom: 8 },
  audioTxt:           { fontSize: 13, color: C.sub },
  audioIcon:          { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  uploadProgressWrap: { marginBottom: 12 },
  progressBar:        { height: 6, borderRadius: 3, backgroundColor: "#d4ead9", overflow: "hidden" },
  progressFill:       { height: 6, backgroundColor: C.green, borderRadius: 3 },

  listTitle:   { fontSize: 13, fontWeight: "700", color: C.sub, marginBottom: 10 },
  emptyTxt:    { textAlign: "center", color: C.sub, marginTop: 20, fontStyle: "italic" },
  listRow:     { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#fff", borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: C.border },
  rowIcon:     { fontSize: 22, width: 34 },
  rowMain:     { fontSize: 14, fontWeight: "600", color: C.txt },
  rowSub:      { fontSize: 11, color: C.sub, marginTop: 2 },
  colorDot:    { width: 14, height: 14, borderRadius: 7 },
  subDot:      { width: 10, height: 10, borderRadius: 5 },
  iconBtn:     { width: 32, height: 32, borderRadius: 8, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" },
  quizPill:    { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
  quizPillTxt: { fontSize: 10, color: C.green, fontWeight: "700" },

  sectionHeader: { fontSize: 13, fontWeight: "800", color: C.green, marginTop: 16, marginBottom: 8, borderLeftWidth: 3, borderLeftColor: C.green, paddingLeft: 8 },
  pdfHint:       { fontSize: 11, color: C.sub, marginTop: 2, fontStyle: "italic" },
  podcastImgHint:{ fontSize: 11, color: C.sub, marginTop: 2, marginBottom: 8, fontStyle: "italic" },

  podcastImgGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  podcastImgCell: { width: 76, alignItems: "center" },
  podcastImgThumb:{ width: 76, height: 76, borderRadius: 8, backgroundColor: "#e8ede9", borderWidth: 1, borderColor: C.border },
  podcastImgDel:  { marginTop: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: "#fef2f2", borderWidth: 1, borderColor: "#fca5a5" },
  podcastImgDelTxt:{ fontSize: 10, fontWeight: "700", color: C.red },

  // ── Mode toggle ──
  modeToggle:    { flexDirection: "row", borderRadius: 10, borderWidth: 1, borderColor: C.border, overflow: "hidden", marginBottom: 16 },
  modeBtn:       { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, backgroundColor: C.bg },
  modeBtnActive: { backgroundColor: C.green },
  modeBtnTxt:    { fontSize: 13, fontWeight: "700", color: C.sub },

  // ── Format guide ──
  fmtHeader:     { flexDirection: "row", justifyContent: "flex-end", marginBottom: 8 },
  fmtToggleBtn:  { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: "#e8f5ee", borderWidth: 1, borderColor: C.border },
  fmtToggleTxt:  { fontSize: 12, fontWeight: "700", color: C.green },
  fmtBox:        { backgroundColor: "#f8fff8", borderRadius: 10, borderWidth: 1, borderColor: "#b8dfc6", padding: 14, marginBottom: 12 },
  fmtTitle:      { fontSize: 12, fontWeight: "700", color: C.green, marginBottom: 8 },
  fmtCode:       { fontSize: 11, color: C.txt, lineHeight: 19, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },

  // ── Paste textarea ──
  pasteArea:     { borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 14, fontSize: 13, color: C.txt, backgroundColor: C.bg, height: 220, textAlignVertical: "top", marginBottom: 10 },

  // ── Parse feedback ──
  parseError:    { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#fef2f2", borderRadius: 8, borderWidth: 1, borderColor: "#fca5a5", padding: 10, marginBottom: 10 },
  parseErrorTxt: { fontSize: 12, color: C.red, flex: 1 },
  parsedPreview: { backgroundColor: "#f0fff6", borderRadius: 10, borderWidth: 1, borderColor: "#a7f3d0", padding: 14, marginBottom: 12 },
  parsedTitle:   { fontSize: 12, fontWeight: "800", color: C.green, marginBottom: 8 },
  parsedRow:     { fontSize: 12, color: C.txt, marginBottom: 4, lineHeight: 18 },
  parsedKey:     { fontWeight: "700", color: C.green },

  // Type-selection modal
  modalOverlay:   { flex: 1, backgroundColor: "#00000066", justifyContent: "center", alignItems: "center", padding: 24 },
  modalBox:       { width: "100%", backgroundColor: "#fff", borderRadius: 20, padding: 20, gap: 12 },
  modalTitle:     { fontSize: 17, fontWeight: "800", color: C.txt, textAlign: "center" },
  modalSub:       { fontSize: 13, color: C.sub, textAlign: "center", marginBottom: 4 },
  typeCard:       { flexDirection: "row", alignItems: "center", gap: 14, borderWidth: 1.5, borderColor: C.border, borderRadius: 14, padding: 14 },
  typeIcon:       { width: 52, height: 52, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  typeInfo:       { flex: 1 },
  typeTitle:      { fontSize: 15, fontWeight: "700", color: C.txt, marginBottom: 3 },
  typeSub:        { fontSize: 12, color: C.sub },
  modalCancel:    { alignItems: "center", paddingVertical: 12, marginTop: 4 },
  modalCancelTxt: { fontSize: 14, color: C.sub, fontWeight: "600" },
});
