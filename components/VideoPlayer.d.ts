// Type surface for the platform-specific VideoPlayer (VideoPlayer.native.tsx /
// VideoPlayer.web.tsx). Metro resolves the real implementation per-platform;
// tsc resolves this declaration for `@/components/VideoPlayer`.
import type { ComponentType } from "react";

declare const VideoPlayer: ComponentType<{
  uri: string;
  isDark: boolean;
  onLoad?: () => void;
  onError?: (err?: any) => void;
  shouldPlay?: boolean;
  isLooping?: boolean;
  useControls?: boolean;
  isMuted?: boolean;
  resizeMode?: "contain" | "cover";
  onPlaybackStatus?: (status: any) => void;
}>;
export default VideoPlayer;
