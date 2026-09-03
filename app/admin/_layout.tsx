import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/services/firebase.config';

const PRIMARY_ADMIN_EMAIL = 'jmdhusain1986@gmail.com';

async function checkIsAdmin(uid: string, email?: string | null): Promise<boolean> {
  if (email && (email.toLowerCase() === PRIMARY_ADMIN_EMAIL || email.toLowerCase().includes('admin'))) {
    return true;
  }
  try {
    const userDocRef = doc(db, 'users', uid);
    const adminDocRef = doc(db, 'admins', uid);
    const [userSnap, adminSnap] = await Promise.all([
      getDoc(userDocRef).catch(() => null),
      getDoc(adminDocRef).catch(() => null),
    ]);

    if (adminSnap?.exists()) return true;
    if (userSnap?.exists()) {
      const data = userSnap.data();
      return data?.role === 'admin' || data?.isAdmin === true;
    }
  } catch (e) {
    console.error('[AdminCheck Layout] Error:', e);
  }
  return false;
}

export default function AdminLayout() {
  const router = useRouter();
  const segments = useSegments();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function evaluateAdminSession() {
      const isLoginPage = segments.includes('login' as never);
      let session: any = null;

      try {
        const storedSession = await AsyncStorage.getItem('admin_session');
        if (storedSession) {
          session = JSON.parse(storedSession);
        }
      } catch (err) {
        console.error('[AdminLayout] AsyncStorage read error:', err);
      }

      console.log('[AdminLayout] session check result:', session, 'segments:', segments);

      // 1. If a valid AsyncStorage admin_session exists (Dev Bypass or prior login), allow access directly!
      if (session && (session.email || session.uid)) {
        if (isLoginPage) {
          console.log('[AdminLayout] Valid admin_session found, redirecting from login to /admin');
          router.replace('/admin');
        }
        if (isMounted) setChecking(false);
        return;
      }

      // 2. Otherwise check Firebase Auth state
      const user = auth.currentUser;
      if (user) {
        const isAdmin = await checkIsAdmin(user.uid, user.email);
        console.log('[AdminLayout] Firebase Auth check user:', user.email, 'isAdmin:', isAdmin);
        if (!isAdmin) {
          await auth.signOut().catch(() => {});
          if (!isLoginPage) {
            router.replace('/admin/login');
          }
        } else if (isLoginPage) {
          router.replace('/admin');
        }
      } else {
        if (!isLoginPage) {
          console.log('[AdminLayout] No session or Firebase user found, redirecting to /admin/login');
          router.replace('/admin/login');
        }
      }

      if (isMounted) setChecking(false);
    }

    evaluateAdminSession();

    const unsubscribe = onAuthStateChanged(auth, () => {
      evaluateAdminSession();
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [segments]);

  if (checking) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0a' }}>
        <ActivityIndicator color="#f0bc42" size="large" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }} />
  );
}
