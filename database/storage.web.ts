import { supabase } from '../lib/supabase';
import { ActivityType, Client, Project, RecentCombo, Session, SessionInterval, SessionObjective } from './types';

function ensureNoError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

async function getActiveTeamId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from('profiles')
    .select('active_team_id')
    .eq('id', user.id)
    .single();
  return profile?.active_team_id ?? null;
}

async function getTeamProjectIds(teamId: string): Promise<number[]> {
  const { data } = await supabase.from('projects').select('id').eq('team_id', teamId);
  return (data ?? []).map((p: any) => p.id);
}

async function enrichWithUserNames(sessions: any[]): Promise<any[]> {
  if (sessions.length === 0) return sessions;
  const userIds = [...new Set(sessions.map((s) => s.user_id))];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', userIds);
  const nameMap: Record<string, string> = Object.fromEntries(
    (profiles ?? []).map((p: any) => [p.id, p.full_name])
  );
  return sessions.map((s) => ({ ...s, user_full_name: nameMap[s.user_id] ?? null }));
}

// Core select: only joins projects (always accessible via team RLS).
// clients and activity_types are fetched separately to avoid RLS join failures.
const SESSION_SELECT = '*, projects!project_id(name, color)';

function mapSession(s: any): Session {
  return {
    ...s,
    project_name: s.projects?.name,
    project_color: s.projects?.color,
    client_name: s.client_name ?? null,   // filled in by enrichWithClientActivity
    activity_name: s.activity_name ?? null,
    activity_color: s.activity_color ?? null,
  };
}

async function enrichWithClientActivity(sessions: any[]): Promise<any[]> {
  if (sessions.length === 0) return sessions;
  // Collect unique client_ids and activity_type_ids
  const clientIds   = [...new Set(sessions.map((s) => s.client_id).filter(Boolean))];
  const activityIds = [...new Set(sessions.map((s) => s.activity_type_id).filter(Boolean))];
  const [clientsRes, activitiesRes] = await Promise.all([
    clientIds.length > 0
      ? supabase.from('clients').select('id, name').in('id', clientIds)
      : Promise.resolve({ data: [], error: null }),
    activityIds.length > 0
      ? supabase.from('activity_types').select('id, name, color').in('id', activityIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const clientMap: Record<string, string> = Object.fromEntries(
    (clientsRes.data ?? []).map((c: any) => [c.id, c.name])
  );
  const activityMap: Record<string, { name: string; color: string }> = Object.fromEntries(
    (activitiesRes.data ?? []).map((a: any) => [a.id, { name: a.name, color: a.color }])
  );
  return sessions.map((s) => ({
    ...s,
    client_name:    s.client_id        ? (clientMap[s.client_id]                ?? null) : null,
    activity_name:  s.activity_type_id ? (activityMap[s.activity_type_id]?.name ?? null) : null,
    activity_color: s.activity_type_id ? (activityMap[s.activity_type_id]?.color ?? null) : null,
  }));
}

export async function initDb(): Promise<void> {}

// ── Clients ───────────────────────────────────────────────────────────────────

export async function getClients(): Promise<Client[]> {
  const teamId = await getActiveTeamId();
  if (!teamId) return [];
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('team_id', teamId)
    .order('name');
  ensureNoError(error);
  return (data ?? []) as Client[];
}

export async function createClient(name: string, isInternal = false): Promise<Client> {
  const { data: { user } } = await supabase.auth.getUser();
  const teamId = await getActiveTeamId();
  if (!teamId) throw new Error('No active team.');
  const { data, error } = await supabase
    .from('clients')
    .insert({ name, team_id: teamId, is_internal: isInternal, created_by: user!.id })
    .select()
    .single();
  ensureNoError(error);
  return data as Client;
}

// ── Activity Types ─────────────────────────────────────────────────────────────

export async function getActivityTypes(): Promise<ActivityType[]> {
  const teamId = await getActiveTeamId();
  if (!teamId) return [];
  const { data, error } = await supabase
    .from('activity_types')
    .select('*')
    .eq('team_id', teamId)
    .order('name');
  ensureNoError(error);
  return (data ?? []) as ActivityType[];
}

export async function createActivityType(name: string, color = '#7aa3b8'): Promise<ActivityType> {
  const teamId = await getActiveTeamId();
  if (!teamId) throw new Error('No active team.');
  const { data, error } = await supabase
    .from('activity_types')
    .insert({ name, color, team_id: teamId })
    .select()
    .single();
  ensureNoError(error);
  return data as ActivityType;
}

// ── Recent Combos ──────────────────────────────────────────────────────────────

export async function getRecentCombos(): Promise<RecentCombo[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from('sessions')
    .select(
      'client_id, project_id, activity_type_id, start_time, ' +
      'clients!client_id(name), projects!project_id(name, color), activity_types!activity_type_id(name, color)'
    )
    .eq('user_id', user.id)
    .not('client_id', 'is', null)
    .not('activity_type_id', 'is', null)
    .not('end_time', 'is', null)
    .order('start_time', { ascending: false })
    .limit(50);
  if (error || !data) return [];

  // Deduplicate by (client_id, project_id, activity_type_id), keep most recent
  const seen = new Set<string>();
  const combos: RecentCombo[] = [];
  for (const s of data as any[]) {
    const key = `${s.client_id}|${s.project_id}|${s.activity_type_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    combos.push({
      client_id: s.client_id,
      project_id: s.project_id,
      activity_type_id: s.activity_type_id,
      client_name: s.clients?.name ?? '',
      project_name: s.projects?.name ?? '',
      project_color: s.projects?.color ?? '#ccc',
      activity_name: s.activity_types?.name ?? '',
      activity_color: s.activity_types?.color ?? '#7aa3b8',
    });
    if (combos.length >= 5) break;
  }
  return combos;
}

// ── Projects ───────────────────────────────────────────────────────────────────

export async function getProjects(clientId?: string): Promise<Project[]> {
  const teamId = await getActiveTeamId();
  if (!teamId) return [];
  let query = supabase
    .from('projects')
    .select('*, clients!client_id(name)')
    .eq('team_id', teamId)
    .eq('status', 'active')
    .order('name');
  if (clientId) query = query.eq('client_id', clientId);
  const { data, error } = await query;
  ensureNoError(error);
  return (data ?? []).map((p: any) => ({
    ...p,
    client_name: p.clients?.name,
  })) as Project[];
}

export async function getActiveSession(): Promise<Session | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('sessions')
    .select(SESSION_SELECT)
    .eq('user_id', user.id)
    .is('end_time', null)
    .order('start_time', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const [enriched] = await enrichWithClientActivity([mapSession(data)]);
  return enriched as Session;
}

export async function clockIn(
  projectId: number,
  activityTypeId?: string,
  opts?: { clientId?: string; isBillable?: boolean; objective?: string }
): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser();
  // Close any orphaned active sessions
  await supabase
    .from('sessions')
    .update({ end_time: new Date().toISOString() })
    .eq('user_id', user!.id)
    .is('end_time', null);
  const { data, error } = await supabase
    .from('sessions')
    .insert({
      project_id: projectId,
      user_id: user!.id,
      start_time: new Date().toISOString(),
      total_break_seconds: 0,
      ...(activityTypeId ? { activity_type_id: activityTypeId } : {}),
      ...(opts?.clientId ? { client_id: opts.clientId } : {}),
      ...(opts?.isBillable !== undefined ? { is_billable: opts.isBillable } : {}),
      ...(opts?.objective ? { objective: opts.objective } : {}),
    })
    .select('id')
    .single();
  ensureNoError(error);
  if (!data) throw new Error('Could not start session.');
  // Track first work interval
  await supabase.from('session_intervals').insert({ session_id: data.id, start_time: new Date().toISOString() });
  return data.id;
}

export async function clockOut(sessionId: number): Promise<void> {
  const { error } = await supabase.rpc('clock_out_session', { p_session_id: sessionId });
  if (error) throw new Error(error.message);
  // Close current open interval
  await supabase
    .from('session_intervals')
    .update({ end_time: new Date().toISOString() })
    .eq('session_id', sessionId)
    .is('end_time', null);
}

export async function resumeSession(sessionId: number, breakSeconds: number): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { data: sess } = await supabase
    .from('sessions')
    .select('total_break_seconds')
    .eq('id', sessionId)
    .single();
  const { error } = await supabase
    .from('sessions')
    .update({
      end_time: null,
      total_break_seconds: (sess?.total_break_seconds ?? 0) + breakSeconds,
    })
    .eq('id', sessionId)
    .eq('user_id', user.id);
  ensureNoError(error);
  const { error: intervalError } = await supabase
    .from('session_intervals')
    .insert({ session_id: sessionId, start_time: new Date().toISOString() });
  ensureNoError(intervalError);
}

export async function startBreak(sessionId: number): Promise<void> {
  const { error } = await supabase
    .from('sessions')
    .update({ break_start: new Date().toISOString() })
    .eq('id', sessionId);
  ensureNoError(error);
}

export async function endBreak(sessionId: number): Promise<void> {
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('break_start, total_break_seconds')
    .eq('id', sessionId)
    .single();
  ensureNoError(sessionError);
  if (!session?.break_start) return;

  const breakSeconds = Math.floor((Date.now() - new Date(session.break_start).getTime()) / 1000);
  const { error } = await supabase
    .from('sessions')
    .update({
      break_start: null,
      total_break_seconds: (session.total_break_seconds ?? 0) + breakSeconds,
    })
    .eq('id', sessionId);
  ensureNoError(error);
}

export async function getTodaySessions(): Promise<Session[]> {
  const teamId = await getActiveTeamId();
  if (!teamId) { console.error('[getTodaySessions] no active teamId'); return []; }
  const projectIds = await getTeamProjectIds(teamId);
  if (projectIds.length === 0) { console.error('[getTodaySessions] no project IDs for team', teamId); return []; }
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('sessions')
    .select(SESSION_SELECT)
    .in('project_id', projectIds)
    .gte('start_time', `${today}T00:00:00`)
    .not('end_time', 'is', null)
    .order('start_time', { ascending: false });
  if (error) { console.error('[getTodaySessions] query error', error); return []; }
  if (!data) return [];
  const raw = (data as any[]).map(mapSession);
  const enriched = await enrichWithClientActivity(raw);
  return (await enrichWithUserNames(enriched)) as Session[];
}

export async function getRecentSessions(limit = 4): Promise<Session[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from('sessions')
    .select(SESSION_SELECT)
    .eq('user_id', user.id)
    .not('end_time', 'is', null)
    .order('start_time', { ascending: false })
    .limit(limit);
  if (error) { console.error('[getRecentSessions] query error', error); return []; }
  if (!data) return [];
  const raw = (data as any[]).map(mapSession);
  return (await enrichWithClientActivity(raw)) as Session[];
}

export async function getAllSessions(): Promise<Session[]> {
  const teamId = await getActiveTeamId();
  if (!teamId) { console.error('[getAllSessions] no active teamId'); return []; }
  const projectIds = await getTeamProjectIds(teamId);
  if (projectIds.length === 0) { console.error('[getAllSessions] no project IDs for team', teamId); return []; }
  const { data, error } = await supabase
    .from('sessions')
    .select(SESSION_SELECT)
    .in('project_id', projectIds)
    .not('end_time', 'is', null)
    .order('start_time', { ascending: false });
  if (error) { console.error('[getAllSessions] query error', error); return []; }
  if (!data) return [];
  const raw = (data as any[]).map(mapSession);
  const enriched = await enrichWithClientActivity(raw);
  return (await enrichWithUserNames(enriched)) as Session[];
}

export async function getTodayTotalMinutes(): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('sessions')
    .select('duration_minutes')
    .eq('user_id', user.id)
    .gte('start_time', `${today}T00:00:00`)
    .not('end_time', 'is', null);
  if (error || !data) return 0;
  return data.reduce((sum: number, s: any) => sum + (s.duration_minutes ?? 0), 0);
}

export async function createProject(name: string, color: string, description?: string, clientId?: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  const teamId = await getActiveTeamId();
  if (!teamId) throw new Error('No active team. Join or create a team first.');
  const { error } = await supabase
    .from('projects')
    .insert({
      name, color, description: description ?? '', team_id: teamId, user_id: user!.id,
      ...(clientId ? { client_id: clientId } : {}),
    });
  ensureNoError(error);
}

export async function updateProject(
  id: number,
  name: string,
  color: string,
  description: string
): Promise<void> {
  const { error } = await supabase.from('projects').update({ name, color, description }).eq('id', id);
  ensureNoError(error);
}

export async function getSessionsInRange(from: string, to: string): Promise<Session[]> {
  const teamId = await getActiveTeamId();
  if (!teamId) return [];
  const projectIds = await getTeamProjectIds(teamId);
  if (projectIds.length === 0) return [];
  const { data, error } = await supabase
    .from('sessions')
    .select(SESSION_SELECT)
    .in('project_id', projectIds)
    .gte('start_time', from)
    .lte('start_time', to)
    .not('end_time', 'is', null);
  if (error) { console.error('[getSessionsInRange] query error', error); return []; }
  if (!data) return [];
  const raw = (data as any[]).map(mapSession);
  const enriched = await enrichWithClientActivity(raw);
  return (await enrichWithUserNames(enriched)) as Session[];
}

export async function saveSessionNotes(sessionId: number, notes: string): Promise<void> {
  const { error } = await supabase.from('sessions').update({ notes }).eq('id', sessionId);
  ensureNoError(error);
}

export async function updateSessionDetails(
  sessionId: number,
  updates: { startTime: string; endTime: string; notes: string }
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const startMs = new Date(updates.startTime).getTime();
  const endMs = new Date(updates.endTime).getTime();

  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    throw new Error('Invalid session time.');
  }

  if (endMs <= startMs) {
    throw new Error('End time must be after start time.');
  }

  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('id')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single();
  ensureNoError(sessionError);

  if (!session) {
    throw new Error('Session not found.');
  }

  const { error } = await supabase
    .from('sessions')
    .update({
      start_time: updates.startTime,
      end_time: updates.endTime,
      notes: updates.notes,
      break_start: null,
    })
    .eq('id', sessionId)
    .eq('user_id', user.id);
  ensureNoError(error);

  const { data: intervals, error: intervalsError } = await supabase
    .from('session_intervals')
    .select('id, start_time, end_time')
    .eq('session_id', sessionId)
    .order('start_time', { ascending: true });
  ensureNoError(intervalsError);

  if (!intervals || intervals.length === 0) return;

  const firstInterval = intervals[0];
  const lastInterval = intervals[intervals.length - 1];

  const { error: firstError } = await supabase
    .from('session_intervals')
    .update({ start_time: updates.startTime })
    .eq('id', firstInterval.id);
  ensureNoError(firstError);

  const { error: lastError } = await supabase
    .from('session_intervals')
    .update({ end_time: updates.endTime })
    .eq('id', lastInterval.id);
  ensureNoError(lastError);
}

export async function saveSessionOutcome(
  sessionId: number,
  outcome: 'achieved' | 'partial' | 'missed'
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { error } = await supabase
    .from('sessions')
    .update({ outcome })
    .eq('id', sessionId)
    .eq('user_id', user.id);
  ensureNoError(error);
}

export async function deleteSession(sessionId: number): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { error } = await supabase
    .from('sessions')
    .delete()
    .eq('id', sessionId)
    .eq('user_id', user.id);
  ensureNoError(error);
}

export async function getActiveSessions(): Promise<Session[]> {
  const teamId = await getActiveTeamId();
  if (!teamId) return [];
  const projectIds = await getTeamProjectIds(teamId);
  if (projectIds.length === 0) return [];
  const { data, error } = await supabase
    .from('sessions')
    .select(SESSION_SELECT)
    .in('project_id', projectIds)
    .is('end_time', null)
    .order('start_time', { ascending: true });
  if (error) { console.error('[getActiveSessions] query error', error); return []; }
  if (!data) return [];
  const raw = (data as any[]).map(mapSession);
  const enriched = await enrichWithClientActivity(raw);
  return (await enrichWithUserNames(enriched)) as Session[];
}

export async function createSessionObjectives(sessionId: number, texts: string[]): Promise<void> {
  if (texts.length === 0) return;
  const items = texts.map((text, i) => ({ session_id: sessionId, text, position: i, completed: false }));
  const { error } = await supabase.from('session_objectives').insert(items);
  ensureNoError(error);
}

export async function toggleObjectiveComplete(objectiveId: string, completed: boolean): Promise<void> {
  const { error } = await supabase
    .from('session_objectives')
    .update({ completed })
    .eq('id', objectiveId);
  ensureNoError(error);
}

export async function getSessionObjectives(sessionId: number): Promise<SessionObjective[]> {
  const { data, error } = await supabase
    .from('session_objectives')
    .select('*')
    .eq('session_id', sessionId)
    .order('position', { ascending: true });
  if (error || !data) return [];
  return data as SessionObjective[];
}

export async function getObjectivesForSessions(sessionIds: number[]): Promise<Record<number, SessionObjective[]>> {
  if (sessionIds.length === 0) return {};
  const { data, error } = await supabase
    .from('session_objectives')
    .select('*')
    .in('session_id', sessionIds)
    .order('position', { ascending: true });
  if (error || !data) return {};
  const result: Record<number, SessionObjective[]> = {};
  for (const obj of data as SessionObjective[]) {
    if (!result[obj.session_id]) result[obj.session_id] = [];
    result[obj.session_id].push(obj);
  }
  return result;
}

export async function getIntervalsForSessions(sessionIds: number[]): Promise<Record<number, SessionInterval[]>> {
  if (sessionIds.length === 0) return {};
  const { data, error } = await supabase
    .from('session_intervals')
    .select('*')
    .in('session_id', sessionIds)
    .order('start_time', { ascending: true });
  if (error || !data) return {};
  const result: Record<number, SessionInterval[]> = {};
  for (const iv of data as SessionInterval[]) {
    if (!result[iv.session_id]) result[iv.session_id] = [];
    result[iv.session_id].push(iv);
  }
  return result;
}
