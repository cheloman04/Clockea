import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Session } from '../database/types';
import { formatMinutes, formatTime } from '../utils/time';

interface SessionItemProps {
  session: Session;
}

export default function SessionItem({ session }: SessionItemProps) {
  const [expanded, setExpanded] = useState(false);
  const hasNotes = !!session.notes?.trim();

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity
        style={styles.item}
        onPress={hasNotes ? () => setExpanded((v) => !v) : undefined}
        activeOpacity={hasNotes ? 0.7 : 1}
      >
        <View style={[styles.dot, { backgroundColor: session.project_color }]} />
        <View style={styles.info}>
          <Text style={styles.project}>{session.project_name}</Text>
          <Text style={styles.time}>
            {formatTime(session.start_time)}
            {session.end_time ? ` – ${formatTime(session.end_time)}` : ''}
          </Text>
        </View>
        <View style={styles.right}>
          <Text style={styles.duration}>
            {session.duration_minutes != null
              ? formatMinutes(session.duration_minutes)
              : '—'}
          </Text>
          {hasNotes && (
            <Text style={styles.notesIndicator}>{expanded ? '▲' : '▼'}</Text>
          )}
        </View>
      </TouchableOpacity>

      {hasNotes && expanded && (
        <View style={styles.notesBox}>
          <Text style={styles.notesLabel}>Session Notes</Text>
          <Text style={styles.notesText}>{session.notes}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderBottomWidth: 1,
    borderBottomColor: '#2d4f62',
    backgroundColor: '#233d4d',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 14,
  },
  info: {
    flex: 1,
  },
  project: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 3,
  },
  time: {
    fontSize: 12,
    color: '#7aa3b8',
  },
  right: {
    alignItems: 'flex-end',
    gap: 4,
  },
  duration: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fe7f2d',
  },
  notesIndicator: {
    fontSize: 9,
    color: '#4a6d80',
  },
  notesBox: {
    paddingHorizontal: 38,
    paddingBottom: 14,
  },
  notesLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4a6d80',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 5,
  },
  notesText: {
    fontSize: 14,
    color: '#a8c4d0',
    lineHeight: 20,
  },
});
