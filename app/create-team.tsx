import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';

export default function CreateTeamScreen() {
  const router = useRouter();
  const { createTeam } = useAuth();
  const [teamName, setTeamName] = useState('');
  const [teamCode, setTeamCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleCreateTeam() {
    if (!teamName.trim()) return;
    setLoading(true);
    setError('');
    const result = await createTeam(teamName.trim());
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setTeamCode(result.code ?? '');
  }

  async function handleCopyCode() {
    if (!teamCode) return;

    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(teamCode);
        Alert.alert('Copied', 'Team code copied to clipboard.');
      } catch {
        Alert.alert('Copy failed', 'Could not access clipboard. Copy the code manually.');
      }
      return;
    }

    Alert.alert('Team code', `Share this code with your team: ${teamCode}`);
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        <Text style={styles.heading}>Create Team</Text>
        <Text style={styles.sub}>Generate a code your teammates can use during signup.</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {teamCode ? (
          <View style={styles.successCard}>
            <Text style={styles.label}>Team Code</Text>
            <Text style={styles.code}>{teamCode}</Text>

            <TouchableOpacity style={styles.primaryBtn} onPress={handleCopyCode} activeOpacity={0.85}>
              <Text style={styles.primaryBtnText}>Copy Code</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.replace('/')} activeOpacity={0.85}>
              <Text style={styles.secondaryBtnText}>Back to Home</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.form}>
            <Text style={styles.label}>Team Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Acme Team"
              placeholderTextColor="#4a6d80"
              value={teamName}
              onChangeText={setTeamName}
              autoFocus
            />

            <TouchableOpacity
              style={[styles.primaryBtn, (!teamName.trim() || loading) && styles.btnDisabled]}
              onPress={handleCreateTeam}
              disabled={!teamName.trim() || loading}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryBtnText}>
                {loading ? 'Creating team…' : 'Create Team Code'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
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
    padding: 24,
  },
  heading: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
  },
  sub: {
    color: '#7aa3b8',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 24,
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
  form: {
    backgroundColor: '#233d4d',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2d4f62',
    padding: 16,
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
    backgroundColor: '#1e3545',
    borderWidth: 1,
    borderColor: '#2d4f62',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#ffffff',
    marginBottom: 16,
  },
  successCard: {
    backgroundColor: '#233d4d',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2d4f62',
    padding: 16,
  },
  code: {
    color: '#fe7f2d',
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: 3,
    marginBottom: 18,
  },
  primaryBtn: {
    backgroundColor: '#fe7f2d',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#fe7f2d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
    marginBottom: 10,
  },
  btnDisabled: {
    opacity: 0.45,
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryBtn: {
    backgroundColor: '#233d4d',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2d4f62',
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: '#7aa3b8',
    fontSize: 15,
    fontWeight: '600',
  },
});
