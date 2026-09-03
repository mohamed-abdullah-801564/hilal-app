import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { View, StyleSheet, ActivityIndicator } from "react-native";
import QuizModal from "@/components/QuizModal";
import { getTrackById } from "@/data/unifiedStorage";
import type { UnifiedTrack } from "@/data/unifiedStorage";

export default function QuizPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [visible, setVisible] = useState(true);
  const [track, setTrack] = useState<UnifiedTrack | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      getTrackById(id).then(t => {
        setTrack(t);
        setLoading(false);
      });
    }
  }, [id]);

  const handleClose = () => {
    setVisible(false);
    setTimeout(() => {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace("/");
      }
    }, 300);
  };

  if (loading) {
    return (
      <View style={styles.bg}>
        <ActivityIndicator color="#f0bc42" size="large" style={{ marginTop: 100 }} />
      </View>
    );
  }

  if (!id || !track) return <View style={styles.bg} />;

  return (
    <View style={styles.bg}>
      <QuizModal
        visible={visible}
        onClose={handleClose}
        trackId={id}
        trackTitle={track.title}
        prizeEnabled={track.prizeEnabled ?? false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
    backgroundColor: "#0a0a0a",
  },
});
