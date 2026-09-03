// Visual Mode — orchestrates the short-video queue on top of the existing
// AudioContext. Deliberately separate from AudioContext: Visual Mode is a
// presentation layer over audio, not a property of audio playback itself,
// so audio must work identically whether this context exists or not.

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAudio } from "./AudioContext";
import { getUserId } from "@/services/userId";
import {
  getEnabledShortVideos,
  getSeenVideoIds,
  markSeen,
  resetSeen,
  type ShortVideo,
} from "@/services/shortVideos.firebase";

interface VisualModeContextType {
  visualModeEnabled: boolean;
  toggleVisualMode: () => void;
  currentClip: ShortVideo | null;
  onClipEnd: () => void;
}

const VisualModeContext = createContext<VisualModeContextType>({} as VisualModeContextType);

const STORAGE_KEY = "visual_mode_enabled_v1";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function VisualModeProvider({ children }: { children: React.ReactNode }) {
  const { currentTrack, onTrackFinish } = useAudio();
  const [visualModeEnabled, setVisualModeEnabled] = useState(false);
  const [currentClip, setCurrentClip] = useState<ShortVideo | null>(null);

  const queueRef        = useRef<ShortVideo[]>([]);
  const queueIndexRef    = useRef(0);
  const allVideosRef     = useRef<ShortVideo[] | null>(null);
  const uidRef           = useRef<string | null>(null);
  const activeTrackIdRef = useRef<string | null>(null);

  // Restore the persisted on/off preference.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((v) => {
      if (v === "1") setVisualModeEnabled(true);
    }).catch(() => {});
  }, []);

  const toggleVisualMode = useCallback(() => {
    setVisualModeEnabled((prev) => {
      const next = !prev;
      AsyncStorage.setItem(STORAGE_KEY, next ? "1" : "0").catch(() => {});
      return next;
    });
  }, []);

  // Build a fresh, shuffled, unseen-first queue. Recycles (resets seen
  // history + reshuffles the full library) only once the unseen pool is
  // genuinely empty — so repeats happen only when truly unavoidable.
  const buildQueue = useCallback(async () => {
    try {
      if (!uidRef.current) uidRef.current = await getUserId();
      if (!allVideosRef.current) allVideosRef.current = await getEnabledShortVideos();
      const all = allVideosRef.current;

      if (!all.length) {
        queueRef.current = [];
        setCurrentClip(null);
        return;
      }

      const seen = await getSeenVideoIds(uidRef.current);
      let unseen = all.filter((v) => !seen.has(v.id));

      if (unseen.length === 0) {
        await resetSeen(uidRef.current);
        unseen = all;
      }

      queueRef.current = shuffle(unseen);
      queueIndexRef.current = 0;
      setCurrentClip(queueRef.current[0] ?? null);
    } catch {
      queueRef.current = [];
      setCurrentClip(null);
    }
  }, []);

  // A new audio track started while Visual Mode is on → fresh queue.
  // Turning Visual Mode off, no track playing, or the track being a
  // Podcast-tab track (id suffixed "__podcast" — see PodcastTab in
  // app/audio/[id].tsx) clears the current clip instead. Podcast playback
  // reuses the same AudioTab/AudioContext as regular audio, so without this
  // check a card's Podcast tab would inherit whatever Short Video queue was
  // already showing for that same card's Audio tab (same underlying card
  // id otherwise) — Visual Mode is intentionally Audio-tab only.
  useEffect(() => {
    const isPodcastTrack = !!currentTrack?.id?.endsWith("__podcast");
    if (!visualModeEnabled || !currentTrack || isPodcastTrack) {
      activeTrackIdRef.current = null;
      setCurrentClip(null);
      return;
    }
    if (activeTrackIdRef.current === currentTrack.id) return; // same track — keep current queue
    activeTrackIdRef.current = currentTrack.id;
    void buildQueue();
  }, [visualModeEnabled, currentTrack?.id, buildQueue]);

  // A clip finished playing → mark it seen, advance to the next one. If the
  // queue runs out mid-audio (fewer unseen clips than the audio needs),
  // top up via buildQueue(), which recycles the pool if truly exhausted.
  const onClipEnd = useCallback(() => {
    const finished = queueRef.current[queueIndexRef.current];
    if (finished && uidRef.current) {
      void markSeen(uidRef.current, finished.id);
    }
    queueIndexRef.current += 1;
    if (queueIndexRef.current >= queueRef.current.length) {
      void buildQueue();
      return;
    }
    setCurrentClip(queueRef.current[queueIndexRef.current]);
  }, [buildQueue]);

  // The master audio track finished entirely → stop the visual sequence.
  useEffect(() => {
    const unsubscribe = onTrackFinish(() => {
      setCurrentClip(null);
      activeTrackIdRef.current = null;
    });
    return unsubscribe;
  }, [onTrackFinish]);

  return (
    <VisualModeContext.Provider
      value={{ visualModeEnabled, toggleVisualMode, currentClip, onClipEnd }}
    >
      {children}
    </VisualModeContext.Provider>
  );
}

export function useVisualMode() {
  return useContext(VisualModeContext);
}
