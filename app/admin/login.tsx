import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/services/firebase.config';
import { sanitizeInput } from '@/utils/security';

const PRIMARY_ADMIN_EMAIL = 'jmdhusain1986@gmail.com';

async function checkIsAdmin(uid: string, email?: string | null): Promise<boolean> {
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
    console.error('[AdminCheck] Firestore read error:', e);
  }
  if (email && email.toLowerCase() === PRIMARY_ADMIN_EMAIL) {
    return true;
  }
  return false;
}

async function ensureAdminFirestoreDocs(uid: string, email: string) {
  try {
    const adminData = {
      email,
      role: 'admin',
      isAdmin: true,
      updatedAt: Date.now(),
    };
    await Promise.all([
      setDoc(doc(db, 'users', uid), adminData, { merge: true }).catch(() => null),
      setDoc(doc(db, 'admins', uid), adminData, { merge: true }).catch(() => null),
    ]);
  } catch (e) {
    console.error('[AdminSetup] Firestore doc creation error:', e);
  }
}

export default function AdminLoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setError('');

    const cleanEmail = sanitizeInput(email);
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      setError('Email மற்றும் Password உள்ளிடுங்க');
      return;
    }

    setLoading(true);

    let user: any = null;

    try {
      // 1. Attempt standard Firebase Auth sign-in
      try {
        const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, cleanPassword);
        user = userCredential.user;
      } catch (signInErr: any) {
        console.log('[AdminLogin] Sign-in failed:', signInErr?.code, signInErr?.message);
        const code = signInErr?.code || '';

        // 2. If user not found or invalid credential, attempt automatic user registration
        if (code === 'auth/user-not-found' || code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
          try {
            console.log('[AdminLogin] Attempting on-the-fly user creation for:', cleanEmail);
            const createCredential = await createUserWithEmailAndPassword(auth, cleanEmail, cleanPassword);
            user = createCredential.user;

            // Automatically create admin metadata documents in Firestore
            await ensureAdminFirestoreDocs(user.uid, cleanEmail);
          } catch (createErr: any) {
            console.log('[AdminLogin] Auto creation result/error:', createErr?.code, createErr?.message);
            if (createErr?.code === 'auth/email-already-in-use') {
              throw new Error('AUTH_INVALID_CREDENTIAL');
            }
            throw createErr;
          }
        } else {
          throw signInErr;
        }
      }

      if (!user) {
        throw new Error('NO_USER');
      }

      // Verify or provision Firestore admin role/metadata flag
      let isAdmin = await checkIsAdmin(user.uid, user.email);
      if (!isAdmin && cleanEmail.toLowerCase() === PRIMARY_ADMIN_EMAIL) {
        await ensureAdminFirestoreDocs(user.uid, cleanEmail);
        isAdmin = true;
      }

      if (isAdmin) {
        await AsyncStorage.setItem(
          'admin_session',
          JSON.stringify({
            email: user.email || cleanEmail,
            uid: user.uid,
            loginTime: Date.now(),
          })
        );
        router.replace('/admin');
      } else {
        if (auth.currentUser) {
          await auth.signOut().catch(() => {});
        }
        setError('தவறான Email அல்லது Password. அல்லது Admin அனுமதி இல்லை.');
      }
    } catch (err: any) {
      console.error('[AdminLogin] Error details:', err);
      const msg = err?.message || '';
      const code = err?.code || '';
      if (
        msg === 'AUTH_INVALID_CREDENTIAL' ||
        code === 'auth/invalid-credential' ||
        code === 'auth/user-not-found' ||
        code === 'auth/wrong-password' ||
        code === 'auth/invalid-email'
      ) {
        setError('தவறான கடவுச்சொல் அல்லது பயனர் இல்லை. Firebase Console-ல் கடவுச்சொல்லை மாற்றவும்.');
      } else if (code === 'auth/weak-password') {
        setError('கடவுச்சொல் குறைந்தபட்சம் 6 எழுத்துகள் இருக்க வேண்டும்.');
      } else {
        setError('உள்நுழைவதில் தவறு ஏற்பட்டது. மீண்டும் முயற்சிக்கவும்.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>🕌</Text>
        </View>

        <Text style={styles.title}>Admin Login</Text>
        <Text style={styles.subtitle}>Hilal</Text>

        <View style={styles.form}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder=""
            placeholderTextColor="#555"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••"
            placeholderTextColor="#555"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️ {error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.loginButton, loading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#0a0a0a" />
            ) : (
              <Text style={styles.loginButtonText}>உள்நுழைக</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    padding: 28,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  icon: {
    fontSize: 56,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#f0bc42',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginBottom: 40,
  },
  form: {
    gap: 8,
  },
  label: {
    fontSize: 13,
    color: '#aaa',
    marginBottom: 4,
    marginTop: 8,
  },
  input: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 8,
    padding: 14,
    fontSize: 15,
    color: '#fff',
  },
  errorBox: {
    backgroundColor: '#2a1010',
    borderWidth: 1,
    borderColor: '#5a2020',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 13,
  },
  loginButton: {
    backgroundColor: '#f0bc42',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: '#0a0a0a',
    fontSize: 16,
    fontWeight: '700',
  },
});
