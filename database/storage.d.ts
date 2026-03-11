import { ActivityType, Client, Project, RecentCombo, Session, SessionInterval, SessionObjective } from './types';

export function initDb(): Promise<void>;

// Clients
export function getClients(): Promise<Client[]>;
export function createClient(name: string, isInternal?: boolean): Promise<Client>;

// Activity Types
export function getActivityTypes(): Promise<ActivityType[]>;
export function createActivityType(name: string, color?: string): Promise<ActivityType>;

// Recent Combos
export function getRecentCombos(): Promise<RecentCombo[]>;

// Projects
export function getProjects(clientId?: string): Promise<Project[]>;
export function createProject(name: string, color: string, description?: string, clientId?: string): Promise<void>;
export function updateProject(id: number, name: string, color: string, description: string): Promise<void>;

// Sessions
export function getActiveSession(): Promise<Session | null>;
export function clockIn(
  projectId: number,
  activityTypeId?: string,
  opts?: { clientId?: string; isBillable?: boolean; objective?: string }
): Promise<number>;
export function clockOut(sessionId: number): Promise<void>;
export function resumeSession(sessionId: number, breakSeconds: number): Promise<void>;
export function startBreak(sessionId: number): Promise<void>;
export function endBreak(sessionId: number): Promise<void>;
export function getTodaySessions(): Promise<Session[]>;
export function getRecentSessions(limit?: number): Promise<Session[]>;
export function getAllSessions(): Promise<Session[]>;
export function getActiveSessions(): Promise<Session[]>;
export function getTodayTotalMinutes(): Promise<number>;
export function getSessionsInRange(from: string, to: string): Promise<Session[]>;
export function saveSessionNotes(sessionId: number, notes: string): Promise<void>;
export function saveSessionOutcome(sessionId: number, outcome: 'achieved' | 'partial' | 'missed'): Promise<void>;
export function deleteSession(sessionId: number): Promise<void>;

// Session Objectives
export function createSessionObjectives(sessionId: number, texts: string[]): Promise<void>;
export function toggleObjectiveComplete(objectiveId: string, completed: boolean): Promise<void>;
export function getSessionObjectives(sessionId: number): Promise<SessionObjective[]>;
export function getObjectivesForSessions(sessionIds: number[]): Promise<Record<number, SessionObjective[]>>;
export function getIntervalsForSessions(sessionIds: number[]): Promise<Record<number, SessionInterval[]>>;
