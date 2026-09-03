import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Speech from "expo-speech";
import CoinPopup         from "@/components/CoinPopup";
import BadgeUnlockPopup  from "@/components/BadgeUnlockPopup";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/context/AppContext";
import { useCoins }  from "@/context/CoinsContext";
import { useBadges } from "@/context/BadgesContext";
import type { FBCard, FBQuizQuestion } from "@/services/firebase.firestore";
import { getUserId } from "@/services/userId";
import {
  getDailyQuiz,
  getDailyResult,
  saveDailyResult,
  todayKey,
  formatDateTa,
  type DailyResult,
} from "@/services/dailyQuiz.firebase";

// ─── Constants ────────────────────────────────────────────────────────────────

const QUESTION_TIMER = 15;
const OPTION_LABELS  = ["A", "B", "C", "D"];
const DAILY_COLOR    = "#6366f1"; // indigo — distinct from green quiz

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = "loading" | "ready" | "playing" | "already_done" | "result" | "review";

interface AnsweredEntry {
  question:     string;
  options:      string[];
  correctIndex: number;
  userAnswer:   number | null;
  explanation?: string;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface DailyQuizModalProps {
  visible:   boolean;
  onClose:   () => void;
  allCards:  FBCard[];
}

// ─── Audio helpers (web tones / mobile haptics) ───────────────────────────────

function playTone(freq: number, dur: number, type: OscillatorType = "sine") {
  if (typeof window === "undefined") return;
  try {
    const AC  = (window as any).AudioContext ?? (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx  = new AC();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + dur);
  } catch {}
}

async function playSound(kind: "correct" | "wrong" | "complete" | "timeout") {
  if (Platform.OS === "web") {
    if      (kind === "correct")  { playTone(660, 0.12); setTimeout(() => playTone(880, 0.16), 110); }
    else if (kind === "complete") { playTone(440, 0.12); setTimeout(() => playTone(550, 0.12), 120); setTimeout(() => playTone(660, 0.26), 240); }
    else                          { playTone(180, 0.28, "square"); }
  } else {
    try {
      await Haptics.notificationAsync(
        kind === "correct" || kind === "complete"
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Error,
      );
    } catch {}
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function starsFor(score: number, total: number): number {
  const p = score / (total || 1);
  return p >= 0.85 ? 3 : p >= 0.6 ? 2 : p > 0 ? 1 : 0;
}

// ─── StarRow ──────────────────────────────────────────────────────────────────

function StarRow({ score, total }: { score: number; total: number }) {
  const s = starsFor(score, total);
  return (
    <View style={{ flexDirection: "row", gap: 8, justifyContent: "center", marginVertical: 10 }}>
      {[1, 2, 3].map(n => (
        <Ionicons key={n} name={n <= s ? "star" : "star-outline"} size={34} color={n <= s ? "#f0bc42" : "#555"} />
      ))}
    </View>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DailyQuizModal({ visible, onClose, allCards }: DailyQuizModalProps) {
  const insets      = useSafeAreaInsets();
  const { isDarkMode } = useApp();
  const { addCoins }   = useCoins();
  const { checkAndAward, checkDaily7 } = useBadges();

  const bg     = isDarkMode ? "#0a0a0a" : "#f5f5f5";
  const card   = isDarkMode ? "#1a1a1a" : "#ffffff";
  const txt    = isDarkMode ? "#f0f0f0" : "#111111";
  const sub    = isDarkMode ? "#888888" : "#666666";
  const border = isDarkMode ? "#2a2a2a" : "#e5e5e5";

  // ── State ─────────────────────────────────────────────────────────────────
  const [phase,       setPhase]       = useState<Phase>("loading");
  const [questions,   setQuestions]   = useState<FBQuizQuestion[]>([]);
  const [dateStr,     setDateStr]     = useState(todayKey());
  const [userId,      setUserId]      = useState("");
  const [qIdx,        setQIdx]        = useState(0);
  const [selected,    setSelected]    = useState<number | null>(null);
  const [answered,    setAnswered]    = useState(false);
  const [score,       setScore]       = useState(0);
  const scoreRef = useRef(0);
  const [timer,       setTimer]       = useState(QUESTION_TIMER);
  const [answeredLog, setAnsweredLog] = useState<AnsweredEntry[]>([]);
  const [prevResult,  setPrevResult]  = useState<DailyResult | null>(null);
  const levelStartRef = useRef<number>(0);
  const timerRef      = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Animations ────────────────────────────────────────────────────────────
  const fadeQ     = useRef(new Animated.Value(0)).current;
  const slideQ    = useRef(new Animated.Value(28)).current;
  const scaleOpts = useRef(new Animated.Value(0.94)).current;

  const animateIn = useCallback(() => {
    fadeQ.setValue(0); slideQ.setValue(28); scaleOpts.setValue(0.93);
    Animated.parallel([
      Animated.timing(fadeQ,     { toValue: 1, duration: 260, useNativeDriver: true }),
      Animated.spring(slideQ,    { toValue: 0, useNativeDriver: true, tension: 90, friction: 9 }),
      Animated.spring(scaleOpts, { toValue: 1, useNativeDriver: true, tension: 100, friction: 8 }),
    ]).start();
  }, [fadeQ, slideQ, scaleOpts]);

  useEffect(() => { if (phase === "playing") animateIn(); }, [phase, qIdx, animateIn]);

  // ── Load daily quiz when modal opens ─────────────────────────────────────
  useEffect(() => {
    if (!visible) return;
    setPhase("loading");
    setAnsweredLog([]);
    scoreRef.current = 0;
    setScore(0);
    setQIdx(0);
    setSelected(null);
    setAnswered(false);

    const allQuestions: FBQuizQuestion[] = allCards.flatMap(c => c.quiz ?? []);

    getUserId().then(async uid => {
      setUserId(uid);
      const date = todayKey();
      setDateStr(date);

      // Check if already attempted
      const existing = await getDailyResult(uid, date);
      if (existing) {
        setPrevResult(existing);
        setPhase("already_done");
        return;
      }

      // Get (or create) today's quiz
      const { questions: qs } = await getDailyQuiz(allQuestions);
      if (qs.length === 0) {
        setPhase("ready"); // will show "no questions" state
        return;
      }
      setQuestions(shuffle(qs));
      setPhase("ready");
    }).catch(() => setPhase("ready"));
  }, [visible, allCards]);

  // ── Timer countdown per question ─────────────────────────────────────────
  useEffect(() => {
    if (phase !== "playing" || answered) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    setTimer(QUESTION_TIMER);
    timerRef.current = setInterval(() => {
      setTimer(t => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          handleTimeUp();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qIdx, phase, answered]);

  // ── Cleanup ───────────────────────────────────────────────────────────────
  useEffect(() => () => {
    try { Speech.stop(); } catch {}
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  // ── Actions ───────────────────────────────────────────────────────────────

  function startQuiz() {
    levelStartRef.current = Date.now();
    scoreRef.current = 0;
    setScore(0);
    setQIdx(0);
    setSelected(null);
    setAnswered(false);
    setAnsweredLog([]);
    setPhase("playing");
  }

  function handleSelect(optIdx: number) {
    if (answered) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setSelected(optIdx);
    setAnswered(true);

    const q       = questions[qIdx];
    const correct = q.correctIndex === optIdx;

    setAnsweredLog(prev => [...prev, {
      question:     q.question,
      options:      q.options,
      correctIndex: q.correctIndex,
      userAnswer:   optIdx,
      explanation:  q.explanation,
    }]);

    if (correct) {
      scoreRef.current += 1;
      setScore(scoreRef.current);
      playSound("correct");
      addCoins(10, "quiz_reward", "Daily Quiz correct answer");
    } else {
      playSound("wrong");
    }
    setTimeout(advanceQ, 1500);
  }

  function handleTimeUp() {
    if (answered) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setAnswered(true);
    setSelected(null);
    const q = questions[qIdx];
    if (q) {
      setAnsweredLog(prev => [...prev, {
        question:     q.question,
        options:      q.options,
        correctIndex: q.correctIndex,
        userAnswer:   null,
        explanation:  q.explanation,
      }]);
    }
    playSound("timeout");
    setTimeout(advanceQ, 1200);
  }

  async function advanceQ() {
    const next = qIdx + 1;
    if (next >= questions.length) {
      await finishQuiz();
    } else {
      setQIdx(next);
      setSelected(null);
      setAnswered(false);
    }
  }

  async function finishQuiz() {
    const finalScore = scoreRef.current;
    const total      = questions.length;
    const pct        = Math.round((finalScore / total) * 100);
    const timeTaken  = Math.round((Date.now() - levelStartRef.current) / 1000);
    const result: DailyResult = {
      score: finalScore, total, percentage: pct,
      timeTaken, completedAt: new Date().toISOString(),
    };
    await saveDailyResult(userId, dateStr, result);
    setPrevResult(result);
    playSound("complete");
    // Daily quiz completion bonus
    addCoins(30, "daily_quiz_bonus", `Daily Quiz – ${dateStr} completed`);
    // Check 7-day streak badge
    checkDaily7();
    setPhase("result");
  }

  function handleClose() {
    try { Speech.stop(); } catch {}
    if (timerRef.current) clearInterval(timerRef.current);
    setPhase("loading");
    onClose();
  }

  const q = phase === "playing" ? questions[qIdx] : null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose} statusBarTranslucent>
      <View style={[s.root, { backgroundColor: bg, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <CoinPopup />
        <BadgeUnlockPopup />

        {/* ━━━ LOADING ━━━ */}
        {phase === "loading" && (
          <View style={s.center}>
            <ActivityIndicator size="large" color={DAILY_COLOR} />
            <Text style={[s.loadTxt, { color: sub }]}>இன்றைய Quiz ஏற்றுகிறது...</Text>
          </View>
        )}

        {/* ━━━ ALREADY DONE ━━━ */}
        {phase === "already_done" && prevResult && (
          <ScrollView contentContainerStyle={s.resultScroll} showsVerticalScrollIndicator={false}>
            <Pressable onPress={handleClose} style={[s.iconBtn, { alignSelf: "flex-end", margin: 16 }]} hitSlop={12}>
              <Ionicons name="close" size={24} color={txt} />
            </Pressable>

            <View style={[s.trophyWrap, { backgroundColor: DAILY_COLOR + "22" }]}>
              <Text style={{ fontSize: 44 }}>📅</Text>
            </View>
            <Text style={[s.heading, { color: txt }]}>இன்று Quiz முடித்துவிட்டீர்கள்!</Text>
            <Text style={[s.subTxt, { color: sub }]}>{formatDateTa(dateStr)}</Text>

            <StarRow score={prevResult.score} total={prevResult.total} />

            <View style={[s.scoreBox, { backgroundColor: card, borderColor: border }]}>
              <View style={s.scoreCell}>
                <Text style={[s.scoreBig, { color: DAILY_COLOR }]}>{prevResult.score}</Text>
                <Text style={[s.scoreLbl, { color: sub }]}>சரியான விடை</Text>
              </View>
              <View style={[s.scoreDivider, { backgroundColor: border }]} />
              <View style={s.scoreCell}>
                <Text style={[s.scoreBig, { color: txt }]}>{prevResult.total}</Text>
                <Text style={[s.scoreLbl, { color: sub }]}>மொத்தம்</Text>
              </View>
              <View style={[s.scoreDivider, { backgroundColor: border }]} />
              <View style={s.scoreCell}>
                <Text style={[s.scoreBig, { color: "#f0bc42" }]}>{prevResult.percentage}%</Text>
                <Text style={[s.scoreLbl, { color: sub }]}>மதிப்பெண்</Text>
              </View>
            </View>

            <View style={[s.noteBox, { backgroundColor: DAILY_COLOR + "14", borderColor: DAILY_COLOR + "44" }]}>
              <Ionicons name="time-outline" size={16} color={DAILY_COLOR} />
              <Text style={[s.noteTxt, { color: DAILY_COLOR }]}>
                நாளை புதிய Daily Quiz கிடைக்கும். மீண்டும் வாருங்கள்!
              </Text>
            </View>

            <Pressable
              style={({ pressed }) => [s.closeBtn, { borderColor: border, opacity: pressed ? 0.7 : 1 }]}
              onPress={handleClose}
            >
              <Text style={[s.closeBtnTxt, { color: sub }]}>மூடு</Text>
            </Pressable>
          </ScrollView>
        )}

        {/* ━━━ READY ━━━ */}
        {phase === "ready" && (
          <ScrollView contentContainerStyle={s.resultScroll} showsVerticalScrollIndicator={false}>
            <Pressable onPress={handleClose} style={[s.iconBtn, { alignSelf: "flex-end", margin: 16 }]} hitSlop={12}>
              <Ionicons name="close" size={24} color={txt} />
            </Pressable>

            <View style={[s.trophyWrap, { backgroundColor: DAILY_COLOR + "22" }]}>
              <Text style={{ fontSize: 44 }}>📅</Text>
            </View>

            <Text style={[s.heading, { color: txt }]}>இன்றைய Quiz</Text>
            <Text style={[s.subTxt, { color: sub }]}>{formatDateTa(dateStr)}</Text>

            {questions.length === 0 ? (
              <View style={[s.noteBox, { backgroundColor: "#ef444414", borderColor: "#ef444444" }]}>
                <Ionicons name="alert-circle-outline" size={16} color="#ef4444" />
                <Text style={[s.noteTxt, { color: "#ef4444" }]}>
                  இன்னும் கேள்விகள் இல்லை. Cards-ல் Quiz சேர்க்கவும்.
                </Text>
              </View>
            ) : (
              <>
                {/* Stats pills */}
                <View style={s.statPills}>
                  <View style={[s.pill, { backgroundColor: DAILY_COLOR + "18", borderColor: DAILY_COLOR + "44" }]}>
                    <Ionicons name="help-circle-outline" size={14} color={DAILY_COLOR} />
                    <Text style={[s.pillTxt, { color: DAILY_COLOR }]}>{questions.length} கேள்விகள்</Text>
                  </View>
                  <View style={[s.pill, { backgroundColor: "#f59e0b18", borderColor: "#f59e0b44" }]}>
                    <Ionicons name="time-outline" size={14} color="#f59e0b" />
                    <Text style={[s.pillTxt, { color: "#f59e0b" }]}>15s / கேள்வி</Text>
                  </View>
                  <View style={[s.pill, { backgroundColor: "#22c55e18", borderColor: "#22c55e44" }]}>
                    <Ionicons name="lock-closed-outline" size={14} color="#22c55e" />
                    <Text style={[s.pillTxt, { color: "#22c55e" }]}>1 முயற்சி மட்டும்</Text>
                  </View>
                </View>

                <View style={[s.noteBox, { backgroundColor: DAILY_COLOR + "14", borderColor: DAILY_COLOR + "44", marginBottom: 20 }]}>
                  <Ionicons name="information-circle-outline" size={16} color={DAILY_COLOR} />
                  <Text style={[s.noteTxt, { color: DAILY_COLOR }]}>
                    இன்றைய Quiz-ல் உள்ள கேள்விகள் அனைத்து பாடங்களிலிருந்து தேர்ந்தெடுக்கப்பட்டவை.
                  </Text>
                </View>

                <Pressable
                  style={({ pressed }) => [s.startBtn, { backgroundColor: DAILY_COLOR, opacity: pressed ? 0.85 : 1 }]}
                  onPress={startQuiz}
                >
                  <Ionicons name="play" size={20} color="#fff" />
                  <Text style={s.startBtnTxt}>Quiz தொடங்கு</Text>
                </Pressable>
              </>
            )}
          </ScrollView>
        )}

        {/* ━━━ PLAYING ━━━ */}
        {phase === "playing" && q && (
          <View style={{ flex: 1 }}>
            {/* Header */}
            <View style={[s.playHeader, { borderBottomColor: border }]}>
              <Pressable onPress={handleClose} style={s.iconBtn} hitSlop={12}>
                <Ionicons name="close" size={22} color={txt} />
              </Pressable>
              <View style={s.playMid}>
                <View style={[s.levelPill, { backgroundColor: DAILY_COLOR + "22" }]}>
                  <Text style={{ fontSize: 13 }}>📅</Text>
                  <Text style={[s.levelPillTxt, { color: DAILY_COLOR }]}>இன்றைய Quiz</Text>
                </View>
              </View>
              {/* Timer */}
              <View style={[s.timerPill, {
                backgroundColor: timer <= 5 ? "#ef444422" : DAILY_COLOR + "18",
                borderColor:     timer <= 5 ? "#ef444488" : DAILY_COLOR + "44",
              }]}>
                <Ionicons name="time-outline" size={12} color={timer <= 5 ? "#ef4444" : DAILY_COLOR} />
                <Text style={[s.timerTxt, { color: timer <= 5 ? "#ef4444" : DAILY_COLOR }]}>{timer}s</Text>
              </View>
            </View>

            {/* Progress bar */}
            <View style={[s.progressTrack, { backgroundColor: border }]}>
              <View style={[s.progressFill, { backgroundColor: DAILY_COLOR, width: `${(qIdx / questions.length) * 100}%` }]} />
            </View>
            <View style={[s.progressRow, { paddingHorizontal: 18 }]}>
              <Text style={[s.progressTxt, { color: sub }]}>கேள்வி {qIdx + 1} / {questions.length}</Text>
              <Text style={[s.progressTxt, { color: "#22c55e" }]}>✅ {score}</Text>
            </View>

            <ScrollView contentContainerStyle={s.playScroll} showsVerticalScrollIndicator={false}>
              {/* Question */}
              <Animated.View style={[s.questionCard, {
                backgroundColor: card, borderColor: border,
                opacity: fadeQ, transform: [{ translateY: slideQ }],
              }]}>
                <View style={[s.qNumPill, { backgroundColor: DAILY_COLOR + "30" }]}>
                  <Text style={[s.qNumTxt, { color: DAILY_COLOR }]}>Q{qIdx + 1}</Text>
                </View>
                <Text style={[s.questionTxt, { color: txt }]}>{q.question}</Text>
              </Animated.View>

              {/* Options */}
              <Animated.View style={{ transform: [{ scale: scaleOpts }] }}>
                {q.options.map((opt, i) => {
                  const isSel  = selected === i;
                  const isCorr = q.correctIndex === i;

                  let optBg = card, optBorder = border, optTxtCol = txt;
                  if (answered) {
                    if (isCorr)          { optBg = "#4ade8030"; optBorder = "#4ade80"; optTxtCol = isDarkMode ? "#4ade80" : "#166534"; }
                    else if (isSel)      { optBg = "#f8717150"; optBorder = "#ef4444"; optTxtCol = isDarkMode ? "#f87171" : "#7f1d1d"; }
                  }

                  const labelBg = answered && isCorr ? "#4ade80"
                    : answered && isSel && !isCorr ? "#ef4444"
                    : isDarkMode ? "#2a2a2a" : "#f0f0f0";

                  return (
                    <Pressable
                      key={i}
                      style={({ pressed }) => [
                        s.optBtn,
                        { backgroundColor: optBg, borderColor: optBorder,
                          opacity: answered && !isSel && !isCorr ? 0.45 : pressed ? 0.78 : 1 },
                      ]}
                      onPress={() => handleSelect(i)}
                      disabled={answered}
                    >
                      <View style={[s.optLabel, { backgroundColor: labelBg }]}>
                        <Text style={[s.optLabelTxt, { color: answered && (isCorr || (isSel && !isCorr)) ? "#fff" : sub }]}>
                          {OPTION_LABELS[i] ?? String(i + 1)}
                        </Text>
                      </View>
                      <Text style={[s.optTxt, { color: optTxtCol, flex: 1 }]}>{opt}</Text>
                      {answered && isCorr         && <Ionicons name="checkmark-circle" size={22} color="#4ade80" />}
                      {answered && isSel && !isCorr && <Ionicons name="close-circle"  size={22} color="#ef4444" />}
                    </Pressable>
                  );
                })}
              </Animated.View>

              {/* Timeout */}
              {answered && selected === null && (
                <View style={[s.infoBox, { backgroundColor: "#ef444415", borderColor: "#ef444444" }]}>
                  <Ionicons name="time-outline" size={15} color="#ef4444" />
                  <Text style={[s.infoTxt, { color: "#ef4444" }]}>நேரம் முடிந்தது! சரியான விடை பச்சையில் தெரிகிறது.</Text>
                </View>
              )}

              {/* Explanation */}
              {answered && selected !== null && selected !== q.correctIndex && !!q.explanation && (
                <View style={[s.infoBox, { backgroundColor: isDarkMode ? "#1a1a2a" : "#f0f4ff", borderColor: "#6366f144" }]}>
                  <Ionicons name="bulb-outline" size={15} color="#6366f1" />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.infoLabel, { color: "#6366f1" }]}>விளக்கம்</Text>
                    <Text style={[s.infoTxt, { color: isDarkMode ? "#c7d2fe" : "#3730a3" }]}>{q.explanation}</Text>
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        )}

        {/* ━━━ RESULT ━━━ */}
        {phase === "result" && prevResult && (
          <ScrollView contentContainerStyle={s.resultScroll} showsVerticalScrollIndicator={false}>
            <Pressable onPress={handleClose} style={[s.iconBtn, { alignSelf: "flex-end", margin: 16 }]} hitSlop={12}>
              <Ionicons name="close" size={24} color={txt} />
            </Pressable>

            <View style={[s.trophyWrap, { backgroundColor: DAILY_COLOR + "22" }]}>
              <Ionicons
                name={prevResult.percentage >= 60 ? "trophy" : "refresh-circle-outline"}
                size={54} color={DAILY_COLOR}
              />
            </View>

            <Text style={[s.heading, { color: txt }]}>
              {prevResult.percentage >= 85 ? "மிகச் சிறப்பு! 🌟" :
               prevResult.percentage >= 60 ? "நல்லது! 👍" : "மேலும் படியுங்கள் 📖"}
            </Text>
            <Text style={[s.subTxt, { color: sub }]}>இன்றைய Quiz முடிந்தது · {formatDateTa(dateStr)}</Text>

            <StarRow score={prevResult.score} total={prevResult.total} />

            <View style={[s.scoreBox, { backgroundColor: card, borderColor: border }]}>
              <View style={s.scoreCell}>
                <Text style={[s.scoreBig, { color: DAILY_COLOR }]}>{prevResult.score}</Text>
                <Text style={[s.scoreLbl, { color: sub }]}>சரியான விடை</Text>
              </View>
              <View style={[s.scoreDivider, { backgroundColor: border }]} />
              <View style={s.scoreCell}>
                <Text style={[s.scoreBig, { color: txt }]}>{prevResult.total}</Text>
                <Text style={[s.scoreLbl, { color: sub }]}>மொத்தம்</Text>
              </View>
              <View style={[s.scoreDivider, { backgroundColor: border }]} />
              <View style={s.scoreCell}>
                <Text style={[s.scoreBig, { color: "#f0bc42" }]}>{prevResult.percentage}%</Text>
                <Text style={[s.scoreLbl, { color: sub }]}>மதிப்பெண்</Text>
              </View>
            </View>

            <Pressable
              style={({ pressed }) => [s.reviewBtn, { backgroundColor: card, borderColor: border, opacity: pressed ? 0.7 : 1 }]}
              onPress={() => setPhase("review")}
            >
              <Ionicons name="list-circle-outline" size={20} color={DAILY_COLOR} />
              <Text style={[s.reviewBtnTxt, { color: DAILY_COLOR }]}>விடைகளை மதிப்பாய்வு செய்</Text>
            </Pressable>

            <View style={[s.noteBox, { backgroundColor: DAILY_COLOR + "14", borderColor: DAILY_COLOR + "44", marginTop: 12 }]}>
              <Ionicons name="checkmark-circle-outline" size={16} color={DAILY_COLOR} />
              <Text style={[s.noteTxt, { color: DAILY_COLOR }]}>நாளை புதிய Daily Quiz கிடைக்கும்!</Text>
            </View>

            <Pressable
              style={({ pressed }) => [s.closeBtn, { borderColor: border, opacity: pressed ? 0.7 : 1, marginTop: 12 }]}
              onPress={handleClose}
            >
              <Text style={[s.closeBtnTxt, { color: sub }]}>மூடு</Text>
            </Pressable>
          </ScrollView>
        )}

        {/* ━━━ REVIEW ━━━ */}
        {phase === "review" && (
          <View style={{ flex: 1 }}>
            <View style={[s.playHeader, { borderBottomColor: border }]}>
              <Pressable onPress={() => setPhase("result")} style={s.iconBtn} hitSlop={12}>
                <Ionicons name="arrow-back" size={22} color={txt} />
              </Pressable>
              <View style={{ flex: 1, alignItems: "center" }}>
                <Text style={[s.heading, { color: txt, fontSize: 18, marginBottom: 0 }]}>விடை மதிப்பாய்வு</Text>
                <Text style={[s.subTxt, { color: sub }]}>{score}/{questions.length} சரி</Text>
              </View>
              <Pressable onPress={handleClose} style={s.iconBtn} hitSlop={12}>
                <Ionicons name="close" size={22} color={txt} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={s.reviewScroll} showsVerticalScrollIndicator={false}>
              {answeredLog.map((entry, idx) => {
                const isCorrect = entry.userAnswer === entry.correctIndex;
                const isTimeout = entry.userAnswer === null;
                const bClr      = isCorrect ? "#4ade80" : "#ef4444";
                const bgClr     = isCorrect ? (isDarkMode ? "#4ade8015" : "#f0fff4") : (isDarkMode ? "#ef444415" : "#fff5f5");

                return (
                  <View key={idx} style={[s.reviewCard, { backgroundColor: bgClr, borderColor: bClr + "88" }]}>
                    <View style={s.reviewHeader}>
                      <View style={[s.reviewBadge, { backgroundColor: bClr + "33" }]}>
                        <Text style={[s.reviewQNum, { color: bClr }]}>Q{idx + 1}</Text>
                      </View>
                      <Ionicons name={isCorrect ? "checkmark-circle" : isTimeout ? "time" : "close-circle"} size={18} color={bClr} />
                      <Text style={[s.reviewStatus, { color: bClr }]}>
                        {isCorrect ? "சரி" : isTimeout ? "நேரம் முடிந்தது" : "தவறு"}
                      </Text>
                    </View>

                    <Text style={[s.reviewQ, { color: txt }]}>{entry.question}</Text>

                    <View style={s.reviewOpts}>
                      {entry.options.map((opt, i) => {
                        const isC = i === entry.correctIndex;
                        const isU = i === entry.userAnswer;
                        const c   = isC ? "#4ade80" : isU ? "#ef4444" : sub;
                        return (
                          <View key={i} style={[s.reviewOptRow, { backgroundColor: isC ? "#4ade8022" : isU ? "#ef444422" : "transparent", borderColor: c + "55" }]}>
                            <View style={[s.reviewOptLbl, { backgroundColor: c + "33" }]}>
                              <Text style={[s.reviewOptLblTxt, { color: c }]}>{OPTION_LABELS[i]}</Text>
                            </View>
                            <Text style={[s.reviewOptTxt, { color: isC || isU ? c : sub }]} numberOfLines={2}>{opt}</Text>
                            {isC && <Ionicons name="checkmark-circle" size={14} color="#4ade80" />}
                            {isU && !isC && <Ionicons name="close-circle" size={14} color="#ef4444" />}
                          </View>
                        );
                      })}
                    </View>

                    {!!entry.explanation && (
                      <View style={[s.infoBox, { marginTop: 10, backgroundColor: isDarkMode ? "#1a1a2a" : "#f0f4ff", borderColor: "#6366f144" }]}>
                        <Ionicons name="bulb-outline" size={13} color="#6366f1" />
                        <View style={{ flex: 1 }}>
                          <Text style={[s.infoLabel, { color: "#6366f1" }]}>விளக்கம்</Text>
                          <Text style={[s.infoTxt, { color: isDarkMode ? "#c7d2fe" : "#3730a3" }]}>{entry.explanation}</Text>
                        </View>
                      </View>
                    )}
                  </View>
                );
              })}
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        )}

      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:    { flex: 1 },
  center:  { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadTxt: { fontSize: 14 },

  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },

  resultScroll: { paddingHorizontal: 24, paddingBottom: 52, alignItems: "center" },

  trophyWrap:  { width: 100, height: 100, borderRadius: 28, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  heading:     { fontSize: 22, fontWeight: "800", textAlign: "center", marginBottom: 4 },
  subTxt:      { fontSize: 13, textAlign: "center", marginBottom: 8 },

  statPills:   { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center", marginVertical: 12 },
  pill:        { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  pillTxt:     { fontSize: 12, fontWeight: "600" },

  noteBox:     { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12, borderRadius: 12, borderWidth: 1, width: "100%" },
  noteTxt:     { fontSize: 13, flex: 1, lineHeight: 18 },

  startBtn:    { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 16, paddingHorizontal: 32, borderRadius: 16, width: "100%" },
  startBtnTxt: { color: "#fff", fontSize: 17, fontWeight: "800" },

  closeBtn:    { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12, borderWidth: 1.5, alignItems: "center" },
  closeBtnTxt: { fontSize: 14, fontWeight: "600" },

  scoreBox:    { flexDirection: "row", borderRadius: 18, borderWidth: 1, padding: 20, width: "100%", marginTop: 14, marginBottom: 14 },
  scoreCell:   { flex: 1, alignItems: "center" },
  scoreBig:    { fontSize: 32, fontWeight: "800" },
  scoreLbl:    { fontSize: 11, marginTop: 4, textAlign: "center" },
  scoreDivider:{ width: 1 },

  reviewBtn:   { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, width: "100%" },
  reviewBtnTxt:{ fontSize: 14, fontWeight: "700" },

  // Playing
  playHeader:  { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1 },
  playMid:     { flex: 1, alignItems: "center" },
  levelPill:   { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  levelPillTxt:{ fontSize: 13, fontWeight: "700" },
  timerPill:   { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 10, borderWidth: 1 },
  timerTxt:    { fontSize: 12, fontWeight: "700" },

  progressTrack: { height: 4 },
  progressFill:  { height: 4, borderRadius: 2 },
  progressRow:   { flexDirection: "row", justifyContent: "space-between", marginTop: 6, marginBottom: 4 },
  progressTxt:   { fontSize: 12 },
  playScroll:    { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 40 },

  questionCard:  { borderRadius: 18, borderWidth: 1.5, padding: 20, marginBottom: 20 },
  qNumPill:      { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, marginBottom: 12 },
  qNumTxt:       { fontSize: 12, fontWeight: "700" },
  questionTxt:   { fontSize: 18, fontWeight: "600", lineHeight: 28 },

  optBtn:      { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 14, borderWidth: 1.5, marginBottom: 12, padding: 14 },
  optLabel:    { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  optLabelTxt: { fontSize: 13, fontWeight: "700" },
  optTxt:      { fontSize: 15, fontWeight: "500", lineHeight: 22 },

  infoBox:     { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12, borderRadius: 12, borderWidth: 1, marginTop: 4 },
  infoLabel:   { fontSize: 11, fontWeight: "700", marginBottom: 2 },
  infoTxt:     { fontSize: 13, lineHeight: 18 },

  // Review
  reviewScroll: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 40 },
  reviewCard:   { borderRadius: 14, borderWidth: 1.5, padding: 12, marginBottom: 12 },
  reviewHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  reviewBadge:  { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  reviewQNum:   { fontSize: 11, fontWeight: "800" },
  reviewStatus: { fontSize: 12, fontWeight: "700", flex: 1 },
  reviewQ:      { fontSize: 14, fontWeight: "600", lineHeight: 20, marginBottom: 10 },
  reviewOpts:   { gap: 5 },
  reviewOptRow: { flexDirection: "row", alignItems: "center", gap: 7, paddingVertical: 6, paddingHorizontal: 8, borderRadius: 9, borderWidth: 1 },
  reviewOptLbl: { width: 22, height: 22, borderRadius: 6, alignItems: "center", justifyContent: "center" },
  reviewOptLblTxt: { fontSize: 10, fontWeight: "800" },
  reviewOptTxt: { flex: 1, fontSize: 12, lineHeight: 16 },
});
