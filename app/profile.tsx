import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

type ProfileRow = {
  full_name: string;
  team_id: string | null;
};

type TeamRow = {
  id: string;
  name: string;
  code: string;
  created_by: string | null;
};

export default function ProfileScreen() {
  const router = useRouter();
  const { user, signOut, joinTeam } = useAuth();
  const [fullName, setFullName] = useState('');
  const [teamName, setTeamName] = useState('');
  const [teamCode, setTeamCode] = useState('');
  const [role, setRole] = useState<'Admin' | 'Participant' | 'No Team'>('No Team');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [joining, setJoining] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError('');

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('full_name, team_id')
      .eq('id', user.id)
      .single<ProfileRow>();

    if (profileError) {
      setError(profileError.message);
      setLoading(false);
      return;
    }

    setFullName(profile.full_name || user.user_metadata?.full_name || '');

    if (!profile.team_id) {
      setTeamName('');
      setTeamCode('');
      setRole('No Team');
      setLoading(false);
      return;
    }

    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id, name, code, created_by')
      .eq('id', profile.team_id)
      .single<TeamRow>();

    if (teamError) {
      setError(teamError.message);
      setLoading(false);
      return;
    }

    setTeamName(team.name);
    setTeamCode(team.code);
    setRole(team.created_by === user.id ? 'Admin' : 'Participant');
    setLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile])
  );

  async function handleJoinTeam() {
    if (!joinCode.trim()) return;
    setJoining(true);
    setError('');
    const joinError = await joinTeam(joinCode.trim().toUpperCase());
    setJoining(false);
    if (joinError) {
      setError(joinError);
      return;
    }
    setJoinCode('');
    await loadProfile();
  }

  async function handleLogout() {
    try {
      await signOut();
      router.replace('/login');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not log out.';
      Alert.alert('Error', message);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        <View style={styles.hero}>
          <View style={styles.avatar}>
            <View style={styles.avatarHead} />
            <View style={styles.avatarBody} />
          </View>
          <Text style={styles.heading}>{fullName || 'Your Profile'}</Text>
          <Text style={styles.emailTop}>{user?.email ?? 'No email'}</Text>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.card}>
          <Text style={styles.label}>Full Name</Text>
          <Text style={styles.value}>{fullName || 'Not set'}</Text>

          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{user?.email ?? 'No email'}</Text>

          <Text style={styles.label}>Team</Text>
          <Text style={styles.value}>{teamName || 'No team yet'}</Text>

          {teamCode ? (
            <>
              <Text style={styles.label}>Team Code</Text>
              <Text style={styles.value}>{teamCode}</Text>
            </>
          ) : null}

          <Text style={styles.label}>Role</Text>
          <Text style={[styles.value, role === 'Admin' && styles.adminRole]}>{role}</Text>
        </View>

        {role === 'No Team' ? (
          <View style={styles.joinCard}>
            <Text style={styles.label}>Join Team With Code</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter team code"
              placeholderTextColor="#4a6d80"
              autoCapitalize="characters"
              value={joinCode}
              onChangeText={setJoinCode}
            />
            <TouchableOpacity
              style={[styles.secondaryBtn, (!joinCode.trim() || joining) && styles.btnDisabled]}
              onPress={handleJoinTeam}
              disabled={!joinCode.trim() || joining}
              activeOpacity={0.85}
            >
              <Text style={styles.secondaryBtnText}>
                {joining ? 'Joining…' : 'Join Team'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => router.push('/create-team')}
          activeOpacity={0.85}
        >
          <Text style={styles.secondaryBtnText}>Create Team Code</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.logoutBtn, loading && styles.logoutBtnDisabled]}
          onPress={handleLogout}
          disabled={loading}
          activeOpacity={0.85}
        >
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
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
  hero: {
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: '#fe7f2d',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#233d4d',
    marginBottom: 10,
  },
  avatarHead: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#fe7f2d',
    marginBottom: 4,
  },
  avatarBody: {
    width: 30,
    height: 12,
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    backgroundColor: '#fe7f2d',
  },
  heading: {
    fontSize: 26,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
  },
  emailTop: {
    color: '#7aa3b8',
    fontSize: 14,
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
  card: {
    backgroundColor: '#233d4d',
    borderWidth: 1,
    borderColor: '#2d4f62',
    borderRadius: 14,
    padding: 16,
  },
  label: {
    fontSize: 11,
    color: '#7aa3b8',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    fontWeight: '700',
    marginBottom: 6,
    marginTop: 12,
  },
  value: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
  adminRole: {
    color: '#fe7f2d',
    fontWeight: '700',
  },
  joinCard: {
    marginTop: 16,
    backgroundColor: '#233d4d',
    borderWidth: 1,
    borderColor: '#2d4f62',
    borderRadius: 14,
    padding: 16,
  },
  input: {
    backgroundColor: '#1e3545',
    borderWidth: 1,
    borderColor: '#2d4f62',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#ffffff',
    marginTop: 8,
  },
  secondaryBtn: {
    marginTop: 16,
    backgroundColor: '#fe7f2d',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#fe7f2d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  secondaryBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  logoutBtn: {
    marginTop: 12,
    backgroundColor: '#EF4444',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  logoutBtnDisabled: {
    opacity: 0.6,
  },
  logoutText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
