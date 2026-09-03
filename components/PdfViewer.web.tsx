// Web stand-in for the native PDF viewer. react-native-pdf is a native module
// with no web support, so on web we never import it (Metro resolves this file
// for the web platform) and show an in-app message instead.

import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

export default function PdfViewer({ isDark }: { url: string; isDark: boolean }) {
  return (
    <View style={styles.notice}>
      <Ionicons name="document-text-outline" size={48} color="#888" />
      <Text style={[styles.noticeTxt, { color: isDark ? "#aaa" : "#5a7a64" }]}>
        PDF viewing is available in the installed app.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  notice:    { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32 },
  noticeTxt: { fontSize: 15, textAlign: "center", lineHeight: 22 },
});
