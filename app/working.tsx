import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MilestoneConfetti from '../components/MilestoneConfetti';
import TickingClock from '../components/TickingClock';
import Timer from '../components/Timer';
import {
  clockOut,
  endBreak,
  getActiveSession,
  getSessionObjectives,
  startBreak,
  toggleObjectiveComplete,
} from '../database/storage';
import { Session, SessionObjective } from '../database/types';
import { playClockOutSound } from '../utils/sounds';

export default function WorkingScreen() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [objectives, setObjectives] = useState<SessionObjective[]>([]);
  const [showClock, setShowClock] = useState(true);
  const [showConfetti, setShowConfetti] = useState(false);
  const milestone60Fired = useRef(false);
  const clockOutPressAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    getActiveSession().then((active) => {
      if (!active) {
        router.replace('/');
        return;
      }
      setSession(active);
      getSessionObjectives(active.id).then(setObjectives);
    });
  }, []);

  async function refreshSession() {
    const active = await getActiveSession();
    if (active) setSession(active);
  }

  // 60-minute milestone confetti — fires once per session
  useEffect(() => {
    if (!session || milestone60Fired.current) return;
    const startMs = new Date(session.start_time).getTime();
    const interval = setInterval(() => {
      const pastBreaks = session.total_break_seconds ?? 0;
      const currentBreak = session.break_start
        ? Math.floor((Date.now() - new Date(session.break_start).getTime()) / 1000)
        : 0;
      const elapsed = Math.floor((Date.now() - startMs) / 1000) - pastBreaks - currentBreak;
      if (elapsed >= 3600) {
        milestone60Fired.current = true;
        setShowConfetti(true);
        clearInterval(interval);
        setTimeout(() => setShowConfetti(false), 800);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [session]);

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

  async function handleToggleObjective(obj: SessionObjective) {
    const newCompleted = !obj.completed;
    // Optimistic update
    setObjectives((prev) =>
      prev.map((o) => (o.id === obj.id ? { ...o, completed: newCompleted } : o))
    );
    try {
      await toggleObjectiveComplete(obj.id, newCompleted);
    } catch {
      // Revert on error
      setObjectives((prev) =>
        prev.map((o) => (o.id === obj.id ? { ...o, completed: !newCompleted } : o))
      );
    }
  }

  function handleClockOut() {
    const doClockOut = async () => {
      if (session) {
        try {
          playClockOutSound();
          await clockOut(session.id);
          router.replace({
            pathname: '/session-recap',
            params: {
              sessionId: String(session.id),
              objective: session.objective ?? '',
            },
          });
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
  const completedCount = objectives.filter((o) => o.completed).length;
  const totalCount = objectives.length;

  return (
    <SafeAreaView style={styles.container}>
      <TickingClock visible={showClock} onDone={() => setShowClock(false)} />
      <MilestoneConfetti visible={showConfetti} />
      {/* Top bar: back + project badge */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.replace('/')} activeOpacity={0.7}>
          <Text style={styles.backText}>← Dashboard</Text>
        </TouchableOpacity>
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

      {/* Scrollable middle: timer + checklist */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Timer */}
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

        {/* Objectives checklist */}
        {totalCount > 0 && (
          <View style={styles.checklist}>
            <View style={styles.checklistHeader}>
              <Text style={styles.checklistTitle}>Objectives</Text>
              <Text style={[
                styles.checklistProgress,
                completedCount === totalCount && styles.checklistProgressDone,
              ]}>
                {completedCount} / {totalCount}
              </Text>
            </View>
            {objectives.map((obj) => (
              <TouchableOpacity
                key={obj.id}
                style={styles.checkItem}
                onPress={() => handleToggleObjective(obj)}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, obj.completed && styles.checkboxDone]}>
                  {obj.completed && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={[styles.checkText, obj.completed && styles.checkTextDone]}>
                  {obj.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Fixed actions */}
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

        <Animated.View style={{ transform: [{ scale: clockOutPressAnim }] }}>
        <TouchableOpacity
          style={styles.clockOutBtn}
          onPress={handleClockOut}
          onPressIn={() => Animated.timing(clockOutPressAnim, { toValue: 0.96, duration: 120, useNativeDriver: true }).start()}
          onPressOut={() => Animated.timing(clockOutPressAnim, { toValue: 1, duration: 150, useNativeDriver: true }).start()}
          activeOpacity={0.85}
        >
          <Text style={styles.clockOutText}>Clock Out</Text>
        </TouchableOpacity>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1e3545',
  },
  topBar: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 14,
  },
  backText: {
    fontSize: 14,
    color: '#7aa3b8',
    fontWeight: '600',
  },
  projectBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    alignItems: 'center',
    gap: 32,
  },
  timerWrapper: {
    alignItems: 'center',
    paddingTop: 24,
    width: '100%',
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

  // Checklist
  checklist: {
    width: '100%',
    backgroundColor: '#233d4d',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2d4f62',
    overflow: 'hidden',
  },
  checklistHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2d4f62',
  },
  checklistTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7aa3b8',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  checklistProgress: {
    fontSize: 13,
    fontWeight: '700',
    color: '#7aa3b8',
  },
  checklistProgressDone: {
    color: '#4ade80',
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2d4f62',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#4a6d80',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkboxDone: {
    backgroundColor: '#4ade80',
    borderColor: '#4ade80',
  },
  checkmark: {
    fontSize: 13,
    color: '#1e3545',
    fontWeight: '700',
  },
  checkText: {
    flex: 1,
    fontSize: 14,
    color: '#ffffff',
    lineHeight: 20,
  },
  checkTextDone: {
    color: '#4a6d80',
    textDecorationLine: 'line-through',
  },

  // Actions
  actions: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 32,
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
