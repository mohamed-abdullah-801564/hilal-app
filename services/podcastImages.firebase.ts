// Podcast Images — shared slideshow images shown above the Podcast player.
// Single Firestore document, NOT per-card:
//   config/podcastImages  { urls: string[] }
// Deliberately separate from services/firebase.firestore.ts (FBCard) and
// services/shortVideos.firebase.ts — this is its own small, isolated
// feature, touching neither of those files or their collections.

import { doc, getDoc, setDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { db } from "./firebase.config";

const CONFIG_COLLECTION = "config";
const DOC_ID = "podcastImages";

const PROHIBITED_KEYWORDS = [
  "person", "people", "human", "man", "men", "woman", "women", "girl", "boy",
  "child", "children", "face", "faces", "portrait", "portraits", "couple", "couples",
  "model", "models", "selfie", "family", "crowd", "crowds", "guy", "guys",
  "lady", "ladies", "groom", "bride", "avatar", "character", "profile"
];

export function isAllowedImage(url: string | undefined | null): boolean {
  if (!url || typeof url !== "string") return false;
  const lowerUrl = url.toLowerCase();
  try {
    const decoded = decodeURIComponent(lowerUrl);
    for (const word of PROHIBITED_KEYWORDS) {
      if (lowerUrl.includes(word) || decoded.includes(word)) {
        return false;
      }
    }
  } catch {
    for (const word of PROHIBITED_KEYWORDS) {
      if (lowerUrl.includes(word)) {
        return false;
      }
    }
  }
  return true;
}

export async function getPodcastImageUrls(): Promise<string[]> {
  try {
    console.log("[PodcastImages] FIRESTORE_READ_START");
    const snap = await getDoc(doc(db, CONFIG_COLLECTION, DOC_ID));
    if (!snap.exists()) {
      console.log("[PodcastImages] FIRESTORE_DOCUMENT_MISSING");
      return [];
    }
    const data = snap.data();
    const rawUrls = Array.isArray(data?.urls) ? data.urls : [];
    const urls = rawUrls.filter((u: string) => isAllowedImage(u));
    console.log(`[PodcastImages] FIRESTORE_READ_SUCCESS count=${urls.length} raw_count=${rawUrls.length}`);
    if (urls.length > 0) {
      console.log(`[PodcastImages] IMAGE_URL first=${urls[0]}`);
    }
    return urls;
  } catch (e) {
    // Never swallowed — the real error is logged and rethrown.
    console.log("[PodcastImages] FIRESTORE_READ_ERROR", e);
    throw e;
  }
}

export async function addPodcastImageUrl(url: string): Promise<void> {
  console.log("[PodcastImages] FIRESTORE_WRITE add");
  await setDoc(doc(db, CONFIG_COLLECTION, DOC_ID), { urls: arrayUnion(url) }, { merge: true });
}

export async function removePodcastImageUrl(url: string): Promise<void> {
  console.log("[PodcastImages] FIRESTORE_WRITE remove");
  await setDoc(doc(db, CONFIG_COLLECTION, DOC_ID), { urls: arrayRemove(url) }, { merge: true });
}
