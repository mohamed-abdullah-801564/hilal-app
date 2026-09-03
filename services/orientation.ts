// Screen-orientation helpers used when a video enters/exits fullscreen.
// The app is locked to portrait (app.json), so we force landscape only while a
// video is fullscreen, then restore portrait. expo-screen-orientation is
// require()'d lazily + guarded so a missing module (web / Expo Go) is a no-op.

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

export async function unlockOrientation(): Promise<void> {
  try {
    if (ScreenOrientation) {
      await ScreenOrientation.unlockAsync();
    }
  } catch {}
}
