import { useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState } from 'react';

export default function AdminDashboard() {
  const router = useRouter();
  const [adminEmail, setAdminEmail] = useState('');

  useFocusEffect(
    useCallback(() => {
      loadSession();
    }, [])
  );

  async function loadSession() {
    try {
      const raw = await AsyncStorage.getItem('admin_session');
      if (raw) setAdminEmail(JSON.parse(raw).email ?? '');
    } catch {}
  }

  function handleLogout() {
    Alert.alert('வெளியேறு', 'Admin-ஆக வெளியேற விரும்புகிறீர்களா?', [
      { text: 'இல்லை', style: 'cancel' },
      {
        text: 'ஆமா', style: 'destructive',
        onPress: async () => {
          await AsyncStorage.removeItem('admin_session');
          router.replace('/admin/login');
        },
      },
    ]);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Admin CMS</Text>
          <Text style={styles.headerSub}>{adminEmail}</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>வெளியேறு</Text>
        </TouchableOpacity>
      </View>

      {/* Info banner */}
      <View style={styles.infoBanner}>
        <Text style={styles.infoBannerIcon}>🔥</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.infoBannerTitle}>Firebase Firestore — Sole Data Source</Text>
          <Text style={styles.infoBannerSub}>
            அனைத்து தரவும் Firestore-ல் மட்டுமே சேமிக்கப்படுகின்றன.
            Real-time sync to all devices.
          </Text>
        </View>
      </View>

      {/* Firebase CMS card */}
      <Text style={styles.sectionTitle}>🔥 Firebase Data Manager</Text>
      <Text style={styles.sectionSub}>Firestore real-time database + Storage audio upload</Text>

      <TouchableOpacity
        style={styles.cmsCard}
        onPress={() => router.push('/admin/firebase' as any)}
        activeOpacity={0.75}
      >
        <View style={[styles.iconBox, { backgroundColor: '#f0bc4222' }]}>
          <Text style={styles.icon}>🔥</Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle}>Firebase Data Manager</Text>
          <Text style={styles.cardMeta}>Categories · Subcategories · Cards · Audio · Quiz</Text>
          <Text style={styles.cardDetail}>Add / Edit / Delete — syncs to all devices instantly</Text>
        </View>
        <Text style={[styles.arrow, { color: '#f0bc42' }]}>›</Text>
      </TouchableOpacity>

      {/* Bulk Seed card */}
      <TouchableOpacity
        style={[styles.cmsCard, { borderColor: '#4CAF5033', marginTop: 12 }]}
        onPress={() => router.push('/admin/firebase/bulk-create' as any)}
        activeOpacity={0.75}
      >
        <View style={[styles.iconBox, { backgroundColor: '#4CAF5022' }]}>
          <Text style={styles.icon}>⚡</Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle}>Bulk Seed Tool</Text>
          <Text style={styles.cardMeta}>Virivurai · Hadith · Iman — Quick seed panels</Text>
          <Text style={styles.cardDetail}>Paste multiple cards at once into Firestore</Text>
        </View>
        <Text style={[styles.arrow, { color: '#4CAF50' }]}>›</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { padding: 20, paddingTop: 56, paddingBottom: 40 },

  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 28,
  },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#f0bc42' },
  headerSub: { fontSize: 12, color: '#555', marginTop: 3 },
  logoutBtn: {
    backgroundColor: '#1a0a0a', borderWidth: 1, borderColor: '#4a1515',
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
  },
  logoutText: { color: '#ff6b6b', fontSize: 13, fontWeight: '600' },

  infoBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: '#0e1a0e', borderWidth: 1, borderColor: '#1a7a4a44',
    borderRadius: 12, padding: 14, marginBottom: 28,
  },
  infoBannerIcon: { fontSize: 24 },
  infoBannerTitle: { color: '#4CAF50', fontSize: 13, fontWeight: '700', marginBottom: 4 },
  infoBannerSub: { color: '#4a7a4a', fontSize: 12, lineHeight: 18 },

  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 4 },
  sectionSub: { fontSize: 12, color: '#555', marginBottom: 14 },

  cmsCard: {
    backgroundColor: '#0e0a18', borderRadius: 14, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderWidth: 1, borderColor: '#f0bc4233',
  },
  iconBox: {
    width: 48, height: 48, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  icon: { fontSize: 24 },
  cardInfo: { flex: 1 },
  cardTitle: { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 3 },
  cardMeta: { color: '#888', fontSize: 12, marginBottom: 2 },
  cardDetail: { color: '#555', fontSize: 11 },
  arrow: { fontSize: 24, fontWeight: '300' },
});
