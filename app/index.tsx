import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import SessionItem from '../components/SessionItem';
import {
  getActiveSession,
  getActiveSessions,
  getTodaySessions,
  getTodayTotalMinutes,
} from '../database/storage';
import { Session } from '../database/types';
import { useAuth } from '../contexts/AuthContext';
import { formatMinutes } from '../utils/time';

type Tab = 'mine' | 'team';

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [todayMinutes, setTodayMinutes] = useState(0);
  const [todaySessions, setTodaySessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [activeTab, setActiveTab] = useState<Tab>('mine');
  const [liveTeam, setLiveTeam] = useState<Session[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useFocusEffect(
    useCallback(() => {
      async function load() {
        const active = await getActiveSession();
        setActiveSession(active);
        setTodayMinutes(await getTodayTotalMinutes());
        setTodaySessions(await getTodaySessions());
        const all = await getActiveSessions();
        setLiveTeam(all.filter((s) => s.user_id !== user?.id));
      }
      load();
    }, [user])
  );

  // Single shared tick for all live teammate timers
  useEffect(() => {
    if (liveTeam.length === 0) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [liveTeam.length]);

  // Live elapsed timer when clocked in
  useEffect(() => {
    if (!activeSession) {
      setElapsedSeconds(0);
      return;
    }
    const startMs = new Date(activeSession.start_time).getTime();
    const breakSecs = activeSession.total_break_seconds ?? 0;
    const tick = () => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startMs) / 1000) - breakSecs));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [activeSession]);

  function handleClockPress() {
    Animated.sequence([
      Animated.spring(pulseAnim, { toValue: 0.88, useNativeDriver: true, speed: 40, bounciness: 0 }),
      Animated.spring(pulseAnim, { toValue: 1, useNativeDriver: true, speed: 16, bounciness: 8 }),
    ]).start();
    if (activeSession) {
      router.push('/working');
    } else {
      router.push('/clock-in');
    }
  }

  const mySessions = todaySessions.filter((s) => s.user_id === user?.id);
  const teamSessions = todaySessions.filter((s) => s.user_id !== user?.id);

  const myProjectTotals = mySessions.reduce<Record<string, { name: string; minutes: number }>>(
    (acc, session) => {
      const key = String(session.project_id);
      if (!acc[key]) acc[key] = { name: session.project_name ?? 'Unknown', minutes: 0 };
      acc[key].minutes += session.duration_minutes ?? 0;
      return acc;
    },
    {}
  );

  const topProject = Object.values(myProjectTotals).sort((a, b) => b.minutes - a.minutes)[0];
  const averageMinutes = mySessions.length > 0 ? Math.round(todayMinutes / mySessions.length) : 0;
  const fullName = (user?.user_metadata?.full_name as string | undefined)?.trim() ?? '';
  const firstName = fullName.split(/\s+/).filter(Boolean)[0] ?? 'User';

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero — context-aware */}
        {activeSession ? (
          <View style={[styles.hero, styles.heroActive]}>
            <Text style={styles.heroActiveLabel}>Currently working on</Text>
            <Text style={styles.heroActiveProject}>{activeSession.project_name ?? 'Unknown'}</Text>
            <Text style={styles.heroTimer}>{formatElapsed(elapsedSeconds)}</Text>
            <TouchableOpacity
              style={styles.heroViewBtn}
              onPress={() => router.push('/working')}
              activeOpacity={0.75}
            >
              <Text style={styles.heroViewBtnText}>View details →</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.hero}>
            <Text style={styles.heroHeading}>Turn time into progress, {firstName}!</Text>
            <Text style={styles.heroLabel}>Today</Text>
            <Text style={styles.heroTime}>
              {todayMinutes === 0 ? '0m' : formatMinutes(todayMinutes)}
            </Text>
          </View>
        )}

        {/* Analytics snapshot */}
        <TouchableOpacity
          style={styles.snapshotCard}
          onPress={() => router.push('/stats')}
          activeOpacity={0.85}
        >
          <View style={styles.snapshotHeader}>
            <Text style={styles.snapshotTitle}>Analytics Snapshot</Text>
            <Text style={styles.snapshotLink}>View Details</Text>
          </View>
          <View style={styles.snapshotRow}>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Sessions</Text>
              <Text style={styles.metricValue}>{mySessions.length}</Text>
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

        {/* Live Now — teammates currently working */}
        {liveTeam.length > 0 && (
          <View style={styles.liveCard}>
            <View style={styles.liveHeader}>
              <View style={styles.liveDot} />
              <Text style={styles.liveTitle}>Live Now</Text>
              <Text style={styles.liveCount}>{liveTeam.length}</Text>
            </View>
            {liveTeam.map((s) => {
              const elapsedSec = Math.max(0, Math.floor((now - new Date(s.start_time).getTime()) / 1000));
              const h = Math.floor(elapsedSec / 3600);
              const m = Math.floor((elapsedSec % 3600) / 60);
              const elapsed = h > 0 ? `${h}h ${m}m` : `${m}m`;
              return (
                <View key={s.id} style={styles.liveRow}>
                  <View style={[styles.liveProjDot, { backgroundColor: s.project_color ?? '#ccc' }]} />
                  <Text style={styles.liveName} numberOfLines={1}>
                    {s.user_full_name ?? 'Teammate'}
                  </Text>
                  <Text style={styles.liveProject} numberOfLines={1}>
                    {s.project_name ?? '—'}
                  </Text>
                  <Text style={styles.liveElapsed}>{elapsed}</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Tabbed sessions */}
        <View style={styles.sessionsCard}>
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'mine' && styles.tabBtnActive]}
              onPress={() => setActiveTab('mine')}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabLabel, activeTab === 'mine' && styles.tabLabelActive]}>
                Your Sessions
              </Text>
              {mySessions.length > 0 && (
                <View style={[styles.tabBadge, activeTab === 'mine' && styles.tabBadgeActive]}>
                  <Text style={[styles.tabBadgeText, activeTab === 'mine' && styles.tabBadgeTextActive]}>
                    {mySessions.length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'team' && styles.tabBtnActive]}
              onPress={() => setActiveTab('team')}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabLabel, activeTab === 'team' && styles.tabLabelActive]}>
                Team Sessions
              </Text>
              {teamSessions.length > 0 && (
                <View style={[styles.tabBadge, activeTab === 'team' && styles.tabBadgeActive]}>
                  <Text style={[styles.tabBadgeText, activeTab === 'team' && styles.tabBadgeTextActive]}>
                    {teamSessions.length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {activeTab === 'mine' ? (
            <>
              {Array.from({ length: 4 }, (_, i) => {
                const item = mySessions[i];
                return item ? (
                  <SessionItem key={item.id} session={item} hideMember />
                ) : (
                  <View key={`my-empty-${i}`} style={styles.placeholderRow}>
                    <View style={styles.placeholderDot} />
                    <Text style={styles.placeholderText}>Your Next Session</Text>
                  </View>
                );
              })}
              <TouchableOpacity
                style={styles.seeAllRow}
                onPress={() => router.push('/history')}
                activeOpacity={0.7}
              >
                <Text style={styles.seeAllText}>View more →</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {Array.from({ length: 4 }, (_, i) => {
                const item = teamSessions[i];
                return item ? (
                  <SessionItem key={item.id} session={item} prominentMember />
                ) : (
                  <View key={`team-empty-${i}`} style={styles.placeholderRow}>
                    <View style={styles.placeholderDot} />
                    <Text style={styles.placeholderText}>Your Next Session</Text>
                  </View>
                );
              })}
              <TouchableOpacity
                style={styles.seeAllRow}
                onPress={() => router.push('/history')}
                activeOpacity={0.7}
              >
                <Text style={styles.seeAllText}>View more →</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <TouchableOpacity
          style={styles.analyticsBtn}
          onPress={() => router.push('/stats')}
          activeOpacity={0.85}
        >
          <Text style={styles.analyticsBtnText}>Analytics</Text>
        </TouchableOpacity>

        {/* Space for bottom bar */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Fixed bottom action bar */}
      <View style={styles.bottomBar}>
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <TouchableOpacity
            style={[styles.clockBtn, activeSession && styles.clockBtnActive]}
            onPress={handleClockPress}
            activeOpacity={0.9}
          >
            <Image
              source={require('../assets/clock-logo.png')}
              style={styles.clockLogo}
              resizeMode="contain"
            />
            <Text style={styles.clockBtnText}>
              {activeSession ? 'Clock Out' : 'Clock In'}
            </Text>
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
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 16,
  },

  // Hero — idle
  hero: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
    backgroundColor: '#233d4d',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2d4f62',
  },
  heroHeading: {
    fontSize: 26,
    color: '#ffffff',
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  heroLabel: {
    fontSize: 12,
    color: '#7aa3b8',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 6,
    fontWeight: '600',
  },
  heroTime: {
    fontSize: 52,
    fontWeight: '300',
    color: '#ffffff',
    letterSpacing: -1,
  },

  // Hero — active session
  heroActive: {
    borderColor: '#fe7f2d44',
    backgroundColor: '#1e3545',
    borderWidth: 1.5,
  },
  heroActiveLabel: {
    fontSize: 12,
    color: '#7aa3b8',
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontWeight: '600',
    marginBottom: 6,
  },
  heroActiveProject: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 10,
  },
  heroTimer: {
    fontSize: 44,
    fontWeight: '200',
    color: '#fe7f2d',
    letterSpacing: 2,
    fontVariant: ['tabular-nums'],
  },
  heroViewBtn: {
    marginTop: 12,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#fe7f2d55',
  },
  heroViewBtnText: {
    color: '#fe7f2d',
    fontSize: 13,
    fontWeight: '600',
  },

  // Snapshot card
  snapshotCard: {
    marginTop: 12,
    backgroundColor: '#233d4d',
    borderWidth: 1,
    borderColor: '#2d4f62',
    borderRadius: 16,
    padding: 16,
  },
  snapshotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  snapshotTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  snapshotLink: {
    color: '#fe7f2d',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  snapshotRow: {
    flexDirection: 'row',
    gap: 8,
  },
  metricItem: {
    flex: 1,
    backgroundColor: '#1e3545',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2d4f62',
    paddingVertical: 10,
    paddingHorizontal: 10,
    minHeight: 72,
  },
  metricLabel: {
    color: '#7aa3b8',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontWeight: '700',
    marginBottom: 5,
  },
  metricValue: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 26,
  },
  metricValueSmall: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  metricHint: {
    color: '#fe7f2d',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },

  // Live Now card
  liveCard: {
    marginTop: 12,
    backgroundColor: '#233d4d',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2d4f62',
    overflow: 'hidden',
  },
  liveHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2d4f62',
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#4ade80',
  },
  liveTitle: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    color: '#7aa3b8',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  liveCount: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4ade80',
  },
  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#2d4f62',
  },
  liveProjDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  liveName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    flex: 1,
  },
  liveProject: {
    fontSize: 13,
    color: '#7aa3b8',
    flex: 1,
    textAlign: 'right',
  },
  liveElapsed: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fe7f2d',
    marginLeft: 10,
    minWidth: 36,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },

  // Sessions tab card
  sessionsCard: {
    marginTop: 12,
    backgroundColor: '#233d4d',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2d4f62',
    overflow: 'hidden',
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#2d4f62',
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: '#fe7f2d',
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4a6d80',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  tabLabelActive: {
    color: '#fe7f2d',
  },
  tabBadge: {
    backgroundColor: '#2d4f62',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  tabBadgeActive: {
    backgroundColor: '#fe7f2d22',
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#7aa3b8',
  },
  tabBadgeTextActive: {
    color: '#fe7f2d',
  },
  empty: {
    padding: 24,
    textAlign: 'center',
    color: '#7aa3b8',
    fontSize: 13,
  },
  placeholderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2d4f6230',
    gap: 14,
  },
  placeholderDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2d4f62',
  },
  placeholderText: {
    fontSize: 13,
    color: '#2d4f62',
    fontStyle: 'italic',
  },
  seeAllRow: {
    paddingVertical: 12,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#2d4f62',
  },
  seeAllText: {
    color: '#fe7f2d',
    fontSize: 13,
    fontWeight: '600',
  },

  analyticsBtn: {
    marginTop: 12,
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
  analyticsBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },

  // Fixed bottom action bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1e3545',
    borderTopWidth: 1,
    borderTopColor: '#2d4f62',
    paddingTop: 12,
    paddingBottom: 24,
    alignItems: 'center',
  },
  clockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fe7f2d',
    paddingVertical: 14,
    paddingHorizontal: 36,
    borderRadius: 32,
    shadowColor: '#fe7f2d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 8,
  },
  clockBtnActive: {
    backgroundColor: '#e05a1a',
  },
  clockLogo: {
    width: 28,
    height: 28,
  },
  clockBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
