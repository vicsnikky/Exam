/**
 * ============================================================================
 * SUPABASE CONFIGURATION FILE
 * ============================================================================
 * You can paste your Supabase Project credentials directly in this file
 * OR define them in your environment variables (.env / Vercel / hosting provider).
 * ============================================================================
 */
import { createClient } from '@supabase/supabase-js';

// 1. SUPABASE PROJECT URL
// Cleaned base URL for Supabase JS client and REST calls
const rawUrl =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  'https://nynaetekcxplzfuworal.supabase.co';

export const SUPABASE_URL = rawUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');

// 2. SUPABASE ANON / PUBLIC KEY
export const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55bmFldGVrY3hwbHpmdXdvcmFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2NDE5NTEsImV4cCI6MjEwNjIxNzk1MX0.gTRbT7Ru-ZBE5aQAwhOPcIkAvtu5R9Id0TbAg96AMhg';

// 3. POSTGRES DATABASE URL (CONNECTION STRING)
// Replace [YOUR-PASSWORD] with your Supabase database password
export const SUPABASE_DATABASE_URL =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.SUPABASE_DB_URL ||
  'postgresql://postgres:[ALO.13071996.2026]@db.nynaetekcxplzfuworal.supabase.co:5432/postgres';

/**
 * Initialized Supabase Client for frontend / backend API calls
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
