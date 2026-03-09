import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import SessionItem from '../components/SessionItem';
import { getAllSessions } from '../database/storage';
import { Session } from '../database/types';
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
  const [sections, setSections] = useState<DaySection[]>([]);

  useFocusEffect(
    useCallback(() => {
      getAllSessions().then((sessions) => setSections(groupByDay(sessions)));
    }, [])
  );

  if (sections.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <Text style={styles.empty}>No sessions recorded yet.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => <SessionItem session={item} />}
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
