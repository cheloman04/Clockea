import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getSessionObjectives, saveSessionNotes, saveSessionOutcome } from '../database/storage';
import { SessionObjective } from '../database/types';
import { Outcome, OUTCOMES } from '../utils/outcomes';

export default function SessionRecapScreen() {
  const router = useRouter();
  const { sessionId, objective } = useLocalSearchParams<{ sessionId: string; objective?: string }>();
  const [notes, setNotes] = useState('');
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [error, setError] = useState('');
  const [objectives, setObjectives] = useState<SessionObjective[]>([]);

  const hasLegacyObjective = !!objective?.trim();
  const hasObjectives = objectives.length > 0;
  // Show outcome picker if either checklist items or legacy objective text exists
  const showOutcomePicker = hasObjectives || hasLegacyObjective;

  useEffect(() => {
    if (!sessionId) return;
    getSessionObjectives(Number(sessionId)).then((objs) => {
      setObjectives(objs);
      if (objs.length > 0) {
        const completed = objs.filter((o) => o.completed).length;
        const ratio = completed / objs.length;
        if (ratio === 1) setOutcome('achieved');
        else if (ratio >= 0.5) setOutcome('partial');
        else setOutcome('missed');
      }
    });
  }, []);

  async function handleSave() {
    try {
      setError('');
      if (sessionId) {
        if (showOutcomePicker && outcome) {
          await saveSessionOutcome(Number(sessionId), outcome);
        }
        if (notes.trim()) {
          await saveSessionNotes(Number(sessionId), notes.trim());
        }
      }
      router.replace('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save session.');
    }
  }

  function handleSkip() {
    router.replace('/');
  }

  const canSave = !showOutcomePicker || outcome !== null;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.outer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.top}>
            <View style={styles.iconWrapper}>
              <Text style={styles.icon}>✓</Text>
            </View>
            <Text style={styles.heading}>Session Complete</Text>
            <Text style={styles.subheading}>
              {showOutcomePicker ? 'How did it go?' : 'What did you accomplish?'}
            </Text>
          </View>

          {/* Objectives checklist (read-only) */}
          {hasObjectives && (
            <View style={styles.objectivesCard}>
              <View style={styles.objectivesHeader}>
                <Text style={styles.objectiveLabel}>Objectives</Text>
                <Text style={[
                  styles.objectiveProgress,
                  objectives.filter((o) => o.completed).length === objectives.length && styles.objectiveProgressDone,
                ]}>
                  {objectives.filter((o) => o.completed).length} / {objectives.length} completed
                </Text>
              </View>
              {objectives.map((obj) => (
                <View key={obj.id} style={styles.objRow}>
                  <View style={[styles.objIcon, obj.completed ? styles.objIconDone : styles.objIconMissed]}>
                    <Text style={styles.objIconText}>{obj.completed ? '✓' : '✗'}</Text>
                  </View>
                  <Text style={[styles.objText, !obj.completed && styles.objTextMissed]}>
                    {obj.text}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Legacy objective card (for old sessions) */}
          {!hasObjectives && hasLegacyObjective && (
            <View style={styles.objectiveCard}>
              <Text style={styles.objectiveLabel}>Your Objective</Text>
              <Text style={styles.objectiveText}>{objective}</Text>
            </View>
          )}

          {/* Outcome picker */}
          {showOutcomePicker && (
            <View style={styles.outcomeSection}>
              <Text style={styles.sectionLabel}>
                Outcome{hasObjectives && <Text style={styles.autoSuggest}> · auto-suggested</Text>}
              </Text>
              {OUTCOMES.map((o) => {
                const selected = outcome === o.value;
                return (
                  <TouchableOpacity
                    key={o.value}
                    style={[
                      styles.outcomeRow,
                      selected && { borderColor: o.color, backgroundColor: o.color + '14' },
                    ]}
                    onPress={() => setOutcome(o.value)}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.outcomeRadio, selected && { borderColor: o.color }]}>
                      {selected && (
                        <View style={[styles.outcomeRadioFill, { backgroundColor: o.color }]} />
                      )}
                    </View>
                    <View style={styles.outcomeInfo}>
                      <Text style={[styles.outcomeTitle, selected && { color: o.color }]}>
                        {o.label}
                      </Text>
                      <Text style={styles.outcomeHint}>{o.hint}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Notes */}
          <View style={styles.notesSection}>
            <Text style={styles.sectionLabel}>
              Session Notes{' '}
              <Text style={styles.optional}>(optional)</Text>
            </Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <TextInput
              style={styles.input}
              placeholder="e.g. Finished the login flow, fixed 3 bugs…"
              placeholderTextColor="#4a6d80"
              value={notes}
              onChangeText={setNotes}
              multiline
              textAlignVertical="top"
            />
            <Text style={styles.hint}>These notes will appear in your session history.</Text>
          </View>
        </ScrollView>

        {/* Fixed actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!canSave}
            activeOpacity={0.85}
          >
            <Text style={styles.saveBtnText}>Save & Finish</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSkip} activeOpacity={0.7}>
            <Text style={styles.skipText}>Skip for now</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1e3545',
  },
  outer: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 16,
  },

  // Header
  top: {
    alignItems: 'center',
    marginBottom: 28,
  },
  iconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fe7f2d',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#fe7f2d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  icon: {
    fontSize: 28,
    color: '#ffffff',
    fontWeight: '700',
  },
  heading: {
    fontSize: 26,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
  },
  subheading: {
    fontSize: 15,
    color: '#7aa3b8',
    textAlign: 'center',
  },

  // Objectives checklist card
  objectivesCard: {
    backgroundColor: '#233d4d',
    borderWidth: 1,
    borderColor: '#2d4f62',
    borderRadius: 14,
    marginBottom: 20,
    overflow: 'hidden',
  },
  objectivesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2d4f62',
  },
  objectiveLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#7aa3b8',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  objectiveProgress: {
    fontSize: 12,
    fontWeight: '600',
    color: '#7aa3b8',
  },
  objectiveProgressDone: {
    color: '#4ade80',
  },
  objRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 11,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2d4f62',
  },
  objIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  objIconDone: {
    backgroundColor: '#4ade80',
  },
  objIconMissed: {
    backgroundColor: '#4a6d80',
  },
  objIconText: {
    fontSize: 11,
    color: '#1e3545',
    fontWeight: '700',
  },
  objText: {
    flex: 1,
    fontSize: 14,
    color: '#ffffff',
    lineHeight: 19,
  },
  objTextMissed: {
    color: '#4a6d80',
  },

  // Legacy objective card
  objectiveCard: {
    backgroundColor: '#233d4d',
    borderWidth: 1,
    borderColor: '#2d4f62',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },
  objectiveText: {
    fontSize: 15,
    color: '#ffffff',
    lineHeight: 22,
    fontWeight: '500',
    marginTop: 6,
  },

  // Auto-suggest label
  autoSuggest: {
    color: '#4a6d80',
    fontWeight: '400',
    textTransform: 'none',
    letterSpacing: 0,
    fontSize: 11,
  },

  // Outcome picker
  outcomeSection: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7aa3b8',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  optional: {
    color: '#4a6d80',
    fontWeight: '400',
    textTransform: 'none',
    letterSpacing: 0,
    fontSize: 11,
  },
  outcomeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#233d4d',
    borderWidth: 1,
    borderColor: '#2d4f62',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    gap: 14,
  },
  outcomeRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#4a6d80',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  outcomeRadioFill: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  outcomeInfo: {
    flex: 1,
  },
  outcomeTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 2,
  },
  outcomeHint: {
    fontSize: 12,
    color: '#7aa3b8',
  },

  // Notes
  notesSection: {
    marginBottom: 8,
  },
  error: {
    backgroundColor: '#EF444420',
    color: '#EF4444',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EF444440',
  },
  input: {
    backgroundColor: '#233d4d',
    borderWidth: 1,
    borderColor: '#2d4f62',
    borderRadius: 14,
    padding: 16,
    fontSize: 15,
    color: '#ffffff',
    lineHeight: 22,
    minHeight: 110,
  },
  hint: {
    fontSize: 12,
    color: '#4a6d80',
    marginTop: 8,
  },

  // Actions
  actions: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 32,
    gap: 12,
  },
  saveBtn: {
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
  saveBtnDisabled: {
    opacity: 0.4,
  },
  saveBtnText: {
    color: '#233d4d',
    fontSize: 16,
    fontWeight: '700',
  },
  skipText: {
    textAlign: 'center',
    color: '#7aa3b8',
    fontSize: 15,
    paddingVertical: 4,
  },
});
