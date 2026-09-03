import AsyncStorage from "@react-native-async-storage/async-storage";

// In-memory fallback map for high-frequency rate-limit checks
const lastExecutionTimes: Record<string, number> = {};

/**
 * Sanitizes input strings by stripping HTML/script tags, control characters,
 * and normalizing leading/trailing whitespace to prevent XSS/injection attacks.
 */
export function sanitizeInput(text: string): string {
  if (typeof text !== "string") return "";
  return text
    .replace(/<[^>]*>/g, "") // remove HTML/XML tags
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, "") // remove control characters
    .trim();
}

/**
 * Checks if a specific action key is currently rate-limited based on a cooldown window in milliseconds.
 * Returns `true` if the request is rate-limited (too soon), or `false` if allowed.
 */
export async function isRateLimited(
  actionKey: string,
  cooldownMs: number = 5000
): Promise<boolean> {
  const now = Date.now();
  const storageKey = `rate_limit_${actionKey}`;

  // Check in-memory first
  const memoryLast = lastExecutionTimes[actionKey] || 0;
  if (now - memoryLast < cooldownMs) {
    return true;
  }

  // Check AsyncStorage for persistent rate-limiting across reloads
  try {
    const persistedStr = await AsyncStorage.getItem(storageKey);
    const persistedLast = persistedStr ? parseInt(persistedStr, 10) : 0;
    if (now - persistedLast < cooldownMs) {
      lastExecutionTimes[actionKey] = persistedLast;
      return true;
    }
  } catch {}

  // Update timestamps
  lastExecutionTimes[actionKey] = now;
  try {
    await AsyncStorage.setItem(storageKey, String(now));
  } catch {}

  return false;
}
