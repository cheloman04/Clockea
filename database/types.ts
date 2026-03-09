export interface Team {
  id: string;
  name: string;
  code: string;
  created_by: string | null;
}

export interface Project {
  id: number;
  name: string;
  color: string;
  description?: string;
  team_id?: string;
}

export interface Session {
  id: number;
  user_id: string;
  project_id: number;
  start_time: string;
  end_time: string | null;
  duration_minutes: number | null;
  break_start: string | null;
  total_break_seconds: number;
  notes?: string;
  objective?: string;
  outcome?: 'achieved' | 'partial' | 'missed';
  project_name?: string;
  project_color?: string;
  user_full_name?: string;
}

export interface SessionObjective {
  id: string;
  session_id: number;
  text: string;
  completed: boolean;
  position: number;
  created_at: string;
}
