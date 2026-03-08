import { Project, Session } from './types';

const KEYS = {
  projects: 'tt_projects',
  sessions: 'tt_sessions',
  nextId: 'tt_next_id',
};

const DEFAULT_PROJECTS: Project[] = [
  { id: 1, name: 'Personal', color: '#4CAF50' },
  { id: 2, name: 'Work', color: '#2196F3' },
  { id: 3, name: 'Learning', color: '#FF9800' },
];

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

function nextId(): number {
  const current = parseInt(localStorage.getItem(KEYS.nextId) ?? '0', 10);
  const next = current + 1;
  localStorage.setItem(KEYS.nextId, String(next));
  return next;
}

function loadProjects(): Project[] {
  return load<Project[]>(KEYS.projects, []);
}

function loadSessions(): Session[] {
  return load<Session[]>(KEYS.sessions, []);
}

export function initDb(): void {
  if (loadProjects().length === 0) {
    save(KEYS.projects, DEFAULT_PROJECTS);
    localStorage.setItem(KEYS.nextId, '3');
  }
}

export function getProjects(): Project[] {
  return loadProjects().sort((a, b) => a.name.localeCompare(b.name));
}

export function getActiveSession(): Session | null {
  const projects = loadProjects();
  const active = loadSessions().find((s) => s.end_time == null) ?? null;
  if (!active) return null;
  const project = projects.find((p) => p.id === active.project_id);
  return { ...active, project_name: project?.name, project_color: project?.color };
}

export function clockIn(projectId: number): number {
  const id = nextId();
  const sessions = loadSessions();
  sessions.push({
    id,
    project_id: projectId,
    start_time: new Date().toISOString(),
    end_time: null,
    duration_minutes: null,
    break_start: null,
    total_break_seconds: 0,
  });
  save(KEYS.sessions, sessions);
  return id;
}

export function clockOut(sessionId: number): void {
  const sessions = loadSessions();
  const idx = sessions.findIndex((s) => s.id === sessionId);
  if (idx === -1) return;

  const endTime = new Date().toISOString();
  const session = sessions[idx];

  // If clocking out while on a break, count that break time too
  let totalBreakSeconds = session.total_break_seconds ?? 0;
  if (session.break_start) {
    totalBreakSeconds += Math.floor(
      (new Date(endTime).getTime() - new Date(session.break_start).getTime()) / 1000
    );
  }

  const totalSeconds =
    (new Date(endTime).getTime() - new Date(session.start_time).getTime()) / 1000;
  const durationMinutes = (totalSeconds - totalBreakSeconds) / 60;

  sessions[idx] = { ...session, end_time: endTime, duration_minutes: durationMinutes, break_start: null };
  save(KEYS.sessions, sessions);
}

export function startBreak(sessionId: number): void {
  const sessions = loadSessions();
  const idx = sessions.findIndex((s) => s.id === sessionId);
  if (idx === -1) return;
  sessions[idx] = { ...sessions[idx], break_start: new Date().toISOString() };
  save(KEYS.sessions, sessions);
}

export function endBreak(sessionId: number): void {
  const sessions = loadSessions();
  const idx = sessions.findIndex((s) => s.id === sessionId);
  if (idx === -1 || !sessions[idx].break_start) return;
  const breakSeconds = Math.floor(
    (Date.now() - new Date(sessions[idx].break_start!).getTime()) / 1000
  );
  sessions[idx] = {
    ...sessions[idx],
    break_start: null,
    total_break_seconds: (sessions[idx].total_break_seconds ?? 0) + breakSeconds,
  };
  save(KEYS.sessions, sessions);
}

export function getTodaySessions(): Session[] {
  const today = new Date().toISOString().split('T')[0];
  const projects = loadProjects();
  return loadSessions()
    .filter((s) => s.start_time.startsWith(today) && s.end_time != null)
    .sort((a, b) => b.start_time.localeCompare(a.start_time))
    .map((s) => {
      const project = projects.find((p) => p.id === s.project_id);
      return { ...s, project_name: project?.name, project_color: project?.color };
    });
}

export function getAllSessions(): Session[] {
  const projects = loadProjects();
  return loadSessions()
    .filter((s) => s.end_time != null)
    .sort((a, b) => b.start_time.localeCompare(a.start_time))
    .map((s) => {
      const project = projects.find((p) => p.id === s.project_id);
      return { ...s, project_name: project?.name, project_color: project?.color };
    });
}

export function getTodayTotalMinutes(): number {
  const today = new Date().toISOString().split('T')[0];
  return loadSessions()
    .filter((s) => s.start_time.startsWith(today) && s.end_time != null)
    .reduce((sum, s) => sum + (s.duration_minutes ?? 0), 0);
}

export function createProject(name: string, color: string): void {
  const projects = loadProjects();
  projects.push({ id: nextId(), name, color });
  save(KEYS.projects, projects);
}

export function updateProject(id: number, name: string, color: string, description: string): void {
  const projects = loadProjects();
  const idx = projects.findIndex((p) => p.id === id);
  if (idx === -1) return;
  projects[idx] = { ...projects[idx], name, color, description };
  save(KEYS.projects, projects);
}

export function getSessionsInRange(from: string, to: string): Session[] {
  const projects = loadProjects();
  return loadSessions()
    .filter((s) => s.end_time != null && s.start_time >= from && s.start_time <= to)
    .map((s) => {
      const project = projects.find((p) => p.id === s.project_id);
      return { ...s, project_name: project?.name, project_color: project?.color };
    });
}

export function saveSessionNotes(sessionId: number, notes: string): void {
  const sessions = loadSessions();
  const idx = sessions.findIndex((s) => s.id === sessionId);
  if (idx === -1) return;
  sessions[idx] = { ...sessions[idx], notes };
  save(KEYS.sessions, sessions);
}
