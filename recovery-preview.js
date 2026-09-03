#!/usr/bin/env node
/**
 * Al-Hilal Firebase Recovery — PREVIEW ONLY. READ-ONLY. NO WRITES.
 * ============================================================
 *
 * What this script does:
 *  - Lists every file under songs/, videos/, shortVideos/, slides/ in
 *    Firebase Storage (bucket: bismillah-573d3.firebasestorage.app).
 *  - Reads existing Firestore documents in the collections those folders
 *    map to (cards, shortVideos) and collects every already-known
 *    download URL from their audioUrl/videoUrl/slideImageUrl/
 *    slideDocUrl/podcastAudioUrl fields.
 *  - For each Storage file, checks whether a Firestore document already
 *    references it. Files with NO match are "orphaned" — likely exactly
 *    the ones whose Firestore document was deleted.
 *  - Writes a local recovery-report.json with everything found, plus a
 *    console summary. That's it.
 *
 * What this script NEVER does:
 *  - No db.collection(...).add/set/update/delete(...) — grep this file,
 *    there are none.
 *  - No bucket.file(...).delete(...) or .save(...) — none.
 *  - It is safe to run repeatedly; running it twice changes nothing.
 *
 * Requirements:
 *  - Node.js, with `firebase-admin` installed (`npm install firebase-admin`).
 *  - Your own Firebase service account key JSON (Firebase Console →
 *    Project Settings → Service Accounts → Generate new private key).
 *    Save it locally as serviceAccountKey.json, next to this script, and
 *    make sure it's in .gitignore — never commit it.
 *  - The service account only needs READ access for this script (Firestore
 *    Viewer + Storage Object Viewer are enough).
 *
 * Run:
 *    node recovery-preview.js
 *
 * Output:
 *    - Console summary (file counts, orphan counts per folder)
 *    - recovery-report.json (full detail, for manual review)
 *
 * After reviewing recovery-report.json, DO NOT auto-apply anything from
 * it. Fill in the "mustBeManuallyReEntered" fields for each orphaned file
 * you actually want to restore, then a separate, explicitly-reviewed
 * script/manual Firestore Console entry would create those documents —
 * that step is intentionally not part of this script.
 */

const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

const SERVICE_ACCOUNT_PATH = path.join(__dirname, "serviceAccountKey.json");

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error(
    "Missing serviceAccountKey.json next to this script.\n" +
    "Get one from Firebase Console → Project Settings → Service Accounts → " +
    "Generate new private key, save it here, and re-run."
  );
  process.exit(1);
}

const serviceAccount = require(SERVICE_ACCOUNT_PATH);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: "bismillah-573d3.firebasestorage.app",
});

const db = admin.firestore();
const bucket = admin.storage().bucket();

// Folder → which Firestore collection/fields it's expected to be
// referenced from. Matches the actual upload targets found in
// services/firebase.storage.ts (uploadAudio → "songs/", uploadVideo →
// "videos/", uploadShortVideo → "shortVideos/", uploadImage/uploadDoc →
// "slides/") and the fields defined in services/firebase.firestore.ts
// (FBCard) / services/shortVideos.firebase.ts (ShortVideo).
const FOLDER_TARGETS = {
  songs:       { collection: "cards",       fields: ["audioUrl", "podcastAudioUrl"] },
  videos:      { collection: "cards",       fields: ["videoUrl"] },
  slides:      { collection: "cards",       fields: ["slideImageUrl", "slideDocUrl"] },
  shortVideos: { collection: "shortVideos", fields: ["videoUrl"] },
};

async function getAllKnownUrls(collection, fields) {
  const snap = await db.collection(collection).get();
  const known = new Set();
  snap.forEach((doc) => {
    const data = doc.data();
    for (const f of fields) {
      if (data[f]) known.add(data[f]);
    }
  });
  return known;
}

// Admin uploads are named `${Date.now()}_${originalFileName}` — see
// uploadToFolder() in services/firebase.storage.ts. This is the only
// metadata-like signal baked into the filename itself.
function guessMetaFromFilename(name) {
  const match = name.match(/^(\d+)_(.+)$/);
  if (!match) return { uploadedAtMs: null, guessedTitle: stripExt(name) };
  const uploadedAtMs = Number(match[1]);
  const guessedTitle = stripExt(match[2]).replace(/[_-]+/g, " ").trim();
  return { uploadedAtMs, guessedTitle };
}
function stripExt(name) {
  return name.replace(/\.[a-zA-Z0-9]+$/, "");
}

async function main() {
  const report = { generatedAt: new Date().toISOString(), readOnly: true, folders: {} };

  for (const folder of Object.keys(FOLDER_TARGETS)) {
    const target = FOLDER_TARGETS[folder];
    const knownUrls = await getAllKnownUrls(target.collection, target.fields);

    const [files] = await bucket.getFiles({ prefix: `${folder}/` });
    const entries = [];

    for (const file of files) {
      if (file.name.endsWith("/")) continue; // skip folder placeholder objects

      const [meta] = await file.getMetadata();

      // Reconstruct the SAME download URL format the app's client-side
      // getDownloadURL() produces, using the object's own download token
      // metadata — this is a read of existing metadata, not a new token.
      const downloadToken = meta.metadata && meta.metadata.firebaseStorageDownloadTokens;
      const appStyleUrl = downloadToken
        ? `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(file.name)}?alt=media&token=${downloadToken}`
        : null;

      const hasMatchingFirestoreDoc = !!(appStyleUrl && knownUrls.has(appStyleUrl));
      const fileName = file.name.split("/").pop();
      const { uploadedAtMs, guessedTitle } = guessMetaFromFilename(fileName);

      entries.push({
        path: file.name,
        fileName,
        contentType: meta.contentType || "unknown",
        sizeBytes: meta.size ? Number(meta.size) : null,
        storageTimeCreated: meta.timeCreated || null,
        storageTimeUpdated: meta.updated || null,
        recoveredDownloadUrl: appStyleUrl,
        hasMatchingFirestoreDoc,
        recoverableFromStorage: {
          videoUrlOrAudioUrl: appStyleUrl,
          approxUploadedAt: uploadedAtMs
            ? new Date(uploadedAtMs).toISOString()
            : (meta.timeCreated || "unknown"),
          guessedTitleFromFilename: guessedTitle,
          contentType: meta.contentType || "unknown",
          sizeBytes: meta.size ? Number(meta.size) : null,
        },
        mustBeManuallyReEntered:
          folder === "shortVideos"
            ? ["category", "enabled (policy decision, not a recovered value)", "sortOrder", "verified/corrected title"]
            : ["categoryId", "subcategoryId", "titleTa", "titleEn", "description", "hasQuiz / quiz[]", "isPremium", "sortOrder"],
      });
    }

    report.folders[folder] = {
      targetCollection: target.collection,
      totalFiles: entries.length,
      orphanedFiles: entries.filter((e) => !e.hasMatchingFirestoreDoc).length,
      files: entries,
    };
  }

  fs.writeFileSync(
    path.join(__dirname, "recovery-report.json"),
    JSON.stringify(report, null, 2)
  );

  console.log("\nPreview complete — NOTHING was written to Firestore or Storage.\n");
  for (const [folder, data] of Object.entries(report.folders)) {
    console.log(
      `${folder}/  →  ${data.totalFiles} files total, ${data.orphanedFiles} with no matching Firestore document`
    );
  }
  console.log("\nFull detail written to recovery-report.json — review before taking any recovery action.");
}

main().catch((err) => {
  console.error("Preview failed (no changes were made):", err);
  process.exit(1);
});
