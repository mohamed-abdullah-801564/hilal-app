import AsyncStorage from '@react-native-async-storage/async-storage';

const CUSTOM_TRACKS_KEY = 'custom_tracks';
const CUSTOM_QUIZZES_KEY = 'custom_quizzes';

export interface CustomTrack {
  id: string;
  title: string;
  description: string;
  categoryId: string;
  categoryName: string;
  audioUri: string;
  fileName: string;
  uploadedAt: number;
  duration: number;
}

export interface CustomQuiz {
  id: string;
  trackId?: string;
  categoryId: string;
  question: string;
  options: string[];
  correctIndex: number;
  addedAt: number;
}

export async function getCustomTracks(): Promise<CustomTrack[]> {
  try {
    const raw = await AsyncStorage.getItem(CUSTOM_TRACKS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveCustomTrack(track: CustomTrack): Promise<void> {
  const existing = await getCustomTracks();
  existing.unshift(track);
  await AsyncStorage.setItem(CUSTOM_TRACKS_KEY, JSON.stringify(existing));
}

export async function updateCustomTrack(id: string, updates: Partial<CustomTrack>): Promise<void> {
  const existing = await getCustomTracks();
  const idx = existing.findIndex(t => t.id === id);
  if (idx !== -1) {
    existing[idx] = { ...existing[idx], ...updates };
    await AsyncStorage.setItem(CUSTOM_TRACKS_KEY, JSON.stringify(existing));
  }
}

export async function deleteCustomTrack(id: string): Promise<void> {
  const existing = await getCustomTracks();
  const filtered = existing.filter(t => t.id !== id);
  await AsyncStorage.setItem(CUSTOM_TRACKS_KEY, JSON.stringify(filtered));
}

export async function getCustomQuizzes(): Promise<CustomQuiz[]> {
  try {
    const raw = await AsyncStorage.getItem(CUSTOM_QUIZZES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function getQuizzesByTrack(trackId: string): Promise<CustomQuiz[]> {
  const all = await getCustomQuizzes();
  return all.filter(q => q.trackId === trackId);
}

export async function saveCustomQuiz(quiz: CustomQuiz): Promise<void> {
  const existing = await getCustomQuizzes();
  existing.unshift(quiz);
  await AsyncStorage.setItem(CUSTOM_QUIZZES_KEY, JSON.stringify(existing));
}

export async function updateCustomQuiz(id: string, updates: Partial<CustomQuiz>): Promise<void> {
  const existing = await getCustomQuizzes();
  const idx = existing.findIndex(q => q.id === id);
  if (idx !== -1) {
    existing[idx] = { ...existing[idx], ...updates };
    await AsyncStorage.setItem(CUSTOM_QUIZZES_KEY, JSON.stringify(existing));
  }
}

export async function deleteCustomQuiz(id: string): Promise<void> {
  const existing = await getCustomQuizzes();
  const filtered = existing.filter(q => q.id !== id);
  await AsyncStorage.setItem(CUSTOM_QUIZZES_KEY, JSON.stringify(filtered));
}
