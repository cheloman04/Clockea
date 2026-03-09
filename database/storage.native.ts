import { supabase } from '../lib/supabase';
import { Project, Session, SessionObjective } from './types';

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

export async function initDb(): Promise<void> {}

export async function getProjects(): Promise<Project[]> {
  const teamId = await getActiveTeamId();
  if (!teamId) return [];
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('team_id', teamId)
    .order('name');
  ensureNoError(error);
  return (data ?? []) as Project[];
}

export async function getActiveSession(): Promise<Session | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('sessions')
    .select('*, projects!project_id(name, color)')
    .eq('user_id', user.id)
    .is('end_time', null)
    .order('start_time', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const p = data.projects as { name: string; color: string } | null;
  return { ...data, project_name: p?.name, project_color: p?.color } as Session;
}

export async function clockIn(projectId: number, objective?: string): Promise<number> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Close any orphaned active sessions before starting a new one
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
      ...(objective ? { objective } : {}),
    })
    .select('id')
    .single();
  ensureNoError(error);
  if (!data) throw new Error('Could not start session.');
  return data.id;
}

export async function clockOut(sessionId: number): Promise<void> {
  const { error } = await supabase.rpc('clock_out_session', { p_session_id: sessionId });
  if (error) throw new Error(error.message);
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
  if (!teamId) return [];
  const projectIds = await getTeamProjectIds(teamId);
  if (projectIds.length === 0) return [];
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('sessions')
    .select('*, projects!project_id(name, color)')
    .in('project_id', projectIds)
    .gte('start_time', `${today}T00:00:00`)
    .not('end_time', 'is', null)
    .order('start_time', { ascending: false });
  if (error || !data) return [];
  const raw = data.map((s: any) => ({
    ...s,
    project_name: s.projects?.name,
    project_color: s.projects?.color,
  }));
  return (await enrichWithUserNames(raw)) as Session[];
}

export async function getAllSessions(): Promise<Session[]> {
  const teamId = await getActiveTeamId();
  if (!teamId) return [];
  const projectIds = await getTeamProjectIds(teamId);
  if (projectIds.length === 0) return [];
  const { data, error } = await supabase
    .from('sessions')
    .select('*, projects!project_id(name, color)')
    .in('project_id', projectIds)
    .not('end_time', 'is', null)
    .order('start_time', { ascending: false });
  if (error || !data) return [];
  const raw = data.map((s: any) => ({
    ...s,
    project_name: s.projects?.name,
    project_color: s.projects?.color,
  }));
  return (await enrichWithUserNames(raw)) as Session[];
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

export async function createProject(name: string, color: string, description?: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  const teamId = await getActiveTeamId();
  if (!teamId) throw new Error('No active team. Join or create a team first.');
  const { error } = await supabase
    .from('projects')
    .insert({ name, color, description: description ?? '', team_id: teamId, user_id: user!.id });
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
    .select('*, projects!project_id(name, color)')
    .in('project_id', projectIds)
    .gte('start_time', from)
    .lte('start_time', to)
    .not('end_time', 'is', null);
  if (error || !data) return [];
  const raw = data.map((s: any) => ({
    ...s,
    project_name: s.projects?.name,
    project_color: s.projects?.color,
  }));
  return (await enrichWithUserNames(raw)) as Session[];
}

export async function saveSessionNotes(sessionId: number, notes: string): Promise<void> {
  const { error } = await supabase.from('sessions').update({ notes }).eq('id', sessionId);
  ensureNoError(error);
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
    .select('*, projects!project_id(name, color)')
    .in('project_id', projectIds)
    .is('end_time', null)
    .order('start_time', { ascending: true });
  if (error || !data) return [];
  const raw = data.map((s: any) => ({
    ...s,
    project_name: s.projects?.name,
    project_color: s.projects?.color,
  }));
  return (await enrichWithUserNames(raw)) as Session[];
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
