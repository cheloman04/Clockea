import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://dagttwkeggzveaoqzacf.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhZ3R0d2tlZ2d6dmVhb3F6YWNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NzM4MDMsImV4cCI6MjA4ODU0OTgwM30.W4S3mO570nVP1hJ0rz_HK1tZiZU1ucmLyTc208TJSew';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
