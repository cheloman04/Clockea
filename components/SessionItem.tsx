import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Session, SessionInterval, SessionObjective } from '../database/types';
import { formatDate, formatMinutes, formatTime } from '../utils/time';
import { OUTCOME_CONFIG } from '../utils/outcomes';

interface SessionItemProps {
  session: Session;
  hideMember?: boolean;
  prominentMember?: boolean;
  onActions?: () => void;
  onResume?: () => void;
  objectives?: SessionObjective[];
  intervals?: SessionInterval[];
}

function SessionItem({ session, hideMember, prominentMember, onActions, onResume, objectives, intervals }: SessionItemProps) {
  const [expanded, setExpanded] = useState(false);

  const hasNotes     = !!session.notes?.trim();
  const hasObjective = !!session.objective?.trim();
  const hasChecklist = !!objectives && objectives.length > 0;
  const hasIntervals = !!intervals && intervals.length > 0;
  const hasExpanded  = hasNotes || hasObjective || hasChecklist || hasIntervals || !!onResume;

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
          {(session.client_name || session.activity_name) && (
            <Text style={styles.sessionMeta}>
              {[session.client_name, session.activity_name].filter(Boolean).join('  ·  ')}
            </Text>
          )}
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
          {session.outcome && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Outcome</Text>
              <Text style={[styles.outcomeBadge, { color: OUTCOME_CONFIG[session.outcome].color }]}>
                {OUTCOME_CONFIG[session.outcome].label}
              </Text>
            </View>
          )}

          {/* Date log (multiple work periods) */}
          {hasIntervals && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Work Periods</Text>
              {intervals!.map((iv, i) => {
                const mins = iv.end_time
                  ? Math.round((new Date(iv.end_time).getTime() - new Date(iv.start_time).getTime()) / 60000)
                  : null;
                return (
                  <View key={iv.id} style={styles.intervalRow}>
                    <View style={styles.intervalDot} />
                    <Text style={styles.intervalText}>
                      <Text style={styles.intervalIndex}>#{i + 1}  </Text>
                      {formatDate(iv.start_time)}  {formatTime(iv.start_time)}
                      {iv.end_time ? ` – ${formatTime(iv.end_time)}` : '  · ongoing'}
                    </Text>
                    {mins != null && (
                      <Text style={styles.intervalDuration}>{formatMinutes(mins)}</Text>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {/* Notes */}
          {hasNotes && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Session Notes</Text>
              <Text style={styles.sectionText}>{session.notes}</Text>
            </View>
          )}

          {/* Resume button */}
          {onResume && (
            <TouchableOpacity style={styles.resumeBtn} onPress={onResume} activeOpacity={0.8}>
              <Text style={styles.resumeBtnText}>↩ Resume Session</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

export default React.memo(SessionItem);

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
  sessionMeta: {
    fontSize: 12,
    color: '#fe7f2d',
    marginBottom: 2,
    fontWeight: '500',
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

  // Work periods / interval log
  intervalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 5,
  },
  intervalDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4a6d80',
    flexShrink: 0,
  },
  intervalText: {
    fontSize: 12,
    color: '#7aa3b8',
    lineHeight: 17,
  },
  intervalIndex: {
    color: '#4a6d80',
    fontWeight: '700',
  },
  intervalDuration: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fe7f2d',
    marginLeft: 'auto',
  },
  resumeBtn: {
    marginTop: 4,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#4ade80',
    alignItems: 'center',
    backgroundColor: '#1e4d3820',
  },
  resumeBtnText: {
    color: '#4ade80',
    fontSize: 13,
    fontWeight: '700',
  },
});
