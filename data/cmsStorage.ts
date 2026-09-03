import AsyncStorage from '@react-native-async-storage/async-storage';

const CATS_KEY    = 'cms_categories_v1';
const SUBS_KEY    = 'cms_subcategories_v1';
const CARDS_KEY   = 'cms_cards_v1';
const TRACKS_KEY  = 'cms_tracks_v1';
const QUIZZES_KEY = 'cms_quizzes_v1';

export interface CMSCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  description?: string;
  sortOrder: number;
  createdAt: number;
}

export interface CMSSubcategory {
  id: string;
  categoryId: string;
  name: string;
  description?: string;
  sortOrder: number;
  createdAt: number;
}

export interface CMSCard {
  id: string;
  subcategoryId: string;
  title: string;
  description?: string;
  sortOrder: number;
  createdAt: number;
}

export interface CMSTrack {
  id: string;
  cardId: string;
  title: string;
  audioUrl: string;
  duration: number;
  hasQuiz: boolean;
  sortOrder: number;
  createdAt: number;
}

export interface CMSQuiz {
  id: string;
  trackId: string;
  question: string;
  options: [string, string, string];
  correctIndex: 0 | 1 | 2;
}

function uid(): string {
  return 'cms_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

async function readJSON<T>(key: string): Promise<T[]> {
  const raw = await AsyncStorage.getItem(key);
  return raw ? JSON.parse(raw) : [];
}

async function writeJSON<T>(key: string, data: T[]): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(data));
}

// ─── CATEGORIES ────────────────────────────────────────────────────────────

export async function getAllCMSCategories(): Promise<CMSCategory[]> {
  const all = await readJSON<CMSCategory>(CATS_KEY);
  return all.sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getCMSCategoryById(id: string): Promise<CMSCategory | null> {
  const all = await readJSON<CMSCategory>(CATS_KEY);
  return all.find(c => c.id === id) ?? null;
}

export async function addCMSCategory(data: Omit<CMSCategory, 'id' | 'createdAt'>): Promise<CMSCategory> {
  const all = await readJSON<CMSCategory>(CATS_KEY);
  const item: CMSCategory = { ...data, id: uid(), createdAt: Date.now() };
  all.push(item);
  await writeJSON(CATS_KEY, all);
  return item;
}

export async function updateCMSCategory(id: string, updates: Partial<CMSCategory>): Promise<void> {
  const all = await readJSON<CMSCategory>(CATS_KEY);
  const idx = all.findIndex(c => c.id === id);
  if (idx !== -1) { all[idx] = { ...all[idx], ...updates }; await writeJSON(CATS_KEY, all); }
}

export async function deleteCMSCategory(id: string): Promise<void> {
  const subs = await readJSON<CMSSubcategory>(SUBS_KEY);
  const subIds = subs.filter(s => s.categoryId === id).map(s => s.id);
  for (const subId of subIds) await deleteCMSSubcategory(subId);
  await writeJSON(CATS_KEY, (await readJSON<CMSCategory>(CATS_KEY)).filter(c => c.id !== id));
}

// ─── SUBCATEGORIES ─────────────────────────────────────────────────────────

export async function getCMSSubcategoriesByCategory(categoryId: string): Promise<CMSSubcategory[]> {
  const all = await readJSON<CMSSubcategory>(SUBS_KEY);
  return all.filter(s => s.categoryId === categoryId).sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getCMSSubcategoryById(id: string): Promise<CMSSubcategory | null> {
  const all = await readJSON<CMSSubcategory>(SUBS_KEY);
  return all.find(s => s.id === id) ?? null;
}

export async function addCMSSubcategory(data: Omit<CMSSubcategory, 'id' | 'createdAt'>): Promise<CMSSubcategory> {
  const all = await readJSON<CMSSubcategory>(SUBS_KEY);
  const item: CMSSubcategory = { ...data, id: uid(), createdAt: Date.now() };
  all.push(item);
  await writeJSON(SUBS_KEY, all);
  return item;
}

export async function updateCMSSubcategory(id: string, updates: Partial<CMSSubcategory>): Promise<void> {
  const all = await readJSON<CMSSubcategory>(SUBS_KEY);
  const idx = all.findIndex(s => s.id === id);
  if (idx !== -1) { all[idx] = { ...all[idx], ...updates }; await writeJSON(SUBS_KEY, all); }
}

export async function deleteCMSSubcategory(id: string): Promise<void> {
  const cards = await readJSON<CMSCard>(CARDS_KEY);
  const cardIds = cards.filter(c => c.subcategoryId === id).map(c => c.id);
  for (const cardId of cardIds) await deleteCMSCard(cardId);
  await writeJSON(SUBS_KEY, (await readJSON<CMSSubcategory>(SUBS_KEY)).filter(s => s.id !== id));
}

// ─── CARDS ─────────────────────────────────────────────────────────────────

export async function getCMSCardsBySubcategory(subcategoryId: string): Promise<CMSCard[]> {
  const all = await readJSON<CMSCard>(CARDS_KEY);
  return all.filter(c => c.subcategoryId === subcategoryId).sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getCMSCardById(id: string): Promise<CMSCard | null> {
  const all = await readJSON<CMSCard>(CARDS_KEY);
  return all.find(c => c.id === id) ?? null;
}

export async function addCMSCard(data: Omit<CMSCard, 'id' | 'createdAt'>): Promise<CMSCard> {
  const all = await readJSON<CMSCard>(CARDS_KEY);
  const item: CMSCard = { ...data, id: uid(), createdAt: Date.now() };
  all.push(item);
  await writeJSON(CARDS_KEY, all);
  return item;
}

export async function updateCMSCard(id: string, updates: Partial<CMSCard>): Promise<void> {
  const all = await readJSON<CMSCard>(CARDS_KEY);
  const idx = all.findIndex(c => c.id === id);
  if (idx !== -1) { all[idx] = { ...all[idx], ...updates }; await writeJSON(CARDS_KEY, all); }
}

export async function deleteCMSCard(id: string): Promise<void> {
  const tracks = await readJSON<CMSTrack>(TRACKS_KEY);
  const trackIds = tracks.filter(t => t.cardId === id).map(t => t.id);
  for (const tid of trackIds) await deleteCMSTrack(tid);
  await writeJSON(CARDS_KEY, (await readJSON<CMSCard>(CARDS_KEY)).filter(c => c.id !== id));
}

export async function getCMSCardTrackCounts(subcategoryId: string): Promise<Record<string, number>> {
  const cards = await getCMSCardsBySubcategory(subcategoryId);
  const tracks = await readJSON<CMSTrack>(TRACKS_KEY);
  const result: Record<string, number> = {};
  for (const card of cards) {
    result[card.id] = tracks.filter(t => t.cardId === card.id).length;
  }
  return result;
}

// ─── TRACKS ────────────────────────────────────────────────────────────────

export async function getCMSTracksByCard(cardId: string): Promise<CMSTrack[]> {
  const all = await readJSON<CMSTrack>(TRACKS_KEY);
  return all.filter(t => t.cardId === cardId).sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getCMSTrackById(id: string): Promise<CMSTrack | null> {
  const all = await readJSON<CMSTrack>(TRACKS_KEY);
  return all.find(t => t.id === id) ?? null;
}

export async function addCMSTrack(data: Omit<CMSTrack, 'id' | 'createdAt'>): Promise<CMSTrack> {
  const all = await readJSON<CMSTrack>(TRACKS_KEY);
  const item: CMSTrack = { ...data, id: uid(), createdAt: Date.now() };
  all.push(item);
  await writeJSON(TRACKS_KEY, all);
  return item;
}

export async function updateCMSTrack(id: string, updates: Partial<CMSTrack>): Promise<void> {
  const all = await readJSON<CMSTrack>(TRACKS_KEY);
  const idx = all.findIndex(t => t.id === id);
  if (idx !== -1) { all[idx] = { ...all[idx], ...updates }; await writeJSON(TRACKS_KEY, all); }
}

export async function deleteCMSTrack(id: string): Promise<void> {
  await writeJSON(TRACKS_KEY, (await readJSON<CMSTrack>(TRACKS_KEY)).filter(t => t.id !== id));
  await writeJSON(QUIZZES_KEY, (await readJSON<CMSQuiz>(QUIZZES_KEY)).filter(q => q.trackId !== id));
}

export async function batchUpdateCMSTrackOrder(updates: Array<{ id: string; sortOrder: number }>): Promise<void> {
  const all = await readJSON<CMSTrack>(TRACKS_KEY);
  const map = new Map(updates.map(u => [u.id, u.sortOrder]));
  await writeJSON(TRACKS_KEY, all.map(t => map.has(t.id) ? { ...t, sortOrder: map.get(t.id)! } : t));
}

// ─── QUIZZES ───────────────────────────────────────────────────────────────

export async function getCMSQuizzesByTrack(trackId: string): Promise<CMSQuiz[]> {
  const all = await readJSON<CMSQuiz>(QUIZZES_KEY);
  return all.filter(q => q.trackId === trackId);
}

export async function addCMSQuiz(data: Omit<CMSQuiz, 'id'>): Promise<CMSQuiz> {
  const all = await readJSON<CMSQuiz>(QUIZZES_KEY);
  const item: CMSQuiz = { ...data, id: uid() };
  all.push(item);
  await writeJSON(QUIZZES_KEY, all);
  return item;
}

export async function updateCMSQuiz(id: string, updates: Partial<CMSQuiz>): Promise<void> {
  const all = await readJSON<CMSQuiz>(QUIZZES_KEY);
  const idx = all.findIndex(q => q.id === id);
  if (idx !== -1) { all[idx] = { ...all[idx], ...updates }; await writeJSON(QUIZZES_KEY, all); }
}

export async function deleteCMSQuiz(id: string): Promise<void> {
  await writeJSON(QUIZZES_KEY, (await readJSON<CMSQuiz>(QUIZZES_KEY)).filter(q => q.id !== id));
}

export async function getCMSTotals(): Promise<{ categories: number; subcategories: number; cards: number; tracks: number }> {
  const [cats, subs, cards, tracks] = await Promise.all([
    readJSON<CMSCategory>(CATS_KEY),
    readJSON<CMSSubcategory>(SUBS_KEY),
    readJSON<CMSCard>(CARDS_KEY),
    readJSON<CMSTrack>(TRACKS_KEY),
  ]);
  return { categories: cats.length, subcategories: subs.length, cards: cards.length, tracks: tracks.length };
}
