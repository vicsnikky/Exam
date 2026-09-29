# Fenster International School — Cloud SQL & Vercel Deployment Guide

## Why didn't you see any keys on Vercel?

1. **Private Google Cloud SQL Environment**:
   Inside this AI Studio testing environment, Google Cloud manages an internal Cloud SQL instance behind a private Virtual Private Cloud (VPC). The connection variables (`SQL_HOST`, `SQL_USER`, etc.) are injected into this container at runtime.
2. **Git Security Standards**:
   When code is pushed to GitHub, private `.env` secret keys and passwords are intentionally **not committed to GitHub** to protect security.
3. **Empty Vercel Environment**:
   When you connect your GitHub repo to Vercel, Vercel starts with zero environment variables by default. Without a database URL or credentials, the login endpoint cannot authenticate users.

---

## ⚡ Database Setup with Supabase (Fast & Reliable)

The backend natively supports Supabase via standard PostgreSQL connection pooling (`pg` + `drizzle-orm`):

### Step 1: Run the Database Migration Script in Supabase
1. Create a free project at **[Supabase.com](https://supabase.com)**.
2. In your Supabase project dashboard, open the **SQL Editor** from the left navigation bar.
3. Open `supabase_setup.sql` from this repository (or copy its contents).
4. Paste it into the Supabase SQL Editor and click **Run**.
5. All 15 tables (`schools`, `users`, `teachers`, `students`, `subjects`, `assessments`, `ss3_mock_scores`, `questions`, `quizzes`, etc.) and default seed accounts (`victoralo1862@gmail.com`, SS3 candidates, and mock scores) will be created instantly.

### Step 2: Connect Supabase to your Deployment
1. In your Supabase Project Dashboard, navigate to **Project Settings** → **Database**.
2. Scroll to the **Connection String** section and copy the **URI** (Session or Transaction pooler):
   * Example: `postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres`
   * Replace `[YOUR-PASSWORD]` with your actual database password.
3. In your hosting environment (Vercel, Render, Railway, Cloud Run, etc.) or `.env`, add:
   * **`DATABASE_URL`**: Your Supabase connection string.
   * **`JWT_SECRET`**: `fenster-international-school-secret-jwt-key-2026`
   * **`GEMINI_API_KEY`**: Your Google AI Studio API key.
4. Redeploy your application. Supabase connection will be established automatically!

---

## School Rebranding to Fenster

The entire application has been updated from "Federal" to **Fenster**:
* Institution Name: **Fenster International School**
* Student ID format: **FEN-2026-XXXXXX** (supports both FEN and FIS for backwards compatibility)
* Branding headers, transcripts, question bank, and exam simulators now feature Fenster branding.

