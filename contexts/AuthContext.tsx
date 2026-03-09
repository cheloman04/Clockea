import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Team } from '../database/types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  activeTeamId: string | null;
  userTeams: Team[];
  switchTeam: (teamId: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string, fullName: string, teamCode?: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  joinTeam: (code: string) => Promise<string | null>;
  createTeam: (name: string) => Promise<{ code: string | null; error: string | null }>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null);
  const [userTeams, setUserTeams] = useState<Team[]>([]);

  const loadTeamsForUser = useCallback(async (userId: string) => {
    // Fetch current user (for pending_team_code in metadata)
    const { data: { user: currentUser } } = await supabase.auth.getUser();

    // Fetch profile to get both legacy team_id and active_team_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('team_id, active_team_id, full_name')
      .eq('id', userId)
      .single();

    // Sync full_name from user_metadata → profiles if missing
    const metaName = currentUser?.user_metadata?.full_name as string | undefined;
    if (metaName && !profile?.full_name) {
      await supabase.from('profiles').update({ full_name: metaName }).eq('id', userId);
    }

    // Fetch team_members rows
    const { data: memberRows } = await supabase
      .from('team_members')
      .select('teams!team_id(id, name, code, created_by)')
      .eq('user_id', userId);

    let teams: Team[] = (memberRows ?? [])
      .map((r: any) => r.teams)
      .filter(Boolean);

    // Auto-join pending team from signup metadata (first login after email confirmation)
    const pendingCode = currentUser?.user_metadata?.pending_team_code;
    if (teams.length === 0 && pendingCode) {
      const { data: pendingTeam } = await supabase
        .from('teams')
        .select('id')
        .eq('code', pendingCode)
        .single();
      if (pendingTeam) {
        await supabase
          .from('team_members')
          .upsert({ user_id: userId, team_id: pendingTeam.id }, { onConflict: 'user_id,team_id' });
        const { data: teamData } = await supabase
          .from('teams')
          .select('id, name, code, created_by')
          .eq('id', pendingTeam.id)
          .single();
        if (teamData) teams = [teamData as Team];
      }
    }

    // Auto-migrate: if no team_members rows but legacy profiles.team_id exists, backfill
    if (teams.length === 0 && profile?.team_id) {
      await supabase
        .from('team_members')
        .upsert({ user_id: userId, team_id: profile.team_id }, { onConflict: 'user_id,team_id' });

      const { data: teamData } = await supabase
        .from('teams')
        .select('id, name, code, created_by')
        .eq('id', profile.team_id)
        .single();

      if (teamData) teams = [teamData as Team];
    }

    setUserTeams(teams);

    let activeId: string | null = profile?.active_team_id ?? null;

    // Auto-assign first team if none active yet
    if (!activeId && teams.length > 0) {
      activeId = teams[0].id;
      await supabase.from('profiles').update({ active_team_id: activeId }).eq('id', userId);
    }

    setActiveTeamId(activeId);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) await loadTeamsForUser(u.id);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        await loadTeamsForUser(u.id);
      } else {
        setUserTeams([]);
        setActiveTeamId(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadTeamsForUser]);

  async function signIn(email: string, password: string): Promise<string | null> {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error?.message ?? null;
  }

  async function signUp(email: string, password: string, fullName: string, teamCode?: string): Promise<string | null> {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, pending_team_code: teamCode?.toUpperCase().trim() || null } },
    });
    return error?.message ?? null;
  }

  async function signOut(): Promise<void> {
    await supabase.auth.signOut();
  }

  async function switchTeam(teamId: string): Promise<void> {
    if (!user) return;
    await supabase.from('profiles').update({ active_team_id: teamId }).eq('id', user.id);
    setActiveTeamId(teamId);
  }

  async function joinTeam(code: string): Promise<string | null> {
    if (!user) return 'You need to sign in first.';

    const { data: team, error } = await supabase
      .from('teams')
      .select('id')
      .eq('code', code.toUpperCase().trim())
      .single();
    if (error || !team) return 'Team code not found.';

    // Insert into team_members (upsert to avoid duplicate error)
    const { error: memberError } = await supabase
      .from('team_members')
      .upsert({ user_id: user.id, team_id: team.id }, { onConflict: 'user_id,team_id' });
    if (memberError) return memberError.message;

    // Set active_team_id if not already set
    if (!activeTeamId) {
      await supabase.from('profiles').update({ active_team_id: team.id }).eq('id', user.id);
      setActiveTeamId(team.id);
    }

    await loadTeamsForUser(user.id);
    return null;
  }

  function generateTeamCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i += 1) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  async function createTeam(name: string): Promise<{ code: string | null; error: string | null }> {
    if (!user) return { code: null, error: 'You need to sign in first.' };

    const teamName = name.trim();
    if (!teamName) return { code: null, error: 'Team name is required.' };

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = generateTeamCode();
      const { data: team, error } = await supabase
        .from('teams')
        .insert({ name: teamName, code, created_by: user.id })
        .select('id, code')
        .single();

      if (error) {
        if (error.code === '23505') continue;
        return { code: null, error: error.message };
      }

      // Add creator to team_members
      const { error: memberError } = await supabase
        .from('team_members')
        .insert({ user_id: user.id, team_id: team.id });
      if (memberError) return { code: null, error: memberError.message };

      // Set active_team_id if not already set
      if (!activeTeamId) {
        await supabase.from('profiles').update({ active_team_id: team.id }).eq('id', user.id);
        setActiveTeamId(team.id);
      }

      await loadTeamsForUser(user.id);
      return { code: team.code, error: null };
    }

    return { code: null, error: 'Could not generate a unique team code. Try again.' };
  }

  return (
    <AuthContext.Provider
      value={{ user, loading, activeTeamId, userTeams, switchTeam, signIn, signUp, signOut, joinTeam, createTeam }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
