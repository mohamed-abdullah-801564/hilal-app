import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  addCard,
  getCategories,
  createVirivuraiCards,
  createHadithCards,
  createImanCards,
  type FBCategory,
  type SeedResult,
} from "@/services/firebase.firestore";

// ─── Palette ──────────────────────────────────────────────────────────────────

const C = {
  green:  "#1a7a4a",
  gold:   "#f0bc42",
  red:    "#ef4444",
  blue:   "#2563eb",
  bg:     "#f4faf6",
  card:   "#ffffff",
  border: "#d4ead9",
  txt:    "#0d2414",
  sub:    "#5a7a64",
  valid:  "#16a34a",
};

// ─── Surah seed data ──────────────────────────────────────────────────────────

interface SurahSeed {
  titleEn:  string;
  titleTa:  string;
  sortOrder: number;
}

const SURAHS: SurahSeed[] = [
  { titleEn: "Al-Fatiha",  titleTa: "அல்-ஃபாத்திஹா",  sortOrder: 1  },
  { titleEn: "An-Nas",     titleTa: "அன்-நாஸ்",         sortOrder: 2  },
  { titleEn: "Al-Falaq",   titleTa: "அல்-ஃபலக்",        sortOrder: 3  },
  { titleEn: "Al-Ikhlas",  titleTa: "அல்-இக்லாஸ்",      sortOrder: 4  },
  { titleEn: "Al-Lahab",   titleTa: "அல்-லஹப்",          sortOrder: 5  },
  { titleEn: "Al-Fath",    titleTa: "அல்-ஃபத்ஹ்",        sortOrder: 6  },
  { titleEn: "Al-Kafirun", titleTa: "அல்-காஃபிரூன்",    sortOrder: 7  },
  { titleEn: "Al-Kawthar", titleTa: "அல்-கவ்ஸர்",       sortOrder: 8  },
  { titleEn: "Al-Ma'un",   titleTa: "அல்-மாஊன்",         sortOrder: 9  },
  { titleEn: "Quraysh",    titleTa: "குறைஷ்",            sortOrder: 10 },
];

// ─── Card status per surah ────────────────────────────────────────────────────

type CardStatus = "idle" | "creating" | "done" | "error";

interface CardState {
  surah:    SurahSeed;
  selected: boolean;
  status:   CardStatus;
  docId:    string | null;
  error:    string | null;
}

// ─── Reusable bulk create function ───────────────────────────────────────────

/**
 * bulkCreateSurahCards
 *
 * Creates one Firestore card per surah under the given category.
 * audioUrl is left empty — admin fills it later via the card editor.
 * hasQuiz is true — quiz questions are pasted later via the quiz editor.
 *
 * @param categoryId - Firestore ID of the target category
 * @param surahs     - Array of { titleEn, titleTa, sortOrder }
 * @param onProgress - Called after each card with its index and result
 */
export async function bulkCreateSurahCards(
  categoryId:    string,
  surahs:        SurahSeed[],
  onProgress:    (idx: number, docId: string | null, error: string | null) => void,
): Promise<{ created: number; failed: number }> {
  let created = 0;
  let failed  = 0;

  for (let i = 0; i < surahs.length; i++) {
    const s = surahs[i];
    try {
      const docId = await addCard({
        categoryId,
        subcategoryId: "",
        titleEn:      s.titleEn,
        titleTa:      s.titleTa,
        audioUrl:     "",          // filled later by admin
        podcastAudioUrl: "",
        videoUrl:     "",
        readContent:  "",
        slideImageUrl: "",
        slideDocUrl:  "",
        duration:     0,
        description:  "",
        isPremium:    false,
        hasQuiz:      true,        // quiz will be pasted later
        viewCount:    0,
        sortOrder:    s.sortOrder,
        quiz:         [],
        quizTitleTa:  "",
        quizTitleEn:  "",
      });
      created++;
      onProgress(i, docId, null);
    } catch (err: any) {
      failed++;
      onProgress(i, null, err?.message ?? "Unknown error");
    }
  }

  return { created, failed };
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function BulkCreateScreen() {
  const router = useRouter();

  const [cats,       setCats]       = useState<FBCategory[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(true);

  const [selectedCatId, setSelectedCatId] = useState<string>("");

  const [cards,    setCards]    = useState<CardState[]>(
    SURAHS.map(s => ({ surah: s, selected: true, status: "idle", docId: null, error: null }))
  );
  const [running,  setRunning]  = useState(false);
  const [finished, setFinished] = useState(false);

  // ── Quick Seed state (Virivurai) ──
  const [quickRunning, setQuickRunning] = useState(false);
  const [quickResult,  setQuickResult]  = useState<SeedResult | null>(null);
  const [quickError,   setQuickError]   = useState<string | null>(null);

  // ── Quick Seed state (Hadith) ──
  const [hadithRunning, setHadithRunning] = useState(false);
  const [hadithResult,  setHadithResult]  = useState<SeedResult | null>(null);
  const [hadithError,   setHadithError]   = useState<string | null>(null);

  // ── Quick Seed state (Iman) ──
  const [imanRunning, setImanRunning] = useState(false);
  const [imanResult,  setImanResult]  = useState<SeedResult | null>(null);
  const [imanError,   setImanError]   = useState<string | null>(null);

  // ── Load categories and subcategories ──

  const loadMeta = useCallback(async () => {
    setLoadingMeta(true);
    try {
      const c = await getCategories();
      setCats(c);

      const quranCat = c.find(x =>
        x.nameEn?.toLowerCase().includes("quran") ||
        x.name?.toLowerCase().includes("குர்")
      );
      if (quranCat) {
        setSelectedCatId(quranCat.id);
      }
    } finally {
      setLoadingMeta(false);
    }
  }, []);

  useEffect(() => { loadMeta(); }, [loadMeta]);

  // ── Toggle individual card selection ──

  function toggleCard(idx: number) {
    if (running || finished) return;
    setCards(prev => prev.map((c, i) => i === idx ? { ...c, selected: !c.selected } : c));
  }

  function selectAll()   { setCards(prev => prev.map(c => ({ ...c, selected: true  }))); }
  function deselectAll() { setCards(prev => prev.map(c => ({ ...c, selected: false }))); }

  const selectedCount = cards.filter(c => c.selected).length;
  const doneCount     = cards.filter(c => c.status === "done").length;
  const errorCount    = cards.filter(c => c.status === "error").length;

  // ── Quick Seed: createImanCards() ──

  async function handleImanSeed() {
    Alert.alert(
      "ஈமான் Seed",
      '"Fundamental of iman" → "ஈமானின் கடமைகள்" subcategory-ல் 16 ஈமான் cards உருவாக்கவா?\n\n' +
      "முதல் 6 cards இலவசம், மீதி 10 Premium.\n" +
      "ஏற்கனவே உள்ள cards skip ஆகும் (duplicate இல்லை).",
      [
        { text: "இல்லை", style: "cancel" },
        {
          text: "ஆம், உருவாக்கு",
          onPress: async () => {
            setImanRunning(true);
            setImanResult(null);
            setImanError(null);
            try {
              const result = await createImanCards();
              setImanResult(result);
            } catch (err: any) {
              const msg = err?.message ?? "Unknown error";
              setImanError(msg);
              console.error("[ImanSeed] Failed:", msg);
            } finally {
              setImanRunning(false);
            }
          },
        },
      ]
    );
  }

  // ── Quick Seed: createHadithCards() ──

  async function handleHadithSeed() {
    Alert.alert(
      "ஹதீஸ் Seed",
      'Hadith → "ஹதீஸ் விரிவுரை" subcategory-ல் 10 ஹதீஸ் cards உருவாக்கவா?\n\n' +
      "ஏற்கனவே உள்ள cards skip ஆகும் (duplicate இல்லை).",
      [
        { text: "இல்லை", style: "cancel" },
        {
          text: "ஆம், உருவாக்கு",
          onPress: async () => {
            setHadithRunning(true);
            setHadithResult(null);
            setHadithError(null);
            try {
              const result = await createHadithCards();
              setHadithResult(result);
            } catch (err: any) {
              const msg = err?.message ?? "Unknown error";
              setHadithError(msg);
              console.error("[HadithSeed] Failed:", msg);
            } finally {
              setHadithRunning(false);
            }
          },
        },
      ]
    );
  }

  // ── Quick Seed: createVirivuraiCards() ──

  async function handleQuickSeed() {
    Alert.alert(
      "விரிவுரை Seed",
      'Quran → "விரிவுரை" subcategory-ல் 10 சூரா cards உருவாக்கவா?\n\n' +
      "ஏற்கனவே உள்ள cards skip ஆகும் (duplicate இல்லை).",
      [
        { text: "இல்லை", style: "cancel" },
        {
          text: "ஆம், உருவாக்கு",
          onPress: async () => {
            setQuickRunning(true);
            setQuickResult(null);
            setQuickError(null);
            try {
              const result = await createVirivuraiCards();
              setQuickResult(result);
            } catch (err: any) {
              const msg = err?.message ?? "Unknown error";
              setQuickError(msg);
              console.error("[QuickSeed] Failed:", msg);
            } finally {
              setQuickRunning(false);
            }
          },
        },
      ]
    );
  }

  // ── Run bulk create ──

  async function handleCreate() {
    if (!selectedCatId) { Alert.alert("தவறு", "Category தேர்ந்தெடுங்கள்"); return; }
    if (selectedCount === 0) { Alert.alert("தவறு", "குறைந்தது ஒரு card தேர்ந்தெடுங்கள்"); return; }

    const catName = cats.find(c => c.id === selectedCatId)?.nameEn ?? "";

    Alert.alert(
      "உருவாக்கவா?",
      `${selectedCount} cards\nCategory: ${catName}\n\nFirestore-ல் சேர்க்கப்படும். தொடரவா?`,
      [
        { text: "இல்லை", style: "cancel" },
        { text: "ஆம், உருவாக்கு", onPress: runCreate },
      ]
    );
  }

  async function runCreate() {
    setRunning(true);
    setFinished(false);

    // Mark selected cards as "creating"
    setCards(prev => prev.map(c => c.selected ? { ...c, status: "creating" } : c));

    const selectedSurahs = cards
      .map((c, idx) => ({ ...c, idx }))
      .filter(c => c.selected);

    for (const { surah, idx } of selectedSurahs) {
      try {
        const docId = await addCard({
          categoryId:    selectedCatId,
          subcategoryId: "",
          titleEn:       surah.titleEn,
          titleTa:       surah.titleTa,
          audioUrl:      "",
          podcastAudioUrl: "",
          videoUrl:      "",
          readContent:   "",
          slideImageUrl: "",
          slideDocUrl:   "",
          duration:      0,
          description:   "",
          isPremium:     false,
          hasQuiz:       true,
          viewCount:     0,
          sortOrder:     surah.sortOrder,
          quiz:          [],
          quizTitleTa:   "",
          quizTitleEn:   "",
        });
        setCards(prev => prev.map((c, i) =>
          i === idx ? { ...c, status: "done", docId, error: null } : c
        ));
      } catch (err: any) {
        setCards(prev => prev.map((c, i) =>
          i === idx ? { ...c, status: "error", docId: null, error: err?.message ?? "Failed" } : c
        ));
      }
    }

    setRunning(false);
    setFinished(true);
  }

  function handleReset() {
    setCards(SURAHS.map(s => ({ surah: s, selected: true, status: "idle", docId: null, error: null })));
    setFinished(false);
  }

  // ── Status icon helper ──

  function StatusIcon({ status }: { status: CardStatus }) {
    if (status === "creating") return <ActivityIndicator size="small" color={C.blue} />;
    if (status === "done")     return <Ionicons name="checkmark-circle" size={20} color={C.valid} />;
    if (status === "error")    return <Ionicons name="close-circle"     size={20} color={C.red}   />;
    return null;
  }

  // ── Render ──

  if (loadingMeta) {
    return (
      <SafeAreaView style={s.safe} edges={["top"]}>
        <View style={s.center}>
          <ActivityIndicator size="large" color={C.green} />
          <Text style={s.centerTxt}>Firestore ஏற்றுகிறது...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      {/* ── Header ── */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={10}>
          <Ionicons name="arrow-back" size={20} color={C.green} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>📦 Bulk Create Cards</Text>
          <Text style={s.headerSub}>10 சூரா cards — Firestore-ல் சேர்</Text>
        </View>
        {finished && (
          <View style={[s.badge, { backgroundColor: errorCount > 0 ? "#fef2f2" : "#dcfce7", borderColor: errorCount > 0 ? C.red : C.valid }]}>
            <Text style={[s.badgeTxt, { color: errorCount > 0 ? C.red : C.valid }]}>
              {doneCount}/{selectedCount} ✓
            </Text>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Quick Seed Panel ── */}
        <View style={s.quickPanel}>
          <View style={s.quickHeader}>
            <View style={s.quickIconWrap}>
              <Ionicons name="flash" size={20} color={C.gold} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.quickTitle}>விரிவுரை Quick Seed</Text>
              <Text style={s.quickSub}>
                Quran → விரிவுரை — 10 சூரா cards auto-create
              </Text>
            </View>
          </View>

          {/* Info row */}
          <View style={s.quickInfo}>
            <View style={s.quickInfoItem}>
              <Ionicons name="search-outline" size={13} color={C.blue} />
              <Text style={s.quickInfoTxt}>Auto-detects category & subcategory by name</Text>
            </View>
            <View style={s.quickInfoItem}>
              <Ionicons name="shield-checkmark-outline" size={13} color={C.valid} />
              <Text style={s.quickInfoTxt}>Duplicate-safe — existing cards are skipped</Text>
            </View>
            <View style={s.quickInfoItem}>
              <Ionicons name="layers-outline" size={13} color={C.sub} />
              <Text style={s.quickInfoTxt}>Calls createVirivuraiCards() from Firestore service</Text>
            </View>
          </View>

          {/* Quick seed button */}
          {!quickResult && !quickError && (
            <TouchableOpacity
              style={[s.quickBtn, quickRunning && s.quickBtnRunning]}
              onPress={handleQuickSeed}
              disabled={quickRunning}
              activeOpacity={0.85}
            >
              {quickRunning ? (
                <>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={s.quickBtnTxt}>உருவாக்குகிறது...</Text>
                </>
              ) : (
                <>
                  <Ionicons name="rocket-outline" size={18} color="#fff" />
                  <Text style={s.quickBtnTxt}>ஒரே click-ல் 10 Cards உருவாக்கு</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Quick seed error */}
          {quickError && (
            <View style={s.quickErrBox}>
              <Ionicons name="alert-circle" size={18} color={C.red} />
              <View style={{ flex: 1 }}>
                <Text style={s.quickErrTitle}>பிழை ஏற்பட்டது</Text>
                <Text style={s.quickErrMsg}>{quickError}</Text>
                <Text style={s.quickErrHint}>
                  Firebase CMS-ல் "Quran" category மற்றும் "விரிவுரை" subcategory உருவாக்கியுள்ளீர்களா என்று சரிபார்க்கவும்.
                </Text>
              </View>
              <Pressable onPress={() => setQuickError(null)} hitSlop={8}>
                <Ionicons name="refresh" size={20} color={C.red} />
              </Pressable>
            </View>
          )}

          {/* Quick seed success result */}
          {quickResult && (
            <View style={s.quickResultBox}>
              <View style={s.quickResultHeader}>
                <Ionicons name="checkmark-circle" size={22} color={C.valid} />
                <Text style={s.quickResultTitle}>
                  {quickResult.created.length === 0
                    ? "எல்லாம் ஏற்கனவே உள்ளன"
                    : `${quickResult.created.length} Cards உருவாக்கப்பட்டன!`}
                </Text>
              </View>

              {/* IDs */}
              <View style={s.quickIdRow}>
                <Text style={s.quickIdLabel}>Category ID:</Text>
                <Text style={s.quickIdVal} numberOfLines={1}>{quickResult.categoryId}</Text>
              </View>
              <View style={s.quickIdRow}>
                <Text style={s.quickIdLabel}>Subcategory ID:</Text>
                <Text style={s.quickIdVal} numberOfLines={1}>{quickResult.subcategoryId}</Text>
              </View>

              {/* Created list */}
              {quickResult.created.length > 0 && (
                <View style={s.quickListBlock}>
                  <Text style={s.quickListLabel}>✅ உருவாக்கப்பட்டவை ({quickResult.created.length})</Text>
                  {quickResult.created.map((t, i) => (
                    <Text key={i} style={[s.quickListItem, { color: C.valid }]}>• {t}</Text>
                  ))}
                </View>
              )}

              {/* Skipped list */}
              {quickResult.skipped.length > 0 && (
                <View style={s.quickListBlock}>
                  <Text style={s.quickListLabel}>⏭ Skip ஆனவை ({quickResult.skipped.length})</Text>
                  {quickResult.skipped.map((t, i) => (
                    <Text key={i} style={[s.quickListItem, { color: C.sub }]}>• {t}</Text>
                  ))}
                </View>
              )}

              {/* Errors */}
              {quickResult.errors.length > 0 && (
                <View style={s.quickListBlock}>
                  <Text style={s.quickListLabel}>❌ பிழை ({quickResult.errors.length})</Text>
                  {quickResult.errors.map((e, i) => (
                    <Text key={i} style={[s.quickListItem, { color: C.red }]}>• {e.titleEn}: {e.message}</Text>
                  ))}
                </View>
              )}

              <Pressable onPress={() => setQuickResult(null)} style={s.quickResetLink} hitSlop={8}>
                <Ionicons name="refresh-outline" size={14} color={C.sub} />
                <Text style={s.quickResetTxt}>மீண்டும் இயக்கு</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* ── Hadith Quick Seed Panel ── */}
        <View style={[s.quickPanel, { marginTop: 12 }]}>
          <View style={s.quickHeader}>
            <View style={[s.quickIconWrap, { backgroundColor: "#8b5cf622" }]}>
              <Ionicons name="book" size={20} color="#8b5cf6" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.quickTitle}>ஹதீஸ் Quick Seed</Text>
              <Text style={s.quickSub}>
                Hadith → ஹதீஸ் விரிவுரை — 10 ஹதீஸ் cards auto-create
              </Text>
            </View>
          </View>

          <View style={s.quickInfo}>
            <View style={s.quickInfoItem}>
              <Ionicons name="search-outline" size={13} color={C.blue} />
              <Text style={s.quickInfoTxt}>Auto-detects Hadith category & ஹதீஸ் விரிவுரை subcategory</Text>
            </View>
            <View style={s.quickInfoItem}>
              <Ionicons name="shield-checkmark-outline" size={13} color={C.valid} />
              <Text style={s.quickInfoTxt}>Duplicate-safe — existing cards are skipped</Text>
            </View>
            <View style={s.quickInfoItem}>
              <Ionicons name="layers-outline" size={13} color={C.sub} />
              <Text style={s.quickInfoTxt}>Calls createHadithCards() from Firestore service</Text>
            </View>
          </View>

          {!hadithResult && !hadithError && (
            <TouchableOpacity
              style={[s.quickBtn, { backgroundColor: "#8b5cf6" }, hadithRunning && s.quickBtnRunning]}
              onPress={handleHadithSeed}
              disabled={hadithRunning}
              activeOpacity={0.85}
            >
              {hadithRunning ? (
                <>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={s.quickBtnTxt}>உருவாக்குகிறது...</Text>
                </>
              ) : (
                <>
                  <Ionicons name="rocket-outline" size={18} color="#fff" />
                  <Text style={s.quickBtnTxt}>ஒரே click-ல் 10 ஹதீஸ் Cards உருவாக்கு</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {hadithError && (
            <View style={s.quickErrBox}>
              <Ionicons name="alert-circle" size={18} color={C.red} />
              <View style={{ flex: 1 }}>
                <Text style={s.quickErrTitle}>பிழை ஏற்பட்டது</Text>
                <Text style={s.quickErrMsg}>{hadithError}</Text>
                <Text style={s.quickErrHint}>
                  Firebase CMS-ல் "Hadith" category மற்றும் "ஹதீஸ் விரிவுரை" subcategory உருவாக்கியுள்ளீர்களா என்று சரிபார்க்கவும்.
                </Text>
              </View>
              <Pressable onPress={() => setHadithError(null)} hitSlop={8}>
                <Ionicons name="refresh" size={20} color={C.red} />
              </Pressable>
            </View>
          )}

          {hadithResult && (
            <View style={s.quickResultBox}>
              <View style={s.quickResultHeader}>
                <Ionicons name="checkmark-circle" size={22} color={C.valid} />
                <Text style={s.quickResultTitle}>
                  {hadithResult.created.length === 0
                    ? "எல்லாம் ஏற்கனவே உள்ளன"
                    : `${hadithResult.created.length} ஹதீஸ் Cards உருவாக்கப்பட்டன!`}
                </Text>
              </View>
              <View style={s.quickIdRow}>
                <Text style={s.quickIdLabel}>Category ID:</Text>
                <Text style={s.quickIdVal} numberOfLines={1}>{hadithResult.categoryId}</Text>
              </View>
              <View style={s.quickIdRow}>
                <Text style={s.quickIdLabel}>Subcategory ID:</Text>
                <Text style={s.quickIdVal} numberOfLines={1}>{hadithResult.subcategoryId}</Text>
              </View>
              {hadithResult.created.length > 0 && (
                <View style={s.quickListBlock}>
                  <Text style={s.quickListLabel}>✅ உருவாக்கப்பட்டவை ({hadithResult.created.length})</Text>
                  {hadithResult.created.map((t, i) => (
                    <Text key={i} style={[s.quickListItem, { color: C.valid }]}>• {t}</Text>
                  ))}
                </View>
              )}
              {hadithResult.skipped.length > 0 && (
                <View style={s.quickListBlock}>
                  <Text style={s.quickListLabel}>⏭ Skip ஆனவை ({hadithResult.skipped.length})</Text>
                  {hadithResult.skipped.map((t, i) => (
                    <Text key={i} style={[s.quickListItem, { color: C.sub }]}>• {t}</Text>
                  ))}
                </View>
              )}
              {hadithResult.errors.length > 0 && (
                <View style={s.quickListBlock}>
                  <Text style={s.quickListLabel}>❌ பிழை ({hadithResult.errors.length})</Text>
                  {hadithResult.errors.map((e, i) => (
                    <Text key={i} style={[s.quickListItem, { color: C.red }]}>• {e.titleEn}: {e.message}</Text>
                  ))}
                </View>
              )}
              <Pressable onPress={() => setHadithResult(null)} style={s.quickResetLink} hitSlop={8}>
                <Ionicons name="refresh-outline" size={14} color={C.sub} />
                <Text style={s.quickResetTxt}>மீண்டும் இயக்கு</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* ── Iman Quick Seed Panel ── */}
        <View style={[s.quickPanel, { marginTop: 12 }]}>
          <View style={s.quickHeader}>
            <View style={[s.quickIconWrap, { backgroundColor: "#f59e0b22" }]}>
              <Ionicons name="star" size={20} color="#f59e0b" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.quickTitle}>ஈமான் Quick Seed</Text>
              <Text style={s.quickSub}>
                Fundamental of iman → ஈமானின் கடமைகள் — 16 cards (6 Free + 10 Premium)
              </Text>
            </View>
          </View>

          <View style={s.quickInfo}>
            <View style={s.quickInfoItem}>
              <Ionicons name="search-outline" size={13} color={C.blue} />
              <Text style={s.quickInfoTxt}>Auto-detects "Fundamental of iman" category & subcategory</Text>
            </View>
            <View style={s.quickInfoItem}>
              <Ionicons name="shield-checkmark-outline" size={13} color={C.valid} />
              <Text style={s.quickInfoTxt}>Duplicate-safe — existing cards are skipped</Text>
            </View>
            <View style={s.quickInfoItem}>
              <Ionicons name="lock-closed-outline" size={13} color="#f59e0b" />
              <Text style={s.quickInfoTxt}>Cards 7–16 are automatically set as Premium</Text>
            </View>
          </View>

          {!imanResult && !imanError && (
            <TouchableOpacity
              style={[s.quickBtn, { backgroundColor: "#d97706" }, imanRunning && s.quickBtnRunning]}
              onPress={handleImanSeed}
              disabled={imanRunning}
              activeOpacity={0.85}
            >
              {imanRunning ? (
                <>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={s.quickBtnTxt}>உருவாக்குகிறது...</Text>
                </>
              ) : (
                <>
                  <Ionicons name="rocket-outline" size={18} color="#fff" />
                  <Text style={s.quickBtnTxt}>ஒரே click-ல் 16 ஈமான் Cards உருவாக்கு</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {imanError && (
            <View style={s.quickErrBox}>
              <Ionicons name="alert-circle" size={18} color={C.red} />
              <View style={{ flex: 1 }}>
                <Text style={s.quickErrTitle}>பிழை ஏற்பட்டது</Text>
                <Text style={s.quickErrMsg}>{imanError}</Text>
                <Text style={s.quickErrHint}>
                  Firebase CMS-ல் "Fundamental of iman" category மற்றும் "ஈமானின் கடமைகள்" subcategory உருவாக்கியுள்ளீர்களா என்று சரிபார்க்கவும்.
                </Text>
              </View>
              <Pressable onPress={() => setImanError(null)} hitSlop={8}>
                <Ionicons name="refresh" size={20} color={C.red} />
              </Pressable>
            </View>
          )}

          {imanResult && (
            <View style={s.quickResultBox}>
              <View style={s.quickResultHeader}>
                <Ionicons name="checkmark-circle" size={22} color={C.valid} />
                <Text style={s.quickResultTitle}>
                  {imanResult.created.length === 0
                    ? "எல்லாம் ஏற்கனவே உள்ளன"
                    : `${imanResult.created.length} ஈமான் Cards உருவாக்கப்பட்டன!`}
                </Text>
              </View>
              <View style={s.quickIdRow}>
                <Text style={s.quickIdLabel}>Category ID:</Text>
                <Text style={s.quickIdVal} numberOfLines={1}>{imanResult.categoryId}</Text>
              </View>
              <View style={s.quickIdRow}>
                <Text style={s.quickIdLabel}>Subcategory ID:</Text>
                <Text style={s.quickIdVal} numberOfLines={1}>{imanResult.subcategoryId}</Text>
              </View>
              {imanResult.created.length > 0 && (
                <View style={s.quickListBlock}>
                  <Text style={s.quickListLabel}>✅ உருவாக்கப்பட்டவை ({imanResult.created.length})</Text>
                  {imanResult.created.map((t, i) => (
                    <Text key={i} style={[s.quickListItem, { color: C.valid }]}>• {t}</Text>
                  ))}
                </View>
              )}
              {imanResult.skipped.length > 0 && (
                <View style={s.quickListBlock}>
                  <Text style={s.quickListLabel}>⏭ Skip ஆனவை ({imanResult.skipped.length})</Text>
                  {imanResult.skipped.map((t, i) => (
                    <Text key={i} style={[s.quickListItem, { color: C.sub }]}>• {t}</Text>
                  ))}
                </View>
              )}
              {imanResult.errors.length > 0 && (
                <View style={s.quickListBlock}>
                  <Text style={s.quickListLabel}>❌ பிழை ({imanResult.errors.length})</Text>
                  {imanResult.errors.map((e, i) => (
                    <Text key={i} style={[s.quickListItem, { color: C.red }]}>• {e.titleEn}: {e.message}</Text>
                  ))}
                </View>
              )}
              <Pressable onPress={() => setImanResult(null)} style={s.quickResetLink} hitSlop={8}>
                <Ionicons name="refresh-outline" size={14} color={C.sub} />
                <Text style={s.quickResetTxt}>மீண்டும் இயக்கு</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Divider */}
        <View style={s.divider}>
          <View style={s.dividerLine} />
          <Text style={s.dividerTxt}>அல்லது கைமுறை தேர்வு</Text>
          <View style={s.dividerLine} />
        </View>

        {/* ── Category picker ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>📁 Category தேர்ந்தெடு</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipRow}>
            {cats.map(cat => (
              <Pressable
                key={cat.id}
                onPress={() => { if (!running && !finished) setSelectedCatId(cat.id); }}
                style={[s.chip, selectedCatId === cat.id && s.chipActive]}
              >
                <Text style={s.chipIcon}>{cat.icon}</Text>
                <Text style={[s.chipTxt, selectedCatId === cat.id && s.chipTxtActive]}>
                  {cat.nameEn || cat.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          {cats.length === 0 && (
            <Text style={s.emptyTxt}>Firestore-ல் category இல்லை</Text>
          )}
        </View>

        {/* ── Target summary banner ── */}
        {selectedCatId && (
          <View style={s.targetBanner}>
            <Ionicons name="location-outline" size={16} color={C.green} />
            <View style={{ flex: 1 }}>
              <Text style={s.targetTxt}>
                {cats.find(c => c.id === selectedCatId)?.nameEn ?? ""}
              </Text>
              <Text style={s.targetSub}>இந்த பிரிவில் cards உருவாக்கப்படும்</Text>
            </View>
          </View>
        )}

        {/* ── Card list ── */}
        <View style={s.section}>
          <View style={s.listHeader}>
            <Text style={s.sectionTitle}>🕌 சூரா பட்டியல் ({selectedCount}/{SURAHS.length})</Text>
            {!running && !finished && (
              <View style={s.selectBtns}>
                <Pressable onPress={selectAll} style={s.selectBtn} hitSlop={8}>
                  <Text style={s.selectBtnTxt}>எல்லாம்</Text>
                </Pressable>
                <Text style={{ color: C.sub }}>|</Text>
                <Pressable onPress={deselectAll} style={s.selectBtn} hitSlop={8}>
                  <Text style={s.selectBtnTxt}>நீக்கு</Text>
                </Pressable>
              </View>
            )}
          </View>

          {cards.map((card, idx) => {
            const isSelected = card.selected;
            const statusColor =
              card.status === "done"    ? C.valid :
              card.status === "error"   ? C.red   :
              card.status === "creating"? C.blue  :
              isSelected                ? C.green : C.sub;

            return (
              <Pressable
                key={idx}
                onPress={() => toggleCard(idx)}
                style={[
                  s.cardRow,
                  isSelected && card.status === "idle" && s.cardRowSelected,
                  card.status === "done"     && s.cardRowDone,
                  card.status === "error"    && s.cardRowError,
                  card.status === "creating" && s.cardRowCreating,
                ]}
                disabled={running || finished}
              >
                {/* Checkbox / status */}
                <View style={[s.checkbox, { borderColor: statusColor, backgroundColor: isSelected ? statusColor + "18" : "#f4faf6" }]}>
                  {card.status === "idle" && isSelected && (
                    <Ionicons name="checkmark" size={14} color={C.green} />
                  )}
                  {card.status !== "idle" && <StatusIcon status={card.status} />}
                </View>

                {/* Card info */}
                <View style={{ flex: 1 }}>
                  <View style={s.cardTitleRow}>
                    <Text style={[s.cardNumBadge, { color: statusColor }]}>#{card.surah.sortOrder}</Text>
                    <Text style={[s.cardTitleEn, { color: isSelected || card.status !== "idle" ? C.txt : C.sub }]}>
                      {card.surah.titleEn}
                    </Text>
                  </View>
                  <Text style={[s.cardTitleTa, { color: isSelected || card.status !== "idle" ? C.sub : "#aaa" }]}>
                    {card.surah.titleTa}
                  </Text>

                  {/* Status messages */}
                  {card.status === "creating" && (
                    <Text style={[s.statusTxt, { color: C.blue }]}>உருவாக்குகிறது...</Text>
                  )}
                  {card.status === "done" && (
                    <Text style={[s.statusTxt, { color: C.valid }]}>✅ உருவாக்கப்பட்டது</Text>
                  )}
                  {card.status === "error" && (
                    <Text style={[s.statusTxt, { color: C.red }]}>❌ {card.error}</Text>
                  )}
                </View>

                {/* Right meta */}
                <View style={s.cardRight}>
                  <View style={s.quizPill}>
                    <Ionicons name="help-circle-outline" size={12} color={C.green} />
                    <Text style={s.quizPillTxt}>Quiz ready</Text>
                  </View>
                  <Text style={s.audioNote}>audio later</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* ── Finished summary ── */}
        {finished && (
          <View style={[s.summaryBox, { borderColor: errorCount > 0 ? C.red + "55" : C.valid + "55", backgroundColor: errorCount > 0 ? "#fef9f9" : "#f0faf4" }]}>
            <Ionicons name={errorCount > 0 ? "warning" : "checkmark-circle"} size={28} color={errorCount > 0 ? C.red : C.valid} />
            <View style={{ flex: 1 }}>
              <Text style={[s.summaryTitle, { color: errorCount > 0 ? C.red : C.valid }]}>
                {errorCount === 0 ? "அனைத்தும் உருவாக்கப்பட்டன! 🎉" : "சில cards தோல்வியடைந்தன"}
              </Text>
              <Text style={s.summaryBody}>
                ✅ {doneCount} cards உருவாக்கப்பட்டன
                {errorCount > 0 ? `\n❌ ${errorCount} cards தோல்வி` : ""}
              </Text>
              <Text style={s.summaryHint}>
                இப்போது Cards tab-ல் audioUrl மற்றும் Quiz சேர்க்கலாம்.
              </Text>
            </View>
          </View>
        )}

        {/* ── Action buttons ── */}
        {!finished ? (
          <TouchableOpacity
            style={[
              s.createBtn,
              (running || selectedCount === 0 || !selectedCatId) && s.createBtnDisabled,
            ]}
            onPress={handleCreate}
            disabled={running || selectedCount === 0 || !selectedCatId}
            activeOpacity={0.85}
          >
            {running ? (
              <>
                <ActivityIndicator color="#fff" />
                <Text style={s.createBtnTxt}>
                  உருவாக்குகிறது... ({doneCount + errorCount}/{selectedCount})
                </Text>
              </>
            ) : (
              <>
                <Ionicons name="cloud-upload-outline" size={20} color="#fff" />
                <Text style={s.createBtnTxt}>
                  {selectedCount} Cards உருவாக்கு — Firebase-ல் சேமி
                </Text>
              </>
            )}
          </TouchableOpacity>
        ) : (
          <View style={s.finishedBtns}>
            <TouchableOpacity style={s.resetBtn} onPress={handleReset} activeOpacity={0.85}>
              <Ionicons name="refresh-outline" size={18} color={C.green} />
              <Text style={s.resetBtnTxt}>மீண்டும் (Reset)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.doneBtn} onPress={() => router.back()} activeOpacity={0.85}>
              <Ionicons name="arrow-back-outline" size={18} color="#fff" />
              <Text style={s.doneBtnTxt}>CMS-க்கு திரும்பு</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Info notes ── */}
        {!running && !finished && (
          <View style={s.noteBox}>
            <Text style={s.noteTitle}>ℹ️ குறிப்புகள்</Text>
            <Text style={s.noteLine}>• audioUrl தற்போது காலியாக சேமிக்கப்படும் — Cards tab-ல் பின்னர் சேர்க்கலாம்</Text>
            <Text style={s.noteLine}>• hasQuiz: true — Quiz editor-ல் கேள்விகளை paste செய்யலாம்</Text>
            <Text style={s.noteLine}>• ஒரு சூரா ஏற்கனவே உள்ளதா என்று சரிபார்க்கப்படாது — duplicate ஆகாமல் பார்த்துக்கொள்ளுங்கள்</Text>
          </View>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  centerTxt: { fontSize: 14, color: C.sub },

  // Header
  header:      { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: "#fff" },
  backBtn:     { width: 38, height: 38, borderRadius: 10, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 15, fontWeight: "800", color: C.txt },
  headerSub:   { fontSize: 11, color: C.sub, marginTop: 1 },
  badge:       { borderRadius: 10, borderWidth: 1.5, paddingHorizontal: 10, paddingVertical: 5 },
  badgeTxt:    { fontSize: 13, fontWeight: "800" },

  scroll: { padding: 16 },

  // Sections
  section:      { marginBottom: 20 },
  sectionTitle: { fontSize: 14, fontWeight: "800", color: C.txt, marginBottom: 12 },
  listHeader:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  selectBtns:   { flexDirection: "row", alignItems: "center", gap: 8 },
  selectBtn:    {},
  selectBtnTxt: { fontSize: 12, fontWeight: "700", color: C.green },
  emptyTxt:     { fontSize: 13, color: C.sub, fontStyle: "italic", textAlign: "center", paddingVertical: 8 },

  // Chip pickers
  chipRow:       { marginBottom: 4 },
  chip:          { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1.5, borderColor: C.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9, marginRight: 8, backgroundColor: "#fff" },
  chipActive:    { backgroundColor: C.green + "18", borderColor: C.green },
  chipIcon:      { fontSize: 16 },
  chipTxt:       { fontSize: 13, fontWeight: "600", color: C.sub },
  chipTxtActive: { color: C.green, fontWeight: "800" },

  // Target banner
  targetBanner: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#e8f5ee", borderRadius: 12, borderWidth: 1, borderColor: C.green + "44", padding: 12, marginBottom: 20 },
  targetTxt:    { fontSize: 13, fontWeight: "800", color: C.green },
  targetSub:    { fontSize: 11, color: C.sub, marginTop: 2 },

  // Card rows
  cardRow:         { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fff", borderRadius: 12, borderWidth: 1.5, borderColor: C.border, padding: 12, marginBottom: 8, opacity: 0.6 },
  cardRowSelected: { opacity: 1, borderColor: C.green + "66" },
  cardRowDone:     { opacity: 1, borderColor: C.valid + "66", backgroundColor: "#f0faf4" },
  cardRowError:    { opacity: 1, borderColor: C.red   + "66", backgroundColor: "#fff5f5" },
  cardRowCreating: { opacity: 1, borderColor: C.blue  + "66", backgroundColor: "#eff8ff" },

  checkbox:     { width: 28, height: 28, borderRadius: 8, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 },
  cardNumBadge: { fontSize: 11, fontWeight: "800", width: 22 },
  cardTitleEn:  { fontSize: 14, fontWeight: "700" },
  cardTitleTa:  { fontSize: 12, marginLeft: 22 },
  statusTxt:    { fontSize: 11, fontWeight: "600", marginTop: 4, marginLeft: 22 },
  cardRight:    { alignItems: "flex-end", gap: 4 },
  quizPill:     { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: C.green + "18", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3 },
  quizPillTxt:  { fontSize: 10, fontWeight: "700", color: C.green },
  audioNote:    { fontSize: 10, color: C.sub, fontStyle: "italic" },

  // Summary
  summaryBox:   { flexDirection: "row", alignItems: "flex-start", gap: 14, borderRadius: 14, borderWidth: 1.5, padding: 16, marginBottom: 20 },
  summaryTitle: { fontSize: 15, fontWeight: "800", marginBottom: 4 },
  summaryBody:  { fontSize: 13, color: C.txt, lineHeight: 20, marginBottom: 6 },
  summaryHint:  { fontSize: 12, color: C.sub, lineHeight: 18 },

  // Buttons
  createBtn:         { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: C.green, borderRadius: 14, paddingVertical: 16, marginBottom: 16, borderWidth: 2, borderColor: C.green + "88" },
  createBtnDisabled: { backgroundColor: "#ccc", borderColor: "#bbb" },
  createBtnTxt:      { color: "#fff", fontWeight: "800", fontSize: 15 },

  finishedBtns: { flexDirection: "row", gap: 12, marginBottom: 16 },
  resetBtn:     { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 14, paddingVertical: 14, borderWidth: 1.5, borderColor: C.green, backgroundColor: "#f0faf4" },
  resetBtnTxt:  { fontSize: 14, fontWeight: "800", color: C.green },
  doneBtn:      { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 14, paddingVertical: 14, backgroundColor: C.green },
  doneBtnTxt:   { fontSize: 14, fontWeight: "800", color: "#fff" },

  // Notes
  noteBox:   { backgroundColor: "#fffbeb", borderRadius: 12, borderWidth: 1, borderColor: C.gold + "66", padding: 14, marginBottom: 8 },
  noteTitle: { fontSize: 13, fontWeight: "800", color: "#92400e", marginBottom: 8 },
  noteLine:  { fontSize: 12, color: "#78350f", lineHeight: 20, marginBottom: 2 },

  // Divider
  divider:     { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: C.border },
  dividerTxt:  { fontSize: 11, color: C.sub, fontWeight: "600" },

  // ── Quick Seed Panel ──
  quickPanel:       { backgroundColor: "#fff", borderRadius: 16, borderWidth: 2, borderColor: C.gold + "88", padding: 16, marginBottom: 20 },
  quickHeader:      { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  quickIconWrap:    { width: 44, height: 44, borderRadius: 12, backgroundColor: C.gold + "22", alignItems: "center", justifyContent: "center" },
  quickTitle:       { fontSize: 15, fontWeight: "800", color: C.txt },
  quickSub:         { fontSize: 11, color: C.sub, marginTop: 2 },

  quickInfo:        { gap: 7, marginBottom: 16 },
  quickInfoItem:    { flexDirection: "row", alignItems: "center", gap: 8 },
  quickInfoTxt:     { fontSize: 12, color: C.sub, flex: 1 },

  quickBtn:         { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: C.green, borderRadius: 12, paddingVertical: 14 },
  quickBtnRunning:  { backgroundColor: C.blue },
  quickBtnTxt:      { color: "#fff", fontWeight: "800", fontSize: 14 },

  quickErrBox:      { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: "#fef2f2", borderRadius: 12, borderWidth: 1, borderColor: C.red + "55", padding: 12 },
  quickErrTitle:    { fontSize: 13, fontWeight: "800", color: C.red, marginBottom: 4 },
  quickErrMsg:      { fontSize: 12, color: "#991b1b", lineHeight: 18, marginBottom: 6 },
  quickErrHint:     { fontSize: 11, color: "#b91c1c", lineHeight: 17 },

  quickResultBox:    { backgroundColor: "#f0faf4", borderRadius: 12, borderWidth: 1, borderColor: C.valid + "55", padding: 14 },
  quickResultHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  quickResultTitle:  { fontSize: 14, fontWeight: "800", color: C.valid, flex: 1 },
  quickIdRow:        { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  quickIdLabel:      { fontSize: 11, fontWeight: "700", color: C.sub, width: 100 },
  quickIdVal:        { flex: 1, fontSize: 11, color: C.txt, fontFamily: "monospace", backgroundColor: "#e8f5ee", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3 },
  quickListBlock:    { marginTop: 10 },
  quickListLabel:    { fontSize: 12, fontWeight: "800", color: C.txt, marginBottom: 6 },
  quickListItem:     { fontSize: 12, lineHeight: 22 },
  quickResetLink:    { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12, alignSelf: "flex-start" },
  quickResetTxt:     { fontSize: 12, color: C.sub, fontWeight: "600" },
});
