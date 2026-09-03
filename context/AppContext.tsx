import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useColorScheme } from "react-native";

export interface Track {
  id: string;
  title: string;
  categoryId: string;
  categoryName: string;
  duration: number;
  audioUrl: string;
  thumbnailUrl?: string;
  viewCount: number;
  isPremium: boolean;
  sortOrder: number;
  prizeEnabled?: boolean;
  hasQuiz?: boolean;
  isBuiltIn?: boolean;
  description?: string;
  fileName?: string;
  uploadedAt?: number;
}

export interface Category {
  id: string;
  name: string;
  trackCount: number;
  icon: string;
  color: string;
  thumbnailUrl?: string;
}

export interface PlaybackProgress {
  trackId: string;
  progressSeconds: number;
  updatedAt: number;
}

interface AppContextType {
  favorites: string[];
  addFavorite: (trackId: string) => void;
  removeFavorite: (trackId: string) => void;
  isFavorite: (trackId: string) => boolean;
  playbackProgress: Record<string, PlaybackProgress>;
  saveProgress: (trackId: string, seconds: number) => void;
  getProgress: (trackId: string) => number;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  recentTracks: Track[];
  addRecentTrack: (track: Track) => void;
}

const AppContext = createContext<AppContextType>({} as AppContextType);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [favorites, setFavorites] = useState<string[]>([]);
  const [playbackProgress, setPlaybackProgress] = useState<
    Record<string, PlaybackProgress>
  >({});
  const [isDarkMode, setIsDarkMode] = useState(systemScheme === "dark");
  const [recentTracks, setRecentTracks] = useState<Track[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  // Auto-sync with system theme changes (only if user hasn't overridden)
  useEffect(() => {
    AsyncStorage.getItem("isDarkMode").then(saved => {
      if (saved === null) {
        setIsDarkMode(systemScheme === "dark");
      }
    }).catch(() => {});
  }, [systemScheme]);

  const loadData = async () => {
    try {
      const [favs, progress, dark, recent] = await Promise.all([
        AsyncStorage.getItem("favorites"),
        AsyncStorage.getItem("playbackProgress"),
        AsyncStorage.getItem("isDarkMode"),
        AsyncStorage.getItem("recentTracks"),
      ]);
      if (favs) setFavorites(JSON.parse(favs));
      if (progress) setPlaybackProgress(JSON.parse(progress));
      if (dark !== null) setIsDarkMode(JSON.parse(dark));
      else setIsDarkMode(systemScheme === "dark");
      if (recent) setRecentTracks(JSON.parse(recent));
    } catch {}
  };

  const addFavorite = useCallback(
    async (trackId: string) => {
      const updated = [...favorites, trackId];
      setFavorites(updated);
      await AsyncStorage.setItem("favorites", JSON.stringify(updated));
    },
    [favorites],
  );

  const removeFavorite = useCallback(
    async (trackId: string) => {
      const updated = favorites.filter((id) => id !== trackId);
      setFavorites(updated);
      await AsyncStorage.setItem("favorites", JSON.stringify(updated));
    },
    [favorites],
  );

  const isFavorite = useCallback(
    (trackId: string) => favorites.includes(trackId),
    [favorites],
  );

  const saveProgress = useCallback(
    async (trackId: string, seconds: number) => {
      const updated = {
        ...playbackProgress,
        [trackId]: { trackId, progressSeconds: seconds, updatedAt: Date.now() },
      };
      setPlaybackProgress(updated);
      await AsyncStorage.setItem("playbackProgress", JSON.stringify(updated));
    },
    [playbackProgress],
  );

  const getProgress = useCallback(
    (trackId: string) => playbackProgress[trackId]?.progressSeconds ?? 0,
    [playbackProgress],
  );

  const toggleDarkMode = useCallback(async () => {
    const next = !isDarkMode;
    setIsDarkMode(next);
    await AsyncStorage.setItem("isDarkMode", JSON.stringify(next));
  }, [isDarkMode]);

  const addRecentTrack = useCallback(
    async (track: Track) => {
      const filtered = recentTracks.filter((t) => t.id !== track.id);
      const updated = [track, ...filtered].slice(0, 10);
      setRecentTracks(updated);
      await AsyncStorage.setItem("recentTracks", JSON.stringify(updated));
    },
    [recentTracks],
  );

  return (
    <AppContext.Provider
      value={{
        favorites,
        addFavorite,
        removeFavorite,
        isFavorite,
        playbackProgress,
        saveProgress,
        getProgress,
        isDarkMode,
        toggleDarkMode,
        recentTracks,
        addRecentTrack,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
