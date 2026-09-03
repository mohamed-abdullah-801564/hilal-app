import { Audio } from "expo-av";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useApp } from "./AppContext";
import type { Track } from "./AppContext";
import { cacheMedia, getCachedMediaUri } from "@/services/mediaCache";

interface AudioContextType {
  currentTrack: Track | null;
  isPlaying: boolean;
  isLoading: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  queue: Track[];
  playlist: Track[];
  isExpanded: boolean;
  playTrack: (track: Track, playlist?: Track[]) => void;
  preloadTrack: (track: Track) => void;
  togglePlay: () => void;
  pause: () => void;
  seekTo: (seconds: number) => void;
  setPlaybackRate: (rate: number) => void;
  stop: () => void;
  playNext: () => void;
  playPrev: () => void;
  addToQueue: (track: Track) => void;
  removeFromQueue: (trackId: string) => void;
  setIsExpanded: (val: boolean) => void;
  onTrackFinish: (callback: () => void) => () => void;
}
const AudioContext = createContext<AudioContextType>({} as AudioContextType);

const RATES = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const preloadedSoundRef = useRef<{
    sound: Audio.Sound;
    trackId: string;
    uri: string;
  } | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const loadLockRef = useRef(false); // prevents overlapping playTrack calls
  const trackFinishListenersRef = useRef<Set<() => void>>(new Set());
  const onTrackFinish = useCallback((callback: () => void) => {
  trackFinishListenersRef.current.add(callback);

  return () => {
    trackFinishListenersRef.current.delete(callback);
  };
}, []);
  const { saveProgress, getProgress, addRecentTrack } = useApp();

  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRateState] = useState(1.0);
  const [queue, setQueue] = useState<Track[]>([]);
  const [playlist, setPlaylist] = useState<Track[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      staysActiveInBackground: true,
      playsInSilentModeIOS: true,
    });
    return () => {
      cleanup();
      cleanupPreload();
    };
  }, []);

  const cleanup = async () => {
    // Stop progress timer first
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    // Always stop THEN unload — prevents two sounds playing at once
    if (soundRef.current) {
      const prev = soundRef.current;
      soundRef.current = null; // null out immediately so no other caller reuses it
      try { await prev.stopAsync(); } catch (_) {}
      try { await prev.unloadAsync(); } catch (_) {}
    }
  };

  const cleanupPreload = async () => {
    if (preloadedSoundRef.current) {
      const prev = preloadedSoundRef.current.sound;
      preloadedSoundRef.current = null;
      try { await prev.unloadAsync(); } catch (_) {}
    }
  };

  const startProgressTracking = useCallback(
    (trackId: string) => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
      progressIntervalRef.current = setInterval(async () => {
        if (soundRef.current) {
          const status = await soundRef.current.getStatusAsync();
          if (status.isLoaded) {
            const secs = status.positionMillis / 1000;
            setCurrentTime(secs);
            saveProgress(trackId, secs);
          }
        }
      }, 1000);
    },
    [saveProgress],
  );

  const preloadTrack = useCallback(async (track: Track) => {
    if (!track.audioUrl || currentTrack?.id === track.id) return;

    try {
      const cachedUri = await getCachedMediaUri(track.audioUrl, "audio");
      const playbackUri = cachedUri ?? track.audioUrl;

      if (
        preloadedSoundRef.current?.trackId === track.id &&
        preloadedSoundRef.current.uri === playbackUri
      ) {
        return;
      }

      await cleanupPreload();
      const { sound } = await Audio.Sound.createAsync(
        { uri: playbackUri },
        {
          shouldPlay: false,
          progressUpdateIntervalMillis: 1000,
        },
        undefined,
        false,
      );
      preloadedSoundRef.current = {
        sound,
        trackId: track.id,
        uri: playbackUri,
      };
    } catch {}
  }, [currentTrack?.id]);

  const playTrack = useCallback(
    async (track: Track, newPlaylist?: Track[]) => {
      // Prevent a second tap from starting a second load while first is in progress
      if (loadLockRef.current) return;
      loadLockRef.current = true;

      setIsLoading(true);
      setCurrentTrack(track);
      if (newPlaylist) setPlaylist(newPlaylist);
      setIsExpanded(true);

      await cleanup();

      try {
        const loadStartedAt = Date.now();
        const startSeconds = getProgress(track.id);
        const cachedUri = await getCachedMediaUri(track.audioUrl, "audio");
        const playbackUri = cachedUri ?? track.audioUrl;
        let sound: Audio.Sound;

        if (
          preloadedSoundRef.current?.trackId === track.id &&
          preloadedSoundRef.current.uri === playbackUri
        ) {
          sound = preloadedSoundRef.current.sound;
          preloadedSoundRef.current = null;
          await sound.setStatusAsync({
            shouldPlay: true,
            rate: playbackRate,
            positionMillis: startSeconds * 1000,
            progressUpdateIntervalMillis: 250,
          });
        } else {
          await cleanupPreload();
          const created = await Audio.Sound.createAsync(
            { uri: playbackUri },
            {
              shouldPlay: true,
              rate: playbackRate,
              positionMillis: startSeconds * 1000,
              progressUpdateIntervalMillis: 250,
            },
            undefined,
            false,
          );
          sound = created.sound;
        }
        soundRef.current = sound;
        console.log(
          `[media] audio ready in ${Date.now() - loadStartedAt}ms (${cachedUri ? "cache" : "stream"})`,
        );

       sound.setOnPlaybackStatusUpdate((status) => {
  console.log("[Audio Status]", status);

  if (status.isLoaded) {
    setIsPlaying(status.isPlaying);
            setDuration(status.durationMillis ? status.durationMillis / 1000 : 0);
            if (status.didJustFinish) {
  trackFinishListenersRef.current.forEach((callback) => {
    try {
      callback();
    } catch {}
  });

  handleTrackEnd(track);
}
          }
        });

        setIsPlaying(true);
        setCurrentTime(startSeconds);
        startProgressTracking(track.id);
        addRecentTrack(track);
        void cacheMedia(track.audioUrl, "audio");

        const activePlaylist = newPlaylist ?? playlist;
        const idx = activePlaylist.findIndex((t) => t.id === track.id);
        const nextTrack = idx >= 0 ? activePlaylist[idx + 1] : undefined;
        if (nextTrack?.audioUrl) {
          void preloadTrack(nextTrack);
        }
      
        } catch (e) {
  console.error("[Audio] playback failed:", e);
  console.error("[Audio] track:", track.id, track.audioUrl);
  setIsPlaying(false);
}
        finally {
        setIsLoading(false);
        loadLockRef.current = false; // release lock so next track can load
      }
    },
    [playbackRate, getProgress, startProgressTracking, addRecentTrack, playlist, preloadTrack],
  );

  const handleTrackEnd = useCallback(
    (track: Track) => {
      if (queue.length > 0) {
        const [next, ...rest] = queue;
        setQueue(rest);
        playTrack(next, playlist);
      } else {
        const idx = playlist.findIndex((t) => t.id === track.id);
        if (idx >= 0 && idx < playlist.length - 1) {
          playTrack(playlist[idx + 1], playlist);
        } else {
          setIsPlaying(false);
        }
      }
    },
    [queue, playlist, playTrack],
  );

  const togglePlay = useCallback(async () => {
    if (!soundRef.current) return;
    if (isPlaying) {
      await soundRef.current.pauseAsync();
    } else {
      await soundRef.current.playAsync();
    }
  }, [isPlaying]);

  const pause = useCallback(async () => {
    if (!soundRef.current || !isPlaying) return;
    await soundRef.current.pauseAsync();
  }, [isPlaying]);

  const seekTo = useCallback(async (seconds: number) => {
    if (!soundRef.current) return;
    await soundRef.current.setPositionAsync(seconds * 1000);
    setCurrentTime(seconds);
  }, []);

  const setPlaybackRate = useCallback(async (rate: number) => {
    setPlaybackRateState(rate);
    if (soundRef.current) {
      await soundRef.current.setRateAsync(rate, true);
    }
  }, []);

  // Fully close the player: stop + unload audio, hide both full & mini players.
  const stop = useCallback(async () => {
    await cleanup();           // stops + unloads the sound, clears the progress timer
    setIsExpanded(false);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setQueue([]);
    setCurrentTrack(null);     // hides the mini player (AudioPlayer returns null)
  }, []);

  const playNext = useCallback(() => {
    if (!currentTrack) return;
    if (queue.length > 0) {
      const [next, ...rest] = queue;
      setQueue(rest);
      playTrack(next, playlist);
    } else {
      const idx = playlist.findIndex((t) => t.id === currentTrack.id);
      if (idx >= 0 && idx < playlist.length - 1) {
        playTrack(playlist[idx + 1], playlist);
      }
    }
  }, [currentTrack, queue, playlist, playTrack]);

  const playPrev = useCallback(() => {
    if (!currentTrack) return;
    const idx = playlist.findIndex((t) => t.id === currentTrack.id);
    if (idx > 0) {
      playTrack(playlist[idx - 1], playlist);
    } else {
      seekTo(0);
    }
  }, [currentTrack, playlist, playTrack, seekTo]);

  const addToQueue = useCallback((track: Track) => {
    setQueue((prev) => [...prev, track]);
  }, []);

  const removeFromQueue = useCallback((trackId: string) => {
    setQueue((prev) => prev.filter((t) => t.id !== trackId));
  }, []);

 return (
  <AudioContext.Provider
    value={{
      currentTrack,
      isPlaying,
      isLoading,
      currentTime,
      duration,
      playbackRate,
      queue,
      playlist,
      isExpanded,
      playTrack,
      preloadTrack,
      togglePlay,
      pause,
      seekTo,
      setPlaybackRate,
      stop,
      playNext,
      playPrev,
      addToQueue,
      removeFromQueue,
      setIsExpanded,
      onTrackFinish,
    }}
  >
    {children}
   </AudioContext.Provider>
);
}

export const useAudio = () => useContext(AudioContext);
