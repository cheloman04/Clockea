import { useLocalSearchParams, useRouter } from 'expo-router';
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
import { saveSessionNotes } from '../database/storage';

export default function SessionRecapScreen() {
  const router = useRouter();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  async function handleSave() {
    try {
      setError('');
      if (sessionId && notes.trim()) {
        await saveSessionNotes(Number(sessionId), notes.trim());
      }
      router.replace('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save session notes.');
    }
  }

  function handleSkip() {
    router.replace('/');
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.inner}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.top}>
          <View style={styles.iconWrapper}>
            <Text style={styles.icon}>✓</Text>
          </View>
          <Text style={styles.heading}>Session Complete</Text>
          <Text style={styles.subheading}>
            What did you accomplish in this session?
          </Text>
        </View>

        <View style={styles.inputWrapper}>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <TextInput
            style={styles.input}
            placeholder="e.g. Finished the login flow, fixed 3 bugs, reviewed designs…"
            placeholderTextColor="#4a6d80"
            value={notes}
            onChangeText={setNotes}
            multiline
            autoFocus
            textAlignVertical="top"
          />
          <Text style={styles.hint}>
            These notes will appear in your session history.
          </Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.saveBtn, !notes.trim() && styles.saveBtnDisabled]}
            onPress={handleSave}
            activeOpacity={0.85}
          >
            <Text style={styles.saveBtnText}>Save & Finish</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSkip}>
            <Text style={styles.skipText}>Skip for now</Text>
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
    paddingTop: 48,
    paddingBottom: 32,
    justifyContent: 'space-between',
  },
  top: {
    alignItems: 'center',
  },
  iconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fe7f2d',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#fe7f2d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  icon: {
    fontSize: 28,
    color: '#ffffff',
    fontWeight: '700',
  },
  heading: {
    fontSize: 26,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 10,
  },
  subheading: {
    fontSize: 15,
    color: '#7aa3b8',
    textAlign: 'center',
    lineHeight: 22,
  },
  inputWrapper: {
    flex: 1,
    marginVertical: 32,
  },
  error: {
    backgroundColor: '#EF444420',
    color: '#EF4444',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EF444440',
  },
  input: {
    flex: 1,
    backgroundColor: '#233d4d',
    borderWidth: 1,
    borderColor: '#2d4f62',
    borderRadius: 14,
    padding: 16,
    fontSize: 15,
    color: '#ffffff',
    lineHeight: 22,
  },
  hint: {
    fontSize: 12,
    color: '#4a6d80',
    marginTop: 8,
  },
  actions: {
    gap: 12,
  },
  saveBtn: {
    backgroundColor: '#fe7f2d',
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#fe7f2d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  saveBtnDisabled: {
    opacity: 0.45,
  },
  saveBtnText: {
    color: '#233d4d',
    fontSize: 16,
    fontWeight: '700',
  },
  skipText: {
    textAlign: 'center',
    color: '#7aa3b8',
    fontSize: 15,
    paddingVertical: 8,
  },
});
