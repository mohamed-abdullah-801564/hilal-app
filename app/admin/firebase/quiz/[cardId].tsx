import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  getCardById,
  updateCard,
  type FBCard,
  type FBQuizQuestion,
} from "@/services/firebase.firestore";

// ─── Palette ──────────────────────────────────────────────────────────────────

const C = {
  green:  "#1a7a4a",
  gold:   "#f0bc42",
  red:    "#ef4444",
  bg:     "#f4faf6",
  card:   "#ffffff",
  border: "#d4ead9",
  txt:    "#0d2414",
  sub:    "#5a7a64",
  valid:  "#16a34a",
  warn:   "#d97706",
  blue:   "#2563eb",
};

// ─── Tamil option prefix → correctIndex map ───────────────────────────────────

const TAMIL_ANSWER_MAP: Record<string, number> = {
  "ஆ": 0,
  "இ": 1,
  "ஈ": 2,
  "உ": 3,
};

// ─── Bulk text parser ─────────────────────────────────────────────────────────

interface ParseResult {
  questions: FBQuizQuestion[];
  errors:    string[];
}

function parseBulkText(raw: string): ParseResult {
  const questions: FBQuizQuestion[] = [];
  const errors:    string[]         = [];

  // Split on blank lines — each block is one question
  const blocks = raw.trim().split(/\n\s*\n/).filter(b => b.trim().length > 0);

  if (blocks.length === 0) {
    return { questions: [], errors: ["ஒரு கேள்வியாவது ஒட்டுங்கள்"] };
  }

  blocks.forEach((block, idx) => {
    const num   = idx + 1;
    const lines = block.trim().split("\n").map(l => l.trim()).filter(Boolean);

    let questionText = "";
    const opts: string[] = [];
    let correctIndex     = -1;

    for (const line of lines) {
      // கேள்வி: Question text
      if (line.startsWith("கேள்வி:")) {
        questionText = line.replace(/^கேள்வி:\s*/, "").trim();
        continue;
      }
      // ஆ) / இ) / ஈ) / உ)  Option text
      const optMatch = line.match(/^([ஆஇஈஉ])\)\s*(.+)$/);
      if (optMatch) {
        const prefix = optMatch[1];
        const text   = optMatch[2].trim();
        const optIdx = TAMIL_ANSWER_MAP[prefix];
        if (optIdx !== undefined) {
          opts[optIdx] = text;
        }
        continue;
      }
      // விடை: ஆ / இ / ஈ / உ
      if (line.startsWith("விடை:")) {
        const ans = line.replace(/^விடை:\s*/, "").trim();
        correctIndex = TAMIL_ANSWER_MAP[ans] ?? -1;
        continue;
      }
    }

    // ── Validate block ──
    if (!questionText) {
      errors.push(`கேள்வி ${num}: "கேள்வி:" வரி இல்லை`);
      return;
    }
    const filledOpts = opts.filter(Boolean);
    if (filledOpts.length < 2) {
      errors.push(`கேள்வி ${num}: குறைந்தது 2 விடைகள் தேவை (ஆ, இ…)`);
      return;
    }
    if (correctIndex < 0) {
      errors.push(`கேள்வி ${num}: "விடை:" வரி இல்லை அல்லது தவறான எழுத்து`);
      return;
    }
    if (!opts[correctIndex]) {
      errors.push(`கேள்வி ${num}: "விடை:" சுட்டும் option இல்லை`);
      return;
    }

    questions.push({ question: questionText, options: filledOpts, correctIndex });
  });

  return { questions, errors };
}

// ─── Empty question form ──────────────────────────────────────────────────────

const BLANK_FORM = {
  question:     "",
  optA:         "",
  optB:         "",
  optC:         "",
  optD:         "",
  correctIndex: -1 as number,
  explanation:  "",
};

type QuestionForm = typeof BLANK_FORM;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formToQuestion(f: QuestionForm): FBQuizQuestion {
  const options = [f.optA, f.optB, f.optC, f.optD].filter(o => o.trim() !== "");
  const q: FBQuizQuestion = { question: f.question.trim(), options, correctIndex: f.correctIndex };
  if (f.explanation.trim()) q.explanation = f.explanation.trim();
  return q;
}

function questionToForm(q: FBQuizQuestion): QuestionForm {
  return {
    question:     q.question,
    optA:         q.options[0] ?? "",
    optB:         q.options[1] ?? "",
    optC:         q.options[2] ?? "",
    optD:         q.options[3] ?? "",
    correctIndex: q.correctIndex,
    explanation:  q.explanation ?? "",
  };
}

function validateForm(f: QuestionForm): string[] {
  const errs: string[] = [];
  if (!f.question.trim())    errs.push("கேள்வி உள்ளிடுங்கள்");
  if (!f.optA.trim())        errs.push("விடை A தேவை");
  if (!f.optB.trim())        errs.push("விடை B தேவை");
  if (f.correctIndex < 0)    errs.push("சரியான விடையை தேர்ந்தெடுங்கள்");
  const filledOpts = [f.optA, f.optB, f.optC, f.optD].filter(o => o.trim());
  if (f.correctIndex >= filledOpts.length) errs.push("தேர்ந்தெடுத்த விடை இல்லை");
  return errs;
}

function validateQuiz(qs: FBQuizQuestion[]): string[] {
  if (qs.length === 0) return ["குறைந்தது ஒரு கேள்வி சேர்க்கவும்"];
  const errs: string[] = [];
  qs.forEach((q, i) => {
    if (!q.question.trim())     errs.push(`கேள்வி ${i + 1}: கேள்வி உள்ளிடவும்`);
    if (q.options.length < 2)   errs.push(`கேள்வி ${i + 1}: குறைந்தது 2 விடைகள் தேவை`);
    if (q.correctIndex < 0 || q.correctIndex >= q.options.length)
      errs.push(`கேள்வி ${i + 1}: சரியான விடை தேர்ந்தெடுக்கவும்`);
  });
  return errs;
}

// ─── Option key list ──────────────────────────────────────────────────────────

const OPT_KEYS: Array<keyof QuestionForm> = ["optA", "optB", "optC", "optD"];
const OPT_LABELS = ["A", "B", "C", "D"];
const TAMIL_OPT_LABELS = ["ஆ", "இ", "ஈ", "உ"];

// ─── Question card (display mode) ────────────────────────────────────────────

function QuestionCard({
  q, idx, onEdit, onDelete,
}: {
  q: FBQuizQuestion; idx: number; onEdit: () => void; onDelete: () => void;
}) {
  const valid = validateQuiz([q]).length === 0;
  return (
    <View style={[qc.wrap, { borderColor: valid ? C.green + "66" : C.red + "66" }]}>
      <View style={qc.topRow}>
        <View style={[qc.numBadge, { backgroundColor: valid ? C.green : C.red }]}>
          <Text style={qc.numTxt}>Q{idx + 1}</Text>
        </View>
        <Text style={qc.qTxt} numberOfLines={3}>{q.question}</Text>
        <View style={qc.actions}>
          <Pressable onPress={onEdit} style={[qc.actionBtn, { backgroundColor: "#fff8e6", borderColor: C.gold + "88" }]} hitSlop={8}>
            <Ionicons name="pencil" size={14} color={C.gold} />
          </Pressable>
          <Pressable onPress={onDelete} style={[qc.actionBtn, { backgroundColor: "#fff0f0", borderColor: C.red + "88" }]} hitSlop={8}>
            <Ionicons name="trash" size={14} color={C.red} />
          </Pressable>
        </View>
      </View>
      <View style={qc.opts}>
        {q.options.map((opt, i) => (
          <View key={i} style={[qc.optRow, i === q.correctIndex && qc.optCorrect]}>
            <View style={[qc.optLabel, i === q.correctIndex && { backgroundColor: C.green }]}>
              <Text style={[qc.optLabelTxt, i === q.correctIndex && { color: "#fff" }]}>
                {OPT_LABELS[i]}
              </Text>
            </View>
            <Text style={[qc.optTxt, i === q.correctIndex && { color: C.green, fontWeight: "700" }]}>
              {opt}
            </Text>
            {i === q.correctIndex && (
              <Ionicons name="checkmark-circle" size={16} color={C.green} />
            )}
          </View>
        ))}
      </View>
      {!valid && (
        <View style={qc.errRow}>
          <Ionicons name="warning-outline" size={13} color={C.red} />
          <Text style={qc.errTxt}>இந்த கேள்வி முழுமையடையவில்லை</Text>
        </View>
      )}
    </View>
  );
}

const qc = StyleSheet.create({
  wrap:        { backgroundColor: "#fff", borderRadius: 14, borderWidth: 1.5, padding: 14, marginBottom: 12 },
  topRow:      { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 10 },
  numBadge:    { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  numTxt:      { color: "#fff", fontSize: 11, fontWeight: "800" },
  qTxt:        { flex: 1, fontSize: 14, fontWeight: "600", color: C.txt, lineHeight: 20 },
  actions:     { flexDirection: "row", gap: 6 },
  actionBtn:   { width: 30, height: 30, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  opts:        { gap: 6 },
  optRow:      { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 7, paddingHorizontal: 10, borderRadius: 8, backgroundColor: "#f6faf7", borderWidth: 1, borderColor: "#e0eee4" },
  optCorrect:  { backgroundColor: "#e8f5ee", borderColor: C.green + "66" },
  optLabel:    { width: 22, height: 22, borderRadius: 6, backgroundColor: "#dce8dc", alignItems: "center", justifyContent: "center" },
  optLabelTxt: { fontSize: 11, fontWeight: "800", color: C.sub },
  optTxt:      { flex: 1, fontSize: 13, color: C.txt },
  errRow:      { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  errTxt:      { color: C.red, fontSize: 12 },
});

// ─── Bulk parsed preview card ─────────────────────────────────────────────────

function ParsedCard({ q, idx }: { q: FBQuizQuestion; idx: number }) {
  return (
    <View style={pc.wrap}>
      <View style={pc.topRow}>
        <View style={pc.badge}>
          <Text style={pc.badgeTxt}>Q{idx + 1}</Text>
        </View>
        <Text style={pc.qTxt}>{q.question}</Text>
      </View>
      {q.options.map((opt, i) => (
        <View key={i} style={[pc.optRow, i === q.correctIndex && pc.optCorrect]}>
          <Text style={[pc.optLabel, i === q.correctIndex && { color: C.green, fontWeight: "800" }]}>
            {TAMIL_OPT_LABELS[i]})
          </Text>
          <Text style={[pc.optTxt, i === q.correctIndex && { color: C.green, fontWeight: "700" }]}>
            {opt}
          </Text>
          {i === q.correctIndex && (
            <Ionicons name="checkmark-circle" size={15} color={C.green} />
          )}
        </View>
      ))}
    </View>
  );
}

const pc = StyleSheet.create({
  wrap:       { backgroundColor: "#f0faf4", borderRadius: 12, borderWidth: 1, borderColor: C.green + "44", padding: 12, marginBottom: 10 },
  topRow:     { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 8 },
  badge:      { backgroundColor: C.green, borderRadius: 7, paddingHorizontal: 7, paddingVertical: 2 },
  badgeTxt:   { color: "#fff", fontSize: 11, fontWeight: "800" },
  qTxt:       { flex: 1, fontSize: 13, fontWeight: "600", color: C.txt, lineHeight: 19 },
  optRow:     { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 7, marginBottom: 3 },
  optCorrect: { backgroundColor: "#dcfce7" },
  optLabel:   { fontSize: 13, color: C.sub, width: 22 },
  optTxt:     { flex: 1, fontSize: 13, color: C.txt },
});

// ─── Mode toggle ──────────────────────────────────────────────────────────────

type EditorMode = "manual" | "bulk";

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function QuizEditorScreen() {
  const { cardId } = useLocalSearchParams<{ cardId: string }>();
  const router     = useRouter();

  const [card,        setCard]        = useState<FBCard | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [questions,   setQuestions]   = useState<FBQuizQuestion[]>([]);
  const [quizTitleTa, setQuizTitleTa] = useState("");
  const [quizTitleEn, setQuizTitleEn] = useState("");

  // ── Manual mode state ──
  const [editingIdx,  setEditingIdx]  = useState<number | null>(null);
  const [form,        setForm]        = useState<QuestionForm>(BLANK_FORM);
  const [formErrors,  setFormErrors]  = useState<string[]>([]);

  // ── Bulk mode state ──
  const [mode,          setMode]          = useState<EditorMode>("manual");
  const [bulkText,      setBulkText]      = useState("");
  const [parseResult,   setParseResult]   = useState<ParseResult | null>(null);
  const [bulkParsed,    setBulkParsed]    = useState(false);

  const [saving,   setSaving]   = useState(false);
  const formShake = useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    if (!cardId) return;
    setLoading(true);
    try {
      const c = await getCardById(cardId);
      if (c) {
        setCard(c);
        setQuestions(c.quiz ?? []);
        setQuizTitleTa(c.quizTitleTa ?? "");
        setQuizTitleEn(c.quizTitleEn ?? "");
      }
    } finally {
      setLoading(false);
    }
  }, [cardId]);

  useEffect(() => { load(); }, [load]);

  const quizErrors  = validateQuiz(questions);
  const isQuizValid = quizErrors.length === 0;

  function shakeForm() {
    Animated.sequence([
      Animated.timing(formShake, { toValue: 8,  duration: 60, useNativeDriver: true }),
      Animated.timing(formShake, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(formShake, { toValue: 6,  duration: 50, useNativeDriver: true }),
      Animated.timing(formShake, { toValue: -6, duration: 50, useNativeDriver: true }),
      Animated.timing(formShake, { toValue: 0,  duration: 40, useNativeDriver: true }),
    ]).start();
  }

  // ── Manual mode handlers ──

  function handleAddOrUpdate() {
    const errs = validateForm(form);
    if (errs.length > 0) { setFormErrors(errs); shakeForm(); return; }
    setFormErrors([]);
    const q = formToQuestion(form);
    if (editingIdx !== null) {
      setQuestions(prev => prev.map((item, i) => i === editingIdx ? q : item));
      setEditingIdx(null);
    } else {
      setQuestions(prev => [...prev, q]);
    }
    setForm(BLANK_FORM);
  }

  function handleEdit(idx: number) {
    setEditingIdx(idx);
    setForm(questionToForm(questions[idx]));
    setFormErrors([]);
  }

  function handleDelete(idx: number) {
    Alert.alert(
      "கேள்வி நீக்கவா?",
      `Q${idx + 1} நீக்கப்படும்.`,
      [
        { text: "இல்லை", style: "cancel" },
        { text: "நீக்கு", style: "destructive", onPress: () => {
          setQuestions(prev => prev.filter((_, i) => i !== idx));
          if (editingIdx === idx) { setEditingIdx(null); setForm(BLANK_FORM); }
        }},
      ]
    );
  }

  function cancelEdit() {
    setEditingIdx(null);
    setForm(BLANK_FORM);
    setFormErrors([]);
  }

  // ── Bulk mode handlers ──

  function handleParse() {
    if (!bulkText.trim()) {
      setParseResult({ questions: [], errors: ["உரையை ஒட்டுங்கள்"] });
      setBulkParsed(true);
      return;
    }
    const result = parseBulkText(bulkText);
    setParseResult(result);
    setBulkParsed(true);
  }

  function handleImportAppend() {
    if (!parseResult || parseResult.questions.length === 0) return;
    setQuestions(prev => [...prev, ...parseResult.questions]);
    setBulkText("");
    setParseResult(null);
    setBulkParsed(false);
    setMode("manual");
    Alert.alert(
      "✅ இறக்குமதி வெற்றி",
      `${parseResult.questions.length} கேள்விகள் சேர்க்கப்பட்டன. "Firebase-ல் சேமி" அழுத்துங்கள்.`,
    );
  }

  function handleImportReplace() {
    if (!parseResult || parseResult.questions.length === 0) return;
    Alert.alert(
      "மாற்றுவதா?",
      `தற்போதுள்ள ${questions.length} கேள்விகளை நீக்கி, புதிதாக ${parseResult.questions.length} கேள்விகளை சேர்க்கவா?`,
      [
        { text: "இல்லை", style: "cancel" },
        { text: "ஆம், மாற்று", style: "destructive", onPress: () => {
          setQuestions(parseResult.questions);
          setBulkText("");
          setParseResult(null);
          setBulkParsed(false);
          setMode("manual");
        }},
      ]
    );
  }

  function handleClearBulk() {
    setBulkText("");
    setParseResult(null);
    setBulkParsed(false);
  }

  // ── Save ──

  async function handleSave() {
    if (!isQuizValid || !cardId) { shakeForm(); return; }
    setSaving(true);
    try {
      await updateCard(cardId, {
        quiz:        questions,
        quizTitleTa: quizTitleTa.trim(),
        quizTitleEn: quizTitleEn.trim(),
        hasQuiz:     questions.length > 0,
      });
      Alert.alert("✅ சேமிக்கப்பட்டது", "Quiz Firebase-ல் சேமிக்கப்பட்டது!", [
        { text: "சரி", onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert("பிழை", e.message ?? "சேமிக்க முடியவில்லை");
    } finally {
      setSaving(false);
    }
  }

  // ── Loading / not found ──

  if (loading) {
    return (
      <SafeAreaView style={s.safe} edges={["top"]}>
        <View style={s.center}>
          <ActivityIndicator size="large" color={C.green} />
          <Text style={s.loadTxt}>Quiz ஏற்றுகிறது...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!card) {
    return (
      <SafeAreaView style={s.safe} edges={["top"]}>
        <View style={s.center}>
          <Ionicons name="alert-circle-outline" size={48} color={C.red} />
          <Text style={s.loadTxt}>Card கிடைக்கவில்லை</Text>
        </View>
      </SafeAreaView>
    );
  }

  const parseOk      = bulkParsed && parseResult && parseResult.errors.length === 0 && parseResult.questions.length > 0;
  const parseHasErr  = bulkParsed && parseResult && parseResult.errors.length > 0;

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      {/* ── Header ── */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={10}>
          <Ionicons name="arrow-back" size={20} color={C.green} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle} numberOfLines={1}>
            🧩 Quiz திருத்து
          </Text>
          <Text style={s.headerSub} numberOfLines={1}>
            {card.titleTa || card.titleEn}
          </Text>
        </View>
        <View style={[s.validBadge, { backgroundColor: isQuizValid ? "#dcfce7" : "#fef2f2", borderColor: isQuizValid ? C.valid : C.red }]}>
          <Ionicons name={isQuizValid ? "checkmark-circle" : "close-circle"} size={16} color={isQuizValid ? C.valid : C.red} />
          <Text style={[s.validTxt, { color: isQuizValid ? C.valid : C.red }]}>
            {isQuizValid ? "Valid" : "Invalid"}
          </Text>
        </View>
      </View>

      {/* ── Mode toggle tabs ── */}
      <View style={s.tabBar}>
        <Pressable
          style={[s.tab, mode === "manual" && s.tabActive]}
          onPress={() => setMode("manual")}
        >
          <Ionicons name="create-outline" size={15} color={mode === "manual" ? "#fff" : C.sub} />
          <Text style={[s.tabTxt, mode === "manual" && s.tabTxtActive]}>ஒவ்வொன்றாக</Text>
        </Pressable>
        <Pressable
          style={[s.tab, mode === "bulk" && s.tabActive]}
          onPress={() => setMode("bulk")}
        >
          <Ionicons name="clipboard-outline" size={15} color={mode === "bulk" ? "#fff" : C.sub} />
          <Text style={[s.tabTxt, mode === "bulk" && s.tabTxtActive]}>ஒட்டி இறக்கு</Text>
          <View style={s.newBadge}><Text style={s.newBadgeTxt}>NEW</Text></View>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Card info banner ── */}
        <View style={s.infoBanner}>
          <View style={s.infoIconWrap}>
            <Ionicons name="musical-note" size={22} color={C.green} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.infoTitle}>{card.titleTa}</Text>
            {!!card.titleEn && <Text style={s.infoEn}>{card.titleEn}</Text>}
          </View>
          <View style={[s.countPill, { backgroundColor: C.green + "22" }]}>
            <Text style={[s.countTxt, { color: C.green }]}>{questions.length} கேள்விகள்</Text>
          </View>
        </View>

        {/* ── Quiz titles ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Quiz தலைப்பு</Text>
          <View style={s.fieldWrap}>
            <Text style={s.fieldLabel}>தமிழ் தலைப்பு</Text>
            <TextInput
              style={s.input}
              value={quizTitleTa}
              onChangeText={setQuizTitleTa}
              placeholder="உதா: அடிப்படை இஸ்லாமிய கேள்விகள்"
              placeholderTextColor="#9abca4"
            />
          </View>
          <View style={s.fieldWrap}>
            <Text style={s.fieldLabel}>English Title</Text>
            <TextInput
              style={s.input}
              value={quizTitleEn}
              onChangeText={setQuizTitleEn}
              placeholder="e.g. Basic Islamic Quiz"
              placeholderTextColor="#9abca4"
            />
          </View>
        </View>

        {/* ── Existing questions ── */}
        {questions.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>
              கேள்விகள் ({questions.length})
            </Text>
            {questions.map((q, i) => (
              <QuestionCard
                key={i}
                q={q}
                idx={i}
                onEdit={() => { handleEdit(i); setMode("manual"); }}
                onDelete={() => handleDelete(i)}
              />
            ))}
          </View>
        )}

        {/* ── Quiz validation summary ── */}
        {questions.length > 0 && (
          <View style={[s.validSummary, {
            backgroundColor: isQuizValid ? "#dcfce7" : "#fef2f2",
            borderColor:     isQuizValid ? C.valid + "88" : C.red + "88",
          }]}>
            <Ionicons
              name={isQuizValid ? "checkmark-circle" : "warning"}
              size={20}
              color={isQuizValid ? C.valid : C.red}
            />
            {isQuizValid ? (
              <Text style={[s.validSummaryTxt, { color: C.valid }]}>
                ✅ Valid Quiz — {questions.length} கேள்விகள் சரியாக உள்ளன. Firebase-ல் சேமிக்கலாம்.
              </Text>
            ) : (
              <View style={{ flex: 1 }}>
                {quizErrors.map((e, i) => (
                  <Text key={i} style={[s.validSummaryTxt, { color: C.red }]}>• {e}</Text>
                ))}
              </View>
            )}
          </View>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            BULK PASTE MODE
        ════════════════════════════════════════════════════════════════════ */}
        {mode === "bulk" && (
          <View style={s.section}>
            {/* Format guide */}
            <View style={s.formatGuide}>
              <View style={s.formatGuideHeader}>
                <Ionicons name="information-circle" size={16} color={C.blue} />
                <Text style={s.formatGuideTitle}>வடிவம் (Format)</Text>
              </View>
              <View style={s.formatCodeBlock}>
                <Text style={s.formatCode}>{`கேள்வி: உங்கள் கேள்வி இங்கே
ஆ) முதல் விடை
இ) இரண்டாம் விடை
ஈ) மூன்றாம் விடை
விடை: இ

கேள்வி: அடுத்த கேள்வி
ஆ) Option 1
இ) Option 2
விடை: ஆ`}</Text>
              </View>
              <View style={s.formatTips}>
                <Text style={s.formatTipItem}>• கேள்விகளுக்கு இடையே ஒரு வெற்று வரி விடுங்கள்</Text>
                <Text style={s.formatTipItem}>• ஆ = முதல், இ = இரண்டாம், ஈ = மூன்றாம், உ = நான்காம் விடை</Text>
                <Text style={s.formatTipItem}>• குறைந்தது 2 விடைகள் தேவை; ஈ, உ optional</Text>
                <Text style={s.formatTipItem}>• ஒரே நேரத்தில் 30 கேள்விகள் வரை ஒட்டலாம்</Text>
              </View>
            </View>

            {/* Paste area */}
            <Text style={s.fieldLabel}>Quiz உரையை இங்கே ஒட்டுங்கள் *</Text>
            <TextInput
              style={s.bulkInput}
              value={bulkText}
              onChangeText={v => { setBulkText(v); setBulkParsed(false); setParseResult(null); }}
              placeholder={`கேள்வி: அல்லாஹ்வின் பண்புகள் எத்தனை?\nஆ) 99\nஇ) அளவற்றவை\nஈ) 100\nவிடை: இ`}
              placeholderTextColor="#9abca4"
              multiline
              numberOfLines={12}
              textAlignVertical="top"
            />

            {/* Parse + Clear buttons */}
            <View style={s.bulkBtnRow}>
              {bulkText.trim().length > 0 && (
                <TouchableOpacity style={s.clearBtn} onPress={handleClearBulk}>
                  <Ionicons name="close-circle-outline" size={16} color={C.sub} />
                  <Text style={s.clearBtnTxt}>அழி</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[s.parseBtn, { flex: 1 }]}
                onPress={handleParse}
                activeOpacity={0.8}
              >
                <Ionicons name="code-working-outline" size={18} color="#fff" />
                <Text style={s.parseBtnTxt}>பார்சு செய் (Parse)</Text>
              </TouchableOpacity>
            </View>

            {/* Parse result — errors */}
            {parseHasErr && (
              <View style={s.parseErrBox}>
                <View style={s.parseErrHeader}>
                  <Ionicons name="warning" size={18} color={C.red} />
                  <Text style={s.parseErrTitle}>
                    {parseResult!.errors.length} பிழை(கள்) கண்டுபிடிக்கப்பட்டன
                    {parseResult!.questions.length > 0 ? ` — ${parseResult!.questions.length} கேள்விகள் சரியாக உள்ளன` : ""}
                  </Text>
                </View>
                {parseResult!.errors.map((e, i) => (
                  <View key={i} style={s.parseErrRow}>
                    <Text style={s.parseErrBullet}>⚠</Text>
                    <Text style={s.parseErrTxt}>{e}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Parse result — success */}
            {parseOk && (
              <>
                <View style={s.parseSuccessBox}>
                  <Ionicons name="checkmark-circle" size={20} color={C.valid} />
                  <Text style={s.parseSuccessTxt}>
                    ✅ {parseResult!.questions.length} கேள்விகள் சரியாக பார்சு ஆயின!
                  </Text>
                </View>

                {/* Preview */}
                <Text style={[s.sectionTitle, { marginTop: 16, marginBottom: 10 }]}>
                  முன்னோட்டம் (Preview)
                </Text>
                {parseResult!.questions.map((q, i) => (
                  <ParsedCard key={i} q={q} idx={i} />
                ))}

                {/* Import buttons */}
                <View style={s.importBtnRow}>
                  <TouchableOpacity
                    style={[s.importBtn, s.importBtnAppend]}
                    onPress={handleImportAppend}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="add-circle-outline" size={18} color={C.green} />
                    <Text style={s.importBtnAppendTxt}>
                      இணை (+{parseResult!.questions.length})
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.importBtn, s.importBtnReplace]}
                    onPress={handleImportReplace}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="refresh-outline" size={18} color="#fff" />
                    <Text style={s.importBtnReplaceTxt}>
                      மாற்று ({parseResult!.questions.length})
                    </Text>
                  </TouchableOpacity>
                </View>

                {questions.length > 0 && (
                  <Text style={s.importHint}>
                    "இணை" — தற்போதுள்ள {questions.length} கேள்விகளுடன் சேர்க்கும்{"\n"}
                    "மாற்று" — தற்போதுள்ளவற்றை நீக்கி புதியதை வைக்கும்
                  </Text>
                )}
              </>
            )}
          </View>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            MANUAL MODE — Add / Edit form
        ════════════════════════════════════════════════════════════════════ */}
        {mode === "manual" && (
          <Animated.View style={[s.section, s.formCard, { transform: [{ translateX: formShake }] }]}>
            <Text style={s.sectionTitle}>
              {editingIdx !== null ? `✏️ Q${editingIdx + 1} திருத்து` : "➕ புதிய கேள்வி சேர்"}
            </Text>

            {/* Question text */}
            <View style={s.fieldWrap}>
              <Text style={s.fieldLabel}>கேள்வி *</Text>
              <TextInput
                style={[s.input, s.textArea]}
                value={form.question}
                onChangeText={v => setForm(f => ({ ...f, question: v }))}
                placeholder="கேள்வியை இங்கே உள்ளிடுங்கள்..."
                placeholderTextColor="#9abca4"
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Options */}
            <Text style={s.fieldLabel}>விடைகள் (சரியான விடையை tap செய்யுங்கள்) *</Text>
            {OPT_KEYS.map((key, i) => {
              const val        = form[key] as string;
              const isSelected = form.correctIndex === i;
              const isFilled   = val.trim().length > 0;
              return (
                <View key={key} style={s.optFormRow}>
                  <Pressable
                    onPress={() => setForm(f => ({ ...f, correctIndex: i }))}
                    style={[s.optSelector, isSelected && s.optSelectorActive]}
                    hitSlop={8}
                  >
                    <Text style={[s.optSelectorLbl, isSelected && { color: "#fff" }]}>
                      {OPT_LABELS[i]}
                    </Text>
                  </Pressable>
                  <TextInput
                    style={[s.optInput, isSelected && { borderColor: C.green, backgroundColor: "#f0faf4" }]}
                    value={val}
                    onChangeText={v => setForm(f => ({ ...f, [key]: v }))}
                    placeholder={`விடை ${OPT_LABELS[i]}${i >= 2 ? " (optional)" : " *"}`}
                    placeholderTextColor="#9abca4"
                  />
                  {isSelected && isFilled && (
                    <Ionicons name="checkmark-circle" size={20} color={C.green} />
                  )}
                </View>
              );
            })}

            {form.correctIndex >= 0 && (
              <View style={s.correctHint}>
                <Ionicons name="information-circle-outline" size={14} color={C.green} />
                <Text style={s.correctHintTxt}>
                  விடை {OPT_LABELS[form.correctIndex]} சரியான விடையாக தேர்ந்தெடுக்கப்பட்டது
                </Text>
              </View>
            )}

            {/* Explanation (optional) */}
            <View style={s.fieldWrap}>
              <Text style={s.fieldLabel}>விளக்கம் (Explanation) — optional</Text>
              <TextInput
                style={[s.input, { minHeight: 64, textAlignVertical: "top" }]}
                value={form.explanation}
                onChangeText={v => setForm(f => ({ ...f, explanation: v }))}
                placeholder="தவறான விடைக்கு பிறகு காட்டப்படும் விளக்கம்"
                placeholderTextColor="#9abca4"
                multiline
                numberOfLines={3}
              />
            </View>

            {formErrors.length > 0 && (
              <View style={s.formErrBox}>
                {formErrors.map((e, i) => (
                  <View key={i} style={s.formErrRow}>
                    <Ionicons name="close-circle" size={13} color={C.red} />
                    <Text style={s.formErrTxt}>{e}</Text>
                  </View>
                ))}
              </View>
            )}

            <View style={s.formBtns}>
              {editingIdx !== null && (
                <TouchableOpacity style={[s.btn, s.btnGray]} onPress={cancelEdit}>
                  <Text style={[s.btnTxt, { color: C.sub }]}>ரத்து</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[s.btn, s.btnGreen, { flex: 1 }]}
                onPress={handleAddOrUpdate}
              >
                <Ionicons name={editingIdx !== null ? "checkmark" : "add"} size={18} color="#fff" />
                <Text style={s.btnTxt}>
                  {editingIdx !== null ? "மாற்றம் சேமி" : "கேள்வி சேர்"}
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}

        {/* ── Save to Firebase button ── */}
        <TouchableOpacity
          style={[
            s.saveBtn,
            !isQuizValid && { backgroundColor: "#ccc", borderColor: "#bbb" },
          ]}
          onPress={handleSave}
          disabled={saving || !isQuizValid}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons
                name={isQuizValid ? "cloud-upload-outline" : "lock-closed-outline"}
                size={20}
                color={isQuizValid ? "#fff" : "#888"}
              />
              <Text style={[s.saveBtnTxt, !isQuizValid && { color: "#888" }]}>
                {isQuizValid
                  ? `✅ Firebase-ல் சேமி (${questions.length} கேள்விகள்)`
                  : "Quiz முழுமையடையவில்லை"}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {!isQuizValid && questions.length > 0 && (
          <Text style={s.saveBtnHint}>
            சேமிக்க மேலே உள்ள பிழைகளை சரி செய்யுங்கள்
          </Text>
        )}
        {questions.length === 0 && (
          <Text style={s.saveBtnHint}>
            குறைந்தது ஒரு கேள்வி சேர்க்கவும்
          </Text>
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
  loadTxt:{ fontSize: 14, color: C.sub },

  // Header
  header:       { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: "#fff" },
  backBtn:      { width: 38, height: 38, borderRadius: 10, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" },
  headerTitle:  { fontSize: 15, fontWeight: "800", color: C.txt },
  headerSub:    { fontSize: 11, color: C.sub, marginTop: 1 },
  validBadge:   { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1 },
  validTxt:     { fontSize: 12, fontWeight: "700" },

  // Mode tabs
  tabBar:       { flexDirection: "row", backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: C.border, paddingHorizontal: 16, paddingVertical: 10, gap: 10 },
  tab:          { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 9, borderRadius: 10, borderWidth: 1.5, borderColor: C.border, backgroundColor: "#f4faf6" },
  tabActive:    { backgroundColor: C.green, borderColor: C.green },
  tabTxt:       { fontSize: 13, fontWeight: "700", color: C.sub },
  tabTxtActive: { color: "#fff" },
  newBadge:     { backgroundColor: C.gold, borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1 },
  newBadgeTxt:  { fontSize: 9, fontWeight: "800", color: "#fff" },

  scroll: { padding: 16, gap: 0 },

  // Info banner
  infoBanner:   { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fff", borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: C.border },
  infoIconWrap: { width: 44, height: 44, borderRadius: 12, backgroundColor: C.green + "18", alignItems: "center", justifyContent: "center" },
  infoTitle:    { fontSize: 14, fontWeight: "700", color: C.txt },
  infoEn:       { fontSize: 12, color: C.sub, marginTop: 2 },
  countPill:    { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  countTxt:     { fontSize: 12, fontWeight: "700" },

  // Sections
  section:      { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontWeight: "800", color: C.txt, marginBottom: 12 },
  fieldWrap:    { marginBottom: 12 },
  fieldLabel:   { fontSize: 12, fontWeight: "700", color: C.sub, marginBottom: 6 },
  input:        { backgroundColor: "#fff", borderRadius: 10, borderWidth: 1.5, borderColor: C.border, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: C.txt },
  textArea:     { minHeight: 80, textAlignVertical: "top", paddingTop: 11 },

  // Validation summary
  validSummary:    { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 14, borderRadius: 12, borderWidth: 1.5, marginBottom: 16 },
  validSummaryTxt: { flex: 1, fontSize: 13, fontWeight: "600", lineHeight: 20 },

  // ── Bulk paste ──
  formatGuide:       { backgroundColor: "#eff8ff", borderRadius: 12, borderWidth: 1, borderColor: "#bfdbfe", padding: 14, marginBottom: 14 },
  formatGuideHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  formatGuideTitle:  { fontSize: 13, fontWeight: "800", color: C.blue },
  formatCodeBlock:   { backgroundColor: "#1e293b", borderRadius: 10, padding: 12, marginBottom: 10 },
  formatCode:        { fontFamily: "monospace", fontSize: 12, color: "#86efac", lineHeight: 20 },
  formatTips:        { gap: 4 },
  formatTipItem:     { fontSize: 12, color: "#1e40af", lineHeight: 18 },

  bulkInput:    { backgroundColor: "#fff", borderRadius: 12, borderWidth: 1.5, borderColor: C.border, padding: 14, fontSize: 13, color: C.txt, minHeight: 220, textAlignVertical: "top", lineHeight: 22, fontFamily: "monospace", marginBottom: 12 },
  bulkBtnRow:   { flexDirection: "row", gap: 10, marginBottom: 14 },
  parseBtn:     { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: C.blue, borderRadius: 12, paddingVertical: 13 },
  parseBtnTxt:  { color: "#fff", fontWeight: "800", fontSize: 14 },
  clearBtn:     { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1.5, borderColor: C.border, backgroundColor: "#fff" },
  clearBtnTxt:  { fontSize: 13, color: C.sub, fontWeight: "600" },

  parseErrBox:    { backgroundColor: "#fef2f2", borderRadius: 12, borderWidth: 1.5, borderColor: C.red + "55", padding: 14, marginBottom: 14 },
  parseErrHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  parseErrTitle:  { fontSize: 13, fontWeight: "800", color: C.red, flex: 1 },
  parseErrRow:    { flexDirection: "row", gap: 8, marginBottom: 6 },
  parseErrBullet: { color: C.red, fontSize: 13 },
  parseErrTxt:    { flex: 1, color: "#991b1b", fontSize: 13, lineHeight: 19 },

  parseSuccessBox: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#dcfce7", borderRadius: 12, borderWidth: 1.5, borderColor: C.valid + "66", padding: 14, marginBottom: 4 },
  parseSuccessTxt: { flex: 1, fontSize: 14, fontWeight: "700", color: C.valid },

  importBtnRow:        { flexDirection: "row", gap: 10, marginTop: 14, marginBottom: 6 },
  importBtn:           { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 12, paddingVertical: 13, borderWidth: 1.5 },
  importBtnAppend:     { backgroundColor: "#f0faf4", borderColor: C.green },
  importBtnAppendTxt:  { fontSize: 14, fontWeight: "800", color: C.green },
  importBtnReplace:    { backgroundColor: C.green, borderColor: C.green },
  importBtnReplaceTxt: { fontSize: 14, fontWeight: "800", color: "#fff" },
  importHint:          { fontSize: 11, color: C.sub, lineHeight: 17, marginTop: 6, marginBottom: 4 },

  // ── Manual form ──
  formCard:      { backgroundColor: "#fff", borderRadius: 16, borderWidth: 1.5, borderColor: C.border, padding: 16, marginBottom: 16 },
  optFormRow:    { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  optSelector:   { width: 34, height: 34, borderRadius: 9, borderWidth: 2, borderColor: C.border, alignItems: "center", justifyContent: "center", backgroundColor: "#f4faf6" },
  optSelectorActive: { backgroundColor: C.green, borderColor: C.green },
  optSelectorLbl:    { fontSize: 13, fontWeight: "800", color: C.sub },
  optInput:      { flex: 1, backgroundColor: "#f6faf7", borderRadius: 10, borderWidth: 1.5, borderColor: C.border, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: C.txt },
  correctHint:   { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#e8f5ee", borderRadius: 9, padding: 10, marginTop: 4, marginBottom: 10 },
  correctHintTxt:{ flex: 1, fontSize: 12, color: C.green, fontWeight: "600" },
  formErrBox:    { backgroundColor: "#fff5f5", borderRadius: 10, padding: 12, marginTop: 4, marginBottom: 10, gap: 6 },
  formErrRow:    { flexDirection: "row", alignItems: "center", gap: 6 },
  formErrTxt:    { flex: 1, fontSize: 12, color: C.red },
  formBtns:      { flexDirection: "row", gap: 10, marginTop: 6 },
  btn:           { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 12, paddingVertical: 13 },
  btnGreen:      { backgroundColor: C.green },
  btnGray:       { backgroundColor: "#f4faf6", borderWidth: 1.5, borderColor: C.border, paddingHorizontal: 20 },
  btnTxt:        { color: "#fff", fontWeight: "800", fontSize: 14 },

  // ── Save ──
  saveBtn:       { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: C.green, borderRadius: 14, paddingVertical: 16, borderWidth: 2, borderColor: C.green + "88", marginBottom: 8 },
  saveBtnTxt:    { color: "#fff", fontWeight: "800", fontSize: 16 },
  saveBtnHint:   { textAlign: "center", fontSize: 12, color: C.sub, marginBottom: 12 },
});
