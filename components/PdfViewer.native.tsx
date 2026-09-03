// Native inline PDF viewer (Android/iOS).
// Renders ALL pages, one by one, vertically scrollable — no external browser.
// react-native-pdf is require()'d lazily and guarded so a missing native module
// (e.g. Expo Go) shows an in-app message instead of hard-crashing the screen.

import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { unlockOrientation, lockPortrait } from "@/services/orientation";

let Pdf: any = null;
let pdfUnavailable = false;
try {
  Pdf = require("react-native-pdf").default;
} catch {
  pdfUnavailable = true;
}

// Fallback for environments where react-native-pdf's native module isn't
// available (e.g. Expo Go). react-native-webview IS part of Expo Go's
// bundled module set (it already powers the Video tab's YouTube embed), so
// the same PDF URL can still be rendered inline via the platform WebView's
// built-in PDF viewer instead of showing a dead-end message.
let WebView: any = null;
let webViewUnavailable = false;
try {
  WebView = require("react-native-webview").WebView;
  if (!WebView) webViewUnavailable = true;
} catch {
  webViewUnavailable = true;
}

interface Props {
  url: string;
  isDark: boolean;
}

function Notice({ icon, text, isDark, debugDetail }: { icon: any; text: string; isDark: boolean; debugDetail?: string }) {
  return (
    <View style={styles.notice}>
      <Ionicons name={icon} size={48} color="#888" />
      <Text style={[styles.noticeTxt, { color: isDark ? "#aaa" : "#5a7a64" }]}>{text}</Text>
      {/* TEMP DEBUG — remove this block once the root cause is confirmed */}
      {!!debugDetail && (
        <View style={styles.debugBox}>
          <Text style={styles.debugLabel}>DEBUG (temporary):</Text>
          <ScrollView>
            <Text style={styles.debugTxt} selectable>{debugDetail}</Text>
          </ScrollView>
        </View>
      )}
    </View>
  );
}

// Expo-Go-only fallback: renders the same PDF URL inline via WebView.
// Kept fully isolated from the react-native-pdf path's state above.
function WebViewPdfFallback({ url, isDark }: { url: string; isDark: boolean }) {
  const [wvLoading, setWvLoading] = useState(true);
  const [wvError, setWvError] = useState(false);
  const bg = isDark ? "#0a0a0a" : "#e9eef0";

  // Allow the device to freely rotate between portrait/landscape while this
  // fallback viewer is open, and restore the app-wide portrait lock
  // (app.json) when it closes. Scoped to this component only — does not
  // affect video fullscreen (services/orientation.ts's lockLandscape/
  // lockPortrait pair) or the react-native-pdf path below.
  useEffect(() => {
    void unlockOrientation();
    return () => {
      void lockPortrait();
    };
  }, []);

  if (wvError) {
    return (
      <Notice
        icon="alert-circle-outline"
        text="PDF-ஐ ஏற்ற முடியவில்லை. மீண்டும் முயற்சிக்கவும்."
        isDark={isDark}
      />
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: bg }]}>
      <WebView
        source={{ uri: url }}
        style={styles.pdf}
        originWhitelist={["*"]}
        onLoadEnd={() => setWvLoading(false)}
        onError={() => { setWvError(true); setWvLoading(false); }}
        onHttpError={() => { setWvError(true); setWvLoading(false); }}
        // Zoom/scroll tuning for the WebView fallback only — react-native-pdf
        // (production/dev builds) has its own zoom/scroll handling and is
        // untouched. The layout above is flex-based, so rotation just
        // reflows this same WebView instance — no remount, no reload.
        scalesPageToFit
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        setBuiltInZoomControls
        setDisplayZoomControls={false}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        bounces={false}
      />
      {wvLoading && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color="#1a7a4a" />
        </View>
      )}
    </View>
  );
}

export default function PdfViewer({ url, isDark }: Props) {
  const [pages, setPages]     = useState(0);
  const [page, setPage]       = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);
  // TEMP DEBUG — remove after root cause is confirmed
  const [errorDetail, setErrorDetail] = useState("");

  const bg = isDark ? "#0a0a0a" : "#e9eef0";

  if (!Pdf || pdfUnavailable) {
    if (!url) {
      return <Notice icon="easel-outline" text="Slide இன்னும் சேர்க்கப்படவில்லை" isDark={isDark} />;
    }
    if (WebView && !webViewUnavailable) {
      return <WebViewPdfFallback url={url} isDark={isDark} />;
    }
    return <Notice icon="document-text-outline" text="PDF viewer requires the installed app build." isDark={isDark} />;
  }
  if (!url) {
    return <Notice icon="easel-outline" text="Slide இன்னும் சேர்க்கப்படவில்லை" isDark={isDark} />;
  }
  if (error) {
    return (
      <Notice
        icon="alert-circle-outline"
        text="PDF-ஐ ஏற்ற முடியவில்லை. மீண்டும் முயற்சிக்கவும்."
        isDark={isDark}
        debugDetail={errorDetail}
      />
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: bg }]}>
      <Pdf
        source={{ uri: url, cache: true }}
        trustAllCerts={false}
        horizontal={false}
        enablePaging={false}
        fitPolicy={0}
        spacing={8}
        style={[styles.pdf, { backgroundColor: bg }]}
        onLoadComplete={(numberOfPages: number) => { setPages(numberOfPages); setLoading(false); }}
        onPageChanged={(p: number) => setPage(p)}
        onError={(err: any) => {
          // TEMP DEBUG — remove after root cause is confirmed
          console.log("[PdfViewer][DEBUG] react-native-pdf onError fired. url =", url);
          console.log("[PdfViewer][DEBUG] error object:", err);
          console.log("[PdfViewer][DEBUG] error message:", err?.message ?? "(no message property)");

          let fullDump = "";
          try {
            fullDump = JSON.stringify(err, Object.getOwnPropertyNames(err ?? {}));
          } catch {
            fullDump = "(could not stringify error object)";
          }
          setErrorDetail(
            `url: ${url}\n\nmessage: ${err?.message ?? "(none)"}\n\nfull error: ${fullDump}`
          );

          setError(true);
          setLoading(false);
        }}
      />

      {loading && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color="#1a7a4a" />
        </View>
      )}

      {pages > 0 && (
        <View style={styles.badge}>
          <Ionicons name="document-text" size={13} color="#fff" />
          <Text style={styles.badgeTxt}>{page} / {pages}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1 },
  pdf:     { flex: 1, width: "100%" },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  badge: {
    position: "absolute", bottom: 14, alignSelf: "center",
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#000000aa", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
  },
  badgeTxt: { color: "#fff", fontSize: 13, fontWeight: "700" },
  notice:    { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32 },
  noticeTxt: { fontSize: 15, textAlign: "center", lineHeight: 22 },
  // TEMP DEBUG — remove this style block once the root cause is confirmed
  debugBox: {
    marginTop: 8, width: "100%", maxHeight: 260,
    backgroundColor: "#00000015", borderRadius: 8, padding: 10,
  },
  debugLabel: { fontSize: 11, fontWeight: "700", color: "#d24400", marginBottom: 4 },
  debugTxt:   { fontSize: 11, color: "#333", fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
});
