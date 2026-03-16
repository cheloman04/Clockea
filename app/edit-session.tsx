import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Alert,
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
import { updateSessionDetails } from '../database/storage';

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function toLocalDateInput(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function toLocalTimeInput(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toIsoFromLocal(dateValue: string, timeValue: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue.trim())) return null;
  if (!/^\d{2}:\d{2}$/.test(timeValue.trim())) return null;

  const [year, month, day] = dateValue.split('-').map(Number);
  const [hours, minutes] = timeValue.split(':').map(Number);
  const date = new Date(year, month - 1, day, hours, minutes, 0, 0);

  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export default function EditSessionScreen() {
  const router = useRouter();
  const {
    id,
    notes: initialNotes,
    startTime: initialStartTime,
    endTime: initialEndTime,
  } = useLocalSearchParams<{
    id: string;
    notes: string;
    startTime: string;
    endTime: string;
  }>();

  const initialValues = useMemo(
    () => ({
      startDate: toLocalDateInput(initialStartTime),
      startClock: toLocalTimeInput(initialStartTime),
      endDate: toLocalDateInput(initialEndTime),
      endClock: toLocalTimeInput(initialEndTime),
    }),
    [initialEndTime, initialStartTime]
  );

  const [startDate, setStartDate] = useState(initialValues.startDate);
  const [startClock, setStartClock] = useState(initialValues.startClock);
  const [endDate, setEndDate] = useState(initialValues.endDate);
  const [endClock, setEndClock] = useState(initialValues.endClock);
  const [notes, setNotes] = useState(initialNotes ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!id) return;

    const startIso = toIsoFromLocal(startDate, startClock);
    const endIso = toIsoFromLocal(endDate, endClock);

    if (!startIso || !endIso) {
      setError('Use valid values. Date: YYYY-MM-DD and time: HH:MM.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      await updateSessionDetails(Number(id), {
        startTime: startIso,
        endTime: endIso,
        notes: notes.trim(),
      });
      router.back();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not save session.';
      setError(message);
      if (Platform.OS !== 'web') {
        Alert.alert('Error', message);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.inner}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.heading}>Edit Session</Text>
          <Text style={styles.subheading}>
            Fix the start or end time if you forgot to clock out on time.
          </Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Text style={styles.label}>Start Date</Text>
          <TextInput
            style={styles.field}
            value={startDate}
            onChangeText={setStartDate}
            placeholder="2026-03-16"
            placeholderTextColor="#4a6d80"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>Start Time</Text>
          <TextInput
            style={styles.field}
            value={startClock}
            onChangeText={setStartClock}
            placeholder="09:00"
            placeholderTextColor="#4a6d80"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>End Date</Text>
          <TextInput
            style={styles.field}
            value={endDate}
            onChangeText={setEndDate}
            placeholder="2026-03-16"
            placeholderTextColor="#4a6d80"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>End Time</Text>
          <TextInput
            style={styles.field}
            value={endClock}
            onChangeText={setEndClock}
            placeholder="17:30"
            placeholderTextColor="#4a6d80"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>Session Notes</Text>
          <TextInput
            style={styles.input}
            value={notes}
            onChangeText={setNotes}
            placeholder="What did you work on?"
            placeholderTextColor="#4a6d80"
            multiline
            textAlignVertical="top"
          />

          <Text style={styles.helper}>
            Times use the local timezone of the device editing the session.
          </Text>

          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.btnDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Session'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1e3545',
  },
  inner: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  heading: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 6,
  },
  subheading: {
    fontSize: 14,
    lineHeight: 22,
    color: '#7aa3b8',
    marginBottom: 20,
  },
  error: {
    backgroundColor: '#EF444420',
    color: '#EF4444',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#EF444440',
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7aa3b8',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  field: {
    backgroundColor: '#233d4d',
    borderWidth: 1,
    borderColor: '#2d4f62',
    borderRadius: 14,
    padding: 16,
    fontSize: 16,
    color: '#ffffff',
    marginBottom: 16,
  },
  input: {
    backgroundColor: '#233d4d',
    borderWidth: 1,
    borderColor: '#2d4f62',
    borderRadius: 14,
    padding: 16,
    fontSize: 16,
    color: '#ffffff',
    lineHeight: 24,
    minHeight: 160,
    marginBottom: 16,
  },
  helper: {
    fontSize: 13,
    lineHeight: 20,
    color: '#4a6d80',
    marginBottom: 16,
  },
  saveBtn: {
    backgroundColor: '#fe7f2d',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#fe7f2d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
