import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, Modal, SectionList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import SessionItem from '../components/SessionItem';
import Navbar from '../components/Navbar';
import {
  deleteSession,
  getAllSessions,
  getIntervalsForSessions,
  getObjectivesForSessions,
  resumeSession,
} from '../database/storage';
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
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

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
      Alert.alert('Error', msg);
    }
  }

  function openEditSession(session: Session) {
    setSelectedSession(null);
    setConfirmingDelete(false);
    router.push({
      pathname: '/edit-session',
      params: {
        id: String(session.id),
        notes: session.notes ?? '',
        startTime: session.start_time,
        endTime: session.end_time ?? '',
      },
    });
  }

  function handleActions(session: Session) {
    setSelectedSession(session);
    setConfirmingDelete(false);
  }

  function closeActionsModal() {
    setSelectedSession(null);
    setConfirmingDelete(false);
  }

  async function handleDeleteSelectedSession() {
    if (!selectedSession) return;
    try {
      await deleteSession(selectedSession.id);
      closeActionsModal();
      load();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not delete session.';
      Alert.alert('Error', message);
    }
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
            <Text style={styles.sectionTotal}>{formatMinutes(section.totalMinutes)}</Text>
          </View>
        )}
        stickySectionHeadersEnabled
        contentContainerStyle={styles.list}
      />

      <Modal
        visible={!!selectedSession}
        transparent
        animationType="fade"
        onRequestClose={closeActionsModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalEyebrow}>Session Actions</Text>
            <Text style={styles.modalTitle}>{selectedSession?.project_name ?? 'Session'}</Text>
            <Text style={styles.modalMeta}>
              {selectedSession ? `${formatDate(selectedSession.start_time)} • ${formatMinutes(selectedSession.duration_minutes ?? 0)}` : ''}
            </Text>

            {confirmingDelete ? (
              <>
                <Text style={styles.modalBody}>
                  Delete this session? This cannot be undone.
                </Text>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.deleteBtn]}
                  onPress={handleDeleteSelectedSession}
                  activeOpacity={0.85}
                >
                  <Text style={styles.deleteBtnText}>Delete Session</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.secondaryBtn]}
                  onPress={() => setConfirmingDelete(false)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.secondaryBtnText}>Back</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.modalBody}>
                  Choose what you want to do with this completed session.
                </Text>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.primaryBtn]}
                  onPress={() => selectedSession && openEditSession(selectedSession)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.primaryBtnText}>Edit Session</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.ghostBtn]}
                  onPress={() => setConfirmingDelete(true)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.ghostBtnText}>Delete Session</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.secondaryBtn]}
                  onPress={closeActionsModal}
                  activeOpacity={0.8}
                >
                  <Text style={styles.secondaryBtnText}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 20, 28, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#233d4d',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#2d4f62',
    padding: 22,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.3,
    shadowRadius: 28,
    elevation: 12,
  },
  modalEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7aa3b8',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 6,
  },
  modalMeta: {
    fontSize: 13,
    color: '#fe7f2d',
    fontWeight: '600',
    marginBottom: 14,
  },
  modalBody: {
    fontSize: 14,
    lineHeight: 22,
    color: '#a8c4d0',
    marginBottom: 18,
  },
  modalBtn: {
    borderRadius: 14,
    alignItems: 'center',
    paddingVertical: 15,
    marginBottom: 10,
  },
  primaryBtn: {
    backgroundColor: '#fe7f2d',
    shadowColor: '#fe7f2d',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.24,
    shadowRadius: 14,
    elevation: 6,
  },
  primaryBtnText: {
    color: '#1e3545',
    fontSize: 15,
    fontWeight: '800',
  },
  ghostBtn: {
    backgroundColor: '#1e3545',
    borderWidth: 1,
    borderColor: '#EF444466',
  },
  ghostBtnText: {
    color: '#EF7A7A',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryBtn: {
    backgroundColor: '#1e3545',
    borderWidth: 1,
    borderColor: '#2d4f62',
    marginBottom: 0,
  },
  secondaryBtnText: {
    color: '#7aa3b8',
    fontSize: 15,
    fontWeight: '700',
  },
  deleteBtn: {
    backgroundColor: '#EF4444',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 6,
  },
  deleteBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
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
