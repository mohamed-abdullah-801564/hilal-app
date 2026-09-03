import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "quiz_level_progress_v1";

export interface LevelResult {
  completed: boolean;
  score: number;
  total: number;
  completedAt?: number;
}

export interface TrackQuizProgress {
  level1?: LevelResult;
  level2?: LevelResult;
  level3?: LevelResult;
}

export type LevelId = 1 | 2 | 3;

function safeParse<T>(raw: string | null, fb: T): T {
  if (!raw) return fb;
  try { return JSON.parse(raw) as T; }
  catch { return fb; }
}

export async function getQuizProgress(trackId: string): Promise<TrackQuizProgress> {
  const raw = await AsyncStorage.getItem(KEY);
  const all = safeParse<Record<string, TrackQuizProgress>>(raw, {});
  return all[trackId] ?? {};
}

export async function saveLevelResult(
  trackId: string,
  level: LevelId,
  result: LevelResult,
): Promise<void> {
  const raw = await AsyncStorage.getItem(KEY);
  const all = safeParse<Record<string, TrackQuizProgress>>(raw, {});
  all[trackId] = all[trackId] ?? {};
  (all[trackId] as any)[`level${level}`] = result;
  await AsyncStorage.setItem(KEY, JSON.stringify(all));
}

export async function resetLevelProgress(
  trackId: string,
  level: LevelId,
): Promise<void> {
  const raw = await AsyncStorage.getItem(KEY);
  const all = safeParse<Record<string, TrackQuizProgress>>(raw, {});
  if (all[trackId]) {
    delete (all[trackId] as any)[`level${level}`];
  }
  await AsyncStorage.setItem(KEY, JSON.stringify(all));
}
