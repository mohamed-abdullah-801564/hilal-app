import AsyncStorage from '@react-native-async-storage/async-storage';

const DB_TRACKS_KEY  = 'db_tracks_v4';
const DB_QUIZZES_KEY = 'db_quizzes_v4';
const DB_CATS_KEY    = 'db_categories_v1';
const DB_SUBS_KEY    = 'db_subcategories_v1';

// ─── INTERFACES ─────────────────────────────────────────────────────────────

export interface StoredCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  description?: string;
  sortOrder: number;
  createdAt: number;
}

export interface StoredSubcategory {
  id: string;
  categoryId: string;
  name: string;
  nameEn?: string;
  sortOrder: number;
  createdAt: number;
}

export interface UnifiedTrack {
  id: string;
  title: string;
  categoryId: string;
  categoryName: string;
  subcategoryId?: string;
  duration: number;
  audioUrl: string;
  viewCount: number;
  isPremium: boolean;
  sortOrder: number;
  prizeEnabled?: boolean;
  hasQuiz?: boolean;
  description?: string;
  fileName?: string;
  uploadedAt: number;
  isBuiltIn: boolean;
}

export interface UnifiedQuiz {
  id: string;
  trackId: string;
  categoryId: string;
  question: string;
  options: string[];
  correctIndex: number;
  addedAt: number;
  explanation?: string;
}

// ─── SAFE JSON PARSE ─────────────────────────────────────────────────────────

function safeParseJSON<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// ─── TRACKS ──────────────────────────────────────────────────────────────────
// NOTE: Local track storage is kept for quiz progress and upload-based tracks.
// Categories and cards are now 100% Firebase-only.

export async function getAllTracks(): Promise<UnifiedTrack[]> {
  try {
    const raw = await AsyncStorage.getItem(DB_TRACKS_KEY);
    return safeParseJSON<UnifiedTrack[]>(raw, []);
  } catch {
    return [];
  }
}

export async function getTracksByCategory(categoryId: string): Promise<UnifiedTrack[]> {
  try {
    const all = await getAllTracks();
    return all.filter(t => t.categoryId === categoryId).sort((a, b) => a.sortOrder - b.sortOrder);
  } catch {
    return [];
  }
}

export async function getTracksByCategoryAndSubcategory(
  categoryId: string,
  subcategoryId: string | null,
): Promise<UnifiedTrack[]> {
  const all = await getTracksByCategory(categoryId);
  if (!subcategoryId) return all;
  return all.filter(t => t.subcategoryId === subcategoryId);
}

export async function batchUpdateSortOrder(updates: Array<{ id: string; sortOrder: number }>): Promise<void> {
  try {
    const all = await getAllTracks();
    const map = new Map(updates.map(u => [u.id, u.sortOrder]));
    await AsyncStorage.setItem(DB_TRACKS_KEY, JSON.stringify(all.map(t => map.has(t.id) ? { ...t, sortOrder: map.get(t.id)! } : t)));
  } catch (err) {
    console.warn('[unifiedStorage] batchUpdateSortOrder error:', err);
  }
}

export async function getTrackById(id: string): Promise<UnifiedTrack | null> {
  try {
    const all = await getAllTracks();
    return all.find(t => t.id === id) ?? null;
  } catch {
    return null;
  }
}

export async function addTrack(track: UnifiedTrack): Promise<void> {
  const all = await getAllTracks();
  all.push(track);
  await AsyncStorage.setItem(DB_TRACKS_KEY, JSON.stringify(all));
}

export async function updateTrack(id: string, updates: Partial<UnifiedTrack>): Promise<void> {
  try {
    const all = await getAllTracks();
    const idx = all.findIndex(t => t.id === id);
    if (idx !== -1) {
      all[idx] = { ...all[idx], ...updates };
      await AsyncStorage.setItem(DB_TRACKS_KEY, JSON.stringify(all));
    }
  } catch (err) {
    console.warn('[unifiedStorage] updateTrack error:', err);
  }
}

export async function deleteTrack(id: string): Promise<void> {
  try {
    const all = await getAllTracks();
    await AsyncStorage.setItem(DB_TRACKS_KEY, JSON.stringify(all.filter(t => t.id !== id)));
  } catch (err) {
    console.warn('[unifiedStorage] deleteTrack error:', err);
  }
}

export async function getCategoryTrackCounts(): Promise<Record<string, number>> {
  try {
    const all = await getAllTracks();
    const counts: Record<string, number> = {};
    for (const t of all) { counts[t.categoryId] = (counts[t.categoryId] ?? 0) + 1; }
    return counts;
  } catch {
    return {};
  }
}

// ─── QUIZZES ─────────────────────────────────────────────────────────────────

export async function getQuizzesByTrack(trackId: string): Promise<UnifiedQuiz[]> {
  try {
    const raw = await AsyncStorage.getItem(DB_QUIZZES_KEY);
    const all: UnifiedQuiz[] = safeParseJSON(raw, []);
    return all.filter(q => q.trackId === trackId);
  } catch {
    return [];
  }
}

export async function getAllQuizzes(): Promise<UnifiedQuiz[]> {
  try {
    const raw = await AsyncStorage.getItem(DB_QUIZZES_KEY);
    return safeParseJSON<UnifiedQuiz[]>(raw, []);
  } catch {
    return [];
  }
}

export async function saveQuiz(quiz: UnifiedQuiz): Promise<void> {
  const all = await getAllQuizzes();
  all.push(quiz);
  await AsyncStorage.setItem(DB_QUIZZES_KEY, JSON.stringify(all));
  if (quiz.trackId) await updateTrack(quiz.trackId, { hasQuiz: true });
}

export async function updateQuiz(id: string, updates: Partial<UnifiedQuiz>): Promise<void> {
  try {
    const all = await getAllQuizzes();
    const idx = all.findIndex(q => q.id === id);
    if (idx !== -1) {
      all[idx] = { ...all[idx], ...updates };
      await AsyncStorage.setItem(DB_QUIZZES_KEY, JSON.stringify(all));
    }
  } catch (err) {
    console.warn('[unifiedStorage] updateQuiz error:', err);
  }
}

export async function deleteQuiz(id: string): Promise<void> {
  try {
    const all = await getAllQuizzes();
    const quiz = all.find(q => q.id === id);
    const filtered = all.filter(q => q.id !== id);
    await AsyncStorage.setItem(DB_QUIZZES_KEY, JSON.stringify(filtered));
    if (quiz?.trackId) {
      const remaining = filtered.filter(q => q.trackId === quiz.trackId);
      if (remaining.length === 0) await updateTrack(quiz.trackId, { hasQuiz: false });
    }
  } catch (err) {
    console.warn('[unifiedStorage] deleteQuiz error:', err);
  }
}

// ─── CATEGORIES (local-only CRUD — Firebase is primary source) ───────────────
// These functions manage a local cache of categories for offline/admin use.
// getAllCategories returns [] if nothing is stored locally — NO built-in seeding.

export async function getAllCategories(): Promise<StoredCategory[]> {
  try {
    const raw = await AsyncStorage.getItem(DB_CATS_KEY);
    const cats = safeParseJSON<StoredCategory[]>(raw, []);
    return cats.sort((a, b) => a.sortOrder - b.sortOrder);
  } catch {
    return [];
  }
}

export async function getCategoryById(id: string): Promise<StoredCategory | null> {
  try {
    const all = await getAllCategories();
    return all.find(c => c.id === id) ?? null;
  } catch {
    return null;
  }
}

export async function addCategory(data: Omit<StoredCategory, 'id' | 'createdAt'>): Promise<StoredCategory> {
  const all = await getAllCategories();
  const cat: StoredCategory = {
    ...data,
    id: `cat_${Date.now()}`,
    createdAt: Date.now(),
  };
  all.push(cat);
  await AsyncStorage.setItem(DB_CATS_KEY, JSON.stringify(all));
  return cat;
}

export async function updateCategory(id: string, updates: Partial<StoredCategory>): Promise<void> {
  try {
    const all = await getAllCategories();
    const idx = all.findIndex(c => c.id === id);
    if (idx !== -1) {
      all[idx] = { ...all[idx], ...updates };
      await AsyncStorage.setItem(DB_CATS_KEY, JSON.stringify(all));
    }
  } catch (err) {
    console.warn('[unifiedStorage] updateCategory error:', err);
  }
}

export async function deleteCategory(id: string): Promise<void> {
  try {
    const all = await getAllCategories();
    await AsyncStorage.setItem(DB_CATS_KEY, JSON.stringify(all.filter(c => c.id !== id)));
    const tracks = await getAllTracks();
    await AsyncStorage.setItem(DB_TRACKS_KEY, JSON.stringify(tracks.filter(t => t.categoryId !== id)));
    const raw = await AsyncStorage.getItem(DB_SUBS_KEY);
    const allSubs = safeParseJSON<StoredSubcategory[]>(raw, []);
    await AsyncStorage.setItem(DB_SUBS_KEY, JSON.stringify(allSubs.filter(s => s.categoryId !== id)));
  } catch (err) {
    console.warn('[unifiedStorage] deleteCategory error:', err);
  }
}

// ─── SUBCATEGORIES ───────────────────────────────────────────────────────────

export async function getSubcategoriesByCategory(categoryId: string): Promise<StoredSubcategory[]> {
  try {
    const raw = await AsyncStorage.getItem(DB_SUBS_KEY);
    const all = safeParseJSON<StoredSubcategory[]>(raw, []);
    return all.filter(s => s.categoryId === categoryId).sort((a, b) => a.sortOrder - b.sortOrder);
  } catch {
    return [];
  }
}

export async function addSubcategory(data: Omit<StoredSubcategory, 'id' | 'createdAt'>): Promise<StoredSubcategory> {
  const raw = await AsyncStorage.getItem(DB_SUBS_KEY);
  const all = safeParseJSON<StoredSubcategory[]>(raw, []);
  const sub: StoredSubcategory = {
    ...data,
    id: `sub_${Date.now()}`,
    createdAt: Date.now(),
  };
  all.push(sub);
  await AsyncStorage.setItem(DB_SUBS_KEY, JSON.stringify(all));
  return sub;
}

export async function updateSubcategory(id: string, updates: Partial<StoredSubcategory>): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(DB_SUBS_KEY);
    const all = safeParseJSON<StoredSubcategory[]>(raw, []);
    const idx = all.findIndex(s => s.id === id);
    if (idx !== -1) {
      all[idx] = { ...all[idx], ...updates };
      await AsyncStorage.setItem(DB_SUBS_KEY, JSON.stringify(all));
    }
  } catch (err) {
    console.warn('[unifiedStorage] updateSubcategory error:', err);
  }
}

export async function deleteSubcategory(id: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(DB_SUBS_KEY);
    const all = safeParseJSON<StoredSubcategory[]>(raw, []);
    await AsyncStorage.setItem(DB_SUBS_KEY, JSON.stringify(all.filter(s => s.id !== id)));
    const tracks = await getAllTracks();
    const updated = tracks.map(t => t.subcategoryId === id ? { ...t, subcategoryId: undefined } : t);
    await AsyncStorage.setItem(DB_TRACKS_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('[unifiedStorage] deleteSubcategory error:', err);
  }
}

export async function resetDB(): Promise<void> {
  await AsyncStorage.multiRemove([DB_TRACKS_KEY, DB_QUIZZES_KEY, DB_CATS_KEY, DB_SUBS_KEY]);
}
