/**
 * ============================================================================
 * SUPABASE CONFIGURATION FILE
 * ============================================================================
 * You can paste your Supabase Project credentials directly in this file
 * OR define them in your environment variables (.env / Vercel / hosting provider).
 * ============================================================================
 */
import { createClient } from '@supabase/supabase-js';

// 1. PASTE YOUR SUPABASE PROJECT URL HERE
// Found in: Supabase Dashboard -> Project Settings -> API -> Project URL
export const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  'https://your-project-ref.supabase.co'; // <--- PASTE YOUR PROJECT URL HERE

// 2. PASTE YOUR SUPABASE ANON / PUBLIC KEY HERE
// Found in: Supabase Dashboard -> Project Settings -> API -> Project API Keys (anon public)
export const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.your-anon-key-here'; // <--- PASTE YOUR ANON KEY HERE

// 3. PASTE YOUR POSTGRES DATABASE URL (CONNECTION STRING) HERE
// Found in: Supabase Dashboard -> Project Settings -> Database -> Connection String (URI format)
// Format: postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
export const SUPABASE_DATABASE_URL =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.SUPABASE_DB_URL ||
  ''; // <--- PASTE YOUR POSTGRESQL DATABASE URL HERE (if not using environment variables)

/**
 * Initialized Supabase Client for frontend / backend API calls
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
