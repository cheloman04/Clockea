import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { G, Path, Svg, Text as SvgText } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getSessionsInRange } from '../database/storage';
import { useAuth } from '../contexts/AuthContext';
import { formatMinutes } from '../utils/time';
import { Session } from '../database/types';

type Period = 'daily' | 'weekly' | 'monthly';

interface ProjectStat {
  project_key: string;
  project_name: string;
  project_color: string;
  total_minutes: number;
  percentage: number;
}

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

function buildStats(sessions: Session[]): ProjectStat[] {
  const map = new Map<string, ProjectStat>();
  for (const s of sessions) {
    const rawName = (s.project_name ?? '').trim();
    const key = rawName ? rawName.toLowerCase() : `project-${s.project_id}`;
    if (!map.has(key)) {
      map.set(key, {
        project_key: key,
        project_name: rawName || 'Unknown',
        project_color: s.project_color ?? '#ccc',
        total_minutes: 0,
        percentage: 0,
      });
    }
    map.get(key)!.total_minutes += s.duration_minutes ?? 0;
  }
  const stats = Array.from(map.values()).sort((a, b) => b.total_minutes - a.total_minutes);
  const total = stats.reduce((sum, s) => sum + s.total_minutes, 0);
  if (total > 0) {
    for (const s of stats) s.percentage = (s.total_minutes / total) * 100;
  }
  return stats;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function slicePath(cx: number, cy: number, outerR: number, innerR: number, startAngle: number, endAngle: number): string {
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

function DonutChart({ stats, totalMinutes }: { stats: ProjectStat[]; totalMinutes: number }) {
  const SIZE = 200;
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const OUTER_R = 84;
  const INNER_R = 54;
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
            return <Path key={stat.project_key} d={path} fill={stat.project_color} />;
          })
        )}
        <SvgText x={cx} y={cy - 8} textAnchor="middle" fill="#ffffff" fontSize="18" fontWeight="300">
          {totalMinutes > 0 ? formatMinutes(totalMinutes) : '—'}
        </SvgText>
        <SvgText x={cx} y={cy + 10} textAnchor="middle" fill="#7aa3b8" fontSize="10">
          TOTAL
        </SvgText>
      </G>
    </Svg>
  );
}

const PERIODS: { key: Period; label: string }[] = [
  { key: 'daily', label: 'Today' },
  { key: 'weekly', label: 'This Week' },
  { key: 'monthly', label: 'This Month' },
];

export default function StatsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [period, setPeriod] = useState<Period>('weekly');
  const [myStats, setMyStats] = useState<ProjectStat[]>([]);
  const [teamStats, setTeamStats] = useState<ProjectStat[]>([]);

  const loadStats = useCallback(async (p: Period) => {
    const { from, to } = getRangeISO(p);
    const sessions = await getSessionsInRange(from, to);
    const mine = sessions.filter((s) => s.user_id === user?.id);
    const team = sessions.filter((s) => s.user_id !== user?.id);
    setMyStats(buildStats(mine));
    setTeamStats(buildStats(team));
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadStats(period);
    }, [period, loadStats])
  );

  const myTotal = myStats.reduce((sum, s) => sum + s.total_minutes, 0);
  const teamTotal = teamStats.reduce((sum, s) => sum + s.total_minutes, 0);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

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

        {/* My Sessions card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>My Sessions</Text>
          <View style={styles.chartWrapper}>
            <DonutChart stats={myStats} totalMinutes={myTotal} />
          </View>
          {myStats.length === 0 ? (
            <Text style={styles.empty}>No data for this period</Text>
          ) : (
            <View style={styles.legend}>
              {myStats.map((stat) => (
                <View key={stat.project_key} style={styles.legendRow}>
                  <View style={styles.legendLeft}>
                    <View style={[styles.legendDot, { backgroundColor: stat.project_color }]} />
                    <Text style={styles.legendName}>{stat.project_name}</Text>
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

        {/* Team Sessions card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Team Sessions</Text>
          <View style={styles.chartWrapper}>
            <DonutChart stats={teamStats} totalMinutes={teamTotal} />
          </View>
          {teamStats.length === 0 ? (
            <Text style={styles.empty}>No team activity for this period</Text>
          ) : (
            <View style={styles.legend}>
              {teamStats.map((stat) => (
                <View key={stat.project_key} style={styles.legendRow}>
                  <View style={styles.legendLeft}>
                    <View style={[styles.legendDot, { backgroundColor: stat.project_color }]} />
                    <Text style={styles.legendName}>{stat.project_name}</Text>
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

        {/* Space for bottom bar */}
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

  // Period selector
  periodBar: {
    flexDirection: 'row',
    backgroundColor: '#233d4d',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: '#2d4f62',
    marginBottom: 16,
  },
  periodBtn: {
    flex: 1,
    paddingVertical: 10,
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

  // Full-width vertical card
  card: {
    backgroundColor: '#233d4d',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2d4f62',
    overflow: 'hidden',
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7aa3b8',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 4,
  },
  chartWrapper: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  empty: {
    textAlign: 'center',
    color: '#7aa3b8',
    fontSize: 13,
    paddingVertical: 20,
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
    paddingVertical: 13,
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
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    flex: 1,
  },
  legendRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  legendTime: {
    fontSize: 14,
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
