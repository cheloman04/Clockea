export interface Project {
  id: number;
  name: string;
  color: string;
  description?: string;
}

export interface Session {
  id: number;
  project_id: number;
  start_time: string;
  end_time: string | null;
  duration_minutes: number | null;
  break_start: string | null;
  total_break_seconds: number;
  notes?: string;
  project_name?: string;
  project_color?: string;
}
