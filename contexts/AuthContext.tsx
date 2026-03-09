import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string, fullName: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  joinTeam: (code: string) => Promise<string | null>;
  createTeam: (name: string) => Promise<{ code: string | null; error: string | null }>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signIn(email: string, password: string): Promise<string | null> {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error?.message ?? null;
  }

  async function signUp(email: string, password: string, fullName: string): Promise<string | null> {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    return error?.message ?? null;
  }

  async function signOut(): Promise<void> {
    await supabase.auth.signOut();
  }

  async function joinTeam(code: string): Promise<string | null> {
    if (!user) return 'You need to sign in first.';

    const { data: team, error } = await supabase
      .from('teams')
      .select('id')
      .eq('code', code.toUpperCase().trim())
      .single();
    if (error || !team) return 'Team code not found.';

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ team_id: team.id })
      .eq('id', user.id);
    return updateError?.message ?? null;
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
        if (error.code === '23505') {
          continue;
        }
        return { code: null, error: error.message };
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ team_id: team.id })
        .eq('id', user.id);

      if (updateError) return { code: null, error: updateError.message };
      return { code: team.code, error: null };
    }

    return { code: null, error: 'Could not generate a unique team code. Try again.' };
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut, joinTeam, createTeam }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
