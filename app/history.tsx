import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, Platform, SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import SessionItem from '../components/SessionItem';
import Navbar from '../components/Navbar';
import { deleteSession, getAllSessions, getIntervalsForSessions, getObjectivesForSessions, resumeSession } from '../database/storage';
import { Session, SessionInterval, SessionObjective } from '../database/types';
import { useAuth } from '../contexts/AuthContext';
import { formatDate, formatMinutes } from '../utils/time';

interface DaySection {
  title: string;
  totalMinutes: number;
  data: Session[];
}

function groupByDay(sessions: Session[]): DaySection[] {
  const map = new Map<string, Session[]>();
  for (const session of sessions) {
    const day = session.start_time.split('T')[0];
    if (!map.has(day)) map.set(day, []);
    map.get(day)!.push(session);
  }
  return Array.from(map.entries()).map(([day, items]) => ({
    title: formatDate(`${day}T00:00:00`),
    totalMinutes: items.reduce((sum, s) => sum + (s.duration_minutes ?? 0), 0),
    data: items,
  }));
}

export default function HistoryScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [sections, setSections] = useState<DaySection[]>([]);
  const [objectivesMap, setObjectivesMap] = useState<Record<number, SessionObjective[]>>({});
  const [intervalsMap, setIntervalsMap] = useState<Record<number, SessionInterval[]>>({});

  const load = useCallback(() => {
    getAllSessions().then(async (sessions) => {
      setSections(groupByDay(sessions));
      const ids = sessions.map((s) => s.id);
      const [objMap, ivMap] = await Promise.all([
        getObjectivesForSessions(ids),
        getIntervalsForSessions(ids),
      ]);
      setObjectivesMap(objMap);
      setIntervalsMap(ivMap);
    });
  }, []);

  useFocusEffect(load);

  async function handleResume(session: Session) {
    try {
      const breakSeconds = Math.floor((Date.now() - new Date(session.end_time!).getTime()) / 1000);
      await resumeSession(session.id, breakSeconds);
      router.replace('/working');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not resume session.';
      if (Platform.OS === 'web') { window.alert(msg); } else { Alert.alert('Error', msg); }
    }
  }

  function handleActions(session: Session) {
    if (Platform.OS === 'web') {
      // Alert.alert with multiple buttons is not supported on web
      const choice = window.prompt(
        `${session.project_name ?? 'Session'}\n\n1 – Edit Notes\n2 – Delete Session\n\nType a number:`,
      );
      if (choice === '1') {
        router.push({ pathname: '/edit-session', params: { id: String(session.id), notes: session.notes ?? '' } });
      } else if (choice === '2') {
        if (window.confirm(`Delete this ${session.project_name ?? 'session'}? This cannot be undone.`)) {
          deleteSession(session.id).then(load);
        }
      }
      return;
    }
    Alert.alert(session.project_name ?? 'Session', undefined, [
      {
        text: 'Edit Notes',
        onPress: () =>
          router.push({
            pathname: '/edit-session',
            params: { id: String(session.id), notes: session.notes ?? '' },
          }),
      },
      {
        text: 'Delete Session',
        style: 'destructive',
        onPress: () =>
          Alert.alert(
            'Delete Session',
            `Delete this ${session.project_name ?? 'session'}? This cannot be undone.`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => { await deleteSession(session.id); load(); },
              },
            ]
          ),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  if (sections.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <Text style={styles.empty}>No sessions recorded yet.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Navbar />
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <SessionItem
            session={item}
            objectives={objectivesMap[item.id]}
            intervals={intervalsMap[item.id]}
            onActions={item.user_id === user?.id ? () => handleActions(item) : undefined}
            onResume={item.user_id === user?.id && !!item.end_time ? () => handleResume(item) : undefined}
          />
        )}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionTotal}>
              {formatMinutes(section.totalMinutes)}
            </Text>
          </View>
        )}
        stickySectionHeadersEnabled
        contentContainerStyle={styles.list}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1e3545',
  },
  list: {
    paddingBottom: 40,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#1e3545',
    borderBottomWidth: 1,
    borderBottomColor: '#2d4f62',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7aa3b8',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  sectionTotal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fe7f2d',
  },
  empty: {
    textAlign: 'center',
    color: '#7aa3b8',
    fontSize: 16,
    marginTop: 80,
  },
});
