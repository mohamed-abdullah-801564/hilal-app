import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useSubcategory } from "@/hooks/useFirebaseData";

/**
 * Legacy route: /subcategory/{id}
 * Redirects to the parent category card list (/category/{categoryId}).
 * No Firestore data is modified.
 */
export default function SubcategoryRedirectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { subcategory, loading } = useSubcategory(id ?? "");

  useEffect(() => {
    if (loading) return;

    if (subcategory?.categoryId) {
      router.replace(`/category/${subcategory.categoryId}` as any);
      return;
    }

    router.replace("/(tabs)" as any);
  }, [loading, subcategory, router]);

  return (
    <View style={styles.centered}>
      <ActivityIndicator size="large" color="#1a7a4a" />
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f0f7ff",
  },
});
