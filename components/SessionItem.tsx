import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Session, SessionObjective } from '../database/types';
import { formatDate, formatMinutes, formatTime } from '../utils/time';

interface SessionItemProps {
  session: Session;
  hideMember?: boolean;
  prominentMember?: boolean;
  onActions?: () => void;
  objectives?: SessionObjective[];
}

const OUTCOME_CONFIG: Record<
  'achieved' | 'partial' | 'missed',
  { label: string; color: string }
> = {
  achieved: { label: 'Achieved',           color: '#4ade80' },
  partial:  { label: 'Partially Achieved', color: '#fe7f2d' },
  missed:   { label: 'Not Achieved',       color: '#EF4444' },
};

export default function SessionItem({ session, hideMember, prominentMember, onActions, objectives }: SessionItemProps) {
  const [expanded, setExpanded] = useState(false);

  const hasNotes      = !!session.notes?.trim();
  const hasObjective  = !!session.objective?.trim();
  const hasChecklist  = !!objectives && objectives.length > 0;
  const hasExpanded   = hasNotes || hasObjective || hasChecklist;

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity
        style={styles.item}
        onPress={hasExpanded ? () => setExpanded((v) => !v) : undefined}
        activeOpacity={hasExpanded ? 0.7 : 1}
      >
        <View style={[styles.dot, { backgroundColor: session.project_color }]} />
        <View style={styles.info}>
          <Text style={styles.project}>{session.project_name}</Text>
          <Text style={styles.time}>
            {formatDate(session.start_time)} · {formatTime(session.start_time)}
            {session.end_time ? ` – ${formatTime(session.end_time)}` : ''}
          </Text>
          {!hideMember && prominentMember && session.user_full_name ? (
            <Text style={styles.memberName}>{session.user_full_name}</Text>
          ) : !hideMember && !prominentMember && session.user_full_name ? (
            <Text style={styles.userName}>{session.user_full_name}</Text>
          ) : null}
        </View>
        <View style={styles.right}>
          <Text style={styles.duration}>
            {session.duration_minutes != null
              ? formatMinutes(session.duration_minutes)
              : '—'}
          </Text>
          {hasExpanded && (
            <Text style={styles.notesIndicator}>{expanded ? '▲' : '▼'}</Text>
          )}
          {onActions && (
            <TouchableOpacity
              onPress={onActions}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.6}
            >
              <Text style={styles.actionsBtn}>⋯</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>

      {hasExpanded && expanded && (
        <View style={styles.expandBox}>
          {/* Objectives checklist */}
          {hasChecklist && (
            <View style={styles.section}>
              <View style={styles.checklistHeader}>
                <Text style={styles.sectionLabel}>Objectives</Text>
                <Text style={styles.checklistCount}>
                  {objectives!.filter((o) => o.completed).length}/{objectives!.length}
                </Text>
              </View>
              {objectives!.map((obj) => (
                <View key={obj.id} style={styles.checkRow}>
                  <View style={[styles.checkIcon, obj.completed ? styles.checkIconDone : styles.checkIconMissed]}>
                    <Text style={styles.checkIconText}>{obj.completed ? '✓' : '✗'}</Text>
                  </View>
                  <Text style={[styles.checkText, !obj.completed && styles.checkTextMissed]}>
                    {obj.text}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Legacy single objective text (backward compat) */}
          {!hasChecklist && hasObjective && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Objective</Text>
              <Text style={styles.sectionText}>{session.objective}</Text>
            </View>
          )}

          {/* Outcome */}
          {session.outcome && (() => {
            const cfg = OUTCOME_CONFIG[session.outcome];
            return (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Outcome</Text>
                <Text style={[styles.outcomeBadge, { color: cfg.color }]}>
                  {cfg.label}
                </Text>
              </View>
            );
          })()}

          {/* Notes */}
          {hasNotes && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Session Notes</Text>
              <Text style={styles.sectionText}>{session.notes}</Text>
            </View>
          )}
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
  userName: {
    fontSize: 11,
    color: '#4a6d80',
    marginTop: 2,
    fontStyle: 'italic',
  },
  memberName: {
    fontSize: 12,
    color: '#7aa3b8',
    marginTop: 3,
    fontWeight: '600',
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
  actionsBtn: {
    fontSize: 18,
    color: '#4a6d80',
    fontWeight: '700',
    lineHeight: 20,
    marginTop: 2,
  },

  // Expanded content
  expandBox: {
    paddingHorizontal: 38,
    paddingBottom: 14,
    gap: 12,
  },
  section: {
    gap: 4,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4a6d80',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  sectionText: {
    fontSize: 14,
    color: '#a8c4d0',
    lineHeight: 20,
  },
  outcomeBadge: {
    fontSize: 14,
    fontWeight: '700',
  },

  // Checklist in expanded view
  checklistHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  checklistCount: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4a6d80',
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 5,
  },
  checkIcon: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkIconDone: {
    backgroundColor: '#4ade80',
  },
  checkIconMissed: {
    backgroundColor: '#4a6d80',
  },
  checkIconText: {
    fontSize: 9,
    color: '#1e3545',
    fontWeight: '700',
  },
  checkText: {
    flex: 1,
    fontSize: 13,
    color: '#a8c4d0',
    lineHeight: 18,
  },
  checkTextMissed: {
    color: '#4a6d80',
  },
});
