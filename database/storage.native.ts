import * as SQLite from 'expo-sqlite';
import { Project, Session } from './types';

const db = SQLite.openDatabaseSync('timetracker.db');

export function initDb(): void {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      color TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT,
      duration_minutes REAL,
      FOREIGN KEY (project_id) REFERENCES projects (id)
    );
  `);

  // Migrations — safe to run each time (fail silently if column exists)
  try { db.execSync(`ALTER TABLE projects ADD COLUMN description TEXT NOT NULL DEFAULT ''`); } catch {}
  try { db.execSync(`ALTER TABLE sessions ADD COLUMN break_start TEXT`); } catch {}
  try { db.execSync(`ALTER TABLE sessions ADD COLUMN total_break_seconds INTEGER NOT NULL DEFAULT 0`); } catch {}
  try { db.execSync(`ALTER TABLE sessions ADD COLUMN notes TEXT`); } catch {}

  const count = db.getFirstSync<{ count: number }>(
    'SELECT COUNT(*) as count FROM projects'
  );

  if (count?.count === 0) {
    db.execSync(`
      INSERT INTO projects (name, color) VALUES ('Personal', '#4CAF50');
      INSERT INTO projects (name, color) VALUES ('Work', '#2196F3');
      INSERT INTO projects (name, color) VALUES ('Learning', '#FF9800');
    `);
  }
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
  const result = db.runSync(
    'INSERT INTO sessions (project_id, start_time, total_break_seconds) VALUES (?, ?, 0)',
    [projectId, new Date().toISOString()]
  );
  return result.lastInsertRowId;
}

export function clockOut(sessionId: number): void {
  const endTime = new Date().toISOString();
  const session = db.getFirstSync<Pick<Session, 'start_time' | 'total_break_seconds' | 'break_start'>>(
    'SELECT start_time, total_break_seconds, break_start FROM sessions WHERE id = ?',
    [sessionId]
  );
  if (!session) return;

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

  db.runSync(
    'UPDATE sessions SET end_time = ?, duration_minutes = ?, break_start = NULL WHERE id = ?',
    [endTime, durationMinutes, sessionId]
  );
}

export function startBreak(sessionId: number): void {
  db.runSync(
    'UPDATE sessions SET break_start = ? WHERE id = ?',
    [new Date().toISOString(), sessionId]
  );
}

export function endBreak(sessionId: number): void {
  const session = db.getFirstSync<Pick<Session, 'break_start' | 'total_break_seconds'>>(
    'SELECT break_start, total_break_seconds FROM sessions WHERE id = ?',
    [sessionId]
  );
  if (!session?.break_start) return;

  const breakSeconds = Math.floor(
    (Date.now() - new Date(session.break_start).getTime()) / 1000
  );
  db.runSync(
    'UPDATE sessions SET break_start = NULL, total_break_seconds = ? WHERE id = ?',
    [(session.total_break_seconds ?? 0) + breakSeconds, sessionId]
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

export function updateProject(id: number, name: string, color: string, description: string): void {
  db.runSync(
    'UPDATE projects SET name = ?, color = ?, description = ? WHERE id = ?',
    [name, color, description, id]
  );
}

export function getSessionsInRange(from: string, to: string): Session[] {
  return db.getAllSync<Session>(
    `SELECT s.*, p.name as project_name, p.color as project_color
     FROM sessions s
     JOIN projects p ON s.project_id = p.id
     WHERE s.end_time IS NOT NULL AND s.start_time >= ? AND s.start_time <= ?
     ORDER BY s.start_time DESC`,
    [from, to]
  );
}

export function saveSessionNotes(sessionId: number, notes: string): void {
  db.runSync('UPDATE sessions SET notes = ? WHERE id = ?', [notes, sessionId]);
}
