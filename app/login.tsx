import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    if (!email.trim() || !password) return;
    setLoading(true);
    setError('');
    const err = await signIn(email.trim().toLowerCase(), password);
    setLoading(false);
    if (err) setError(err);
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.inner}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.top}>
          <Text style={styles.logo}>Clockea</Text>
          <Text style={styles.heading}>Welcome back</Text>
          <Text style={styles.sub}>Sign in to continue tracking</Text>
        </View>

        <View style={styles.form}>
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor="#4a6d80"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoFocus
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor="#4a6d80"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.btn, (!email.trim() || !password || loading) && styles.btnDisabled]}
            onPress={handleSignIn}
            disabled={!email.trim() || !password || loading}
            activeOpacity={0.85}
          >
            <Text style={styles.btnText}>{loading ? 'Signing in…' : 'Sign In'}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push('/register')}>
            <Text style={styles.link}>
              Don't have an account?{' '}
              <Text style={styles.linkBold}>Create one</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1e3545',
  },
  inner: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 40,
  },
  top: {
    alignItems: 'center',
  },
  logo: {
    fontSize: 36,
    fontWeight: '700',
    color: '#fe7f2d',
    letterSpacing: -1,
    marginBottom: 32,
  },
  heading: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
  },
  sub: {
    fontSize: 15,
    color: '#7aa3b8',
  },
  form: {
    gap: 0,
  },
  error: {
    backgroundColor: '#EF444420',
    color: '#EF4444',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#EF444440',
  },
  label: {
    fontSize: 11,
    color: '#7aa3b8',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    fontWeight: '700',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#233d4d',
    borderWidth: 1,
    borderColor: '#2d4f62',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#ffffff',
    marginBottom: 20,
  },
  btn: {
    backgroundColor: '#fe7f2d',
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#fe7f2d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  btnDisabled: {
    opacity: 0.45,
  },
  btnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  link: {
    textAlign: 'center',
    color: '#7aa3b8',
    fontSize: 15,
    paddingVertical: 8,
  },
  linkBold: {
    color: '#fe7f2d',
    fontWeight: '700',
  },
});
