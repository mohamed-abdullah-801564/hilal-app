# 📋 Islamic Audio Hub — Quiz System Full Audit Report

> Generated: April 2026 | App: Tamil Islamic Audio Learning App | Platform: Expo (iOS + Android + Web)

---

## 1. OVERVIEW

**Type:** Audio-linked, progressive 3-level MCQ quiz system (Multiple Choice Questions)

**Main Concept:**
- Every audio card (பாடம்) has its own set of quiz questions stored in Firebase Firestore.
- Users listen to the audio lesson first, then test their knowledge through the quiz.
- The quiz is NOT a daily quiz — it is a per-track quiz tied to each audio lesson.
- Learning flow: Audio → Quiz → Results → Unlock next level.
- The quiz is designed for Tamil-speaking Islamic learners, with full Tamil UI and Tamil TTS (voice reading).

---

## 2. QUIZ STRUCTURE

| Property | Value |
|----------|-------|
| Format | Multiple Choice (MCQ) — 4 options per question |
| Options per question | Always 4 (labeled A, B, C, D) |
| Correct answer | One correct answer (correctIndex: 0–3) |
| Questions per card | Unlimited (stored in Firestore as array) |
| Level 1 uses | Questions 0–5 (max 5 questions) |
| Level 2 uses | Questions 5–15 (max 10 questions) |
| Level 3 uses | Questions 15–30 (max 15 questions) |
| Question order | SHUFFLED randomly every time (Fisher-Yates algorithm) |
| Data source | Firebase Firestore (card.quiz array) |

**Question Data Structure (Firestore):**
```
{
  question: "தமிழ் கேள்வி இங்கே",
  options: ["விடை 1", "விடை 2", "விடை 3", "விடை 4"],
  correctIndex: 0
}
```

---

## 3. LEVEL SYSTEM

**Total Levels: 3**

| Level | Tamil Name | Questions | Icon | Color | Unlock Rule |
|-------|-----------|-----------|------|-------|-------------|
| Level 1 | ஆரம்ப நிலை (Beginner) | Q1–Q5 (max 5) | 🍃 Leaf | Green (#22c55e) | Always unlocked |
| Level 2 | இடை நிலை (Medium) | Q6–Q15 (max 10) | ⚡ Flash | Yellow (#f59e0b) | Level 1 must be completed |
| Level 3 | உயர் நிலை (Advanced) | Q16–Q30 (max 15) | 🏆 Trophy | Red (#ef4444) | Level 2 must be completed |

**Unlock Rules:**
- Level 1 → Always open, anyone can start immediately
- Level 2 → Locked with 🔒 icon and 50% opacity until Level 1 is `completed: true`
- Level 3 → Locked until Level 2 is `completed: true`
- A level is also locked if it has 0 questions available for that range

---

## 4. USER FLOW (STEP BY STEP)

```
📱 App Opens
     ↓
🏠 Home Screen (Tab 1 — Categories list)
     ↓
📂 Category Screen (Subcategories grid)
     ↓
📋 Subcategory Screen (Audio card list)
     ↓
     [Option A] Tap QUIZ button on card row → Opens QuizModal directly
     [Option B] Tap card → Audio Detail Screen → Switch to "Quiz" tab → QuizModal opens
     ↓
━━━ PHASE 1: LEVEL SELECT SCREEN ━━━
  • Shows 3 level cards (Level 1, 2, 3)
  • Shows question count per level
  • Shows ⭐ stars from previous attempt (if any)
  • Locked levels show 🔒 and are disabled
  • Voice mode toggle button (top right)
  • Hint text: "Level 1 முடித்தால் Level 2 திறக்கும்"
     ↓
  [Tap a level card]
     ↓
━━━ PHASE 2: PLAYING SCREEN ━━━
  • Questions load and SHUFFLE
  • TTS auto-reads question + options (if voice ON)
  • User taps one of 4 answer options
  • INSTANT feedback: Green = correct, Red = wrong
  • Correct answer always shown in green
  • Sound/haptic plays
  • Auto-advances to next question after 1500ms
  • Progress bar fills as questions complete
  • Score shown live (✅ count)
  • 🔥 Streak shown if 3+ correct in a row
     ↓
  [Last question answered]
     ↓
━━━ PHASE 3: RESULT SCREEN ━━━
  • Trophy or refresh icon (based on score)
  • Motivational message in Tamil
  • ⭐⭐⭐ Star display
  • Score breakdown: Correct / Total / Wrong
  • Level badge shown
  • "மீண்டும் விளையாடு" (Play Again) button
  • "அடுத்த நிலை" (Next Level) button — if available
  • "மூடு" (Close) button
     ↓
  Progress saved to AsyncStorage
  Level select screen refreshes with new stars
```

---

## 5. UI / UX DESIGN

**Screens involved:**
1. Level Select Screen (Phase: "select")
2. Playing Screen (Phase: "playing")
3. Result Screen (Phase: "result")

**Key UI Elements:**

| Element | Description |
|---------|-------------|
| Level Cards | Colored left-stripe accent, icon bubble, Tamil+English text, star result row |
| 🔒 Lock Icon | Replaces level icon for locked levels |
| Progress Bar | Thin bar at top, fills left→right as questions progress, color matches level |
| Q Counter | "கேள்வி 3 / 10" shown below progress bar |
| Score Counter | "✅ 5" live score shown top-right during play |
| 🔥 Streak Pill | Appears when 3+ consecutive correct answers |
| Voice Toggle | Volume icon — green tinted when ON, muted when OFF |
| Listen Again | Button to re-read current question via TTS |
| Question Card | Animated card with "Q3" pill + question text |
| Option Buttons | A/B/C/D labeled, full-width, changes color on answer |
| ✅ / ❌ Icons | Appear on correct/wrong options after answering |
| Trophy/Refresh | Result screen icon — trophy if ≥60%, refresh if <60% |
| StarRow | 3 gold stars — filled based on score percentage |
| Score Stats Box | 3-column: Correct | Total | Wrong |

**Dark / Light Mode:**
- Fully supported — reads `isDarkMode` from AppContext
- Dark: bg=#0a0a0a, card=#1a1a1a, text=#f0f0f0, border=#2a2a2a
- Light: bg=#f5f5f5, card=#ffffff, text=#111111, border=#e5e5e5
- Option colors adapt: green/red text changes shade for dark vs light
- All icons, labels, and sub-text adjust accordingly

---

## 6. GAME MECHANICS

**Scoring System:**
- +1 point per correct answer
- No negative marking (wrong answer = 0, not −1)
- Score tracked with both useState AND useRef (to prevent stale closure bug)

**Star Rating:**
| Score % | Stars |
|---------|-------|
| ≥ 85% | ⭐⭐⭐ (3 stars) |
| ≥ 60% | ⭐⭐ (2 stars) |
| > 0% | ⭐ (1 star) |
| 0% | No stars |

**Streak System:**
- Tracks consecutive correct answers
- 🔥 Streak displayed ONLY when streak ≥ 3
- Streak resets to 0 on any wrong answer

**Timer:** ❌ No timer — unlimited time per question

**Attempt Limits:** ❌ No attempt limits — can replay levels unlimited times

**Auto-Advance:**
- After answering (correct or wrong), waits 1500ms then auto-moves to next question
- User can see feedback during these 1500ms

---

## 7. AUDIO / VOICE FEATURES

**TTS (Text-To-Speech):**
- Library: `expo-speech` with `language: "ta-IN"` (Tamil, India)
- Auto-reads question text when question appears (350ms delay after animation)
- Then chains into reading options: "A. விடை 1", "B. விடை 2", etc.
- Chaining uses `onDone` callback — not setTimeout (avoids timing bugs)
- If voice is OFF or user answers, speech stops immediately

**Voice Mode Toggle:**
- Persistent — saved to AsyncStorage as key `"quiz_voice_mode_v1"`
- Default: ON
- Toggle button always visible (top-right in both select and playing screens)
- When toggled OFF: speech stops instantly, auto-speak disabled
- "Listen Again" button visible only when voice mode is ON

**Sound System (Platform-aware):**

| Platform | Correct | Wrong | Level Complete |
|----------|---------|-------|----------------|
| Web | 660Hz + 880Hz tones (sine wave) | 180Hz square wave | 440→550→660Hz tones |
| Native | Haptics.Success | Haptics.Error | Haptics.Success |

Web uses Web Audio API (AudioContext/oscillator).
Native uses `expo-haptics` for physical vibration.

---

## 8. DATA STORAGE

**Quiz Questions:**
- Stored in Firebase Firestore as `quiz` array inside each card document
- Loaded via `getCardById()` when the audio detail screen opens
- Passed to QuizModal as `firestoreQuestions` prop
- Falls back to AsyncStorage legacy data if Firestore questions not provided

**Quiz Progress:**
- Stored in AsyncStorage (device-local, not cloud)
- Key: `"quiz_level_progress_v1"`
- Structure:
```json
{
  "cardId123": {
    "level1": { "completed": true, "score": 5, "total": 5, "completedAt": 1234567890 },
    "level2": { "completed": true, "score": 9, "total": 10, "completedAt": 1234567890 },
    "level3": null
  }
}
```
- Functions: `getQuizProgress(trackId)`, `saveLevelResult(trackId, level, result)`, `resetLevelProgress(trackId, level)`

**Voice Mode Preference:**
- AsyncStorage key: `"quiz_voice_mode_v1"` → "on" or "off"

---

## 9. LEADERBOARD / RANKING

**Status: ❌ NOT IMPLEMENTED**

- No leaderboard exists in the current app
- No user accounts or cloud-synced scores
- Progress is purely device-local (AsyncStorage)
- No ranking calculation or comparison between users

---

## 10. STATE MANAGEMENT

**Quiz state is managed inside QuizModal component using React useState:**

| State Variable | Purpose |
|---------------|---------|
| `phase` | "select" / "playing" / "result" |
| `activeLevel` | Currently playing level (1, 2, or 3) |
| `levelQs` | Shuffled questions for current level |
| `qIdx` | Current question index (0-based) |
| `selected` | Which option index user tapped |
| `answered` | Whether current question is answered |
| `score` | Correct answer count |
| `scoreRef` | useRef mirror of score (prevents stale closure) |
| `streak` | Consecutive correct count |
| `questions` | All questions from Firestore |
| `progress` | Per-level result history from AsyncStorage |
| `voiceMode` | TTS on/off |
| `isSpeaking` | Whether TTS is currently speaking |

**No global state** — quiz state is fully local to QuizModal.
No Redux / Zustand / Context API used for quiz.

---

## 11. ANIMATIONS

| Animation | How It Works |
|-----------|-------------|
| Modal appearance | `animationType="slide"` — slides up from bottom |
| New question fade-in | `Animated.timing` — opacity 0→1 in 260ms |
| Question slide-up | `Animated.spring` — translateY 28→0 |
| Options scale-in | `Animated.spring` — scale 0.93→1 |
| All 3 run in PARALLEL | `Animated.parallel([...]).start()` |
| Press feedback | Opacity 1→0.82 on press (Pressable built-in) |
| Skeleton loaders | Pulse animation in subcategory screen |

All animations use `useNativeDriver: true` for 60fps performance.

---

## 12. PLATFORM SUPPORT

| Feature | Web | iOS | Android |
|---------|-----|-----|---------|
| Quiz UI | ✅ Full | ✅ Full | ✅ Full |
| TTS (Tamil voice) | ✅ via expo-speech | ✅ | ✅ |
| Correct sound | ✅ Web Audio API | ✅ Haptics | ✅ Haptics |
| Wrong sound | ✅ Web Audio API | ✅ Haptics | ✅ Haptics |
| Physical vibration | ❌ Not available | ✅ | ✅ |
| Progress save | ✅ AsyncStorage | ✅ | ✅ |
| Dark/Light mode | ✅ | ✅ | ✅ |
| Quiz in card detail (5-tab) | ✅ | ✅ | ✅ |

---

## 13. CURRENT FEATURES LIST ✅

- [x] 3-level progressive quiz (Beginner → Medium → Advanced)
- [x] Level unlock system (must complete L1 → L2 → L3)
- [x] MCQ format — 4 options, A/B/C/D labels
- [x] Fisher-Yates shuffle — random question order every play
- [x] Instant answer feedback — green/red color + icon
- [x] Correct answer revealed after wrong selection
- [x] 1500ms auto-advance after answering
- [x] Live score counter (✅ count)
- [x] 🔥 Streak tracker (shown at 3+)
- [x] ⭐⭐⭐ Star rating (85% / 60% / >0% thresholds)
- [x] Result screen with Correct / Total / Wrong stats
- [x] Trophy icon (pass) or Refresh icon (fail) on result
- [x] Motivational Tamil message on result
- [x] Tamil TTS auto-reads question + options
- [x] TTS chaining (question → A → B → C → D)
- [x] Voice mode ON/OFF toggle (persistent)
- [x] "மீண்டும் கேள்" (Listen Again) button
- [x] Progress bar filling during play
- [x] "கேள்வி X / Total" question counter
- [x] Web Audio API sounds (correct/wrong/complete)
- [x] Native haptic vibration (iOS/Android)
- [x] Progress saved to AsyncStorage per card per level
- [x] Previous stars shown on level select screen
- [x] "Play Again" button on result
- [x] "Next Level" button on result (if available)
- [x] Dark mode + Light mode full support
- [x] Quiz available from subcategory card row (Quiz button)
- [x] Quiz available as a tab in 5-tab audio detail screen
- [x] Admin can add questions to any card via Firebase CMS
- [x] No questions → level shows "கேள்விகள் இல்லை" (graceful empty state)
- [x] Locked levels show 🔒 and are not tappable

---

## 14. MISSING FEATURES / GAPS ❌

| Gap | Description |
|-----|-------------|
| No leaderboard | No ranking between users — purely device-local progress |
| No cloud sync | Quiz progress lost if app uninstalled or device changed |
| No user login tied to quiz | No way to track "User X answered Y questions" |
| No timer | No time limit per question — unlimited time |
| No negative marking | No penalty for wrong answer |
| No explanation after answer | No "Why is this the right answer?" explanation shown |
| No question review | After completing a level, can't review which questions were wrong |
| No daily quiz | No scheduled/daily quiz — only tied to audio lessons |
| No streak badges / achievements | No achievements or badges for completing all levels |
| No progress reset button | User cannot manually reset their quiz progress |
| No wrong answer history | App doesn't track which specific questions user got wrong |
| Admin cannot reorder questions | Questions are fixed in insertion order in Firestore |
| TTS not working on all web browsers | Web TTS depends on browser support (Chrome works, others vary) |
| No offline question cache | If Firestore is offline, quiz won't load questions |

---

## 15. FUTURE IMPROVEMENT SUGGESTIONS 🚀

**High Priority (Production-level):**
1. **Cloud Progress Sync** — Save quiz progress to Firestore per user (needs login system)
2. **User Authentication** — Firebase Auth (Google/email) to track per-user progress
3. **Leaderboard** — Show top scorers per audio card or per category
4. **Wrong Answer Review** — After completing level, show all wrongly answered questions with correct answers
5. **Question Explanations** — Admin adds an explanation field per question; shown after answering

**Medium Priority (Better UX):**
6. **Timer Mode** — Optional 15-second timer per question (hard mode)
7. **Daily Quiz Mode** — Curated set of 10 questions from all cards, refreshes daily
8. **Negative Marking Option** — Admin toggles -0.5 for wrong answers
9. **Progress Reset Button** — Let user reset a level to retry from scratch
10. **Achievement Badges** — "All 3 levels complete" badge, "Perfect score" badge, etc.

**Low Priority (Polish):**
11. **Answer History Screen** — Full history of all attempted quizzes with dates
12. **Animated Stars** — Stars animate into view on result screen (scale + rotate)
13. **Confetti Animation** — Confetti on 3-star perfect score
14. **Share Score Button** — Share result image to WhatsApp/social media
15. **Offline Support** — Cache questions locally after first Firestore load
16. **Admin Question Reorder** — Drag-and-drop question ordering in admin CMS
17. **Hints System** — User can use one hint per level (eliminates 1 wrong option)
18. **Time-Based Bonus Points** — Answer quickly = bonus score
19. **Category-wide Quiz** — Quiz covering all audio cards in a category
20. **Tamil Audio for Each Option** — Record human voice audio for answers, not just TTS

---

*End of Report — Islamic Audio Hub Quiz System Audit*
