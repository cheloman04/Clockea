import { Project, Session } from './types';

export function initDb(): void;
export function getProjects(): Project[];
export function getActiveSession(): Session | null;
export function clockIn(projectId: number): number;
export function clockOut(sessionId: number): void;
export function getTodaySessions(): Session[];
export function getAllSessions(): Session[];
export function getTodayTotalMinutes(): number;
export function createProject(name: string, color: string): void;
export function updateProject(id: number, name: string, color: string, description: string): void;
export function getSessionsInRange(from: string, to: string): Session[];
export function startBreak(sessionId: number): void;
export function endBreak(sessionId: number): void;
export function saveSessionNotes(sessionId: number, notes: string): void;
