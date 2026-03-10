export interface Team {
  id: string;
  name: string;
  code: string;
  created_by: string | null;
}

export interface Client {
  id: string;
  name: string;
  team_id: string;
  is_internal: boolean;
  created_by?: string;
  created_at: string;
}

export interface ActivityType {
  id: string;
  name: string;
  color: string;
  team_id: string;
}

export interface RecentCombo {
  client_id: string;
  project_id: number;
  activity_type_id: string;
  client_name: string;
  project_name: string;
  project_color: string;
  activity_name: string;
  activity_color: string;
}

export interface Project {
  id: number;
  name: string;
  color: string;
  description?: string;
  team_id?: string;
  client_id?: string;
  client_name?: string;
  status: 'active' | 'archived';
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
  // denormalized for display
  project_name?: string;
  project_color?: string;
  user_full_name?: string;
  client_id?: string;
  client_name?: string;
  activity_type_id?: string;
  activity_name?: string;
  activity_color?: string;
  is_billable: boolean;
}

export interface SessionObjective {
  id: string;
  session_id: number;
  text: string;
  completed: boolean;
  position: number;
  created_at: string;
}

export interface SessionInterval {
  id: string;
  session_id: number;
  start_time: string;
  end_time: string | null;
}
