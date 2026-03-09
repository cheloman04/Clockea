import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';

function ClockLogo() {
  return (
    <View style={logo.outerCircle}>
      {/* Clock body */}
      <View style={logo.clockBody}>
        {/* Clock face */}
        <View style={logo.clockFace}>
          {/* Hour hand */}
          <View style={[logo.hand, logo.hourHand]} />
          {/* Minute hand */}
          <View style={[logo.hand, logo.minuteHand]} />
          {/* Center dot */}
          <View style={logo.centerDot} />
        </View>
        {/* Paper strip */}
        <View style={logo.paper}>
          <View style={logo.paperLine} />
          <View style={logo.paperLine} />
          <View style={logo.paperLine} />
        </View>
      </View>
    </View>
  );
}

const logo = StyleSheet.create({
  outerCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#f5ede0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  clockBody: {
    width: 64,
    height: 72,
    backgroundColor: '#fe7f2d',
    borderRadius: 10,
    alignItems: 'center',
    paddingTop: 8,
    gap: 4,
  },
  clockFace: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#1e3545',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hand: {
    position: 'absolute',
    backgroundColor: '#ffffff',
    borderRadius: 2,
    bottom: '50%',
    left: '50%',
    transformOrigin: 'bottom center',
  },
  hourHand: {
    width: 2,
    height: 12,
    marginLeft: -1,
    transform: [{ rotate: '-30deg' }],
  },
  minuteHand: {
    width: 2,
    height: 16,
    marginLeft: -1,
    transform: [{ rotate: '60deg' }],
  },
  centerDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#fe7f2d',
  },
  paper: {
    width: 38,
    backgroundColor: '#ffffff',
    borderRadius: 3,
    paddingVertical: 4,
    paddingHorizontal: 6,
    gap: 3,
  },
  paperLine: {
    height: 2,
    backgroundColor: '#ccc',
    borderRadius: 1,
  },
});

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
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
          <Text style={styles.tagline}>TURN TIME INTO{'\n'}PROGRESS.</Text>

          <View style={styles.top}>
            <ClockLogo />
            <Text style={styles.logo}>CLOCKEA</Text>
            <Text style={styles.heading}>Welcome back</Text>
            <Text style={styles.sub}>Sign in to continue tracking</Text>
          </View>

          <View style={styles.form}>
            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor="#9bb0be"
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
              placeholderTextColor="#9bb0be"
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
        </ScrollView>
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
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 40,
  },
  tagline: {
    fontSize: 32,
    fontWeight: '900',
    color: '#ffffff',
    textAlign: 'center',
    letterSpacing: 1,
    lineHeight: 38,
    marginBottom: 32,
    textTransform: 'uppercase',
  },
  top: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    fontSize: 28,
    fontWeight: '900',
    color: '#fe7f2d',
    letterSpacing: 6,
    marginBottom: 16,
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 6,
  },
  sub: {
    fontSize: 14,
    color: '#7aa3b8',
  },
  form: {},
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
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1e3545',
    marginBottom: 20,
  },
  btn: {
    backgroundColor: '#c4621a',
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  btnDisabled: {
    opacity: 0.5,
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
