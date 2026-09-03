// Type surface for the platform-specific VisualModePlayer
// (VisualModePlayer.native.tsx / VisualModePlayer.web.tsx). Metro resolves
// the real implementation per-platform; tsc resolves this declaration.
import type { ComponentType } from "react";

declare const VisualModePlayer: ComponentType<{
  uri: string;
  shouldPlay: boolean;
  onEnd: () => void;
}>;
export default VisualModePlayer;
