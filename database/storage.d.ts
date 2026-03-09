import { Project, Session } from './types';

export function initDb(): Promise<void>;
export function getProjects(): Promise<Project[]>;
export function getActiveSession(): Promise<Session | null>;
export function clockIn(projectId: number): Promise<number>;
export function clockOut(sessionId: number): Promise<void>;
export function getTodaySessions(): Promise<Session[]>;
export function getAllSessions(): Promise<Session[]>;
export function getTodayTotalMinutes(): Promise<number>;
export function createProject(name: string, color: string): Promise<void>;
export function updateProject(id: number, name: string, color: string, description: string): Promise<void>;
export function getSessionsInRange(from: string, to: string): Promise<Session[]>;
export function startBreak(sessionId: number): Promise<void>;
export function endBreak(sessionId: number): Promise<void>;
export function saveSessionNotes(sessionId: number, notes: string): Promise<void>;
