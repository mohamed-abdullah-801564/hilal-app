export const CARD_LINK_ORIGIN = "https://www.islamicaudiohub.com";
export const ANDROID_PACKAGE_NAME = "com.alhilal.platform";
export const PLAY_STORE_URL =
  `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE_NAME}`;

export function getCardUrl(cardId: string): string {
  return `${CARD_LINK_ORIGIN}/audio/${encodeURIComponent(cardId)}`;
}
