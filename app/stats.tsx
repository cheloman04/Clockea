import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { G, Path, Svg, Text as SvgText } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getSessionsInRange } from '../database/storage';
import { formatMinutes } from '../utils/time';

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
  // monthly
  const from = new Date(now);
  from.setDate(from.getDate() - 29);
  from.setHours(0, 0, 0, 0);
  return { from: from.toISOString(), to };
}

async function computeStats(period: Period): Promise<ProjectStat[]> {
  const { from, to } = getRangeISO(period);
  const sessions = await getSessionsInRange(from, to);

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

// --- SVG Donut Chart helpers ---

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function slicePath(cx: number, cy: number, outerR: number, innerR: number, startAngle: number, endAngle: number): string {
  // Guard against full-circle edge case
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
  const SIZE = 260;
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const OUTER_R = 110;
  const INNER_R = 72;

  let currentAngle = 0;

  return (
    <Svg width={SIZE} height={SIZE}>
      <G>
        {stats.length === 0 ? (
          <Path
            d={slicePath(cx, cy, OUTER_R, INNER_R, 0, 359.99)}
            fill="#2d4f62"
          />
        ) : (
          stats.map((stat) => {
            const sweep = (stat.percentage / 100) * 360;
            const path = slicePath(cx, cy, OUTER_R, INNER_R, currentAngle, currentAngle + sweep);
            currentAngle += sweep;
            return <Path key={stat.project_key} d={path} fill={stat.project_color} />;
          })
        )}
        {/* Center label */}
        <SvgText
          x={cx}
          y={cy - 10}
          textAnchor="middle"
          fill="#ffffff"
          fontSize="22"
          fontWeight="300"
        >
          {totalMinutes > 0 ? formatMinutes(totalMinutes) : '—'}
        </SvgText>
        <SvgText
          x={cx}
          y={cy + 14}
          textAnchor="middle"
          fill="#7aa3b8"
          fontSize="11"
        >
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
  const [period, setPeriod] = useState<Period>('weekly');
  const [stats, setStats] = useState<ProjectStat[]>([]);

  useFocusEffect(
    useCallback(() => {
      computeStats(period).then(setStats);
    }, [period])
  );

  const totalMinutes = stats.reduce((sum, s) => sum + s.total_minutes, 0);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Period selector */}
        <View style={styles.tabs}>
          {PERIODS.map((p) => (
            <TouchableOpacity
              key={p.key}
              style={[styles.tab, period === p.key && styles.tabActive]}
              onPress={() => {
                setPeriod(p.key);
                computeStats(p.key).then(setStats);
              }}
              activeOpacity={0.75}
            >
              <Text style={[styles.tabText, period === p.key && styles.tabTextActive]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Donut chart */}
        <View style={styles.chartWrapper}>
          <DonutChart stats={stats} totalMinutes={totalMinutes} />
        </View>

        {/* Legend */}
        {stats.length === 0 ? (
          <Text style={styles.empty}>No sessions recorded for this period.</Text>
        ) : (
          <View style={styles.legend}>
            {stats.map((stat) => (
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1e3545',
  },
  scroll: {
    paddingBottom: 48,
  },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 20,
    backgroundColor: '#233d4d',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: '#2d4f62',
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 9,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#fe7f2d',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#7aa3b8',
  },
  tabTextActive: {
    color: '#233d4d',
  },
  chartWrapper: {
    alignItems: 'center',
    marginTop: 32,
    marginBottom: 12,
  },
  empty: {
    textAlign: 'center',
    color: '#7aa3b8',
    fontSize: 15,
    marginTop: 16,
    paddingHorizontal: 40,
  },
  legend: {
    marginHorizontal: 20,
    marginTop: 8,
    backgroundColor: '#233d4d',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2d4f62',
    overflow: 'hidden',
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2d4f62',
  },
  legendLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  legendRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  legendTime: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fe7f2d',
  },
  legendPct: {
    fontSize: 13,
    color: '#7aa3b8',
    fontWeight: '600',
    width: 38,
    textAlign: 'right',
  },
});
