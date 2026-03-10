import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { G, Path, Svg, Text as SvgText } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import Navbar from '../components/Navbar';
import { getSessionsInRange } from '../database/storage';
import { useAuth } from '../contexts/AuthContext';
import { formatMinutes } from '../utils/time';
import { Session } from '../database/types';

// ── Types ──────────────────────────────────────────────────────────────────────

type Period = 'daily' | 'weekly' | 'monthly';
type Dimension = 'project' | 'client' | 'activity';

interface Stat {
  key: string;
  name: string;
  color: string;
  total_minutes: number;
  percentage: number;
}

interface DayTrend {
  label: string;
  minutes: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CLIENT_PALETTE = [
  '#7aa3b8', '#fe7f2d', '#60a5fa', '#f87171',
  '#c084fc', '#4ade80', '#fbbf24', '#34d399',
];

const PERIODS: { key: Period; label: string }[] = [
  { key: 'daily', label: 'Today' },
  { key: 'weekly', label: 'This Week' },
  { key: 'monthly', label: 'This Month' },
];

const DIMENSIONS: { key: Dimension; label: string }[] = [
  { key: 'project', label: 'Project' },
  { key: 'client', label: 'Client' },
  { key: 'activity', label: 'Activity' },
];

// ── Pure data functions ────────────────────────────────────────────────────────

function getRangeISO(period: Period): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString();
  if (period === 'daily') {
    const from = new Date(now);
    from.setHours(0, 0, 0, 0);
    return { from: from.toISOString(), to };
  }
  if (period === 'weekly') {
    const from = new Date(now);
    from.setDate(from.getDate() - 6);
    from.setHours(0, 0, 0, 0);
    return { from: from.toISOString(), to };
  }
  const from = new Date(now);
  from.setDate(from.getDate() - 29);
  from.setHours(0, 0, 0, 0);
  return { from: from.toISOString(), to };
}

function applySearch(sessions: Session[], query: string): Session[] {
  if (!query.trim()) return sessions;
  const q = query.toLowerCase();
  return sessions.filter(
    (s) =>
      (s.project_name ?? '').toLowerCase().includes(q) ||
      (s.client_name ?? '').toLowerCase().includes(q) ||
      (s.activity_name ?? '').toLowerCase().includes(q) ||
      (s.notes ?? '').toLowerCase().includes(q),
  );
}

function buildStats(sessions: Session[], dimension: Dimension): Stat[] {
  const map = new Map<string, Stat>();
  let colorIdx = 0;

  for (const s of sessions) {
    let key: string;
    let name: string;
    let color: string;

    if (dimension === 'project') {
      key = String(s.project_id);
      name = s.project_name ?? 'Unknown';
      color = s.project_color ?? '#ccc';
    } else if (dimension === 'client') {
      if (!s.client_id) continue;
      key = s.client_id;
      name = s.client_name ?? '—';
      color = CLIENT_PALETTE[colorIdx % CLIENT_PALETTE.length]; // overridden per new key
    } else {
      if (!s.activity_type_id) continue;
      key = s.activity_type_id;
      name = s.activity_name ?? '—';
      color = s.activity_color ?? '#7aa3b8';
    }

    if (!map.has(key)) {
      if (dimension === 'client') color = CLIENT_PALETTE[colorIdx++ % CLIENT_PALETTE.length];
      map.set(key, { key, name, color, total_minutes: 0, percentage: 0 });
    }
    map.get(key)!.total_minutes += s.duration_minutes ?? 0;
  }

  const arr = Array.from(map.values()).sort((a, b) => b.total_minutes - a.total_minutes);
  const total = arr.reduce((sum, s) => sum + s.total_minutes, 0);
  if (total > 0) for (const s of arr) s.percentage = (s.total_minutes / total) * 100;
  return arr;
}

function buildDailyTrend(sessions: Session[]): DayTrend[] {
  const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const minutesByDate = new Map<string, number>();
  for (const s of sessions) {
    const dateStr = s.start_time?.split('T')[0];
    if (!dateStr) continue;
    minutesByDate.set(dateStr, (minutesByDate.get(dateStr) ?? 0) + (s.duration_minutes ?? 0));
  }
  const now = new Date();
  const days: DayTrend[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    days.push({
      label: i === 0 ? 'Today' : DAY_LABELS[d.getDay()],
      minutes: minutesByDate.get(dateStr) ?? 0,
    });
  }
  return days;
}

// ── DonutChart (SVG-based) ─────────────────────────────────────────────────────

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function slicePath(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  startAngle: number,
  endAngle: number,
): string {
  const safeEnd = endAngle - startAngle >= 360 ? startAngle + 359.99 : endAngle;
  const o1 = polarToCartesian(cx, cy, outerR, startAngle);
  const o2 = polarToCartesian(cx, cy, outerR, safeEnd);
  const i1 = polarToCartesian(cx, cy, innerR, safeEnd);
  const i2 = polarToCartesian(cx, cy, innerR, startAngle);
  const large = safeEnd - startAngle > 180 ? 1 : 0;
  return [
    `M ${o1.x.toFixed(2)} ${o1.y.toFixed(2)}`,
    `A ${outerR} ${outerR} 0 ${large} 1 ${o2.x.toFixed(2)} ${o2.y.toFixed(2)}`,
    `L ${i1.x.toFixed(2)} ${i1.y.toFixed(2)}`,
    `A ${innerR} ${innerR} 0 ${large} 0 ${i2.x.toFixed(2)} ${i2.y.toFixed(2)}`,
    'Z',
  ].join(' ');
}

function DonutChart({ stats, totalMinutes }: { stats: Stat[]; totalMinutes: number }) {
  const SIZE = 180;
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const OUTER_R = 76;
  const INNER_R = 50;
  let currentAngle = 0;

  return (
    <Svg width={SIZE} height={SIZE}>
      <G>
        {stats.length === 0 ? (
          <Path d={slicePath(cx, cy, OUTER_R, INNER_R, 0, 359.99)} fill="#2d4f62" />
        ) : (
          stats.map((stat) => {
            const sweep = (stat.percentage / 100) * 360;
            const path = slicePath(cx, cy, OUTER_R, INNER_R, currentAngle, currentAngle + sweep);
            currentAngle += sweep;
            return <Path key={stat.key} d={path} fill={stat.color} />;
          })
        )}
        <SvgText x={cx} y={cy - 6} textAnchor="middle" fill="#ffffff" fontSize="16" fontWeight="300">
          {totalMinutes > 0 ? formatMinutes(totalMinutes) : '—'}
        </SvgText>
        <SvgText x={cx} y={cy + 10} textAnchor="middle" fill="#7aa3b8" fontSize="9">
          MY TIME
        </SvgText>
      </G>
    </Svg>
  );
}

// ── DailyTrendChart (View-based, no SVG) ──────────────────────────────────────

function DailyTrendChart({ days }: { days: DayTrend[] }) {
  const maxMinutes = Math.max(...days.map((d) => d.minutes), 1);
  return (
    <View style={trendStyles.container}>
      {days.map((day, i) => {
        const heightPct = (day.minutes / maxMinutes) * 100;
        const isToday = day.label === 'Today';
        return (
          <View key={i} style={trendStyles.col}>
            <View style={trendStyles.barWrapper}>
              <View
                style={[
                  trendStyles.bar,
                  {
                    height: `${Math.max(heightPct, day.minutes > 0 ? 4 : 0)}%` as any,
                    backgroundColor: isToday ? '#fe7f2d' : '#60a5fa',
                  },
                ]}
              />
            </View>
            {day.minutes > 0 && (
              <Text style={trendStyles.barValue}>{formatMinutes(day.minutes)}</Text>
            )}
            <Text style={[trendStyles.dayLabel, isToday && trendStyles.dayLabelToday]}>
              {day.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const trendStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 90,
    paddingHorizontal: 18,
    paddingBottom: 0,
    gap: 6,
  },
  col: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
  },
  barWrapper: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  bar: {
    width: '70%',
    borderRadius: 4,
    minHeight: 0,
  },
  barValue: {
    fontSize: 8,
    color: '#7aa3b8',
    marginTop: 3,
    fontWeight: '600',
  },
  dayLabel: {
    fontSize: 9,
    color: '#7aa3b8',
    marginTop: 2,
    fontWeight: '500',
  },
  dayLabelToday: {
    color: '#fe7f2d',
    fontWeight: '700',
  },
});

// ── MetricCard ─────────────────────────────────────────────────────────────────

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={metricStyles.card}>
      <Text style={metricStyles.value}>{value}</Text>
      {sub ? <Text style={metricStyles.sub}>{sub}</Text> : null}
      <Text style={metricStyles.label}>{label}</Text>
    </View>
  );
}

const metricStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: '#2d4f62',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  value: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    lineHeight: 24,
  },
  sub: {
    fontSize: 10,
    color: '#7aa3b8',
    fontWeight: '600',
    marginTop: 1,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    color: '#7aa3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 4,
    textAlign: 'center',
  },
});

// ── HorizontalBarList ──────────────────────────────────────────────────────────

function HorizontalBarList({ stats, emptyText, limit }: { stats: Stat[]; emptyText: string; limit?: number }) {
  const items = limit ? stats.slice(0, limit) : stats;
  if (items.length === 0) {
    return <Text style={barStyles.empty}>{emptyText}</Text>;
  }
  return (
    <View>
      {items.map((s) => (
        <View key={s.key} style={barStyles.row}>
          <View style={barStyles.nameRow}>
            <View style={[barStyles.dot, { backgroundColor: s.color }]} />
            <Text style={barStyles.name} numberOfLines={1}>{s.name}</Text>
            <Text style={barStyles.pct}>{Math.round(s.percentage)}%</Text>
            <Text style={barStyles.time}>{formatMinutes(s.total_minutes)}</Text>
          </View>
          <View style={barStyles.track}>
            <View style={[barStyles.fill, { width: `${s.percentage}%` as any, backgroundColor: s.color }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

const barStyles = StyleSheet.create({
  empty: { color: '#7aa3b8', fontSize: 13, paddingVertical: 16, paddingHorizontal: 18, textAlign: 'center' },
  row: { paddingHorizontal: 18, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#2d4f62' },
  nameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 7, gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  name: { flex: 1, fontSize: 13, color: '#ffffff', fontWeight: '600' },
  pct: { fontSize: 11, color: '#7aa3b8', fontWeight: '600', minWidth: 30, textAlign: 'right' },
  time: { fontSize: 13, fontWeight: '700', color: '#fe7f2d', minWidth: 48, textAlign: 'right' },
  track: { height: 5, backgroundColor: '#1e3545', borderRadius: 3, overflow: 'hidden' },
  fill: { height: 5, borderRadius: 3 },
});

// ── Main Screen ────────────────────────────────────────────────────────────────

export default function StatsScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [allSessions, setAllSessions] = useState<Session[]>([]);
  const [period, setPeriod] = useState<Period>('weekly');
  const [dimension, setDimension] = useState<Dimension>('project');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const loadStats = useCallback(async (p: Period) => {
    setLoading(true);
    const { from, to } = getRangeISO(p);
    const sessions = await getSessionsInRange(from, to);
    setAllSessions(sessions);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadStats(period);
    }, [period, loadStats]),
  );

  // ── Derived state (all reactive to search + dimension) ──────────────────────

  const filtered = useMemo(() => applySearch(allSessions, searchQuery), [allSessions, searchQuery]);
  const mySessions = useMemo(() => filtered.filter((s) => s.user_id === user?.id), [filtered, user]);

  const myTotalMinutes = useMemo(
    () => mySessions.reduce((sum, s) => sum + (s.duration_minutes ?? 0), 0),
    [mySessions],
  );

  const avgSessionMinutes = useMemo(
    () => (mySessions.length > 0 ? Math.round(myTotalMinutes / mySessions.length) : 0),
    [myTotalMinutes, mySessions.length],
  );

  const activeProjectCount = useMemo(
    () => new Set(mySessions.map((s) => s.project_id)).size,
    [mySessions],
  );

  const donutStats = useMemo(() => buildStats(mySessions, dimension), [mySessions, dimension]);

  const projectBreakdown = useMemo(() => buildStats(filtered, 'project'), [filtered]);
  const clientBreakdown = useMemo(() => buildStats(filtered, 'client'), [filtered]);
  const activityBreakdown = useMemo(() => buildStats(filtered, 'activity'), [filtered]);

  const dailyTrend = useMemo(() => buildDailyTrend(mySessions), [mySessions]);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Navbar />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Search bar */}
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by project, client, activity…"
            placeholderTextColor="#7aa3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearBtn}>
              <Text style={styles.clearBtnText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Period selector */}
        <View style={styles.periodBar}>
          {PERIODS.map((p) => (
            <TouchableOpacity
              key={p.key}
              style={[styles.periodBtn, period === p.key && styles.periodBtnActive]}
              onPress={() => { setPeriod(p.key); loadStats(p.key); }}
              activeOpacity={0.75}
            >
              <Text style={[styles.periodText, period === p.key && styles.periodTextActive]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Overview metrics */}
        <View style={styles.metricsRow}>
          <MetricCard label="Total Time" value={myTotalMinutes > 0 ? formatMinutes(myTotalMinutes) : '—'} />
          <MetricCard label="Sessions" value={String(mySessions.length)} />
          <MetricCard label="Avg Session" value={avgSessionMinutes > 0 ? formatMinutes(avgSessionMinutes) : '—'} />
          <MetricCard label="Projects" value={String(activeProjectCount)} />
        </View>

        {/* Work Distribution card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Work Distribution</Text>
            <View style={styles.dimToggle}>
              {DIMENSIONS.map((d) => (
                <TouchableOpacity
                  key={d.key}
                  style={[styles.dimBtn, dimension === d.key && styles.dimBtnActive]}
                  onPress={() => setDimension(d.key)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.dimText, dimension === d.key && styles.dimTextActive]}>
                    {d.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.chartWrapper}>
            <DonutChart stats={donutStats} totalMinutes={myTotalMinutes} />
          </View>

          {donutStats.length === 0 ? (
            <Text style={styles.empty}>
              {loading ? 'Loading…' : searchQuery ? 'No results for this search' : 'No data for this period'}
            </Text>
          ) : (
            <View style={styles.legend}>
              {donutStats.slice(0, 6).map((stat) => (
                <View key={stat.key} style={styles.legendRow}>
                  <View style={styles.legendLeft}>
                    <View style={[styles.legendDot, { backgroundColor: stat.color }]} />
                    <Text style={styles.legendName} numberOfLines={1}>{stat.name}</Text>
                  </View>
                  <View style={styles.legendRight}>
                    <Text style={styles.legendTime}>{formatMinutes(stat.total_minutes)}</Text>
                    <Text style={styles.legendPct}>{Math.round(stat.percentage)}%</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Daily Trend */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Last 7 Days</Text>
          <View style={{ paddingVertical: 14 }}>
            <DailyTrendChart days={dailyTrend} />
          </View>
        </View>

        {/* Top Projects */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Top Projects</Text>
          <HorizontalBarList
            stats={projectBreakdown}
            emptyText="No project data for this period"
            limit={5}
          />
        </View>

        {/* By Client */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>By Client</Text>
          <HorizontalBarList
            stats={clientBreakdown}
            emptyText="No client data — tag sessions with a client to see breakdowns"
          />
        </View>

        {/* By Activity */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>By Activity</Text>
          <HorizontalBarList
            stats={activityBreakdown}
            emptyText="No activity data — tag sessions with an activity type to see breakdowns"
          />
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Fixed bottom action bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.clockBtn}
          onPress={() => router.push('/clock-in')}
          activeOpacity={0.9}
        >
          <View style={styles.clockIconRing}>
            <View style={styles.clockHandH} />
            <View style={styles.clockHandM} />
            <View style={styles.clockCenter} />
          </View>
          <Text style={styles.clockBtnText}>Clock In</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1e3545',
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
  },

  // Search
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#233d4d',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2d4f62',
    paddingHorizontal: 14,
    marginBottom: 10,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#ffffff',
    height: '100%',
  },
  clearBtn: {
    paddingLeft: 8,
    paddingVertical: 4,
  },
  clearBtnText: {
    color: '#7aa3b8',
    fontSize: 14,
    fontWeight: '600',
  },

  // Period selector
  periodBar: {
    flexDirection: 'row',
    backgroundColor: '#233d4d',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: '#2d4f62',
    marginBottom: 14,
  },
  periodBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 9,
    alignItems: 'center',
  },
  periodBtnActive: {
    backgroundColor: '#fe7f2d',
  },
  periodText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#7aa3b8',
  },
  periodTextActive: {
    color: '#ffffff',
  },

  // Metrics row
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },

  // Cards
  card: {
    backgroundColor: '#233d4d',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2d4f62',
    overflow: 'hidden',
    marginBottom: 14,
  },
  cardHeader: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 8,
    gap: 10,
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7aa3b8',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },

  // Dimension toggle
  dimToggle: {
    flexDirection: 'row',
    backgroundColor: '#1e3545',
    borderRadius: 8,
    padding: 3,
    gap: 2,
  },
  dimBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
  },
  dimBtnActive: {
    backgroundColor: '#fe7f2d',
  },
  dimText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#7aa3b8',
  },
  dimTextActive: {
    color: '#ffffff',
  },

  chartWrapper: {
    alignItems: 'center',
    paddingTop: 4,
    paddingBottom: 8,
  },
  empty: {
    textAlign: 'center',
    color: '#7aa3b8',
    fontSize: 13,
    paddingVertical: 20,
    paddingHorizontal: 18,
  },

  // Legend
  legend: {
    borderTopWidth: 1,
    borderTopColor: '#2d4f62',
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#2d4f62',
  },
  legendLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    flexShrink: 0,
  },
  legendName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
    flex: 1,
  },
  legendRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  legendTime: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fe7f2d',
  },
  legendPct: {
    fontSize: 11,
    color: '#7aa3b8',
    fontWeight: '600',
  },

  // Bottom action bar
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
  clockIconRing: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  clockHandH: {
    position: 'absolute',
    width: 1.5,
    height: 6,
    backgroundColor: '#ffffff',
    borderRadius: 1,
    bottom: '50%',
    left: '50%',
    marginLeft: -0.75,
    transformOrigin: 'bottom',
    transform: [{ rotate: '-30deg' }],
  },
  clockHandM: {
    position: 'absolute',
    width: 1.5,
    height: 7,
    backgroundColor: '#ffffff',
    borderRadius: 1,
    bottom: '50%',
    left: '50%',
    marginLeft: -0.75,
    transformOrigin: 'bottom',
    transform: [{ rotate: '60deg' }],
  },
  clockCenter: {
    width: 2.5,
    height: 2.5,
    borderRadius: 1.25,
    backgroundColor: '#ffffff',
  },
  clockBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
