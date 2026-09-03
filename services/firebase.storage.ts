import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  type StorageReference,
} from "firebase/storage";
import { storage, ensureAdminSignedIn } from "./firebase.config";

export interface UploadProgress {
  bytesTransferred: number;
  totalBytes:       number;
  percent:          number;
}

// ─── Pick audio file on web ───────────────────────────────────────────────────
// On web, expo-document-picker returns an object URL that XHR cannot reliably
// read. A hidden <input type="file"> gives us the actual File object (Blob).

export function pickImageFileWeb(): Promise<File | null> {
  return new Promise(resolve => {
    const input = document.createElement("input");
    input.type   = "file";
    input.accept = "image/*";
    input.style.display = "none";

    input.onchange = (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0] ?? null;
      if (document.body.contains(input)) document.body.removeChild(input);
      resolve(file);
    };

    input.addEventListener("cancel", () => {
      if (document.body.contains(input)) document.body.removeChild(input);
      resolve(null);
    });

    document.body.appendChild(input);
    input.click();
  });
}

export function pickAudioFileWeb(): Promise<File | null> {
  return pickFileWeb("audio/*");
}

export function pickVideoFileWeb(): Promise<File | null> {
  return pickFileWeb("video/*");
}

export function pickDocFileWeb(): Promise<File | null> {
  return pickFileWeb(".pdf,application/pdf");
}

// Generic <input type="file"> picker for web — returns the real File (Blob).
function pickFileWeb(accept: string): Promise<File | null> {
  return new Promise(resolve => {
    const input = document.createElement("input");
    input.type   = "file";
    input.accept = accept;
    input.style.display = "none";

    input.onchange = (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0] ?? null;
      if (document.body.contains(input)) document.body.removeChild(input);
      resolve(file);
    };

    input.addEventListener("cancel", () => {
      if (document.body.contains(input)) document.body.removeChild(input);
      resolve(null);
    });

    document.body.appendChild(input);
    input.click();
  });
}

// ─── uploadAudio ──────────────────────────────────────────────────────────────
// source: string  → local file URI from expo-document-picker (native)
// source: File    → File object from <input type="file"> (web)
//
// Storage path: songs/<filename>
//
// Requires Firebase Storage security rules that allow authenticated writes:
//   match /{allPaths=**} { allow read, write: if request.auth != null; }
// OR open rules for development:
//   match /{allPaths=**} { allow read, write: if true; }

export async function uploadAudio(
  source:      string | File,
  fileName:    string,
  onProgress?: (p: UploadProgress) => void,
): Promise<string> {
  try {
    // ── Ensure admin is signed in (required for Storage rules) ────────────────
    try {
      await ensureAdminSignedIn();
    } catch (authErr: any) {
      console.warn("[uploadAudio] Auth failed, attempting upload anyway:", authErr.code);
      // Continue — if Storage rules allow public writes it will still succeed
    }

    const storageRef: StorageReference = ref(storage, "songs/" + fileName);

    // ── Get blob ──────────────────────────────────────────────────────────────
    let blob: Blob;

    if (typeof source === "string") {
      // Native (iOS / Android): URI → Blob via XHR
      // fetch() returns empty blobs on local file:// URIs in React Native;
      // XHR with responseType="blob" is the only reliable method.
      blob = await new Promise<Blob>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.onload  = () => {
          if (xhr.status >= 200 && xhr.status < 400) {
            resolve(xhr.response as Blob);
          } else {
            reject(new Error(`XHR status ${xhr.status} for URI: ${source}`));
          }
        };
        xhr.onerror  = () => reject(new Error("XHR network error reading local file"));
        xhr.responseType = "blob";
        xhr.open("GET", source, true);
        xhr.send(null);
      });
    } else {
      // Web: File IS already a Blob — use directly
      blob = source;
    }

    // ── Validate blob ─────────────────────────────────────────────────────────
    console.log("[uploadAudio] File:", fileName, "| Size:", blob.size, "bytes | Type:", blob.type);
    if (blob.size === 0) {
      throw new Error("தேர்ந்தெடுத்த கோப்பு காலியாக உள்ளது (0 bytes). வேறு கோப்பை முயற்சிக்கவும்.");
    }

    onProgress?.({ bytesTransferred: 0, totalBytes: blob.size, percent: 0 });

    // ── Determine content type ────────────────────────────────────────────────
    const contentType = blob.type || guessContentType(fileName);
    const metadata = { contentType };

    // ── Resumable upload (real progress, better CORS handling) ────────────────
    const url = await new Promise<string>((resolve, reject) => {
      const task = uploadBytesResumable(storageRef, blob, metadata);

      task.on(
        "state_changed",
        snap => {
          const percent = snap.totalBytes > 0
            ? Math.round((snap.bytesTransferred / snap.totalBytes) * 100)
            : 0;
          console.log(`[uploadAudio] Progress: ${percent}% (${snap.state})`);
          onProgress?.({ bytesTransferred: snap.bytesTransferred, totalBytes: snap.totalBytes, percent });
        },
        err => {
          console.error("[uploadAudio] ❌ Upload error:", err.code, err.message, err.serverResponse);
          reject(err);
        },
        async () => {
          try {
            const downloadUrl = await getDownloadURL(task.snapshot.ref);
            console.log("[uploadAudio] ✅ Download URL:", downloadUrl.substring(0, 80));
            resolve(downloadUrl);
          } catch (urlErr) {
            reject(urlErr);
          }
        },
      );
    });

    return url;

  } catch (e: any) {
    // Re-throw with a human-readable message that maps Firebase error codes
    const msg = friendlyStorageError(e);
    console.error("[uploadAudio] Throwing:", msg, "|", e?.code, "|", e?.serverResponse);
    throw new Error(msg);
  }
}

// ─── uploadImage ──────────────────────────────────────────────────────────────
// Uploads an image file to Firebase Storage under slides/ folder

export async function uploadImage(
  source:      string | File,
  fileName:    string,
  onProgress?: (p: UploadProgress) => void,
): Promise<string> {
  try {
    try { await ensureAdminSignedIn(); } catch {}

    const storageRef: StorageReference = ref(storage, "slides/" + fileName);

    let blob: Blob;
    if (typeof source === "string") {
      blob = await new Promise<Blob>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.onload  = () => { resolve(xhr.response as Blob); };
        xhr.onerror = () => reject(new Error("XHR network error reading local file"));
        xhr.responseType = "blob";
        xhr.open("GET", source, true);
        xhr.send(null);
      });
    } else {
      blob = source;
    }

    if (blob.size === 0) throw new Error("தேர்ந்தெடுத்த படம் காலியாக உள்ளது (0 bytes).");

    onProgress?.({ bytesTransferred: 0, totalBytes: blob.size, percent: 0 });

    const contentType = blob.type || "image/jpeg";
    const url = await new Promise<string>((resolve, reject) => {
      const task = uploadBytesResumable(storageRef, blob, { contentType });
      task.on(
        "state_changed",
        snap => {
          const percent = snap.totalBytes > 0 ? Math.round((snap.bytesTransferred / snap.totalBytes) * 100) : 0;
          onProgress?.({ bytesTransferred: snap.bytesTransferred, totalBytes: snap.totalBytes, percent });
        },
        err => reject(err),
        async () => {
          try { resolve(await getDownloadURL(task.snapshot.ref)); } catch (e) { reject(e); }
        },
      );
    });
    return url;
  } catch (e: any) {
    throw new Error(friendlyStorageError(e));
  }
}

// ─── uploadVideo ──────────────────────────────────────────────────────────────
// Uploads a video file (.mp4 etc.) to Firebase Storage under videos/ folder.
// External URLs are stored as-is and never reach this function.

// ─── uploadShortVideo ────────────────────────────────────────────────────────

export async function uploadShortVideo(
  source: string | File,
  fileName: string,
  onProgress?: (p: UploadProgress) => void,
): Promise<string> {
  return uploadToFolder(
    source,
    fileName,
    "short-videos",
    guessVideoContentType,
    onProgress,
  );
}

export async function uploadVideo(
  source:      string | File,
  fileName:    string,
  onProgress?: (p: UploadProgress) => void,
): Promise<string> {
  return uploadToFolder(source, fileName, "videos", guessVideoContentType, onProgress);
}

// ─── uploadDoc ────────────────────────────────────────────────────────────────
// Uploads a slide document (PDF / PPT / PPTX) to Firebase Storage under slides/.

export async function uploadDoc(
  source:      string | File,
  fileName:    string,
  onProgress?: (p: UploadProgress) => void,
): Promise<string> {
  return uploadToFolder(source, fileName, "slides", guessDocContentType, onProgress);
}

// ─── Shared resumable upload core ─────────────────────────────────────────────

async function uploadToFolder(
  source:        string | File,
  fileName:      string,
  folder:        string,
  guessType:     (name: string) => string,
  onProgress?:   (p: UploadProgress) => void,
): Promise<string> {
  try {
    try { await ensureAdminSignedIn(); } catch {}

    const storageRef: StorageReference = ref(storage, `${folder}/${fileName}`);

    let blob: Blob;
    if (typeof source === "string") {
      blob = await new Promise<Blob>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.onload  = () => {
          if (xhr.status >= 200 && xhr.status < 400) resolve(xhr.response as Blob);
          else reject(new Error(`XHR status ${xhr.status} for URI: ${source}`));
        };
        xhr.onerror = () => reject(new Error("XHR network error reading local file"));
        xhr.responseType = "blob";
        xhr.open("GET", source, true);
        xhr.send(null);
      });
    } else {
      blob = source;
    }

    if (blob.size === 0) {
      throw new Error("தேர்ந்தெடுத்த கோப்பு காலியாக உள்ளது (0 bytes). வேறு கோப்பை முயற்சிக்கவும்.");
    }

    onProgress?.({ bytesTransferred: 0, totalBytes: blob.size, percent: 0 });

    const contentType = blob.type || guessType(fileName);
    const url = await new Promise<string>((resolve, reject) => {
      const task = uploadBytesResumable(storageRef, blob, { contentType });
      task.on(
        "state_changed",
        snap => {
          const percent = snap.totalBytes > 0
            ? Math.round((snap.bytesTransferred / snap.totalBytes) * 100)
            : 0;
          onProgress?.({ bytesTransferred: snap.bytesTransferred, totalBytes: snap.totalBytes, percent });
        },
        err => reject(err),
        async () => {
          try { resolve(await getDownloadURL(task.snapshot.ref)); } catch (e) { reject(e); }
        },
      );
    });
    return url;
  } catch (e: any) {
    throw new Error(friendlyStorageError(e));
  }
}

// ─── deleteAudio ──────────────────────────────────────────────────────────────

export async function deleteAudio(downloadUrl: string): Promise<void> {
  try {
    const fileRef = ref(storage, downloadUrl);
    await deleteObject(fileRef);
  } catch (e: any) {
    console.error("[deleteAudio] error:", e);
    throw e;
  }
}

export async function deleteStorageFile(urlOrPath: string): Promise<void> {
  try {
    const fileRef = ref(storage, urlOrPath);
    await deleteObject(fileRef);
  } catch (e: any) {
    console.error("[deleteStorageFile] error:", e);
    throw e;
  }
}

// ─── getAudioUrl ──────────────────────────────────────────────────────────────

export async function getAudioUrl(path: string): Promise<string> {
  const fileRef = ref(storage, path);
  return await getDownloadURL(fileRef);
}

// ─── Slide-kind detection ─────────────────────────────────────────────────────
// Firebase download URLs look like
//   https://firebasestorage.../o/slides%2F1700000000_deck.pptx?alt=media&token=...
// so we decode and strip query before sniffing the extension.

export type SlideKind = "pdf" | "ppt" | "image" | "unknown";

export function slideKindFromUrl(url: string): SlideKind {
  if (!url) return "unknown";
  let path = url;
  try { path = decodeURIComponent(url); } catch {}
  path = path.split("?")[0].toLowerCase();
  if (/\.pdf$/.test(path))            return "pdf";
  if (/\.(pptx?|key)$/.test(path))    return "ppt";
  if (/\.(png|jpe?g|gif|webp|bmp|heic)$/.test(path)) return "image";
  return "unknown";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function guessContentType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    mp3: "audio/mpeg",
    mp4: "audio/mp4",
    m4a: "audio/mp4",
    ogg: "audio/ogg",
    wav: "audio/wav",
    aac: "audio/aac",
    flac: "audio/flac",
    webm: "audio/webm",
  };
  return map[ext ?? ""] ?? "audio/mpeg";
}

function guessVideoContentType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    mp4: "video/mp4",
    mov: "video/quicktime",
    m4v: "video/x-m4v",
    webm: "video/webm",
    mkv: "video/x-matroska",
    avi: "video/x-msvideo",
    "3gp": "video/3gpp",
  };
  return map[ext ?? ""] ?? "video/mp4";
}

function guessDocContentType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    pdf:  "application/pdf",
    ppt:  "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  };
  return map[ext ?? ""] ?? "application/octet-stream";
}

function friendlyStorageError(e: any): string {
  const code: string = e?.code ?? "";
  const map: Record<string, string> = {
    "storage/unauthorized":
      "❌ பதிவேற்ற அனுமதி இல்லை (storage/unauthorized).\n\nFire​base Console → Storage → Rules-ல் இந்த rule சேர்க்கவும்:\n  allow read, write: if true;",
    "storage/canceled":
      "⚠️ பதிவேற்றம் ரத்து செய்யப்பட்டது.",
    "storage/quota-exceeded":
      "❌ Firebase Storage quota முடிந்தது. Upgrade தேவை.",
    "storage/unauthenticated":
      "❌ உள்நுழைவு தேவை (storage/unauthenticated).\n\nFire​base Auth-ல் admin@example.com பயனர் உருவாக்கவும்.",
    "storage/retry-limit-exceeded":
      "❌ பதிவேற்றம் Timeout ஆனது. Internet இணைப்பை சரிபார்க்கவும்.",
    "storage/invalid-checksum":
      "❌ கோப்பு சேதமடைந்தது. மீண்டும் முயற்சிக்கவும்.",
    "storage/cannot-slice-blob":
      "❌ கோப்பை படிக்க முடியவில்லை. வேறு கோப்பை முயற்சிக்கவும்.",
    "storage/server-file-wrong-size":
      "❌ பதிவேற்றம் முழுமையடையவில்லை. மீண்டும் முயற்சிக்கவும்.",
  };
  return map[code] ?? `❌ பதிவேற்றம் தோல்வி [${code || "unknown"}]: ${e?.message ?? ""}`;
}
