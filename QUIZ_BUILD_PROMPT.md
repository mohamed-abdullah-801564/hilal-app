# 🎯 Quiz Feature Build Prompt — Islamic Audio Hub

இந்த prompt-ஐ copy செய்து AI-கிட்டே கொடுத்தால், அதே மாதிரி quiz system build ஆகும்.

---

## 📋 PROMPT (Copy This Exactly)

```
Build a 3-level Tamil Islamic quiz modal for a React Native (Expo) mobile app.
It must work on both iOS/Android (native) and Web.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TECH STACK:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- React Native + Expo (Expo Router)
- Firebase Firestore for questions storage
- expo-speech for Tamil TTS (Text-To-Speech)
- expo-haptics for vibration feedback on native
- Web Audio API for sound tones on web
- AsyncStorage for saving quiz progress & voice mode preference

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
QUIZ DATA STRUCTURE (Firestore):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Each "card" (audio track) in Firestore has a quiz array:
{
  quiz: [
    {
      question: "தமிழ் கேள்வி இங்கே",
      options: ["விடை 1", "விடை 2", "விடை 3", "விடை 4"],
      correctIndex: 0   // 0-based index of correct answer
    }
  ]
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3 LEVELS CONFIGURATION:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Level 1 – ஆரம்ப நிலை (Beginner):  questions 0–5,   icon: leaf,   color: green (#22c55e)
Level 2 – இடை நிலை   (Medium):    questions 5–15,  icon: flash,  color: yellow (#f59e0b)
Level 3 – உயர் நிலை  (Advanced):  questions 15–30, icon: trophy, color: red (#ef4444)

Rules:
- Level 1 is always unlocked
- Level 2 unlocks only after Level 1 is completed
- Level 3 unlocks only after Level 2 is completed
- Progress saved in AsyncStorage per trackId

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3 PHASES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Phase 1 — "select":
  - Show all 3 level cards
  - Show ⭐ stars (1-3) from previous result if completed
  - Show question count per level
  - Locked levels show 🔒 icon and 0.5 opacity
  - Voice mode toggle button (top right)
  - Total question count badge

Phase 2 — "playing":
  - Show one question at a time
  - Questions are SHUFFLED (Fisher-Yates algorithm)
  - Progress bar fills as questions complete
  - Show "கேள்வி X / Total" counter
  - Show score (✅ count) in real time
  - Show 🔥 streak if 3+ correct in a row
  - 4 answer options with A/B/C/D labels
  - On correct: green highlight, ✅ icon, success sound/haptic
  - On wrong: red highlight, ❌ icon, error sound/haptic, shows correct answer in green
  - Auto-advance to next question after 1500ms
  - "Listen Again" button to replay TTS
  - Voice mode toggle (top right)

Phase 3 — "result":
  - Show level name + track title
  - Show ⭐⭐⭐ stars (85%+ = 3 stars, 60%+ = 2 stars, >0% = 1 star)
  - Show final score: X / Total
  - "மீண்டும் விளையாடு" (Play Again) button
  - "அடுத்த நிலை" (Next Level) button — only if next level available
  - "மூடு" (Close) button

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SOUND SYSTEM (Platform-aware):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
On WEB — use Web Audio API oscillator tones:
  - Correct: two ascending tones (660Hz then 880Hz)
  - Wrong: low square wave (180Hz, 0.3s)
  - Complete: three ascending tones (440, 550, 660Hz)

On NATIVE (iOS/Android) — use expo-haptics:
  - Correct: Haptics.NotificationFeedbackType.Success
  - Wrong: Haptics.NotificationFeedbackType.Error
  - Complete: Haptics.NotificationFeedbackType.Success

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TTS (Text-To-Speech) SYSTEM:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Use expo-speech with language: "ta-IN" (Tamil).
When question appears:
  1. Speak the question text
  2. After question done → speak "A. option1"
  3. After A done → speak "B. option2" ... etc.
  4. Chain using onDone callback (not setTimeout)

Voice mode can be toggled ON/OFF:
  - Saved to AsyncStorage as "quiz_voice_mode_v1"
  - OFF = stop all speech, disable auto-speak
  - Toggle button shows volume-high or volume-mute icon

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ANIMATIONS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
On each new question:
  - Fade in question text (opacity 0 → 1, 260ms)
  - Slide up question (translateY 28 → 0, spring)
  - Scale up options (0.93 → 1, spring)

Option buttons:
  - Show correct/wrong with color + icon INSTANTLY on tap
  - Use Animated.Value for option scale/press feedback

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DARK / LIGHT MODE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Read isDarkMode from AppContext.
Dark:  bg=#0a0a0a, card=#1a1a1a, text=#f0f0f0, border=#2a2a2a
Light: bg=#f5f5f5, card=#ffffff, text=#111111, border=#e5e5e5

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PROGRESS STORAGE (AsyncStorage):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Key: "quiz_progress_v2_{trackId}"
Value:
{
  level1: { completed: true, score: 5, total: 5, completedAt: 1234567890 },
  level2: { completed: true, score: 12, total: 15, completedAt: 1234567890 },
  level3: null  // not yet completed
}

Functions needed:
  getQuizProgress(trackId) → TrackQuizProgress
  saveLevelResult(trackId, levelId, result) → void

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OPTION BUTTON DESIGN:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Before answer:
  - White bg (light) / dark bg (dark)
  - A/B/C/D label circle on left

After answer:
  - Correct option: green bg (#22c55e22), green border, ✅ icon
  - Wrong selected: red bg (#ef444422), red border, ❌ icon
  - Other options: stay neutral (no change)
  - Disabled: pointer-events none after selection

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STAR SCORING:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
score/total >= 0.85 → ⭐⭐⭐ (3 stars)
score/total >= 0.60 → ⭐⭐ (2 stars)
score/total >  0    → ⭐ (1 star)
score == 0          → no stars

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COMPONENT API (Props):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<QuizModal
  visible={boolean}
  onClose={() => void}
  trackId={string}
  trackTitle={string}
  firestoreQuestions={FBQuizQuestion[]}  // pre-loaded from Firestore
/>

When firestoreQuestions is provided → use them directly (skip AsyncStorage lookup).
When not provided → load from local AsyncStorage (legacy support).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STALE CLOSURE BUG FIX (Important!):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Use scoreRef = useRef(0) alongside score state.
Update BOTH when score changes:
  scoreRef.current += 1;
  setScore(scoreRef.current);
In finishLevel() use scoreRef.current (not score state) to avoid stale value.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TAMIL UI TEXT:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"நிலையை தேர்வு செய்யுங்கள்" — Choose your level
"கேள்விகள் உள்ளன" — Questions available
"கேள்விகள் இல்லை" — No questions
"கேள்வி X / Total" — Question X / Total
"மீண்டும் விளையாடு" — Play Again
"அடுத்த நிலை" — Next Level
"மூடு" — Close
"ஆரம்ப நிலை" — Beginner
"இடை நிலை" — Intermediate
"உயர் நிலை" — Advanced
"Level 1 முடித்தால் Level 2 திறக்கும்" — Finish Level 1 to unlock Level 2

Build this as a single QuizModal.tsx component file.
```

---

## ✅ இந்த System-ல் உள்ளவை:

| Feature | Status |
|---------|--------|
| 3-level progressive unlock | ✅ |
| Tamil TTS (auto-read questions) | ✅ |
| Voice mode toggle (on/off) | ✅ |
| Correct/Wrong sound effects | ✅ |
| Haptic vibration (mobile) | ✅ |
| 🔥 Streak counter | ✅ |
| ⭐⭐⭐ Star rating | ✅ |
| Progress saved in AsyncStorage | ✅ |
| Dark/Light mode | ✅ |
| Question shuffle | ✅ |
| Auto-advance after 1500ms | ✅ |
| Firebase Firestore questions | ✅ |
| Web + Mobile compatible | ✅ |
