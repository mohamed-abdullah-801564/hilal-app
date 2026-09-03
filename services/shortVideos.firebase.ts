// Short Video Library — data layer for "Audio + Video Visual Mode".
//
// Reuses the exact same architecture as the rest of the app: a flat
// top-level Firestore collection (like `cards`), and a per-user
// subcollection for seen-history (like `users/{uid}/badges` in
// services/badges.firebase.ts). No new database, no new auth system —
// `uid` comes from the existing anonymous services/userId.ts.

import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  writeBatch,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase.config";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ShortVideo {
  id:        string;
  videoUrl:  string;
  title:     string;
  category:  string;
  enabled:   boolean;
  sortOrder: number;
  duration:  number;   // seconds — informational only; advance is event-driven
  createdAt: number;
}

function toShortVideo(id: string, data: Record<string, any>): ShortVideo {
  return {
    id,
    videoUrl:  data.videoUrl  ?? "",
    title:     data.title     ?? "",
    category:  data.category  ?? "",
    enabled:   data.enabled   ?? true,
    sortOrder: data.sortOrder ?? 0,
    duration:  data.duration  ?? 0,
    createdAt: data.createdAt ?? Date.now(),
  };
}

// ─── Admin CRUD (app/admin/firebase/short-videos.tsx) ─────────────────────────

export async function getAllShortVideos(): Promise<ShortVideo[]> {
  const snap = await getDocs(query(collection(db, "shortVideos"), orderBy("sortOrder", "asc")));
  return snap.docs.map(d => toShortVideo(d.id, d.data()));
}

export async function addShortVideo(
  data: Omit<ShortVideo, "id" | "createdAt">,
): Promise<string> {
  const ref = doc(collection(db, "shortVideos"));
  await setDoc(ref, { ...data, createdAt: Date.now() });
  return ref.id;
}

export async function updateShortVideo(id: string, data: Partial<ShortVideo>): Promise<void> {
  await updateDoc(doc(db, "shortVideos", id), data as Record<string, any>);
}

export async function deleteShortVideo(id: string): Promise<void> {
  await deleteDoc(doc(db, "shortVideos", id));
}

// ─── App-facing read (context/VisualModeContext.tsx) ──────────────────────────

export async function getEnabledShortVideos(): Promise<ShortVideo[]> {
  const snap = await getDocs(
    query(collection(db, "shortVideos"), where("enabled", "==", true)),
  );
  return snap.docs.map(d => toShortVideo(d.id, d.data()));
}

// ─── Per-user seen-history ──────────────────────────────────────────────────
// users/{uid}/seenShortVideos/{videoId} — one lightweight doc per seen clip,
// doc id = videoId (cheap existence check, cheap full reset via batch delete).

export async function getSeenVideoIds(uid: string): Promise<Set<string>> {
  try {
    const snap = await getDocs(collection(db, "users", uid, "seenShortVideos"));
    return new Set(snap.docs.map(d => d.id));
  } catch {
    return new Set();
  }
}

export async function markSeen(uid: string, videoId: string): Promise<void> {
  try {
    await setDoc(doc(db, "users", uid, "seenShortVideos", videoId), {
      seenAt: Timestamp.now(),
    });
  } catch {
    // Non-critical — a missed "seen" write just means that one clip might
    // reappear slightly sooner than intended. Never block playback on this.
  }
}

export async function resetSeen(uid: string): Promise<void> {
  try {
    const snap = await getDocs(collection(db, "users", uid, "seenShortVideos"));
    if (snap.empty) return;
    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
  } catch {
    // Non-critical — worst case the pool doesn't recycle this one time.
  }
}
