import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { addRequest } from "@/services/firebase.firestore";
import { sanitizeInput } from "@/utils/security";

interface RequestModalProps {
  visible: boolean;
  onClose: () => void;
}

const GREEN = "#1a7a4a";
const GOLD  = "#f0bc42";

const CATEGORIES = [
  "குர்ஆன் விளக்கம்",
  "ஹதீஸ் விளக்கம்",
  "ஈமான் அடிப்படைகள்",
  "நபி வரலாறு",
  "அன்றாட வழிகாட்டி",
  "பிற",
];

export default function RequestModal({ visible, onClose }: RequestModalProps) {
  const { isDark } = useColors();
  const insets = useSafeAreaInsets();

  const [title, setTitle]         = useState("");
  const [desc, setDesc]           = useState("");
  const [selectedCat, setSelectedCat] = useState("");
  const [submitting, setSubmitting]   = useState(false);
  const [submitted, setSubmitted]     = useState(false);

  // ── Palette (responds to the in-app dark-mode toggle) ──
  const bg      = isDark ? "#0a0a0a" : "#f4f8f5";
  const card    = isDark ? "#16191c" : "#ffffff";
  const border  = isDark ? "#272c30" : "#dbe7df";
  const text    = isDark ? "#f1f1f1" : "#0d2414";
  const sub      = isDark ? "#9aa0a6" : "#5a7a64";
  const inputBg = isDark ? "#16191c" : "#ffffff";
  const canSend = title.trim().length > 0 && !submitting;

  const handleSubmit = async () => {
    const cleanTitle = sanitizeInput(title);
    const cleanDesc = sanitizeInput(desc);
    const cleanCat = sanitizeInput(selectedCat);

    if (!cleanTitle || submitting) return;

    setSubmitting(true);
    try {
      await addRequest({ title: cleanTitle, category: cleanCat, description: cleanDesc });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSubmitted(true);
    } catch (err: any) {
      if (err?.message?.includes("Too many requests")) {
        Alert.alert("கோரிக்கை அளவு வரம்பு", "தயவுசெய்து சிறிது நேரம் கழித்து மீண்டும் முயற்சிக்கவும்.");
      } else {
        setSubmitted(true);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setTitle("");
    setDesc("");
    setSelectedCat("");
    setSubmitting(false);
    setSubmitted(false);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <View style={[styles.container, { backgroundColor: bg, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={handleClose} style={[styles.closeBtn, { backgroundColor: card, borderColor: border }]} hitSlop={8}>
            <Ionicons name="close" size={22} color={text} />
          </Pressable>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={[styles.headerTitle, { color: text }]}>கோரிக்கை</Text>
            <Text style={[styles.headerSub, { color: sub }]}>புதிய பாடம் கோருங்கள்</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {!submitted ? (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Info */}
            <View style={[styles.infoBox, { backgroundColor: GREEN + (isDark ? "1f" : "12"), borderColor: GREEN + "44" }]}>
              <Ionicons name="bulb-outline" size={18} color={GREEN} />
              <Text style={[styles.infoText, { color: isDark ? "#bfe6cf" : "#2e7a4e" }]}>
                நீங்கள் கேட்க விரும்பும் பாடங்கள் அல்லது தலைப்புகளைச் சொல்லுங்கள் — நாங்கள் ஆய்வு செய்வோம்.
              </Text>
            </View>

            {/* Title */}
            <Text style={[styles.label, { color: text }]}>பாடத்தின் தலைப்பு *</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="உதாரணம்: சூரா யாஸீன் விளக்கம்"
              placeholderTextColor={sub}
              style={[styles.input, { backgroundColor: inputBg, borderColor: border, color: text }]}
            />

            {/* Category chips */}
            <Text style={[styles.label, { color: text }]}>பிரிவு</Text>
            <View style={styles.catGrid}>
              {CATEGORIES.map((cat) => {
                const active = selectedCat === cat;
                return (
                  <Pressable
                    key={cat}
                    onPress={() => setSelectedCat(active ? "" : cat)}
                    style={[
                      styles.catChip,
                      {
                        backgroundColor: active ? GREEN + (isDark ? "26" : "18") : card,
                        borderColor: active ? GREEN : border,
                      },
                    ]}
                  >
                    <Text style={[styles.catChipText, { color: active ? GREEN : sub, fontWeight: active ? "700" : "500" }]}>
                      {cat}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Description */}
            <Text style={[styles.label, { color: text }]}>விளக்கம் (விரும்பினால்)</Text>
            <TextInput
              value={desc}
              onChangeText={setDesc}
              placeholder="இந்த பாடத்தைப் பற்றி கூடுதல் தகவல்…"
              placeholderTextColor={sub}
              multiline
              textAlignVertical="top"
              style={[styles.textArea, { backgroundColor: inputBg, borderColor: border, color: text }]}
            />

            {/* Submit */}
            <Pressable
              onPress={handleSubmit}
              disabled={!canSend}
              style={[styles.submitBtn, { backgroundColor: canSend ? GREEN : (isDark ? "#1f2430" : "#d7dee3") }]}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="paper-plane" size={18} color={canSend ? "#fff" : sub} />
                  <Text style={[styles.submitText, { color: canSend ? "#fff" : sub }]}>கோரிக்கை அனுப்பு</Text>
                </>
              )}
            </Pressable>
          </ScrollView>
        ) : (
          <View style={styles.successContainer}>
            <View style={[styles.successIcon, { backgroundColor: GREEN + "1f" }]}>
              <Ionicons name="checkmark-circle" size={64} color={GREEN} />
            </View>
            <Text style={[styles.successTitle, { color: text }]}>நன்றி! கோரிக்கை அனுப்பப்பட்டது</Text>
            <Text style={[styles.successDesc, { color: sub }]}>
              உங்கள் கோரிக்கையைப் பெற்றுக்கொண்டோம். விரைவில் ஆய்வு செய்வோம்.
            </Text>
            <Pressable onPress={handleClose} style={[styles.doneBtn, { backgroundColor: GREEN }]}>
              <Text style={styles.doneBtnText}>முடித்தது</Text>
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 18 },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  closeBtn: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "700" },
  headerSub: { fontSize: 12, marginTop: 1 },

  content: { paddingBottom: 28, gap: 12 },

  infoBox: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 6 },
  infoText: { flex: 1, fontSize: 13, lineHeight: 20 },

  label: { fontSize: 13, fontWeight: "600", marginTop: 4 },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15 },

  catGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  catChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1.5 },
  catChipText: { fontSize: 13 },

  textArea: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, minHeight: 110 },

  submitBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 16, borderRadius: 16, marginTop: 10 },
  submitText: { fontSize: 16, fontWeight: "700" },

  successContainer: { flex: 1, justifyContent: "center", alignItems: "center", gap: 16, paddingHorizontal: 24 },
  successIcon: { width: 110, height: 110, borderRadius: 32, alignItems: "center", justifyContent: "center" },
  successTitle: { fontSize: 21, fontWeight: "800", textAlign: "center" },
  successDesc: { fontSize: 14, textAlign: "center", lineHeight: 22 },
  doneBtn: { paddingHorizontal: 40, paddingVertical: 15, borderRadius: 16, marginTop: 8 },
  doneBtnText: { fontSize: 16, fontWeight: "700", color: "#fff" },
});
