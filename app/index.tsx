import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import SessionItem from '../components/SessionItem';
import {
  getActiveSession,
  getTodaySessions,
  getTodayTotalMinutes,
} from '../database/storage';
import { Session } from '../database/types';
import { useAuth } from '../contexts/AuthContext';
import { formatMinutes } from '../utils/time';

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [todayMinutes, setTodayMinutes] = useState(0);
  const [todaySessions, setTodaySessions] = useState<Session[]>([]);

  useFocusEffect(
    useCallback(() => {
      async function load() {
        const active = await getActiveSession();
        if (active) {
          router.replace('/working');
          return;
        }
        setTodayMinutes(await getTodayTotalMinutes());
        setTodaySessions(await getTodaySessions());
      }
      load();
    }, [])
  );

  const projectTotals = todaySessions.reduce<Record<string, { name: string; minutes: number }>>(
    (acc, session) => {
      const key = String(session.project_id);
      if (!acc[key]) {
        acc[key] = { name: session.project_name ?? 'Unknown', minutes: 0 };
      }
      acc[key].minutes += session.duration_minutes ?? 0;
      return acc;
    },
    {}
  );

  const topProject = Object.values(projectTotals).sort((a, b) => b.minutes - a.minutes)[0];
  const averageMinutes =
    todaySessions.length > 0 ? Math.round(todayMinutes / todaySessions.length) : 0;
  const fullName = (user?.user_metadata?.full_name as string | undefined)?.trim() ?? '';
  const firstName = fullName.split(/\s+/).filter(Boolean)[0] ?? 'User';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.profileIconBtn}
          onPress={() => router.push('/profile')}
          activeOpacity={0.85}
        >
          <View style={styles.profileIconHead} />
          <View style={styles.profileIconBody} />
        </TouchableOpacity>
      </View>

      <View style={styles.hero}>
        <Text style={styles.heroHeading}>Ready to Create, {firstName}?</Text>
        <Text style={styles.heroLabel}>Today</Text>
        <Text style={styles.heroTime}>
          {todayMinutes === 0 ? '0m' : formatMinutes(todayMinutes)}
        </Text>
      </View>

      <TouchableOpacity
        style={styles.snapshotCard}
        onPress={() => router.push('/stats')}
        activeOpacity={0.85}
      >
        <View style={styles.snapshotHeader}>
          <Text style={styles.snapshotTitle}>Analytics Snapshot</Text>
          <Text style={styles.snapshotLink}>View details</Text>
        </View>
        <View style={styles.snapshotRow}>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Sessions</Text>
            <Text style={styles.metricValue}>{todaySessions.length}</Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Focus Project</Text>
            <Text style={styles.metricValueSmall}>
              {topProject ? topProject.name : 'No data'}
            </Text>
            <Text style={styles.metricHint}>
              {topProject ? formatMinutes(Math.round(topProject.minutes)) : '0m'}
            </Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Avg / Session</Text>
            <Text style={styles.metricValue}>{averageMinutes}m</Text>
          </View>
        </View>
      </TouchableOpacity>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Sessions</Text>
          {todaySessions.length > 0 && (
            <TouchableOpacity onPress={() => router.push('/history')}>
              <Text style={styles.seeAll}>See all</Text>
            </TouchableOpacity>
          )}
        </View>

        {todaySessions.length === 0 ? (
          <Text style={styles.empty}>
            No sessions today.{'\n'}Tap Clock In to start tracking.
          </Text>
        ) : (
          <FlatList
            data={todaySessions}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => <SessionItem session={item} />}
          />
        )}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => router.push('/stats')}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryBtnText}>Analytics</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => router.push('/clock-in')}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryBtnText}>Clock In</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1e3545',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 20,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 16,
  },
  profileIconBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#fe7f2d',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#233d4d',
  },
  profileIconHead: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#fe7f2d',
    marginBottom: 3,
  },
  profileIconBody: {
    width: 22,
    height: 10,
    borderTopLeftRadius: 11,
    borderTopRightRadius: 11,
    backgroundColor: '#fe7f2d',
  },
  hero: {
    alignItems: 'center',
    paddingVertical: 18,
    backgroundColor: '#233d4d',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2d4f62',
  },
  heroHeading: {
    fontSize: 42,
    color: '#ffffff',
    fontWeight: '700',
    marginBottom: 10,
    letterSpacing: -1,
    textAlign: 'center',
  },
  heroLabel: {
    fontSize: 16,
    color: '#7aa3b8',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 12,
    fontWeight: '600',
  },
  heroTime: {
    fontSize: 56,
    fontWeight: '300',
    color: '#ffffff',
    letterSpacing: -1,
  },
  section: {
    flex: 1,
    marginTop: 14,
    marginBottom: 14,
    backgroundColor: '#233d4d',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2d4f62',
  },
  snapshotCard: {
    marginTop: 12,
    backgroundColor: '#233d4d',
    borderWidth: 1,
    borderColor: '#2d4f62',
    borderRadius: 14,
    padding: 14,
  },
  snapshotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  snapshotTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  snapshotLink: {
    color: '#fe7f2d',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  snapshotRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metricItem: {
    flex: 1,
    backgroundColor: '#1e3545',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2d4f62',
    paddingVertical: 10,
    paddingHorizontal: 10,
    minHeight: 76,
  },
  metricLabel: {
    color: '#7aa3b8',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontWeight: '700',
    marginBottom: 6,
  },
  metricValue: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 28,
  },
  metricValueSmall: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  metricHint: {
    color: '#fe7f2d',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#2d4f62',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7aa3b8',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  seeAll: {
    fontSize: 13,
    color: '#fe7f2d',
    fontWeight: '600',
  },
  empty: {
    padding: 32,
    textAlign: 'center',
    color: '#7aa3b8',
    fontSize: 15,
    lineHeight: 24,
  },
  actions: {
    gap: 12,
  },
  primaryBtn: {
    backgroundColor: '#fe7f2d',
    borderRadius: 14,
    alignItems: 'center',
    paddingVertical: 16,
    shadowColor: '#fe7f2d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
