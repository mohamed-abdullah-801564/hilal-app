// Screen-orientation helpers used when a video enters/exits fullscreen, and
// when the Expo-Go PDF WebView fallback is open. The app is locked to
// portrait (app.json); these temporarily change that, then restore it.
// expo-screen-orientation is require()'d lazily + guarded so a missing
// module (web / Expo Go without the native module) is a no-op.

let ScreenOrientation: any = null;
try {
  ScreenOrientation = require("expo-screen-orientation");
} catch {
  ScreenOrientation = null;
}

export async function lockLandscape(): Promise<void> {
  try {
    if (ScreenOrientation) {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    }
  } catch {}
}

export async function lockPortrait(): Promise<void> {
  try {
    if (ScreenOrientation) {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    }
  } catch {}
}

// Lifts the app-wide portrait lock so the device can freely rotate between
// portrait and landscape while following the phone's physical orientation.
// Used only by the PDF WebView fallback (Expo Go); paired with
// lockPortrait() to restore the app-wide lock when that screen closes.
export async function unlockOrientation(): Promise<void> {
  try {
    if (ScreenOrientation) {
      await ScreenOrientation.unlockAsync();
    }
  } catch {}
}
