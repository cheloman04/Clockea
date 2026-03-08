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
import { formatMinutes } from '../utils/time';

export default function HomeScreen() {
  const router = useRouter();
  const [todayMinutes, setTodayMinutes] = useState(0);
  const [todaySessions, setTodaySessions] = useState<Session[]>([]);

  useFocusEffect(
    useCallback(() => {
      const active = getActiveSession();
      if (active) {
        router.replace('/working');
        return;
      }
      setTodayMinutes(getTodayTotalMinutes());
      setTodaySessions(getTodaySessions());
    }, [])
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.heroHeading}>Ready to Create User?</Text>
        <Text style={styles.heroLabel}>Today</Text>
        <Text style={styles.heroTime}>
          {todayMinutes === 0 ? '0m' : formatMinutes(todayMinutes)}
        </Text>
      </View>

      <View style={styles.btnRow}>
        <TouchableOpacity
          style={styles.clockInBtn}
          onPress={() => router.push('/clock-in')}
          activeOpacity={0.85}
        >
          <Text style={styles.clockInText}>Clock In</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.analyticsBtn}
          onPress={() => router.push('/stats')}
          activeOpacity={0.85}
        >
          <Text style={styles.analyticsBtnText}>Analytics</Text>
        </TouchableOpacity>
      </View>

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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1e3545',
  },
  hero: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
    backgroundColor: '#233d4d',
    borderBottomWidth: 1,
    borderBottomColor: '#2d4f62',
  },
  heroHeading: {
    fontSize: 48,
    color: '#ffffff',
    fontWeight: '700',
    marginBottom: 12,
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
    fontSize: 64,
    fontWeight: '300',
    color: '#ffffff',
    letterSpacing: -1,
  },
  btnRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 28,
    gap: 10,
  },
  clockInBtn: {
    flex: 1,
    backgroundColor: '#fe7f2d',
    paddingVertical: 20,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#fe7f2d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  clockInText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  analyticsBtn: {
    backgroundColor: '#233d4d',
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2d4f62',
  },
  analyticsBtnText: {
    color: '#7aa3b8',
    fontSize: 15,
    fontWeight: '600',
  },
  section: {
    flex: 1,
    marginTop: 28,
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: '#233d4d',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2d4f62',
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
});
