# Fenster International School — Cloud SQL & Vercel Deployment Guide

## Why didn't you see any keys on Vercel?

1. **Private Google Cloud SQL Environment**:
   Inside this AI Studio testing environment, Google Cloud manages an internal Cloud SQL instance behind a private Virtual Private Cloud (VPC). The connection variables (`SQL_HOST`, `SQL_USER`, etc.) are injected into this container at runtime.
2. **Git Security Standards**:
   When code is pushed to GitHub, private `.env` secret keys and passwords are intentionally **not committed to GitHub** to protect security.
3. **Empty Vercel Environment**:
   When you connect your GitHub repo to Vercel, Vercel starts with zero environment variables by default. Without a database URL or credentials, the login endpoint cannot authenticate users.

---

## ⚡ Fastest Fix on Vercel (1-Click Database Setup)

You don't have to manually configure 5 different database keys. We have updated the codebase to automatically support **`POSTGRES_URL`** and **`DATABASE_URL`**:

### Option 1: 1-Click Vercel Postgres (Zero manual key typing!)
1. Open your project in the **[Vercel Dashboard](https://vercel.com/)**.
2. Click the **Storage** tab at the top.
3. Click **"Connect Store"** (or "Create Database") → Select **Postgres** (powered by Neon).
4. Click **Create** and link it to your project.
5. Vercel will automatically inject `POSTGRES_URL` into your environment variables!
6. Go to **Settings** → **Environment Variables**, add:
   * `JWT_SECRET` = `fenster-secret-jwt-key-2026`
   * `GEMINI_API_KEY` = your Google AI Studio API key
7. Go to **Deployments** → Click the three dots `...` on the latest deployment → **Redeploy**.
8. That's it! Your login and database will work immediately.

### Option 2: Use Free Neon.tech or Supabase (1 single connection string)
1. Create a free account at **[Neon.tech](https://neon.tech)** (free serverless Postgres).
2. Copy your connection string (looks like `postgresql://user:pass@ep-xyz.neon.tech/neondb?sslmode=require`).
3. In **Vercel Project Settings → Environment Variables**, add:
   * `DATABASE_URL`: (paste your connection string)
   * `JWT_SECRET`: `fenster-secret-jwt-key-2026`
4. Redeploy on Vercel.

---

## School Rebranding to Fenster

The entire application has been updated from "Federal" to **Fenster**:
* Institution Name: **Fenster International School**
* Student ID format: **FEN-2026-XXXXXX** (supports both FEN and FIS for backwards compatibility)
* Branding headers, transcripts, question bank, and exam simulators now feature Fenster branding.

