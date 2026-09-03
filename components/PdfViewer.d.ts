// Type surface for the platform-specific PdfViewer (PdfViewer.native.tsx /
// PdfViewer.web.tsx). Metro resolves the real implementation per-platform;
// tsc resolves this declaration for `@/components/PdfViewer`.
import type { ComponentType } from "react";

declare const PdfViewer: ComponentType<{ url: string; isDark: boolean }>;
export default PdfViewer;
