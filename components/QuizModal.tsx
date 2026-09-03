import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Speech from "expo-speech";
import CoinPopup         from "@/components/CoinPopup";
import BadgeUnlockPopup  from "@/components/BadgeUnlockPopup";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useApp } from "@/context/AppContext";
import {
  getQuizzesByTrack,
  type UnifiedQuiz,
} from "@/data/unifiedStorage";
import {
  getQuizProgress,
  saveLevelResult,
  type LevelId,
  type LevelResult,
  type TrackQuizProgress,
} from "@/data/quizProgress";
import type { FBQuizQuestion } from "@/services/firebase.firestore";
import { getUserId } from "@/services/userId";
import { useCoins }  from "@/context/CoinsContext";
import { useBadges } from "@/context/BadgesContext";
import {
  saveProgressToCloud,
  loadProgressFromCloud,
  getAttempts,
  incrementAttempt,
  canAttempt,
  remainingAttempts,
  saveScore,
  MAX_DAILY_ATTEMPTS,
  type AttemptData,
} from "@/services/quiz.firebase";

// ─── Constants ────────────────────────────────────────────────────────────────

const VOICE_MODE_KEY  = "quiz_voice_mode_v1";
const QUESTION_TIMER  = 15;   // seconds per question
const OPTION_LABELS   = ["A", "B", "C", "D"];

// Distinct per-option colors (A: red, B: amber, C: blue, D: green) — applied as
// the box accent while the question is unanswered. Answer feedback (green for
// correct / red for the wrong pick) still overrides these on selection.
const OPTION_COLORS   = ["#ef4444", "#f59e0b", "#3b82f6", "#22c55e"];
const MAX_OPTIONS     = 4;

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = "select" | "playing" | "result" | "review";

interface LevelCfg {
  id: LevelId;
  label: string;
  labelTa: string;
  icon: string;
  color: string;
  qStart: number;
  qEnd: number;
}

interface AnsweredEntry {
  question:     string;
  options:      string[];
  correctIndex: number;
  userAnswer:   number | null;   // null = timed out
  explanation?: string;
}

const LEVEL_CFG: LevelCfg[] = [
  { id: 1, label: "Level 1", labelTa: "ஆரம்ப நிலை", icon: "leaf-outline",   color: "#22c55e", qStart: 0,  qEnd: 5  },
  { id: 2, label: "Level 2", labelTa: "இடை நிலை",   icon: "flash-outline",  color: "#f59e0b", qStart: 5,  qEnd: 15 },
  { id: 3, label: "Level 3", labelTa: "உயர் நிலை",  icon: "trophy-outline", color: "#ef4444", qStart: 15, qEnd: 30 },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface QuizModalProps {
  visible: boolean;
  onClose: () => void;
  trackId: string;
  trackTitle: string;
  categoryId?: string;
  prizeEnabled?: boolean;
  firestoreQuestions?: FBQuizQuestion[];
}

// ─── Web Audio tones ──────────────────────────────────────────────────────────

function playTone(freq: number, dur: number, type: OscillatorType = "sine") {
  if (typeof window === "undefined") return;
  try {
    const AC = (window as any).AudioContext ?? (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx  = new AC();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.22, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + dur);
  } catch {}
}

async function playSoundFor(kind: "correct" | "wrong" | "complete" | "timeout") {
  if (Platform.OS === "web") {
    if (kind === "correct") {
      playTone(660, 0.13);
      setTimeout(() => playTone(880, 0.18), 110);
    } else if (kind === "wrong" || kind === "timeout") {
      playTone(180, 0.3, "square");
    } else {
      playTone(440, 0.13);
      setTimeout(() => playTone(550, 0.13), 120);
      setTimeout(() => playTone(660, 0.28), 240);
    }
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
  if (!total) return 0;
  const p = score / total;
  return p >= 0.85 ? 3 : p >= 0.6 ? 2 : p > 0 ? 1 : 0;
}

// ─── StarRow ──────────────────────────────────────────────────────────────────

function StarRow({ score, total }: { score: number; total: number }) {
  const s = starsFor(score, total);
  return (
    <View style={{ flexDirection: "row", gap: 8, justifyContent: "center", marginVertical: 10 }}>
      {[1, 2, 3].map(n => (
        <Ionicons key={n} name={n <= s ? "star" : "star-outline"} size={34} color={n <= s ? "#f0bc42" : "#444"} />
      ))}
    </View>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function QuizModal({
  visible, onClose, trackId, trackTitle, firestoreQuestions,
}: QuizModalProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isDarkMode } = useApp();
  const { addCoins }        = useCoins();
  const { checkAndAward }   = useBadges();

  const bg     = isDarkMode ? "#0a0a0a" : "#f5f5f5";
  const card   = isDarkMode ? "#1a1a1a" : "#ffffff";
  const txt    = isDarkMode ? "#f0f0f0" : "#111111";
  const sub    = isDarkMode ? "#888888" : "#666666";
  const border = isDarkMode ? "#2a2a2a" : "#e5e5e5";

  // ── Existing quiz state ───────────────────────────────────────────────────
  const [questions, setQuestions] = useState<UnifiedQuiz[]>([]);
  const [progress,  setProgress]  = useState<TrackQuizProgress>({});

  const [phase,       setPhase]       = useState<Phase>("select");
  const [activeLevel, setActiveLevel] = useState<LevelId>(1);
  const [levelQs,     setLevelQs]     = useState<UnifiedQuiz[]>([]);
  const [qIdx,        setQIdx]        = useState(0);
  const [selected,    setSelected]    = useState<number | null>(null);
  const [answered,    setAnswered]    = useState(false);
  const [score,       setScore]       = useState(0);
  const [streak,      setStreak]      = useState(0);
  const scoreRef = useRef(0);

  // ── New state ─────────────────────────────────────────────────────────────
  const [timer,         setTimer]         = useState(QUESTION_TIMER);
  const [answeredLog,   setAnsweredLog]   = useState<AnsweredEntry[]>([]);
  const [userId,        setUserId]        = useState("");
  const [levelAttempts, setLevelAttempts] = useState<Record<LevelId, AttemptData>>({
    1: { date: "", count: 0 },
    2: { date: "", count: 0 },
    3: { date: "", count: 0 },
  });

  const levelStartTimeRef = useRef<number>(0);
  const timerRef          = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Voice/TTS state ───────────────────────────────────────────────────────
  const [voiceMode,  setVoiceMode]  = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const voiceModeRef = useRef(true);

  useEffect(() => { voiceModeRef.current = voiceMode; }, [voiceMode]);

  // ── Load voice mode ───────────────────────────────────────────────────────
  useEffect(() => {
    AsyncStorage.getItem(VOICE_MODE_KEY).then(val => {
      const on = val !== "off";
      setVoiceMode(on);
      voiceModeRef.current = on;
    });
  }, []);

  // ── Load userId and attempt counts when modal opens ───────────────────────
  useEffect(() => {
    if (!visible || !trackId) return;
    getUserId().then(uid => {
      setUserId(uid);
      // Load attempt counts for all 3 levels
      Promise.all(LEVEL_CFG.map(cfg => getAttempts(trackId, cfg.id))).then(
        ([a1, a2, a3]) => setLevelAttempts({ 1: a1, 2: a2, 3: a3 }),
      );
    });
  }, [visible, trackId]);

  // ── Timer countdown per question ──────────────────────────────────────────
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

  // ── Load quiz data ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!visible || !trackId) return;
    setPhase("select");
    setScore(0);
    setStreak(0);
    setAnsweredLog([]);
    stopSpeech();

    if (firestoreQuestions) {
      const mapped = firestoreQuestions.map((q, i) => ({
        id:           `fb_${trackId}_${i}`,
        trackId,
        categoryId:   "",
        addedAt:      0,
        question:     q.question,
        options:      q.options,
        correctIndex: q.correctIndex,
        explanation:  q.explanation,
      }));
      // Try cloud progress first, fallback to local
      getUserId().then(uid =>
        loadProgressFromCloud(uid, trackId).then(cloudProg => {
          getQuizProgress(trackId).then(localProg => {
            setQuestions(mapped);
            setProgress(cloudProg ?? localProg);
          });
        })
      ).catch(() => {
        getQuizProgress(trackId).then(prog => {
          setQuestions(mapped);
          setProgress(prog);
        });
      });
    } else {
      Promise.all([getQuizzesByTrack(trackId), getQuizProgress(trackId)]).then(
        ([qs, prog]) => {
          setQuestions(qs);
          setProgress(prog);
        },
      );
    }
  }, [visible, trackId, firestoreQuestions]);

  // ── Stop speech when leaving playing phase ────────────────────────────────
  useEffect(() => {
    if (phase !== "playing") stopSpeech();
  }, [phase]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => () => { stopSpeech(); if (timerRef.current) clearInterval(timerRef.current); }, []);

  // ── Animations ────────────────────────────────────────────────────────────
  const fadeQ     = useRef(new Animated.Value(0)).current;
  const slideQ    = useRef(new Animated.Value(28)).current;
  // Per-option entry progress (0→1) and a press/selection bounce scale (≈1).
  const optEntry  = useRef(Array.from({ length: MAX_OPTIONS }, () => new Animated.Value(0))).current;
  const optPress  = useRef(Array.from({ length: MAX_OPTIONS }, () => new Animated.Value(1))).current;

  const animateIn = useCallback(() => {
    fadeQ.setValue(0); slideQ.setValue(28);
    optEntry.forEach(v => v.setValue(0));
    optPress.forEach(v => v.setValue(1));
    Animated.parallel([
      Animated.timing(fadeQ,  { toValue: 1, duration: 260, useNativeDriver: true }),
      Animated.spring(slideQ, { toValue: 0, useNativeDriver: true, tension: 90, friction: 9 }),
      // Staggered bounce-in for each option box
      Animated.stagger(
        70,
        optEntry.map(v =>
          Animated.spring(v, { toValue: 1, useNativeDriver: true, tension: 120, friction: 7 }),
        ),
      ),
    ]).start();
  }, [fadeQ, slideQ, optEntry, optPress]);

  // Quick scale pop when an option is tapped (selection state change).
  const bounceOption = useCallback((i: number) => {
    const v = optPress[i];
    if (!v) return;
    Animated.sequence([
      Animated.timing(v, { toValue: 1.07, duration: 110, useNativeDriver: true }),
      Animated.spring(v,  { toValue: 1, useNativeDriver: true, tension: 140, friction: 6 }),
    ]).start();
  }, [optPress]);

  useEffect(() => {
    if (phase === "playing") animateIn();
  }, [phase, qIdx, animateIn]);

  // ── Auto-speak question ───────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "playing" || levelQs.length === 0) return;
    const q = levelQs[qIdx];
    if (!q) return;
    const timer = setTimeout(() => {
      if (voiceModeRef.current) speakQuestion(q);
    }, 350);
    return () => { clearTimeout(timer); stopSpeech(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qIdx, phase]);

  // ── Speech helpers ────────────────────────────────────────────────────────

  function stopSpeech() {
    try { Speech.stop(); } catch {}
    setIsSpeaking(false);
  }

  async function toggleVoiceMode() {
    const next = !voiceModeRef.current;
    voiceModeRef.current = next;
    setVoiceMode(next);
    await AsyncStorage.setItem(VOICE_MODE_KEY, next ? "on" : "off");
    if (!next) stopSpeech();
  }

  function speakOptionsChain(quiz: UnifiedQuiz, idx: number) {
    if (!voiceModeRef.current || idx >= quiz.options.length) { setIsSpeaking(false); return; }
    const label = OPTION_LABELS[idx] ?? String(idx + 1);
    try {
      Speech.speak(`${label}. ${quiz.options[idx]}`, {
        language: "ta-IN",
        onDone:   () => speakOptionsChain(quiz, idx + 1),
        onError:  () => setIsSpeaking(false),
      });
    } catch { setIsSpeaking(false); }
  }

  function speakQuestion(quiz: UnifiedQuiz) {
    if (!voiceModeRef.current) return;
    stopSpeech();
    setIsSpeaking(true);
    try {
      Speech.speak(quiz.question, {
        language: "ta-IN",
        onDone:   () => speakOptionsChain(quiz, 0),
        onError:  () => setIsSpeaking(false),
      });
    } catch { setIsSpeaking(false); }
  }

  // ── Level helpers ─────────────────────────────────────────────────────────

  const levelQCount   = (cfg: LevelCfg) => Math.max(0, Math.min(cfg.qEnd, questions.length) - cfg.qStart);
  const isLevelAvailable = (cfg: LevelCfg) => levelQCount(cfg) > 0;

  const isLevelUnlocked = (id: LevelId): boolean => {
    if (id === 1) return true;
    if (id === 2) return !!progress.level1?.completed;
    if (id === 3) return !!progress.level2?.completed;
    return false;
  };

  const getLevelResult = (id: LevelId): LevelResult | undefined =>
    (progress as any)[`level${id}`];

  const getLevelAttempts = (id: LevelId): AttemptData => levelAttempts[id];
  const levelCanStart    = (id: LevelId) => canAttempt(getLevelAttempts(id));
  const levelRemaining   = (id: LevelId) => remainingAttempts(getLevelAttempts(id));

  // ── Actions ───────────────────────────────────────────────────────────────

  async function startLevel(cfg: LevelCfg) {
    // Check attempt limit
    const attempts = await getAttempts(trackId, cfg.id);
    if (!canAttempt(attempts)) return; // blocked (UI disables button too)

    // Increment attempt count
    await incrementAttempt(userId || await getUserId(), trackId, cfg.id);

    // Refresh attempt counts in state
    const fresh = await getAttempts(trackId, cfg.id);
    setLevelAttempts(prev => ({ ...prev, [cfg.id]: fresh }));

    const qs = shuffle(questions.slice(cfg.qStart, Math.min(cfg.qEnd, questions.length)));
    setActiveLevel(cfg.id);
    setLevelQs(qs);
    setQIdx(0);
    setSelected(null);
    setAnswered(false);
    scoreRef.current = 0;
    setScore(0);
    setStreak(0);
    setAnsweredLog([]);
    levelStartTimeRef.current = Date.now();
    setPhase("playing");
  }

  function handleSelect(optIdx: number) {
    if (answered) return;
    if (timerRef.current) clearInterval(timerRef.current);
    stopSpeech();
    bounceOption(optIdx);
    setSelected(optIdx);
    setAnswered(true);

    const q       = levelQs[qIdx];
    const correct = q.correctIndex === optIdx;

    // Log this answer for review
    setAnsweredLog(prev => [...prev, {
      question:     q.question,
      options:      q.options,
      correctIndex: q.correctIndex,
      userAnswer:   optIdx,
      explanation:  q.explanation,
    }]);

    if (correct) {
      const newStreak = streak + 1;
      scoreRef.current += 1;
      setScore(scoreRef.current);
      setStreak(newStreak);
      playSoundFor("correct");
      addCoins(10, "quiz_reward", `Correct answer – ${trackTitle}`);
      if (newStreak === 5) checkAndAward("STREAK_5");
    } else {
      setStreak(0);
      playSoundFor("wrong");
    }
    setTimeout(advanceQ, 1500);
  }

  function handleTimeUp() {
    if (answered) return;
    if (timerRef.current) clearInterval(timerRef.current);
    stopSpeech();
    setAnswered(true);
    setSelected(null);

    // Log as timed out
    const q = levelQs[qIdx];
    if (q) {
      setAnsweredLog(prev => [...prev, {
        question:     q.question,
        options:      q.options,
        correctIndex: q.correctIndex,
        userAnswer:   null,
        explanation:  q.explanation,
      }]);
    }
    playSoundFor("timeout");
    setTimeout(advanceQ, 1200);
  }

  async function advanceQ() {
    const next = qIdx + 1;
    if (next >= levelQs.length) {
      await finishLevel();
    } else {
      setQIdx(next);
      setSelected(null);
      setAnswered(false);
    }
  }

  async function finishLevel() {
    const finalScore  = scoreRef.current;
    const total       = levelQs.length;
    const percentage  = Math.round((finalScore / total) * 100);
    const timeTaken   = Math.round((Date.now() - levelStartTimeRef.current) / 1000);

    const result: LevelResult = {
      completed:   true,
      score:       finalScore,
      total,
      completedAt: Date.now(),
    };

    // Save locally
    await saveLevelResult(trackId, activeLevel, result);
    const fresh = await getQuizProgress(trackId);
    setProgress(fresh);

    // Save to cloud (parallel, non-blocking)
    const uid = userId || await getUserId();
    saveProgressToCloud(uid, trackId, activeLevel, result);

    // Full score bonus
    if (finalScore === total && total > 0) {
      addCoins(50, "full_score_bonus", `Perfect score – ${trackTitle} Level ${activeLevel}`);
      checkAndAward("FULL_SCORE");
    }

    // Level Master: check if ALL 3 levels completed
    const allCompleted = LEVEL_CFG.every(l => fresh[`level${l.id}` as keyof typeof fresh]?.completed);
    if (allCompleted) checkAndAward("LEVEL_MASTER");

    // Save to leaderboard
    saveScore({
      userId:     uid,
      cardId:     trackId,
      level:      activeLevel,
      score:      finalScore,
      total,
      percentage,
      timeTaken,
    });

    playSoundFor("complete");
    setPhase("result");
  }

  function restartLevel() {
    const cfg = LEVEL_CFG.find(l => l.id === activeLevel)!;
    startLevel(cfg);
  }

  function goNextLevel() {
    const nextId = (activeLevel + 1) as LevelId;
    const next   = LEVEL_CFG.find(l => l.id === nextId);
    if (next && isLevelAvailable(next)) startLevel(next);
  }

  function handleClose() {
    stopSpeech();
    if (timerRef.current) clearInterval(timerRef.current);
    setPhase("select");
    onClose();
  }

  // ── Current question ──────────────────────────────────────────────────────
  const q         = phase === "playing" ? levelQs[qIdx] : null;
  const activeCfg = LEVEL_CFG.find(l => l.id === activeLevel)!;
  const nextCfg   = LEVEL_CFG.find(l => l.id === ((activeLevel + 1) as LevelId));

  const timeTakenSec = Math.round((Date.now() - levelStartTimeRef.current) / 1000);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose} statusBarTranslucent>
      <View style={[s.root, { backgroundColor: bg, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <CoinPopup />
        <BadgeUnlockPopup />

        {/* ━━━ LEVEL SELECT ━━━ */}
        {phase === "select" && (
          <ScrollView contentContainerStyle={s.selScroll} showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={s.selHeader}>
              <Pressable onPress={handleClose} style={s.iconBtn} hitSlop={12}>
                <Ionicons name="close" size={24} color={txt} />
              </Pressable>
              <View style={{ flex: 1, alignItems: "center" }}>
                <Text style={[s.selTitle, { color: txt }]}>Quiz</Text>
                <Text style={[s.selSub, { color: sub }]} numberOfLines={1}>{trackTitle}</Text>
              </View>
              <Pressable
                onPress={toggleVoiceMode}
                style={[s.iconBtn, { backgroundColor: voiceMode ? "#1a7a4a22" : "transparent" }]}
                hitSlop={12}
              >
                <Ionicons
                  name={voiceMode ? "volume-high-outline" : "volume-mute-outline"}
                  size={22}
                  color={voiceMode ? "#1a7a4a" : sub}
                />
              </Pressable>
            </View>

            {/* Question count badge */}
            <View style={[s.trackBadge, { backgroundColor: card, borderColor: border }]}>
              <View style={[s.trackBadgeIcon, { backgroundColor: "#1a7a4a22" }]}>
                <Ionicons name="help-circle" size={28} color="#1a7a4a" />
              </View>
              <View>
                <Text style={[s.trackBadgeNum, { color: txt }]}>{questions.length}</Text>
                <Text style={[s.trackBadgeLbl, { color: sub }]}>கேள்விகள் உள்ளன</Text>
              </View>
            </View>

            <Text style={[s.sectionLbl, { color: sub }]}>நிலையை தேர்வு செய்யுங்கள்</Text>

            {/* Level cards */}
            {LEVEL_CFG.map(cfg => {
              const available  = isLevelAvailable(cfg);
              const unlocked   = isLevelUnlocked(cfg.id);
              const result     = getLevelResult(cfg.id);
              const count      = levelQCount(cfg);
              const attempts   = getLevelAttempts(cfg.id);
              const attemptsOk = canAttempt(attempts);
              const remaining  = remainingAttempts(attempts);
              const locked     = !available || !unlocked || !attemptsOk;

              return (
                <Pressable
                  key={cfg.id}
                  style={({ pressed }) => [
                    s.levelCard,
                    {
                      backgroundColor: card,
                      borderColor: locked ? border : cfg.color + "55",
                      opacity: locked ? 0.55 : pressed ? 0.82 : 1,
                    },
                  ]}
                  onPress={() => !locked && startLevel(cfg)}
                  disabled={locked}
                >
                  <View style={[s.levelStripe, { backgroundColor: cfg.color }]} />

                  <View style={[s.levelIconBubble, { backgroundColor: cfg.color + "22" }]}>
                    <Ionicons
                      name={(locked ? "lock-closed-outline" : cfg.icon) as any}
                      size={24}
                      color={locked ? sub : cfg.color}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={[s.levelCardTitle, { color: txt }]}>{cfg.label}</Text>
                    <Text style={[s.levelCardSub, { color: sub }]}>
                      {cfg.labelTa}{available ? `  ·  ${count} கேள்விகள்` : "  ·  கேள்விகள் இல்லை"}
                    </Text>

                    {/* Previous stars */}
                    {result && (
                      <View style={s.levelResultRow}>
                        {[1, 2, 3].map(n => (
                          <Ionicons
                            key={n}
                            name={n <= starsFor(result.score, result.total) ? "star" : "star-outline"}
                            size={13}
                            color={n <= starsFor(result.score, result.total) ? "#f0bc42" : "#888"}
                          />
                        ))}
                        <Text style={[s.levelResultScore, { color: sub }]}>
                          {result.score}/{result.total}
                        </Text>
                      </View>
                    )}

                    {/* Attempt count */}
                    {!attemptsOk ? (
                      <View style={[s.attemptBadge, { backgroundColor: "#ef444422" }]}>
                        <Ionicons name="time-outline" size={11} color="#ef4444" />
                        <Text style={[s.attemptTxt, { color: "#ef4444" }]}>
                          இன்றைய முயற்சிகள் முடிந்துவிட்டது
                        </Text>
                      </View>
                    ) : (
                      <View style={[s.attemptBadge, { backgroundColor: cfg.color + "18" }]}>
                        <Ionicons name="refresh-outline" size={11} color={cfg.color} />
                        <Text style={[s.attemptTxt, { color: cfg.color }]}>
                          {remaining}/{MAX_DAILY_ATTEMPTS} முயற்சிகள் எஞ்சியுள்ளன
                        </Text>
                      </View>
                    )}
                  </View>

                  {!locked && <Ionicons name="chevron-forward" size={20} color={sub} />}
                </Pressable>
              );
            })}

            {/* Hint */}
            <View style={[s.hintBox, { backgroundColor: "#1a7a4a18", borderColor: "#1a7a4a44" }]}>
              <Ionicons name="information-circle-outline" size={16} color="#1a7a4a" />
              <Text style={[s.hintText, { color: "#1a7a4a" }]}>
                Level 1 முடித்தால் Level 2 திறக்கும். Level 2 முடித்தால் Level 3 திறக்கும். தினசரி 3 முயற்சிகள் மட்டும்.
              </Text>
            </View>
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
              <View style={s.playHeaderMid}>
                <View style={[s.levelPill, { backgroundColor: activeCfg.color + "22" }]}>
                  <Ionicons name={activeCfg.icon as any} size={13} color={activeCfg.color} />
                  <Text style={[s.levelPillTxt, { color: activeCfg.color }]}>{activeCfg.label}</Text>
                </View>
                {streak >= 3 && (
                  <View style={[s.streakPill, { marginTop: 4 }]}>
                    <Text style={s.streakTxt}>🔥 {streak}</Text>
                  </View>
                )}
              </View>
              <Pressable
                onPress={toggleVoiceMode}
                style={[s.iconBtn, { backgroundColor: voiceMode ? activeCfg.color + "22" : "transparent" }]}
                hitSlop={12}
              >
                <Ionicons
                  name={voiceMode ? "volume-high-outline" : "volume-mute-outline"}
                  size={20}
                  color={voiceMode ? activeCfg.color : sub}
                />
              </Pressable>
            </View>

            {/* Progress bar */}
            <View style={[s.progressTrack, { backgroundColor: border }]}>
              <View style={[s.progressFill, { backgroundColor: activeCfg.color, width: `${(qIdx / levelQs.length) * 100}%` }]} />
            </View>

            {/* Progress row */}
            <View style={[s.progressRow, { paddingHorizontal: 18 }]}>
              <Text style={[s.progressTxt, { color: sub }]}>
                கேள்வி {qIdx + 1} / {levelQs.length}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Text style={[s.progressTxt, { color: "#22c55e" }]}>✅ {score}</Text>

                {/* Timer */}
                <View style={[
                  s.timerPill,
                  { backgroundColor: timer <= 5 ? "#ef444422" : activeCfg.color + "18",
                    borderColor:      timer <= 5 ? "#ef444488" : activeCfg.color + "44" },
                ]}>
                  <Ionicons
                    name="time-outline"
                    size={12}
                    color={timer <= 5 ? "#ef4444" : activeCfg.color}
                  />
                  <Text style={[s.timerTxt, { color: timer <= 5 ? "#ef4444" : activeCfg.color }]}>
                    {timer}s
                  </Text>
                </View>

                {/* Listen again */}
                {voiceMode && (
                  <Pressable
                    onPress={() => q && speakQuestion(q)}
                    style={[s.listenBtn, { borderColor: activeCfg.color + "66", backgroundColor: activeCfg.color + "18" }]}
                    hitSlop={8}
                  >
                    <Ionicons
                      name={isSpeaking ? "pause-circle-outline" : "volume-medium-outline"}
                      size={14}
                      color={activeCfg.color}
                    />
                    <Text style={[s.listenBtnTxt, { color: activeCfg.color }]}>
                      {isSpeaking ? "படிக்கிறது..." : "மீண்டும் கேள்"}
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>

            <ScrollView contentContainerStyle={s.playScroll} showsVerticalScrollIndicator={false}>
              {/* Question card */}
              <Animated.View style={[
                s.questionCard,
                { backgroundColor: card, borderColor: border, opacity: fadeQ, transform: [{ translateY: slideQ }] },
              ]}>
                <View style={[s.qNumPill, { backgroundColor: activeCfg.color + "30" }]}>
                  <Text style={[s.qNumTxt, { color: activeCfg.color }]}>Q{qIdx + 1}</Text>
                </View>
                <Text style={[s.questionTxt, { color: txt }]}>{q.question}</Text>
              </Animated.View>

              {/* Options */}
              <View>
                {q.options.map((opt, i) => {
                  const isSel  = selected === i;
                  const isCorr = q.correctIndex === i;
                  const color  = OPTION_COLORS[i % OPTION_COLORS.length];

                  // Unanswered → distinct per-option color accent
                  let optBg     = color + (isDarkMode ? "26" : "1A");
                  let optBorder = color;
                  let optTxtCol = txt;
                  let labelBg   = color;
                  let labelTxt  = "#ffffff";

                  if (answered) {
                    if (isCorr) {
                      optBg = "#4ade8030"; optBorder = "#4ade80";
                      optTxtCol = isDarkMode ? "#4ade80" : "#166534";
                      labelBg = "#4ade80"; labelTxt = "#fff";
                    } else if (isSel) {
                      optBg = "#f8717150"; optBorder = "#ef4444";
                      optTxtCol = isDarkMode ? "#f87171" : "#7f1d1d";
                      labelBg = "#ef4444"; labelTxt = "#fff";
                    } else {
                      // Dim the untouched options once answered
                      optBg = card; optBorder = border;
                      labelBg = isDarkMode ? "#2a2a2a" : "#f0f0f0";
                      labelTxt = sub;
                    }
                  }

                  const entry = optEntry[i] ?? new Animated.Value(1);
                  const press = optPress[i] ?? new Animated.Value(1);
                  const animStyle = {
                    opacity: entry,
                    transform: [
                      { translateY: entry.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) },
                      { scale: Animated.multiply(
                          entry.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }),
                          press,
                        ) },
                    ],
                  };

                  return (
                    <Animated.View key={i} style={animStyle}>
                      <Pressable
                        style={({ pressed }) => [
                          s.optBtn,
                          { backgroundColor: optBg, borderColor: optBorder,
                            opacity: answered && !isSel && !isCorr ? 0.45 : pressed ? 0.85 : 1 },
                        ]}
                        onPress={() => handleSelect(i)}
                        disabled={answered}
                      >
                        <View style={[s.optLabelBox, { backgroundColor: labelBg }]}>
                          <Text style={[s.optLabelTxt, { color: labelTxt }]}>
                            {OPTION_LABELS[i] ?? String(i + 1)}
                          </Text>
                        </View>
                        <Text style={[s.optTxt, { color: optTxtCol, flex: 1 }]}>{opt}</Text>
                        {answered && isCorr  && <Ionicons name="checkmark-circle" size={22} color="#4ade80" />}
                        {answered && isSel && !isCorr && <Ionicons name="close-circle" size={22} color="#ef4444" />}
                      </Pressable>
                    </Animated.View>
                  );
                })}
              </View>

              {/* Timeout message */}
              {answered && selected === null && (
                <View style={[s.timeoutBox, { backgroundColor: "#ef444415", borderColor: "#ef444444" }]}>
                  <Ionicons name="time-outline" size={16} color="#ef4444" />
                  <Text style={[s.timeoutTxt, { color: "#ef4444" }]}>நேரம் முடிந்தது! சரியான விடை பச்சை நிறத்தில் தெரிகிறது.</Text>
                </View>
              )}

              {/* Explanation after wrong answer */}
              {answered && selected !== null && selected !== q.correctIndex && !!q.explanation && (
                <View style={[s.explBox, { backgroundColor: isDarkMode ? "#1a1a2a" : "#f0f4ff", borderColor: "#6366f144" }]}>
                  <Ionicons name="bulb-outline" size={16} color="#6366f1" />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.explLabel, { color: "#6366f1" }]}>விளக்கம்</Text>
                    <Text style={[s.explTxt, { color: isDarkMode ? "#c7d2fe" : "#3730a3" }]}>{q.explanation}</Text>
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        )}

        {/* ━━━ RESULT ━━━ */}
        {phase === "result" && (
          <ScrollView contentContainerStyle={s.resultScroll} showsVerticalScrollIndicator={false}>
            <Pressable onPress={handleClose} style={[s.iconBtn, { alignSelf: "flex-end", margin: 16 }]} hitSlop={12}>
              <Ionicons name="close" size={24} color={txt} />
            </Pressable>

            {/* Trophy */}
            <View style={[s.resultTrophyWrap, { backgroundColor: activeCfg.color + "22" }]}>
              <Ionicons
                name={score / levelQs.length >= 0.6 ? "trophy" : "refresh-circle-outline"}
                size={54}
                color={activeCfg.color}
              />
            </View>

            <Text style={[s.resultHeading, { color: txt }]}>
              {score / levelQs.length >= 0.85 ? "மிகச் சிறப்பு! 🌟" :
               score / levelQs.length >= 0.6  ? "நல்லது! 👍" : "மேலும் படியுங்கள் 📖"}
            </Text>

            <StarRow score={score} total={levelQs.length} />

            {/* Score stats */}
            <View style={[s.scoreBox, { backgroundColor: card, borderColor: border }]}>
              <View style={s.scoreCell}>
                <Text style={[s.scoreBigNum, { color: activeCfg.color }]}>{score}</Text>
                <Text style={[s.scoreCellLbl, { color: sub }]}>சரியான விடை</Text>
              </View>
              <View style={[s.scoreDivider, { backgroundColor: border }]} />
              <View style={s.scoreCell}>
                <Text style={[s.scoreBigNum, { color: txt }]}>{levelQs.length}</Text>
                <Text style={[s.scoreCellLbl, { color: sub }]}>மொத்தம்</Text>
              </View>
              <View style={[s.scoreDivider, { backgroundColor: border }]} />
              <View style={s.scoreCell}>
                <Text style={[s.scoreBigNum, { color: "#f87171" }]}>{levelQs.length - score}</Text>
                <Text style={[s.scoreCellLbl, { color: sub }]}>தவறான விடை</Text>
              </View>
            </View>

            {/* Level tag */}
            <View style={[s.levelPill, { backgroundColor: activeCfg.color + "22", alignSelf: "center", marginTop: 10 }]}>
              <Ionicons name={activeCfg.icon as any} size={13} color={activeCfg.color} />
              <Text style={[s.levelPillTxt, { color: activeCfg.color }]}>{activeCfg.label} முடிந்தது</Text>
            </View>

            {/* Action buttons */}
            <View style={s.resultBtnRow}>
              <Pressable
                style={({ pressed }) => [s.actionBtn, s.actionBtnOutline, { borderColor: border, opacity: pressed ? 0.7 : 1 }]}
                onPress={restartLevel}
              >
                <Ionicons name="refresh" size={18} color={txt} />
                <Text style={[s.actionBtnTxt, { color: txt }]}>மீண்டும்</Text>
              </Pressable>

              {nextCfg && isLevelAvailable(nextCfg) && (
                <Pressable
                  style={({ pressed }) => [s.actionBtn, s.actionBtnPrimary, { opacity: pressed ? 0.82 : 1 }]}
                  onPress={goNextLevel}
                >
                  <Text style={[s.actionBtnTxt, { color: "#fff" }]}>{nextCfg.label}</Text>
                  <Ionicons name="arrow-forward" size={18} color="#fff" />
                </Pressable>
              )}
            </View>

            {/* Review Answers button */}
            <Pressable
              style={({ pressed }) => [s.reviewBtn, { backgroundColor: card, borderColor: border, opacity: pressed ? 0.7 : 1 }]}
              onPress={() => setPhase("review")}
            >
              <Ionicons name="list-circle-outline" size={20} color={activeCfg.color} />
              <Text style={[s.reviewBtnTxt, { color: activeCfg.color }]}>விடைகளை மதிப்பாய்வு செய்</Text>
            </Pressable>

            {/* Leaderboard button */}
            <Pressable
              style={({ pressed }) => [s.lbBtn, { borderColor: "#f0bc4466", backgroundColor: "#f0bc4412", opacity: pressed ? 0.7 : 1 }]}
              onPress={() => {
                handleClose();
                router.push(`/leaderboard/${trackId}?level=${activeLevel}&title=${encodeURIComponent(trackTitle)}` as any);
              }}
            >
              <Ionicons name="trophy-outline" size={18} color="#f0bc42" />
              <Text style={[s.lbBtnTxt, { color: "#f0bc42" }]}>Leaderboard பார்க்க</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [s.backToSelectBtn, { opacity: pressed ? 0.7 : 1 }]}
              onPress={() => setPhase("select")}
            >
              <Ionicons name="list-outline" size={16} color={sub} />
              <Text style={[s.backToSelectTxt, { color: sub }]}>நிலை தேர்வுக்கு திரும்பு</Text>
            </Pressable>
          </ScrollView>
        )}

        {/* ━━━ REVIEW ━━━ */}
        {phase === "review" && (
          <View style={{ flex: 1 }}>
            {/* Header */}
            <View style={[s.playHeader, { borderBottomColor: border }]}>
              <Pressable onPress={() => setPhase("result")} style={s.iconBtn} hitSlop={12}>
                <Ionicons name="arrow-back" size={22} color={txt} />
              </Pressable>
              <View style={{ flex: 1, alignItems: "center" }}>
                <Text style={[s.selTitle, { color: txt }]}>விடை மதிப்பாய்வு</Text>
                <Text style={[s.selSub, { color: sub }]}>
                  {score}/{levelQs.length} சரியான விடைகள்
                </Text>
              </View>
              <Pressable onPress={handleClose} style={s.iconBtn} hitSlop={12}>
                <Ionicons name="close" size={22} color={txt} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={s.reviewScroll} showsVerticalScrollIndicator={false}>
              {answeredLog.map((entry, idx) => {
                const isCorrect = entry.userAnswer === entry.correctIndex;
                const isTimeout = entry.userAnswer === null;
                const borderClr = isCorrect ? "#4ade80" : "#ef4444";
                const bgClr     = isCorrect
                  ? (isDarkMode ? "#4ade8015" : "#f0fff4")
                  : (isDarkMode ? "#ef444415" : "#fff5f5");

                return (
                  <View key={idx} style={[s.reviewCard, { backgroundColor: bgClr, borderColor: borderClr + "88" }]}>
                    {/* Q number + result icon */}
                    <View style={s.reviewCardHeader}>
                      <View style={[s.reviewQBadge, { backgroundColor: borderClr + "33" }]}>
                        <Text style={[s.reviewQNum, { color: borderClr }]}>Q{idx + 1}</Text>
                      </View>
                      <Ionicons
                        name={isCorrect ? "checkmark-circle" : isTimeout ? "time" : "close-circle"}
                        size={20}
                        color={isCorrect ? "#4ade80" : "#ef4444"}
                      />
                      <Text style={[s.reviewStatusTxt, { color: isCorrect ? "#4ade80" : "#ef4444" }]}>
                        {isCorrect ? "சரி" : isTimeout ? "நேரம் முடிந்தது" : "தவறு"}
                      </Text>
                    </View>

                    {/* Question */}
                    <Text style={[s.reviewQuestion, { color: txt }]}>{entry.question}</Text>

                    {/* Options */}
                    <View style={s.reviewOpts}>
                      {entry.options.map((opt, i) => {
                        const isCorrectOpt = i === entry.correctIndex;
                        const isUserOpt    = i === entry.userAnswer;
                        const optColor     = isCorrectOpt ? "#4ade80" : isUserOpt ? "#ef4444" : sub;
                        const optBg        = isCorrectOpt
                          ? "#4ade8022"
                          : isUserOpt && !isCorrectOpt
                          ? "#ef444422"
                          : "transparent";
                        return (
                          <View key={i} style={[s.reviewOptRow, { backgroundColor: optBg, borderColor: optColor + "55" }]}>
                            <View style={[s.reviewOptLabel, { backgroundColor: optColor + "33" }]}>
                              <Text style={[s.reviewOptLabelTxt, { color: optColor }]}>{OPTION_LABELS[i]}</Text>
                            </View>
                            <Text style={[s.reviewOptTxt, { color: isCorrectOpt || isUserOpt ? optColor : sub }]} numberOfLines={2}>
                              {opt}
                            </Text>
                            {isCorrectOpt && <Ionicons name="checkmark-circle" size={16} color="#4ade80" />}
                            {isUserOpt && !isCorrectOpt && <Ionicons name="close-circle" size={16} color="#ef4444" />}
                          </View>
                        );
                      })}
                    </View>

                    {/* Explanation */}
                    {!!entry.explanation && (
                      <View style={[s.explBox, { marginTop: 10, backgroundColor: isDarkMode ? "#1a1a2a" : "#f0f4ff", borderColor: "#6366f144" }]}>
                        <Ionicons name="bulb-outline" size={14} color="#6366f1" />
                        <View style={{ flex: 1 }}>
                          <Text style={[s.explLabel, { color: "#6366f1" }]}>விளக்கம்</Text>
                          <Text style={[s.explTxt, { color: isDarkMode ? "#c7d2fe" : "#3730a3" }]}>{entry.explanation}</Text>
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
  root:            { flex: 1 },

  // ── Select ────────────────────────────────
  selScroll:       { paddingHorizontal: 20, paddingBottom: 48 },
  selHeader:       { flexDirection: "row", alignItems: "center", paddingVertical: 16 },
  iconBtn:         { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  selTitle:        { fontSize: 22, fontWeight: "700" },
  selSub:          { fontSize: 13, marginTop: 2 },

  trackBadge:      { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 24 },
  trackBadgeIcon:  { width: 50, height: 50, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  trackBadgeNum:   { fontSize: 20, fontWeight: "800" },
  trackBadgeLbl:   { fontSize: 12, marginTop: 1 },

  sectionLbl:      { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 12 },

  levelCard:       { flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 16, borderWidth: 1.5, marginBottom: 14, overflow: "hidden", paddingVertical: 16, paddingRight: 16, paddingLeft: 12 },
  levelStripe:     { position: "absolute", left: 0, top: 0, bottom: 0, width: 4 },
  levelIconBubble: { width: 50, height: 50, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  levelCardTitle:  { fontSize: 16, fontWeight: "700" },
  levelCardSub:    { fontSize: 12, marginTop: 2 },
  levelResultRow:  { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 5 },
  levelResultScore:{ fontSize: 12, marginLeft: 4 },

  // Attempt badge
  attemptBadge:    { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, alignSelf: "flex-start" },
  attemptTxt:      { fontSize: 10, fontWeight: "600" },

  hintBox:         { flexDirection: "row", gap: 8, alignItems: "flex-start", padding: 14, borderRadius: 12, borderWidth: 1, marginTop: 6 },
  hintText:        { fontSize: 12, lineHeight: 18, flex: 1 },

  // ── Playing ────────────────────────────────
  playHeader:      { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1 },
  playHeaderMid:   { flex: 1, alignItems: "center" },

  levelPill:       { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  levelPillTxt:    { fontSize: 13, fontWeight: "700" },

  streakPill:      { backgroundColor: "#ff6b3533", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  streakTxt:       { fontSize: 13, fontWeight: "700" },

  listenBtn:       { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, borderWidth: 1 },
  listenBtnTxt:    { fontSize: 11, fontWeight: "600" },

  // Timer pill
  timerPill:       { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 10, borderWidth: 1 },
  timerTxt:        { fontSize: 12, fontWeight: "700" },

  progressTrack:   { height: 4 },
  progressFill:    { height: 4, borderRadius: 2 },
  progressRow:     { flexDirection: "row", justifyContent: "space-between", marginTop: 6, marginBottom: 4, alignItems: "center" },
  progressTxt:     { fontSize: 12 },

  playScroll:      { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 40 },

  questionCard:    { borderRadius: 18, borderWidth: 1.5, padding: 20, marginBottom: 20 },
  qNumPill:        { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, marginBottom: 12 },
  qNumTxt:         { fontSize: 12, fontWeight: "700" },
  questionTxt:     { fontSize: 18, fontWeight: "600", lineHeight: 28 },

  optBtn:          { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 14, borderWidth: 1.5, marginBottom: 12, padding: 14 },
  optLabelBox:     { width: 32, height: 32, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  optLabelTxt:     { fontSize: 13, fontWeight: "700" },
  optTxt:          { fontSize: 15, fontWeight: "500", lineHeight: 22 },

  // Timeout
  timeoutBox:      { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12, borderRadius: 12, borderWidth: 1, marginTop: 4 },
  timeoutTxt:      { fontSize: 13, flex: 1, lineHeight: 18 },

  // Explanation
  explBox:         { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12, borderRadius: 12, borderWidth: 1, marginTop: 4 },
  explLabel:       { fontSize: 11, fontWeight: "700", marginBottom: 2 },
  explTxt:         { fontSize: 13, lineHeight: 20 },

  // ── Result ─────────────────────────────────
  resultScroll:    { paddingHorizontal: 24, paddingBottom: 52, alignItems: "center" },
  resultTrophyWrap:{ width: 100, height: 100, borderRadius: 28, justifyContent: "center", alignItems: "center", marginBottom: 18 },
  resultHeading:   { fontSize: 24, fontWeight: "800", textAlign: "center", marginBottom: 4 },

  scoreBox:        { flexDirection: "row", borderRadius: 18, borderWidth: 1, padding: 20, width: "100%", marginTop: 14, marginBottom: 14 },
  scoreCell:       { flex: 1, alignItems: "center" },
  scoreBigNum:     { fontSize: 34, fontWeight: "800" },
  scoreCellLbl:    { fontSize: 11, marginTop: 4, textAlign: "center" },
  scoreDivider:    { width: 1 },

  resultBtnRow:    { flexDirection: "row", gap: 12, marginTop: 18, width: "100%" },
  actionBtn:       { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 14 },
  actionBtnOutline:{ borderWidth: 1.5 },
  actionBtnPrimary:{ backgroundColor: "#1a7a4a" },
  actionBtnTxt:    { fontSize: 15, fontWeight: "700" },

  // Review button
  reviewBtn:       { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, marginTop: 12, width: "100%" },
  reviewBtnTxt:    { fontSize: 14, fontWeight: "700" },

  // Leaderboard button
  lbBtn:           { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: 14, borderWidth: 1.5, marginTop: 10, width: "100%" },
  lbBtnTxt:        { fontSize: 14, fontWeight: "700" },

  backToSelectBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 14, padding: 12 },
  backToSelectTxt: { fontSize: 14 },

  // ── Review ─────────────────────────────────
  reviewScroll:    { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 40 },

  reviewCard:      { borderRadius: 16, borderWidth: 1.5, padding: 14, marginBottom: 14 },
  reviewCardHeader:{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  reviewQBadge:    { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  reviewQNum:      { fontSize: 12, fontWeight: "800" },
  reviewStatusTxt: { fontSize: 13, fontWeight: "700", flex: 1 },
  reviewQuestion:  { fontSize: 15, fontWeight: "600", lineHeight: 22, marginBottom: 12 },

  reviewOpts:      { gap: 6 },
  reviewOptRow:    { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 7, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1 },
  reviewOptLabel:  { width: 24, height: 24, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  reviewOptLabelTxt:{ fontSize: 11, fontWeight: "800" },
  reviewOptTxt:    { flex: 1, fontSize: 13, lineHeight: 18 },
});
