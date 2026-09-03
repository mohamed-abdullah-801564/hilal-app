// Type surface for the platform-specific YoutubeViewer (YoutubeViewer.native.tsx
// / YoutubeViewer.web.tsx). Metro resolves the real implementation per-platform.
import type { ComponentType } from "react";

declare const YoutubeViewer: ComponentType<{ videoId: string; isDark: boolean }>;
export default YoutubeViewer;
