import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';
import { supabase } from '../lib/supabase';
import {
  createActivityType,
  createClient,
  getActivityTypes,
  getClients,
} from '../database/storage';
import { ActivityType, Client } from '../database/types';

const ACTIVITY_PALETTE = ['#fe7f2d', '#60a5fa', '#f87171', '#c084fc', '#fbbf24', '#4ade80', '#34d399', '#fb923c'];


export default function ProfileScreen() {
  const router = useRouter();
  const { user, signOut, joinTeam, userTeams, activeTeamId, switchTeam } = useAuth();
  const [fullName, setFullName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(false);
  const [teamMembers, setTeamMembers] = useState<Array<{ id: string; full_name: string }>>([]);
  const [teamNameEdit, setTeamNameEdit] = useState('');
  const [savingName, setSavingName] = useState(false);

  // Clients management
  const [clients, setClients] = useState<Client[]>([]);
  const [clientsOpen, setClientsOpen] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [addingClient, setAddingClient] = useState(false);

  // Activity types management
  const [activities, setActivities] = useState<ActivityType[]>([]);
  const [activitiesOpen, setActivitiesOpen] = useState(false);
  const [newActivityName, setNewActivityName] = useState('');
  const [newActivityColor, setNewActivityColor] = useState(ACTIVITY_PALETTE[0]);
  const [addingActivity, setAddingActivity] = useState(false);

  // Derive active team info from AuthContext
  const activeTeam = userTeams.find((t) => t.id === activeTeamId) ?? null;
  const role = activeTeam
    ? activeTeam.created_by === user?.id ? 'Admin' : 'Participant'
    : 'No Team';

  // Keep rename input in sync with active team
  React.useEffect(() => {
    setTeamNameEdit(activeTeam?.name ?? '');
  }, [activeTeam?.name]);

  const loadProfile = useCallback(async () => {
    if (!user) return;

    // Fetch profile, teammate IDs, clients, and activity types all in parallel
    const [{ data: profile }, { data: ids }, clientsList, activitiesList] = await Promise.all([
      supabase.from('profiles').select('full_name').eq('id', user.id).single(),
      supabase.rpc('get_teammate_ids', { p_user_id: user.id }),
      getClients().catch(() => [] as Client[]),
      getActivityTypes().catch(() => [] as ActivityType[]),
    ]);
    setFullName(profile?.full_name || user.user_metadata?.full_name || '');
    setClients(clientsList);
    setActivities(activitiesList);

    if (ids && (ids as string[]).length > 0) {
      const { data: members } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', ids as string[]);
      setTeamMembers((members ?? []) as Array<{ id: string; full_name: string }>);
    } else {
      setTeamMembers([]);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile])
  );

  async function handleRemoveMember(memberId: string, memberName: string) {
    if (!activeTeamId) return;
    Alert.alert(
      'Remove Member',
      `Remove ${memberName} from the team?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('team_members')
              .delete()
              .eq('user_id', memberId)
              .eq('team_id', activeTeamId);
            if (error) {
              setError(error.message);
            } else {
              await loadProfile();
            }
          },
        },
      ]
    );
  }

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

  function getLocalCutoff(period: 'day' | 'week' | 'month' | 'all'): string {
    if (period === 'all') return new Date(0).toISOString();
    const d = new Date();
    if (period === 'day') {
      d.setHours(0, 0, 0, 0);
    } else if (period === 'week') {
      d.setDate(d.getDate() - d.getDay());
      d.setHours(0, 0, 0, 0);
    } else if (period === 'month') {
      d.setDate(1);
      d.setHours(0, 0, 0, 0);
    }
    return d.toISOString();
  }

  async function handleRenameTeam() {
    if (!activeTeamId || !teamNameEdit.trim()) return;
    setSavingName(true);
    const { error } = await supabase
      .from('teams')
      .update({ name: teamNameEdit.trim() })
      .eq('id', activeTeamId)
      .eq('created_by', user!.id);
    setSavingName(false);
    if (error) {
      if (Platform.OS === 'web') window.alert(`Error: ${error.message}`);
      else Alert.alert('Error', error.message);
    } else {
      if (Platform.OS === 'web') window.location.reload();
      else router.replace('/');
    }
  }

  async function handleDeleteTeam() {
    if (!activeTeamId) return;
    const confirmMsg = `Delete team "${activeTeam?.name}"?\n\nThis will remove the team and all its data permanently. This cannot be undone.`;
    const doDelete = async () => {
      const { error } = await supabase
        .from('teams')
        .delete()
        .eq('id', activeTeamId)
        .eq('created_by', user!.id);
      if (error) {
        if (Platform.OS === 'web') window.alert(`Error: ${error.message}`);
        else Alert.alert('Error', error.message);
      } else {
        if (Platform.OS === 'web') window.location.reload();
        else router.replace('/');
      }
    };
    if (Platform.OS === 'web') {
      if (window.confirm(confirmMsg)) doDelete();
    } else {
      Alert.alert('Delete Team', confirmMsg, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDelete },
      ]);
    }
  }

  async function handleFlush(period: 'day' | 'week' | 'month' | 'all') {
    if (!activeTeamId) return;
    const periodLabel = { day: 'today', week: 'this week', month: 'this month', all: 'ALL TIME' }[period];
    const confirmMsg = `Delete all session logs from ${periodLabel}?\n\nThis cannot be undone.`;

    const doFlush = async () => {
      try {
        const { data, error } = await supabase.rpc('admin_flush_sessions', {
          p_cutoff: getLocalCutoff(period),
          p_team_id: activeTeamId,
        });
        if (error) throw error;
        const count = data ?? 0;
        const doneMsg = `${count} session${count !== 1 ? 's' : ''} deleted.`;
        if (Platform.OS === 'web') window.alert(doneMsg);
        else Alert.alert('Done', doneMsg);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Could not delete sessions.';
        if (Platform.OS === 'web') window.alert(`Error: ${msg}`);
        else Alert.alert('Error', msg);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(confirmMsg)) doFlush();
    } else {
      Alert.alert('Delete Session Logs', confirmMsg, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doFlush },
      ]);
    }
  }

  async function handleAddClient() {
    if (!newClientName.trim()) return;
    setAddingClient(true);
    try {
      await createClient(newClientName.trim());
      setNewClientName('');
      const data = await getClients();
      setClients(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not create client.';
      if (Platform.OS === 'web') window.alert(msg); else Alert.alert('Error', msg);
    } finally {
      setAddingClient(false);
    }
  }

  async function handleAddActivity() {
    if (!newActivityName.trim()) return;
    setAddingActivity(true);
    try {
      await createActivityType(newActivityName.trim(), newActivityColor);
      setNewActivityName('');
      setNewActivityColor(ACTIVITY_PALETTE[0]);
      const data = await getActivityTypes();
      setActivities(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not create activity type.';
      if (Platform.OS === 'web') window.alert(msg); else Alert.alert('Error', msg);
    } finally {
      setAddingActivity(false);
    }
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
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Navbar />
      <ScrollView style={styles.inner} contentContainerStyle={{ paddingBottom: 32 }}>
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
          <Text style={styles.value}>{activeTeam?.name || 'No team yet'}</Text>

          {activeTeam?.code ? (
            <>
              <Text style={styles.label}>Team Code</Text>
              <Text style={styles.value}>{activeTeam.code}</Text>
            </>
          ) : null}

          <Text style={styles.label}>Role</Text>
          <Text style={[styles.value, role === 'Admin' && styles.adminRole]}>{role}</Text>
        </View>

        {/* Team Switcher */}
        {userTeams.length > 0 && (
          <View style={styles.teamsCard}>
            <Text style={styles.label}>My Teams</Text>
            {userTeams.map((team) => {
              const isActive = team.id === activeTeamId;
              return (
                <TouchableOpacity
                  key={team.id}
                  style={[styles.teamRow, isActive && styles.teamRowActive]}
                  onPress={() => !isActive && switchTeam(team.id)}
                  activeOpacity={isActive ? 1 : 0.7}
                >
                  <View style={styles.teamRowLeft}>
                    <View style={[styles.teamDot, isActive && styles.teamDotActive]} />
                    <Text style={[styles.teamName, isActive && styles.teamNameActive]}>
                      {team.name}
                    </Text>
                  </View>
                  {isActive ? (
                    <Text style={styles.teamActiveBadge}>Active</Text>
                  ) : (
                    <Text style={styles.teamSwitch}>Switch</Text>
                  )}
                </TouchableOpacity>
              );
            })}
            {/* Team members subsection */}
            {teamMembers.length > 0 && (
              <View style={styles.membersSection}>
                <Text style={styles.membersTitle}>Members</Text>
                {teamMembers.map((member) => (
                  <View key={member.id} style={styles.memberRow}>
                    <View style={styles.memberAvatar}>
                      <Text style={styles.memberInitial}>
                        {(member.full_name ?? '?').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.memberName}>
                      {member.full_name ?? 'Unknown'}
                      {member.id === user?.id ? ' (you)' : ''}
                    </Text>
                    {role === 'Admin' && member.id !== user?.id && (
                      <TouchableOpacity
                        style={styles.removeBtn}
                        onPress={() => handleRemoveMember(member.id, member.full_name ?? 'this member')}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.removeBtnText}>Remove</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Join team if not in any */}
        {userTeams.length === 0 && (
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
        )}

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => router.push('/create-team')}
          activeOpacity={0.85}
        >
          <Text style={styles.secondaryBtnText}>Create New Team</Text>
        </TouchableOpacity>

        {/* Admin: Session Log Management */}
        {role === 'Admin' && activeTeamId && (
          <View style={styles.adminCard}>
            <Text style={styles.adminCardTitle}>Team Management</Text>

            {/* Rename team */}
            <Text style={styles.label}>Team Name</Text>
            <View style={styles.renameRow}>
              <TextInput
                style={styles.renameInput}
                value={teamNameEdit}
                onChangeText={setTeamNameEdit}
                placeholder="Team name"
                placeholderTextColor="#4a6d80"
                autoCapitalize="words"
              />
              <TouchableOpacity
                style={[styles.renameBtn, (savingName || !teamNameEdit.trim() || teamNameEdit.trim() === activeTeam?.name) && styles.btnDisabled]}
                onPress={handleRenameTeam}
                disabled={savingName || !teamNameEdit.trim() || teamNameEdit.trim() === activeTeam?.name}
                activeOpacity={0.8}
              >
                <Text style={styles.renameBtnText}>{savingName ? '…' : 'Save'}</Text>
              </TouchableOpacity>
            </View>

            {/* Delete team */}
            <TouchableOpacity
              style={styles.deleteTeamBtn}
              onPress={handleDeleteTeam}
              activeOpacity={0.8}
            >
              <Text style={styles.deleteTeamBtnText}>Delete Team</Text>
            </TouchableOpacity>

            <View style={styles.adminDivider} />
            <Text style={styles.adminCardTitle}>Session Log Management</Text>
            <Text style={styles.adminCardHint}>
              Permanently deletes session records for this team. Admin only.
            </Text>
            {(
              [
                { period: 'day',   label: 'Flush Today' },
                { period: 'week',  label: 'Flush This Week' },
                { period: 'month', label: 'Flush This Month' },
                { period: 'all',   label: 'Flush All Logs' },
              ] as const
            ).map(({ period, label }) => (
              <TouchableOpacity
                key={period}
                style={[styles.flushBtn, period === 'all' && styles.flushBtnAll]}
                onPress={() => handleFlush(period)}
                activeOpacity={0.8}
              >
                <Text style={styles.flushBtnText}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Clients & Activity Types (all team members) */}
        {activeTeamId && (
          <>
            {/* Clients card */}
            <View style={styles.dataCard}>
              <TouchableOpacity
                style={styles.dataCardHeader}
                onPress={() => setClientsOpen((v) => !v)}
                activeOpacity={0.8}
              >
                <Text style={styles.dataCardTitle}>Clients</Text>
                <Text style={styles.dataCardChevron}>{clientsOpen ? '▲' : '▼'}</Text>
              </TouchableOpacity>
              {clientsOpen && (
                <View style={styles.dataCardBody}>
                  {clients.length === 0 ? (
                    <Text style={styles.dataCardEmpty}>No clients yet.</Text>
                  ) : (
                    clients.map((c) => (
                      <View key={c.id} style={styles.dataRow}>
                        <Text style={styles.dataRowText}>{c.name}</Text>
                        {c.is_internal && <Text style={styles.internalBadge}>Internal</Text>}
                      </View>
                    ))
                  )}
                  <View style={styles.dataAddRow}>
                    <TextInput
                      style={styles.dataInput}
                      placeholder="New client name"
                      placeholderTextColor="#4a6d80"
                      value={newClientName}
                      onChangeText={setNewClientName}
                    />
                    <TouchableOpacity
                      style={[styles.dataAddBtn, (!newClientName.trim() || addingClient) && styles.btnDisabled]}
                      onPress={handleAddClient}
                      disabled={!newClientName.trim() || addingClient}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.dataAddBtnText}>Add</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>

            {/* Activity Types card */}
            <View style={styles.dataCard}>
              <TouchableOpacity
                style={styles.dataCardHeader}
                onPress={() => setActivitiesOpen((v) => !v)}
                activeOpacity={0.8}
              >
                <Text style={styles.dataCardTitle}>Activity Types</Text>
                <Text style={styles.dataCardChevron}>{activitiesOpen ? '▲' : '▼'}</Text>
              </TouchableOpacity>
              {activitiesOpen && (
                <View style={styles.dataCardBody}>
                  {activities.length === 0 ? (
                    <Text style={styles.dataCardEmpty}>No activity types yet.</Text>
                  ) : (
                    activities.map((a) => (
                      <View key={a.id} style={styles.dataRow}>
                        <View style={[styles.dataColorDot, { backgroundColor: a.color }]} />
                        <Text style={styles.dataRowText}>{a.name}</Text>
                      </View>
                    ))
                  )}
                  <Text style={styles.dataSubLabel}>Name</Text>
                  <TextInput
                    style={[styles.dataInput, { marginBottom: 8 }]}
                    placeholder="e.g. Development"
                    placeholderTextColor="#4a6d80"
                    value={newActivityName}
                    onChangeText={setNewActivityName}
                  />
                  <Text style={styles.dataSubLabel}>Color</Text>
                  <View style={styles.colorPickerRow}>
                    {ACTIVITY_PALETTE.map((c) => (
                      <TouchableOpacity
                        key={c}
                        style={[styles.colorDot, { backgroundColor: c }, newActivityColor === c && styles.colorSelected]}
                        onPress={() => setNewActivityColor(c)}
                      />
                    ))}
                  </View>
                  <TouchableOpacity
                    style={[styles.dataAddBtnFull, (!newActivityName.trim() || addingActivity) && styles.btnDisabled]}
                    onPress={handleAddActivity}
                    disabled={!newActivityName.trim() || addingActivity}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.dataAddBtnText}>Add Activity Type</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </>
        )}

        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={handleLogout}
          activeOpacity={0.85}
        >
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1e3545',
  },
  inner: {
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
  teamsCard: {
    marginTop: 16,
    backgroundColor: '#233d4d',
    borderWidth: 1,
    borderColor: '#2d4f62',
    borderRadius: 14,
    overflow: 'hidden',
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2d4f62',
  },
  teamRowActive: {
    backgroundColor: '#fe7f2d18',
  },
  teamRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  teamDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4a6d80',
  },
  teamDotActive: {
    backgroundColor: '#fe7f2d',
  },
  teamName: {
    color: '#7aa3b8',
    fontSize: 15,
    fontWeight: '500',
  },
  teamNameActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  teamActiveBadge: {
    color: '#fe7f2d',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  teamSwitch: {
    color: '#7aa3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  membersSection: {
    borderTopWidth: 1,
    borderTopColor: '#2d4f62',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
  },
  membersTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#7aa3b8',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  memberAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#2d4f62',
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberInitial: {
    color: '#fe7f2d',
    fontSize: 13,
    fontWeight: '700',
  },
  memberName: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  removeBtn: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EF444466',
  },
  removeBtnText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '600',
  },
  joinBtn: {
    marginTop: 10,
    backgroundColor: '#2d4f62',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  joinBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },

  renameRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  renameInput: {
    flex: 1,
    backgroundColor: '#1e3545',
    borderWidth: 1,
    borderColor: '#2d4f62',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#ffffff',
  },
  renameBtn: {
    backgroundColor: '#fe7f2d',
    borderRadius: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  renameBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  deleteTeamBtn: {
    backgroundColor: '#EF444415',
    borderWidth: 1,
    borderColor: '#EF444455',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 4,
  },
  deleteTeamBtnText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '600',
  },
  adminDivider: {
    height: 1,
    backgroundColor: '#2d4f62',
    marginVertical: 16,
  },
  // Admin flush card
  adminCard: {
    marginTop: 16,
    backgroundColor: '#233d4d',
    borderWidth: 1,
    borderColor: '#EF444433',
    borderRadius: 14,
    padding: 16,
  },
  adminCardTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EF4444',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  adminCardHint: {
    fontSize: 12,
    color: '#4a6d80',
    marginBottom: 14,
    lineHeight: 17,
  },
  flushBtn: {
    backgroundColor: '#2d4f62',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    marginBottom: 8,
  },
  flushBtnAll: {
    backgroundColor: '#EF444415',
    borderWidth: 1,
    borderColor: '#EF444455',
    marginBottom: 0,
  },
  flushBtnText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '600',
  },

  // Clients / Activity Types cards
  dataCard: {
    marginTop: 16,
    backgroundColor: '#233d4d',
    borderWidth: 1,
    borderColor: '#2d4f62',
    borderRadius: 14,
    overflow: 'hidden',
  },
  dataCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dataCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  dataCardChevron: {
    fontSize: 10,
    color: '#4a6d80',
  },
  dataCardBody: {
    borderTopWidth: 1,
    borderTopColor: '#2d4f62',
    padding: 16,
    gap: 6,
  },
  dataCardEmpty: {
    color: '#4a6d80',
    fontSize: 13,
    marginBottom: 8,
  },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2d4f62',
  },
  dataColorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    flexShrink: 0,
  },
  dataRowText: {
    flex: 1,
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '500',
  },
  internalBadge: {
    fontSize: 11,
    color: '#7aa3b8',
    backgroundColor: '#2d4f62',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    fontWeight: '600',
  },
  dataAddRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  dataSubLabel: {
    fontSize: 10,
    color: '#7aa3b8',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontWeight: '700',
    marginTop: 10,
    marginBottom: 4,
  },
  dataInput: {
    flex: 1,
    backgroundColor: '#1e3545',
    borderWidth: 1,
    borderColor: '#2d4f62',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#ffffff',
  },
  dataAddBtn: {
    backgroundColor: '#fe7f2d',
    borderRadius: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dataAddBtnFull: {
    backgroundColor: '#fe7f2d',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  dataAddBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  colorPickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 4,
  },
  colorDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  colorSelected: {
    borderWidth: 3,
    borderColor: '#ffffff',
  },
});
