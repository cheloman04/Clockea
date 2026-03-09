import { supabase } from '../lib/supabase';
import { Project, Session } from './types';

function ensureNoError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function initDb(): Promise<void> {
  // Supabase manages the schema; nothing to initialize client-side
}

export async function getProjects(): Promise<Project[]> {
  const { data, error } = await supabase.from('projects').select('*').order('name');
  ensureNoError(error);
  if (!data) return [];
  return data as Project[];
}

export async function getActiveSession(): Promise<Session | null> {
  const { data, error } = await supabase
    .from('sessions')
    .select('*, projects!project_id(name, color)')
    .is('end_time', null)
    .maybeSingle();
  if (error || !data) return null;
  const p = data.projects as { name: string; color: string } | null;
  return { ...data, project_name: p?.name, project_color: p?.color } as Session;
}

export async function clockIn(projectId: number): Promise<number> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('sessions')
    .insert({
      project_id: projectId,
      user_id: user!.id,
      start_time: new Date().toISOString(),
      total_break_seconds: 0,
    })
    .select('id')
    .single();
  ensureNoError(error);
  if (!data) throw new Error('Could not start session.');
  return data.id;
}

export async function clockOut(sessionId: number): Promise<void> {
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('start_time, break_start, total_break_seconds')
    .eq('id', sessionId)
    .single();
  ensureNoError(sessionError);
  if (!session) return;

  const endTime = new Date().toISOString();
  let totalBreakSeconds = session.total_break_seconds ?? 0;
  if (session.break_start) {
    totalBreakSeconds += Math.floor(
      (new Date(endTime).getTime() - new Date(session.break_start).getTime()) / 1000
    );
  }
  const totalSeconds =
    (new Date(endTime).getTime() - new Date(session.start_time).getTime()) / 1000;
  const durationMinutes = (totalSeconds - totalBreakSeconds) / 60;

  const { error } = await supabase
    .from('sessions')
    .update({
      end_time: endTime,
      duration_minutes: durationMinutes,
      break_start: null,
      total_break_seconds: totalBreakSeconds,
    })
    .eq('id', sessionId);
  ensureNoError(error);
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
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('sessions')
    .select('*, projects!project_id(name, color)')
    .gte('start_time', `${today}T00:00:00`)
    .not('end_time', 'is', null)
    .order('start_time', { ascending: false });
  if (error || !data) return [];
  return data.map((s: any) => ({
    ...s,
    project_name: s.projects?.name,
    project_color: s.projects?.color,
  })) as Session[];
}

export async function getAllSessions(): Promise<Session[]> {
  const { data, error } = await supabase
    .from('sessions')
    .select('*, projects!project_id(name, color)')
    .not('end_time', 'is', null)
    .order('start_time', { ascending: false });
  if (error || !data) return [];
  return data.map((s: any) => ({
    ...s,
    project_name: s.projects?.name,
    project_color: s.projects?.color,
  })) as Session[];
}

export async function getTodayTotalMinutes(): Promise<number> {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('sessions')
    .select('duration_minutes')
    .gte('start_time', `${today}T00:00:00`)
    .not('end_time', 'is', null);
  if (error || !data) return 0;
  return data.reduce((sum: number, s: any) => sum + (s.duration_minutes ?? 0), 0);
}

export async function createProject(name: string, color: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('projects')
    .insert({ name, color, description: '', user_id: user!.id });
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
  const { data, error } = await supabase
    .from('sessions')
    .select('*, projects!project_id(name, color)')
    .gte('start_time', from)
    .lte('start_time', to)
    .not('end_time', 'is', null);
  if (error || !data) return [];
  return data.map((s: any) => ({
    ...s,
    project_name: s.projects?.name,
    project_color: s.projects?.color,
  })) as Session[];
}

export async function saveSessionNotes(sessionId: number, notes: string): Promise<void> {
  const { error } = await supabase.from('sessions').update({ notes }).eq('id', sessionId);
  ensureNoError(error);
}
