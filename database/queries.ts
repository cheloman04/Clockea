import db from './db';

export interface Project {
  id: number;
  name: string;
  color: string;
}

export interface Session {
  id: number;
  project_id: number;
  start_time: string;
  end_time: string | null;
  duration_minutes: number | null;
  project_name?: string;
  project_color?: string;
}

export function getProjects(): Project[] {
  return db.getAllSync<Project>('SELECT * FROM projects ORDER BY name');
}

export function getActiveSession(): Session | null {
  return db.getFirstSync<Session>(
    `SELECT s.*, p.name as project_name, p.color as project_color
     FROM sessions s
     JOIN projects p ON s.project_id = p.id
     WHERE s.end_time IS NULL
     LIMIT 1`
  );
}

export function clockIn(projectId: number): number {
  const startTime = new Date().toISOString();
  const result = db.runSync(
    'INSERT INTO sessions (project_id, start_time) VALUES (?, ?)',
    [projectId, startTime]
  );
  return result.lastInsertRowId;
}

export function clockOut(sessionId: number): void {
  const endTime = new Date().toISOString();
  const session = db.getFirstSync<Pick<Session, 'start_time'>>(
    'SELECT start_time FROM sessions WHERE id = ?',
    [sessionId]
  );
  if (!session) return;

  const durationMinutes =
    (new Date(endTime).getTime() - new Date(session.start_time).getTime()) /
    60000;

  db.runSync(
    'UPDATE sessions SET end_time = ?, duration_minutes = ? WHERE id = ?',
    [endTime, durationMinutes, sessionId]
  );
}

export function getTodaySessions(): Session[] {
  const today = new Date().toISOString().split('T')[0];
  return db.getAllSync<Session>(
    `SELECT s.*, p.name as project_name, p.color as project_color
     FROM sessions s
     JOIN projects p ON s.project_id = p.id
     WHERE s.start_time LIKE ? AND s.end_time IS NOT NULL
     ORDER BY s.start_time DESC`,
    [`${today}%`]
  );
}

export function getAllSessions(): Session[] {
  return db.getAllSync<Session>(
    `SELECT s.*, p.name as project_name, p.color as project_color
     FROM sessions s
     JOIN projects p ON s.project_id = p.id
     WHERE s.end_time IS NOT NULL
     ORDER BY s.start_time DESC`
  );
}

export function getTodayTotalMinutes(): number {
  const today = new Date().toISOString().split('T')[0];
  const result = db.getFirstSync<{ total: number }>(
    `SELECT COALESCE(SUM(duration_minutes), 0) as total
     FROM sessions
     WHERE start_time LIKE ? AND end_time IS NOT NULL`,
    [`${today}%`]
  );
  return result?.total ?? 0;
}

export function createProject(name: string, color: string): void {
  db.runSync('INSERT INTO projects (name, color) VALUES (?, ?)', [name, color]);
}
