import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Timer from '../components/Timer';
import { clockOut, endBreak, getActiveSession, startBreak } from '../database/storage';
import { Session } from '../database/types';

export default function WorkingScreen() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    getActiveSession().then((active) => {
      if (!active) {
        router.replace('/');
        return;
      }
      setSession(active);
    });
  }, []);

  async function refreshSession() {
    const active = await getActiveSession();
    if (active) setSession(active);
  }

  async function handleBreak() {
    if (!session) return;
    try {
      await startBreak(session.id);
      refreshSession();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not start break.';
      Alert.alert('Error', message);
    }
  }

  async function handleResume() {
    if (!session) return;
    try {
      await endBreak(session.id);
      refreshSession();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not resume session.';
      Alert.alert('Error', message);
    }
  }

  function handleClockOut() {
    const doClockOut = async () => {
      if (session) {
        try {
          await clockOut(session.id);
          router.replace({ pathname: '/session-recap', params: { sessionId: String(session.id) } });
        } catch (e) {
          const message = e instanceof Error ? e.message : 'Could not clock out.';
          Alert.alert('Error', message);
        }
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Stop this session?')) doClockOut();
    } else {
      Alert.alert('Clock Out', 'Stop this session?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clock Out', style: 'destructive', onPress: doClockOut },
      ]);
    }
  }

  if (!session) return null;

  const onBreak = !!session.break_start;

  return (
    <SafeAreaView style={styles.container}>
      {/* Project badge */}
      <View style={styles.top}>
        <View
          style={[
            styles.projectBadge,
            { backgroundColor: (session.project_color ?? '#ccc') + '30' },
          ]}
        >
          <View style={[styles.dot, { backgroundColor: session.project_color }]} />
          <Text style={[styles.projectName, { color: session.project_color }]}>
            {session.project_name}
          </Text>
        </View>
      </View>

      {/* Timer area */}
      <View style={styles.timerWrapper}>
        <Text style={styles.label}>
          {onBreak ? 'On Break' : 'Time Elapsed'}
        </Text>
        <Timer
          startTime={session.start_time}
          totalBreakSeconds={session.total_break_seconds ?? 0}
          breakStart={session.break_start}
        />
        {onBreak ? (
          <View style={styles.breakBadge}>
            <View style={styles.breakDot} />
            <Text style={styles.breakBadgeText}>Timer paused</Text>
          </View>
        ) : (
          <>
            <View style={styles.divider} />
            <Text style={styles.statusText}>Session in progress</Text>
          </>
        )}
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        {onBreak ? (
          <TouchableOpacity
            style={styles.resumeBtn}
            onPress={handleResume}
            activeOpacity={0.85}
          >
            <Text style={styles.resumeText}>Resume</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.breakBtn}
            onPress={handleBreak}
            activeOpacity={0.85}
          >
            <Text style={styles.breakText}>Take a Break</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.clockOutBtn}
          onPress={handleClockOut}
          activeOpacity={0.85}
        >
          <Text style={styles.clockOutText}>Clock Out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1e3545',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  top: {
    alignItems: 'center',
  },
  projectBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 100,
    gap: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  projectName: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  timerWrapper: {
    alignItems: 'center',
  },
  label: {
    fontSize: 11,
    color: '#7aa3b8',
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontWeight: '700',
    marginBottom: 16,
  },
  breakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 24,
    backgroundColor: '#2d4f62',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 100,
  },
  breakDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#fe7f2d',
  },
  breakBadgeText: {
    fontSize: 12,
    color: '#fe7f2d',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  divider: {
    width: 40,
    height: 2,
    backgroundColor: '#2d4f62',
    borderRadius: 2,
    marginTop: 28,
    marginBottom: 16,
  },
  statusText: {
    fontSize: 13,
    color: '#7aa3b8',
    letterSpacing: 0.5,
  },
  actions: {
    width: '100%',
    gap: 12,
  },
  breakBtn: {
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
  breakText: {
    color: '#233d4d',
    fontSize: 16,
    fontWeight: '700',
  },
  resumeBtn: {
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
  resumeText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  clockOutBtn: {
    backgroundColor: '#EF4444',
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  clockOutText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
