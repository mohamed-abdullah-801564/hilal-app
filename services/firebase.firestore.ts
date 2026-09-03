import {
  collection,
  collectionGroup,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  setDoc,
  onSnapshot,
  query,
  orderBy,
  where,
  serverTimestamp,
  Timestamp,
  arrayUnion,
  arrayRemove,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase.config";
import { sanitizeInput, isRateLimited } from "@/utils/security";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FBCategory {
  id:           string;
  name:         string;
  nameEn:       string;
  icon:         string;
  color:        string;
  description:  string;
  sortOrder:    number;
  createdAt:    number;
}

export interface FBSubcategory {
  id:           string;
  categoryId:   string;
  name:         string;
  nameEn:       string;
  sortOrder:    number;
  createdAt:    number;
}

export interface FBQuizQuestion {
  question:     string;
  options:      string[];
  correctIndex: number;
  explanation?: string;   // shown after wrong answer
}

export interface FBTrackItem {
  id:                  string;
  titleTa:             string;
  titleEn:             string;
  audioUrl?:           string;
  podcastAudioUrl?:    string;
  videoUrl?:           string;
  readContent?:        string;
  slideImageUrl?:      string;
  slideDocUrl?:        string;
  hasQuiz?:            boolean;
  quiz?:               FBQuizQuestion[];
}

export interface FBCard {
  id:                  string;
  categoryId:          string;
  /** @deprecated App navigation no longer uses subcategories; field kept for existing Firestore docs */
  subcategoryId?:      string;
  titleTa:             string;
  titleEn:             string;
  audioUrl:            string;
  podcastAudioUrl:     string;
  videoUrl:            string;   // file upload OR external URL (.mp4 etc.)
  readContent:         string;
  slideImageUrl:       string;
  slideDocUrl:         string;   // PDF / PPT / PPTX document URL
  duration:            number;
  description:         string;
  isPremium:           boolean;
  hasQuiz:             boolean;
  viewCount:           number;
  sortOrder:           number;
  quiz:                FBQuizQuestion[];
  quizTitleTa:         string;
  quizTitleEn:         string;
  createdAt:           number;
  tracks?:             FBTrackItem[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tsToMs(val: unknown): number {
  if (!val) return Date.now();
  if (val instanceof Timestamp) return val.toMillis();
  if (typeof val === "number") return val;
  return Date.now();
}

function bySort(a: { sortOrder: number }, b: { sortOrder: number }) {
  return a.sortOrder - b.sortOrder;
}

function toFBCategory(id: string, data: Record<string, any>): FBCategory {
  return {
    id,
    name:        data.name        ?? "",
    nameEn:      data.nameEn      ?? "",
    icon:        data.icon        ?? "📖",
    color:       data.color       ?? "#1a7a4a",
    description: data.description ?? "",
    sortOrder:   data.sortOrder   ?? 0,
    createdAt:   tsToMs(data.createdAt),
  };
}

function toFBSubcategory(id: string, data: Record<string, any>): FBSubcategory {
  return {
    id,
    categoryId: data.categoryId ?? "",
    name:       data.name       ?? "",
    nameEn:     data.nameEn     ?? "",
    sortOrder:  data.sortOrder  ?? 0,
    createdAt:  tsToMs(data.createdAt),
  };
}

function toFBCard(id: string, data: Record<string, any>): FBCard {
  return {
    id,
    categoryId:      data.categoryId      ?? "",
    subcategoryId:   data.subcategoryId   ?? "",
    titleTa:         data.titleTa         ?? "",
    titleEn:         data.titleEn         ?? "",
    audioUrl:        data.audioUrl        ?? "",
    podcastAudioUrl: data.podcastAudioUrl ?? "",
    videoUrl:        data.videoUrl        ?? "",
    readContent:     data.readContent     ?? "",
    slideImageUrl:   data.slideImageUrl   ?? "",
    slideDocUrl:     data.slideDocUrl     ?? "",
    duration:        data.duration        ?? 0,
    description:     data.description     ?? "",
    isPremium:       data.isPremium       ?? false,
    hasQuiz:         data.hasQuiz         ?? false,
    viewCount:       data.viewCount       ?? 0,
    sortOrder:       data.sortOrder       ?? 0,
    quiz:            Array.isArray(data.quiz) ? data.quiz : [],
    quizTitleTa:     data.quizTitleTa     ?? "",
    quizTitleEn:     data.quizTitleEn     ?? "",
    createdAt:       tsToMs(data.createdAt),
    tracks:          Array.isArray(data.tracks) ? data.tracks : [],
  };
}

// ─── Category CRUD ────────────────────────────────────────────────────────────

export async function addCategory(
  data: Omit<FBCategory, "id" | "createdAt">
): Promise<string> {
  const ref = await addDoc(collection(db, "categories"), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateCategory(
  id: string,
  data: Partial<Omit<FBCategory, "id" | "createdAt">>
): Promise<void> {
  await updateDoc(doc(db, "categories", id), data);
}

export async function deleteCategory(id: string): Promise<void> {
  await deleteDoc(doc(db, "categories", id));
}

export async function getCategories(): Promise<FBCategory[]> {
  const snap = await getDocs(collection(db, "categories"));
  return snap.docs
    .map(d => toFBCategory(d.id, d.data() as Record<string, any>))
    .sort(bySort);
}

// ─── Subcategory CRUD ─────────────────────────────────────────────────────────

export async function addSubCategory(
  data: Omit<FBSubcategory, "id" | "createdAt">
): Promise<string> {
  const ref = await addDoc(collection(db, "subcategories"), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateSubCategory(
  id: string,
  data: Partial<Omit<FBSubcategory, "id" | "createdAt">>
): Promise<void> {
  await updateDoc(doc(db, "subcategories", id), data);
}

export async function deleteSubCategory(id: string): Promise<void> {
  await deleteDoc(doc(db, "subcategories", id));
}

export async function getSubcategories(categoryId?: string): Promise<FBSubcategory[]> {
  const snap = await getDocs(collection(db, "subcategories"));
  const all = snap.docs
    .map(d => toFBSubcategory(d.id, d.data() as Record<string, any>))
    .sort(bySort);
  return categoryId ? all.filter(s => s.categoryId === categoryId) : all;
}

// ─── Card CRUD ────────────────────────────────────────────────────────────────

export async function addCard(
  data: Omit<FBCard, "id" | "createdAt">
): Promise<string> {
  const ref = await addDoc(collection(db, "cards"), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateCard(
  id: string,
  data: Partial<Omit<FBCard, "id" | "createdAt">>
): Promise<void> {
  await updateDoc(doc(db, "cards", id), data);
}

export async function deleteCard(id: string): Promise<void> {
  await deleteDoc(doc(db, "cards", id));
}

// ─── Podcast Images (shared config — not stored on cards) ─────────────────────
// Reuses the existing `config` collection (same pattern as config/userCounter).
// Document: config/podcastImages  { urls: string[] }

const PODCAST_IMAGES_COL = "config";
const PODCAST_IMAGES_DOC = "podcastImages";

function podcastImagesRef() {
  return doc(db, PODCAST_IMAGES_COL, PODCAST_IMAGES_DOC);
}

function normalizePodcastImageUrls(val: unknown): string[] {
  if (!Array.isArray(val)) return [];
  return val.filter((u): u is string => typeof u === "string" && u.length > 0);
}

export async function getPodcastImageUrls(): Promise<string[]> {
  try {
    console.log("[PodcastImages] firestore read config/podcastImages");
    const snap = await getDoc(podcastImagesRef());
    if (!snap.exists()) {
      console.log("[PodcastImages] firestore document does not exist");
      return [];
    }
    const raw = snap.data();
    console.log("[PodcastImages] firestore raw keys:", raw ? Object.keys(raw) : []);
    const urls = normalizePodcastImageUrls(raw?.urls);
    if (urls.length === 0) {
      console.log("[PodcastImages] urls is empty. urls field type:", Array.isArray(raw?.urls) ? "array" : typeof raw?.urls);
    }
    console.log("[PodcastImages] urls count:", urls.length);
    console.log("[PodcastImages] urls:", urls);
    return urls;
  } catch (e: any) {
    console.error("[PodcastImages] firestore read FAILED:", e?.code, e?.message ?? e);
    throw e;
  }
}

/** Appends URLs that are not already stored. No-op for empty input. */
export async function addPodcastImageUrls(urls: string[]): Promise<string[]> {
  const unique = [...new Set(urls.filter(u => typeof u === "string" && u.trim().length > 0))];
  console.log("[PodcastImages] firestore write", { incoming: unique.length });
  if (unique.length === 0) return getPodcastImageUrls();

  const ref = podcastImagesRef();
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      console.log("[PodcastImages] firestore write creating config/podcastImages");
      await setDoc(ref, { urls: unique });
    } else {
      const existing = new Set(normalizePodcastImageUrls(snap.data()?.urls));
      const toAdd = unique.filter(u => !existing.has(u));
      console.log("[PodcastImages] firestore write arrayUnion", { toAdd: toAdd.length, existing: existing.size });
      if (toAdd.length > 0) {
        await updateDoc(ref, { urls: arrayUnion(...toAdd) });
      }
    }
  } catch (e: any) {
    console.error("[PodcastImages] firestore write FAILED:", e?.code, e?.message ?? e);
    throw e;
  }
  return getPodcastImageUrls();
}

export async function removePodcastImageUrl(url: string): Promise<string[]> {
  const ref = podcastImagesRef();
  const snap = await getDoc(ref);
  if (!snap.exists()) return [];
  await updateDoc(ref, { urls: arrayRemove(url) });
  return getPodcastImageUrls();
}

export async function getCardById(id: string): Promise<FBCard | null> {
  const snap = await getDoc(doc(db, "cards", id));
  if (!snap.exists()) return null;
  return toFBCard(snap.id, snap.data() as Record<string, any>);
}

export async function getCards(subcategoryId?: string, categoryId?: string): Promise<FBCard[]> {
  // collectionGroup("cards") finds cards in ANY collection named "cards",
  // whether top-level or nested as a subcollection under categories.
  const snap = await getDocs(collectionGroup(db, "cards"));
  let all = snap.docs
    .map(d => toFBCard(d.id, d.data() as Record<string, any>))
    .sort(bySort);
  if (subcategoryId) all = all.filter(c => c.subcategoryId === subcategoryId);
  else if (categoryId) all = all.filter(c => c.categoryId === categoryId);
  return all;
}

// ─── Content requests (from users) ────────────────────────────────────────────

export async function addRequest(
  data: { title: string; category: string; description: string }
): Promise<string> {
  const limited = await isRateLimited("add_request", 10000);
  if (limited) {
    throw new Error("Too many requests. Please wait before submitting again.");
  }

  const cleanTitle = sanitizeInput(data.title);
  const cleanCategory = sanitizeInput(data.category);
  const cleanDescription = sanitizeInput(data.description);

  if (!cleanTitle) {
    throw new Error("Title cannot be empty");
  }

  const ref = await addDoc(collection(db, "requests"), {
    title:       cleanTitle,
    category:    cleanCategory,
    description: cleanDescription,
    createdAt:   serverTimestamp(),
  });
  return ref.id;
}

// ─── Single-document listeners ────────────────────────────────────────────────

export function subscribeCategory(
  id: string,
  onData: (cat: FBCategory | null) => void,
  onError?: (e: Error) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, "categories", id),
    snap => {
      if (!snap.exists()) { onData(null); return; }
      onData(toFBCategory(snap.id, snap.data() as Record<string, any>));
    },
    err => onError?.(err)
  );
}

export function subscribeSubcategory(
  id: string,
  onData: (sub: FBSubcategory | null) => void,
  onError?: (e: Error) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, "subcategories", id),
    snap => {
      if (!snap.exists()) { onData(null); return; }
      onData(toFBSubcategory(snap.id, snap.data() as Record<string, any>));
    },
    err => onError?.(err)
  );
}

export function subscribeCardsByCategory(
  categoryId: string,
  onData: (cards: FBCard[]) => void,
  onError?: (e: Error) => void
): Unsubscribe {
  return onSnapshot(
    collectionGroup(db, "cards"),
    snap => {
      const cards = snap.docs
        .map(d => toFBCard(d.id, d.data() as Record<string, any>))
        .filter(c => c.categoryId === categoryId)
        .sort(bySort);
      onData(cards);
    },
    err => onError?.(err)
  );
}

// ─── Real-time listeners (no composite index needed — filter in JS) ────────────

export function subscribeCategories(
  onData: (cats: FBCategory[]) => void,
  onError?: (e: Error) => void
): Unsubscribe {
  // Immediate one-time fetch as a guaranteed backup (survives onSnapshot permission errors)
  getDocs(collection(db, "categories"))
    .then(snap => {
      const cats = snap.docs
        .map(d => toFBCategory(d.id, d.data() as Record<string, any>))
        .sort(bySort);
      console.log("[Firebase] getDocs categories:", cats.length, "docs");
      onData(cats);
    })
    .catch(err => {
      console.error("[Firebase] getDocs categories FAILED:", err.code, err.message);
    });

  // Real-time listener (keeps data fresh after initial load)
  return onSnapshot(
    collection(db, "categories"),
    snap => {
      const cats = snap.docs
        .map(d => toFBCategory(d.id, d.data() as Record<string, any>))
        .sort(bySort);
      console.log("[Firebase] onSnapshot categories:", cats.length, "docs");
      onData(cats);
    },
    err => {
      console.error("[Firebase] onSnapshot categories FAILED:", err.code, err.message);
      onError?.(err);
    }
  );
}

export function subscribeSubcategories(
  categoryId: string,
  onData: (subs: FBSubcategory[]) => void,
  onError?: (e: Error) => void
): Unsubscribe {
  getDocs(collection(db, "subcategories"))
    .then(snap => {
      const subs = snap.docs
        .map(d => toFBSubcategory(d.id, d.data() as Record<string, any>))
        .filter(s => s.categoryId === categoryId)
        .sort(bySort);
      console.log("[Firebase] getDocs subcategories for", categoryId, ":", subs.length);
      onData(subs);
    })
    .catch(err => console.error("[Firebase] getDocs subcategories FAILED:", err.code, err.message));

  return onSnapshot(
    collection(db, "subcategories"),
    snap => {
      const subs = snap.docs
        .map(d => toFBSubcategory(d.id, d.data() as Record<string, any>))
        .filter(s => s.categoryId === categoryId)
        .sort(bySort);
      onData(subs);
    },
    err => {
      console.error("[Firebase] onSnapshot subcategories FAILED:", err.code, err.message);
      onError?.(err);
    }
  );
}

export function subscribeCards(
  subcategoryId: string,
  onData: (cards: FBCard[]) => void,
  onError?: (e: Error) => void
): Unsubscribe {
  // collectionGroup finds cards whether stored as top-level collection
  // OR as a subcollection under categories/{id}/cards
  getDocs(collectionGroup(db, "cards"))
    .then(snap => {
      const cards = snap.docs
        .map(d => toFBCard(d.id, d.data() as Record<string, any>))
        .filter(c => c.subcategoryId === subcategoryId)
        .sort(bySort);
      console.log("[Firebase] getDocs cards for subcategory", subcategoryId, ":", cards.length);
      onData(cards);
    })
    .catch(err => console.error("[Firebase] getDocs cards FAILED:", err.code, err.message));

  return onSnapshot(
    collectionGroup(db, "cards"),
    snap => {
      const cards = snap.docs
        .map(d => toFBCard(d.id, d.data() as Record<string, any>))
        .filter(c => c.subcategoryId === subcategoryId)
        .sort(bySort);
      onData(cards);
    },
    err => {
      console.error("[Firebase] onSnapshot cards FAILED:", err.code, err.message);
      onError?.(err);
    }
  );
}

export function subscribeAllCards(
  onData: (cards: FBCard[]) => void,
  onError?: (e: Error) => void
): Unsubscribe {
  getDocs(collectionGroup(db, "cards"))
    .then(snap => {
      const cards = snap.docs
        .map(d => toFBCard(d.id, d.data() as Record<string, any>))
        .sort(bySort);
      console.log("[Firebase] getDocs allCards:", cards.length);
      onData(cards);
    })
    .catch(err => console.error("[Firebase] getDocs allCards FAILED:", err.code, err.message));

  return onSnapshot(
    collectionGroup(db, "cards"),
    snap => {
      const cards = snap.docs
        .map(d => toFBCard(d.id, d.data() as Record<string, any>))
        .sort(bySort);
      onData(cards);
    },
    err => {
      console.error("[Firebase] onSnapshot allCards FAILED:", err.code, err.message);
      onError?.(err);
    }
  );
}

// ─── Bulk Seeder ───────────────────────────────────────────────────────────────
//
// createVirivuraiCards()
//
// 1. Finds category  where nameEn = "Quran"
// 2. Finds subcategory where name = "விரிவுரை" (under that category)
// 3. Checks existing cards in that subcategory to skip duplicates
// 4. Creates any missing surah cards
//
// Uses Firebase v9 modular SDK (collection / query / where / getDocs / addDoc)
// ─────────────────────────────────────────────────────────────────────────────

export interface SeedResult {
  categoryId:    string;
  subcategoryId: string;
  created:       string[];   // titleEn of newly created cards
  skipped:       string[];   // titleEn of cards that already existed
  errors:        { titleEn: string; message: string }[];
}

// ─────────────────────────────────────────────────────────────────────────────
// createHadithCards()
//
// 1. Finds category  where nameEn = "Hadith"
// 2. Finds subcategory where name = "ஹதீஸ் விரிவுரை" (under that category)
// 3. Checks existing cards in that subcategory to skip duplicates
// 4. Creates Hadith 1–10 cards
// ─────────────────────────────────────────────────────────────────────────────

const HADITH_CARDS: Array<{ titleEn: string; titleTa: string; sortOrder: number }> = [
  { titleEn: "Hadith 1",  titleTa: "ஹதீஸ் 1",  sortOrder: 1  },
  { titleEn: "Hadith 2",  titleTa: "ஹதீஸ் 2",  sortOrder: 2  },
  { titleEn: "Hadith 3",  titleTa: "ஹதீஸ் 3",  sortOrder: 3  },
  { titleEn: "Hadith 4",  titleTa: "ஹதீஸ் 4",  sortOrder: 4  },
  { titleEn: "Hadith 5",  titleTa: "ஹதீஸ் 5",  sortOrder: 5  },
  { titleEn: "Hadith 6",  titleTa: "ஹதீஸ் 6",  sortOrder: 6  },
  { titleEn: "Hadith 7",  titleTa: "ஹதீஸ் 7",  sortOrder: 7  },
  { titleEn: "Hadith 8",  titleTa: "ஹதீஸ் 8",  sortOrder: 8  },
  { titleEn: "Hadith 9",  titleTa: "ஹதீஸ் 9",  sortOrder: 9  },
  { titleEn: "Hadith 10", titleTa: "ஹதீஸ் 10", sortOrder: 10 },
];

export async function createHadithCards(): Promise<SeedResult> {
  console.log("[Seeder] ── createHadithCards() started ──────────────────────");

  // ── Step 1: Find category where nameEn = "Hadith" ─────────────────────────
  console.log('[Seeder] Step 1: Looking for category nameEn = "Hadith"...');

  const catSnap = await getDocs(
    query(collection(db, "categories"), where("nameEn", "==", "Hadith"))
  );

  if (catSnap.empty) {
    console.warn('[Seeder] nameEn = "Hadith" not found, trying name field...');
    const catSnap2 = await getDocs(
      query(collection(db, "categories"), where("name", "==", "Hadith"))
    );
    if (catSnap2.empty) {
      throw new Error(
        'Category "Hadith" not found. Check that the category exists in Firestore with nameEn = "Hadith".'
      );
    }
    const catDoc = catSnap2.docs[0];
    console.log(`[Seeder] ✅ Category found via name field: id=${catDoc.id}`);
    return _seedHadithCards(catDoc.id);
  }

  const catDoc = catSnap.docs[0];
  console.log(`[Seeder] ✅ Category found: id=${catDoc.id}, nameEn=${catDoc.data().nameEn}`);
  return _seedHadithCards(catDoc.id);
}

async function _seedHadithCards(categoryId: string): Promise<SeedResult> {
  const result: SeedResult = {
    categoryId,
    subcategoryId: "",
    created: [],
    skipped: [],
    errors:  [],
  };

  // ── Step 2: Find subcategory where name = "ஹதீஸ் விரிவுரை" ───────────────
  console.log('[Seeder] Step 2: Looking for subcategory name = "ஹதீஸ் விரிவுரை"...');

  const subSnap = await getDocs(
    query(
      collection(db, "subcategories"),
      where("categoryId", "==", categoryId),
      where("name", "==", "ஹதீஸ் விரிவுரை")
    )
  );

  if (subSnap.empty) {
    console.warn('[Seeder] "ஹதீஸ் விரிவுரை" not found, trying nameEn = "Hadith Virivurai"...');
    const subSnap2 = await getDocs(
      query(
        collection(db, "subcategories"),
        where("categoryId", "==", categoryId),
        where("nameEn", "==", "Hadith Virivurai")
      )
    );
    if (subSnap2.empty) {
      throw new Error(
        '"ஹதீஸ் விரிவுரை" subcategory not found under Hadith category. ' +
        'Create it first in the CMS with name = "ஹதீஸ் விரிவுரை".'
      );
    }
    result.subcategoryId = subSnap2.docs[0].id;
    console.log(`[Seeder] ✅ Subcategory found via nameEn: id=${result.subcategoryId}`);
  } else {
    result.subcategoryId = subSnap.docs[0].id;
    console.log(`[Seeder] ✅ Subcategory found: id=${result.subcategoryId}, name=${subSnap.docs[0].data().name}`);
  }

  const subcategoryId = result.subcategoryId;

  // ── Step 3: Fetch existing cards to detect duplicates ─────────────────────
  console.log("[Seeder] Step 3: Checking existing cards for duplicates...");

  const existingSnap = await getDocs(
    query(collection(db, "cards"), where("subcategoryId", "==", subcategoryId))
  );

  const existingTitles = new Set<string>(
    existingSnap.docs.map(d => ((d.data().titleEn as string) ?? "").toLowerCase().trim())
  );

  console.log(
    `[Seeder] Found ${existingSnap.size} existing cards. ` +
    `Existing titles: [${[...existingTitles].join(", ")}]`
  );

  // ── Step 4: Create missing cards ──────────────────────────────────────────
  console.log("[Seeder] Step 4: Creating Hadith cards...");

  for (const hadith of HADITH_CARDS) {
    const key = hadith.titleEn.toLowerCase().trim();

    if (existingTitles.has(key)) {
      console.log(`[Seeder]   ⏭ SKIP  — "${hadith.titleEn}" already exists`);
      result.skipped.push(hadith.titleEn);
      continue;
    }

    try {
      const ref = await addDoc(collection(db, "cards"), {
        categoryId,
        subcategoryId,
        titleEn:      hadith.titleEn,
        titleTa:      hadith.titleTa,
        audioUrl:     "",
        duration:     0,
        description:  "",
        isPremium:    false,
        hasQuiz:      true,
        viewCount:    0,
        sortOrder:    hadith.sortOrder,
        quiz:         [],
        quizTitleTa:  "",
        quizTitleEn:  "",
        createdAt:    serverTimestamp(),
      });

      console.log(`[Seeder]   ✅ CREATED — "${hadith.titleEn}" → docId: ${ref.id}`);
      result.created.push(hadith.titleEn);
      existingTitles.add(key);
    } catch (err: any) {
      const msg = err?.message ?? "Unknown error";
      console.error(`[Seeder]   ❌ ERROR  — "${hadith.titleEn}": ${msg}`);
      result.errors.push({ titleEn: hadith.titleEn, message: msg });
    }
  }

  // ── Step 5: Summary ───────────────────────────────────────────────────────
  console.log("[Seeder] ── Summary ─────────────────────────────────────────");
  console.log(`[Seeder]   Category ID:    ${result.categoryId}`);
  console.log(`[Seeder]   Subcategory ID: ${result.subcategoryId}`);
  console.log(`[Seeder]   ✅ Created:  ${result.created.length} cards → [${result.created.join(", ")}]`);
  console.log(`[Seeder]   ⏭ Skipped:  ${result.skipped.length} cards → [${result.skipped.join(", ")}]`);
  console.log(`[Seeder]   ❌ Errors:   ${result.errors.length}`);
  console.log("[Seeder] ── createHadithCards() done ────────────────────────");

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// createImanCards()
//
// 1. Finds category  where nameEn = "Fundamental of iman"
// 2. Finds subcategory where name = "ஈமானின் கடமைகள்"
// 3. Checks existing cards in that subcategory to skip duplicates
// 4. Creates 16 Iman cards (first 6 free, last 10 premium)
// ─────────────────────────────────────────────────────────────────────────────

const IMAN_CARDS: Array<{ titleEn: string; titleTa: string; isPremium: boolean; sortOrder: number }> = [
  { titleEn: "Roots of Iman",                        titleTa: "ஈமானின் வேர்கள்",                        isPremium: false, sortOrder: 1  },
  { titleEn: "Tawheed ar-Ruboobiyyah",                titleTa: "தவ்ஹீதுர் ருபூபிய்யா",                   isPremium: false, sortOrder: 2  },
  { titleEn: "Tawheed al-Uloohiyyah",                 titleTa: "தவ்ஹீதுல் உலூஹிய்யா",                    isPremium: false, sortOrder: 3  },
  { titleEn: "Fortress of Tawheed",                   titleTa: "ஏகத்துவத்தின் அரண்",                     isPremium: false, sortOrder: 4  },
  { titleEn: "Shirk and Rejection",                   titleTa: "இணைவைப்பு மற்றும் நிராகரிப்பு",          isPremium: false, sortOrder: 5  },
  { titleEn: "Unseen Knowledge and Deception",        titleTa: "ஃகைப் மறைவான அறிவின் ரகசியம்",           isPremium: false, sortOrder: 6  },
  { titleEn: "Belief in Angels",                      titleTa: "வானவர்கள் பற்றிய பாடம்",                  isPremium: true,  sortOrder: 7  },
  { titleEn: "Belief in Books",                       titleTa: "வேதங்களின் மீதான ஈமான்",                  isPremium: true,  sortOrder: 8  },
  { titleEn: "Belief in Prophets",                    titleTa: "நபிமார்கள் மீதான ஈமான்",                  isPremium: true,  sortOrder: 9  },
  { titleEn: "Prophet Muhammad (SAW) Specialties",   titleTa: "முஹம்மது (ஸல்) அவர்களின் சிறப்புகள்",    isPremium: true,  sortOrder: 10 },
  { titleEn: "Journey of Hereafter",                  titleTa: "மறுமைப் பயணம்",                          isPremium: true,  sortOrder: 11 },
  { titleEn: "Divine Decree",                         titleTa: "இறைவிதி ரகசியம்",                        isPremium: true,  sortOrder: 12 },
  { titleEn: "Three Levels of Deen",                  titleTa: "மார்க்கத்தின் மூன்று நிலைகள்",            isPremium: true,  sortOrder: 13 },
  { titleEn: "Al Wala Wal Bara",                      titleTa: "அல் வலா வல் பரா",                        isPremium: true,  sortOrder: 14 },
  { titleEn: "Companions Virtues",                    titleTa: "நபித்தோழர்களின் மாண்பு",                  isPremium: true,  sortOrder: 15 },
  { titleEn: "Following Quran & Sunnah",              titleTa: "குர்ஆன் & சுன்னா பின்பற்றுதல்",          isPremium: true,  sortOrder: 16 },
];

export async function createImanCards(): Promise<SeedResult> {
  console.log("[Seeder] ── createImanCards() started ────────────────────────");

  // ── Step 1: Find category where nameEn = "Fundamental of iman" ────────────
  console.log('[Seeder] Step 1: Looking for category nameEn = "Fundamental of iman"...');

  const catSnap = await getDocs(
    query(collection(db, "categories"), where("nameEn", "==", "Fundamental of iman"))
  );

  let categoryId: string;

  if (catSnap.empty) {
    console.warn('[Seeder] nameEn exact match not found, trying case-insensitive fallback...');
    // Try partial match via name field
    const catSnap2 = await getDocs(
      query(collection(db, "categories"), where("name", "==", "Fundamental of iman"))
    );
    if (catSnap2.empty) {
      throw new Error(
        'Category "Fundamental of iman" not found. ' +
        'Check that the category exists in Firestore with nameEn = "Fundamental of iman".'
      );
    }
    categoryId = catSnap2.docs[0].id;
    console.log(`[Seeder] ✅ Category found via name field: id=${categoryId}`);
  } else {
    categoryId = catSnap.docs[0].id;
    console.log(`[Seeder] ✅ Category found: id=${categoryId}, nameEn=${catSnap.docs[0].data().nameEn}`);
  }

  return _seedImanCards(categoryId);
}

async function _seedImanCards(categoryId: string): Promise<SeedResult> {
  const result: SeedResult = {
    categoryId,
    subcategoryId: "",
    created: [],
    skipped: [],
    errors:  [],
  };

  // ── Step 2: Find subcategory where name = "ஈமானின் கடமைகள்" ───────────────
  console.log('[Seeder] Step 2: Looking for subcategory name = "ஈமானின் கடமைகள்"...');

  const subSnap = await getDocs(
    query(
      collection(db, "subcategories"),
      where("categoryId", "==", categoryId),
      where("name", "==", "ஈமானின் கடமைகள்")
    )
  );

  if (subSnap.empty) {
    // Fallback: search without categoryId filter in case it was stored differently
    console.warn('[Seeder] "ஈமானின் கடமைகள்" not found with categoryId filter, trying global search...');
    const subSnap2 = await getDocs(
      query(
        collection(db, "subcategories"),
        where("name", "==", "ஈமானின் கடமைகள்")
      )
    );
    if (subSnap2.empty) {
      throw new Error(
        '"ஈமானின் கடமைகள்" subcategory not found. ' +
        'Create it first in the CMS under the "Fundamental of iman" category.'
      );
    }
    result.subcategoryId = subSnap2.docs[0].id;
    console.log(`[Seeder] ✅ Subcategory found (global): id=${result.subcategoryId}`);
  } else {
    result.subcategoryId = subSnap.docs[0].id;
    console.log(`[Seeder] ✅ Subcategory found: id=${result.subcategoryId}, name=${subSnap.docs[0].data().name}`);
  }

  const subcategoryId = result.subcategoryId;

  // ── Step 3: Fetch existing cards to detect duplicates ─────────────────────
  console.log("[Seeder] Step 3: Checking existing cards for duplicates...");

  const existingSnap = await getDocs(
    query(collection(db, "cards"), where("subcategoryId", "==", subcategoryId))
  );

  const existingTitles = new Set<string>(
    existingSnap.docs.map(d => ((d.data().titleEn as string) ?? "").toLowerCase().trim())
  );

  console.log(
    `[Seeder] Found ${existingSnap.size} existing cards. ` +
    `Existing titles: [${[...existingTitles].join(", ")}]`
  );

  // ── Step 4: Create missing cards ──────────────────────────────────────────
  console.log("[Seeder] Step 4: Creating Iman cards...");

  for (const card of IMAN_CARDS) {
    const key = card.titleEn.toLowerCase().trim();

    if (existingTitles.has(key)) {
      console.log(`[Seeder]   ⏭ SKIP  — "${card.titleEn}" already exists`);
      result.skipped.push(card.titleEn);
      continue;
    }

    try {
      const ref = await addDoc(collection(db, "cards"), {
        categoryId,
        subcategoryId,
        titleEn:      card.titleEn,
        titleTa:      card.titleTa,
        audioUrl:     "",
        duration:     0,
        description:  "",
        isPremium:    card.isPremium,
        hasQuiz:      true,
        viewCount:    0,
        sortOrder:    card.sortOrder,
        quiz:         [],
        quizTitleTa:  "",
        quizTitleEn:  "",
        createdAt:    serverTimestamp(),
      });

      console.log(`[Seeder]   ✅ CREATED — "${card.titleEn}" (premium=${card.isPremium}) → docId: ${ref.id}`);
      result.created.push(card.titleEn);
      existingTitles.add(key);
    } catch (err: any) {
      const msg = err?.message ?? "Unknown error";
      console.error(`[Seeder]   ❌ ERROR  — "${card.titleEn}": ${msg}`);
      result.errors.push({ titleEn: card.titleEn, message: msg });
    }
  }

  // ── Step 5: Summary ───────────────────────────────────────────────────────
  console.log("[Seeder] ── Summary ─────────────────────────────────────────");
  console.log(`[Seeder]   Category ID:    ${result.categoryId}`);
  console.log(`[Seeder]   Subcategory ID: ${result.subcategoryId}`);
  console.log(`[Seeder]   ✅ Created:  ${result.created.length} cards → [${result.created.join(", ")}]`);
  console.log(`[Seeder]   ⏭ Skipped:  ${result.skipped.length} cards → [${result.skipped.join(", ")}]`);
  console.log(`[Seeder]   ❌ Errors:   ${result.errors.length}`);
  console.log("[Seeder] ── createImanCards() done ──────────────────────────");

  return result;
}

// The 10 Surahs to seed
const VIRIVURAI_SURAHS: Array<{ titleEn: string; titleTa: string; sortOrder: number }> = [
  { titleEn: "Al-Fatiha",  titleTa: "சூரா ஃபாத்திஹா",  sortOrder: 1  },
  { titleEn: "An-Nas",     titleTa: "சூரா நாஸ்",         sortOrder: 2  },
  { titleEn: "Al-Falaq",   titleTa: "சூரா ஃபலக்",        sortOrder: 3  },
  { titleEn: "Al-Ikhlas",  titleTa: "சூரா இக்லாஸ்",      sortOrder: 4  },
  { titleEn: "Al-Lahab",   titleTa: "சூரா லஹப்",          sortOrder: 5  },
  { titleEn: "Al-Fath",    titleTa: "சூரா ஃபத்",          sortOrder: 6  },
  { titleEn: "Al-Kafirun", titleTa: "சூரா காஃபிரூன்",    sortOrder: 7  },
  { titleEn: "Al-Kawthar", titleTa: "சூரா கவ்சர்",        sortOrder: 8  },
  { titleEn: "Al-Ma'un",   titleTa: "சூரா மாஊன்",         sortOrder: 9  },
  { titleEn: "Quraysh",    titleTa: "சூரா குரைஷ்",        sortOrder: 10 },
];

export async function createVirivuraiCards(): Promise<SeedResult> {
  console.log("[Seeder] ── createVirivuraiCards() started ──────────────────");

  // ── Step 1: Find category where nameEn = "Quran" ──────────────────────────
  console.log('[Seeder] Step 1: Looking for category nameEn = "Quran"...');

  const catSnap = await getDocs(
    query(collection(db, "categories"), where("nameEn", "==", "Quran"))
  );

  if (catSnap.empty) {
    // Fallback: try matching name field (Tamil name might be stored instead)
    console.warn('[Seeder] nameEn = "Quran" not found, trying name field...');
    const catSnap2 = await getDocs(
      query(collection(db, "categories"), where("name", "==", "Quran"))
    );
    if (catSnap2.empty) {
      throw new Error(
        'Category "Quran" not found. Check that the category exists in Firestore with nameEn = "Quran".'
      );
    }
    const catDoc = catSnap2.docs[0];
    console.log(`[Seeder] ✅ Category found via name field: id=${catDoc.id}`);
    return _seedCards(catDoc.id);
  }

  const catDoc = catSnap.docs[0];
  console.log(`[Seeder] ✅ Category found: id=${catDoc.id}, nameEn=${catDoc.data().nameEn}`);

  return _seedCards(catDoc.id);
}

async function _seedCards(categoryId: string): Promise<SeedResult> {
  const result: SeedResult = {
    categoryId,
    subcategoryId: "",
    created: [],
    skipped: [],
    errors:  [],
  };

  // ── Step 2: Find subcategory where name = "விரிவுரை" ──────────────────────
  console.log('[Seeder] Step 2: Looking for subcategory name = "விரிவுரை"...');

  const subSnap = await getDocs(
    query(
      collection(db, "subcategories"),
      where("categoryId", "==", categoryId),
      where("name", "==", "விரிவுரை")
    )
  );

  if (subSnap.empty) {
    // Fallback: try nameEn = "Virivurai"
    console.warn('[Seeder] name = "விரிவுரை" not found, trying nameEn = "Virivurai"...');
    const subSnap2 = await getDocs(
      query(
        collection(db, "subcategories"),
        where("categoryId", "==", categoryId),
        where("nameEn", "==", "Virivurai")
      )
    );
    if (subSnap2.empty) {
      throw new Error(
        '"விரிவுரை" subcategory not found under Quran category. ' +
        'Create it first in the CMS with name = "விரிவுரை".'
      );
    }
    const subDoc = subSnap2.docs[0];
    console.log(`[Seeder] ✅ Subcategory found via nameEn: id=${subDoc.id}`);
    result.subcategoryId = subDoc.id;
  } else {
    const subDoc = subSnap.docs[0];
    console.log(
      `[Seeder] ✅ Subcategory found: id=${subDoc.id}, name=${subDoc.data().name}`
    );
    result.subcategoryId = subDoc.id;
  }

  const subcategoryId = result.subcategoryId;

  // ── Step 3: Fetch existing cards to detect duplicates ─────────────────────
  console.log("[Seeder] Step 3: Checking existing cards for duplicates...");

  const existingSnap = await getDocs(
    query(
      collection(db, "cards"),
      where("subcategoryId", "==", subcategoryId)
    )
  );

  // Build a Set of already-existing titleEn values (lowercase) for fast lookup
  const existingTitles = new Set<string>(
    existingSnap.docs.map(d => ((d.data().titleEn as string) ?? "").toLowerCase().trim())
  );

  console.log(
    `[Seeder] Found ${existingSnap.size} existing cards. ` +
    `Existing titles: [${[...existingTitles].join(", ")}]`
  );

  // ── Step 4: Create missing cards ──────────────────────────────────────────
  console.log("[Seeder] Step 4: Creating cards...");

  for (const surah of VIRIVURAI_SURAHS) {
    const key = surah.titleEn.toLowerCase().trim();

    if (existingTitles.has(key)) {
      console.log(`[Seeder]   ⏭ SKIP  — "${surah.titleEn}" already exists`);
      result.skipped.push(surah.titleEn);
      continue;
    }

    try {
      const ref = await addDoc(collection(db, "cards"), {
        categoryId,
        subcategoryId,
        titleEn:      surah.titleEn,
        titleTa:      surah.titleTa,
        audioUrl:     "",
        duration:     0,
        description:  "",
        isPremium:    false,
        hasQuiz:      true,
        viewCount:    0,
        sortOrder:    surah.sortOrder,
        quiz:         [],
        quizTitleTa:  "",
        quizTitleEn:  "",
        createdAt:    serverTimestamp(),
      });

      console.log(`[Seeder]   ✅ CREATED — "${surah.titleEn}" → docId: ${ref.id}`);
      result.created.push(surah.titleEn);

      // Add to existing set so if the same title appears twice in the seed list
      // it won't be attempted twice
      existingTitles.add(key);
    } catch (err: any) {
      const msg = err?.message ?? "Unknown error";
      console.error(`[Seeder]   ❌ ERROR  — "${surah.titleEn}": ${msg}`);
      result.errors.push({ titleEn: surah.titleEn, message: msg });
    }
  }

  // ── Step 5: Summary ───────────────────────────────────────────────────────
  console.log("[Seeder] ── Summary ─────────────────────────────────────────");
  console.log(`[Seeder]   Category ID:    ${result.categoryId}`);
  console.log(`[Seeder]   Subcategory ID: ${result.subcategoryId}`);
  console.log(`[Seeder]   ✅ Created:  ${result.created.length} cards → [${result.created.join(", ")}]`);
  console.log(`[Seeder]   ⏭ Skipped:  ${result.skipped.length} cards → [${result.skipped.join(", ")}]`);
  console.log(`[Seeder]   ❌ Errors:   ${result.errors.length}`);
  console.log("[Seeder] ── createVirivuraiCards() done ──────────────────────");

  return result;
}
