import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";

export type MediaCacheType = "audio" | "video";

export const MEDIA_CACHE_LIMIT_BYTES = 350 * 1024 * 1024;

type MediaCacheEntry = {
  key: string;
  url: string;
  type: MediaCacheType;
  uri: string;
  size: number;
  lastAccessed: number;
};

type MediaCacheIndex = Record<string, MediaCacheEntry>;

const CACHE_ROOT = `${FileSystem.cacheDirectory ?? ""}hilal-media/`;
const INDEX_URI = `${CACHE_ROOT}index.json`;
const inflightDownloads = new Map<string, Promise<string | null>>();

function canUseFileCache(url: string): boolean {
  return Platform.OS !== "web" && /^https?:\/\//i.test(url) && !!FileSystem.cacheDirectory;
}

function hashUrl(url: string): string {
  let hash = 5381;
  for (let i = 0; i < url.length; i += 1) {
    hash = (hash * 33) ^ url.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

function extensionForUrl(url: string, type: MediaCacheType): string {
  const clean = url.split("?")[0]?.split("#")[0] ?? "";
  const match = clean.match(/\.([a-z0-9]{2,5})$/i);
  if (match?.[1]) return match[1].toLowerCase();
  return type === "video" ? "mp4" : "mp3";
}

function cacheKey(url: string, type: MediaCacheType): string {
  return `${type}-${hashUrl(url)}`;
}

function cacheUri(url: string, type: MediaCacheType): string {
  return `${CACHE_ROOT}${cacheKey(url, type)}.${extensionForUrl(url, type)}`;
}

async function ensureCacheRoot(): Promise<void> {
  const info = await FileSystem.getInfoAsync(CACHE_ROOT);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(CACHE_ROOT, { intermediates: true });
  }
}

async function readIndex(): Promise<MediaCacheIndex> {
  try {
    await ensureCacheRoot();
    const info = await FileSystem.getInfoAsync(INDEX_URI);
    if (!info.exists) return {};
    const raw = await FileSystem.readAsStringAsync(INDEX_URI);
    return JSON.parse(raw) as MediaCacheIndex;
  } catch {
    return {};
  }
}

async function writeIndex(index: MediaCacheIndex): Promise<void> {
  await ensureCacheRoot();
  await FileSystem.writeAsStringAsync(INDEX_URI, JSON.stringify(index));
}

async function deleteEntry(entry: MediaCacheEntry): Promise<void> {
  try {
    await FileSystem.deleteAsync(entry.uri, { idempotent: true });
  } catch {}
}

async function enforceCacheLimit(
  index: MediaCacheIndex,
  protectedKey?: string,
): Promise<MediaCacheIndex> {
  let entries = Object.values(index);
  let total = entries.reduce((sum, entry) => sum + entry.size, 0);

  if (total <= MEDIA_CACHE_LIMIT_BYTES) return index;

  entries = entries.sort((a, b) => a.lastAccessed - b.lastAccessed);
  for (const entry of entries) {
    if (total <= MEDIA_CACHE_LIMIT_BYTES) break;
    if (entry.key === protectedKey && entry.size <= MEDIA_CACHE_LIMIT_BYTES) continue;
    await deleteEntry(entry);
    delete index[entry.key];
    total -= entry.size;
  }

  return index;
}

export async function getCachedMediaUri(
  url: string,
  type: MediaCacheType,
): Promise<string | null> {
  if (!canUseFileCache(url)) return null;

  const key = cacheKey(url, type);
  const index = await readIndex();
  const entry = index[key];
  if (!entry) return null;

  const info = await FileSystem.getInfoAsync(entry.uri);
  if (!info.exists) {
    delete index[key];
    await writeIndex(index);
    return null;
  }

  entry.lastAccessed = Date.now();
  entry.size = info.size ?? entry.size;
  index[key] = entry;
  await writeIndex(index);
  return entry.uri;
}

export async function cacheMedia(
  url: string,
  type: MediaCacheType,
): Promise<string | null> {
  if (!canUseFileCache(url)) return null;

  const key = cacheKey(url, type);
  const existing = await getCachedMediaUri(url, type);
  if (existing) return existing;

  const active = inflightDownloads.get(key);
  if (active) return active;

  const download = (async () => {
    try {
      await ensureCacheRoot();
      const uri = cacheUri(url, type);
      await FileSystem.downloadAsync(url, uri);

      const info = await FileSystem.getInfoAsync(uri);
      if (!info.exists || !info.size || info.size > MEDIA_CACHE_LIMIT_BYTES) {
        await FileSystem.deleteAsync(uri, { idempotent: true });
        return null;
      }

      const index = await readIndex();
      index[key] = {
        key,
        url,
        type,
        uri,
        size: info.size,
        lastAccessed: Date.now(),
      };
      await writeIndex(await enforceCacheLimit(index, key));
      return uri;
    } catch {
      return null;
    } finally {
      inflightDownloads.delete(key);
    }
  })();

  inflightDownloads.set(key, download);
  return download;
}
