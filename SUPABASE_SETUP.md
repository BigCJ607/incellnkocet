# Supabase Database & Backend Setup Guide

This guide walks you through connecting your Supabase project to the **Event Zero** hackathon & event management platform.

---

## 1. Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and log in or create a free account.
2. Click **New Project** and configure:
   - **Name**: `event-zero` (or your preferred name)
   - **Database Password**: Choose a strong password and save it.
   - **Region**: Select the region closest to your users.
3. Wait ~1-2 minutes for your project database to initialize.

---

## 2. Execute the Database Schema

1. In your Supabase Dashboard, click on **SQL Editor** from the left navigation menu.
2. Click **New Query**.
3. Open the [`supabase/schema.sql`](./supabase/schema.sql) file from this repository, copy the entire SQL script, paste it into the editor, and click **Run**.
4. This script will automatically:
   - Create tables: `profiles`, `events`, `tickets`, `teams`, `team_members`, `messages`, `submissions`.
   - Enable Row Level Security (RLS) policies for secure access.
   - Create an automated trigger (`on_auth_user_created`) to create a profile row upon signup.
   - Configure Realtime replication on the `messages` table for live chat.
   - Create `avatars` and `submissions` Storage buckets with appropriate access policies.
   - Populate initial seed events (Hack The Future, HackSpark 48H, Design Frontier, and past hackathons).

---

## 3. Retrieve Project API Credentials

1. In your Supabase Dashboard, navigate to **Project Settings** (gear icon) > **API**.
2. Copy the following values:
   - **Project URL** (e.g. `https://xyzcompany.supabase.co`)
   - **Project API Keys** -> `anon` / `public` key

---

## 4. Configure Environment Variables

Open (or create) the `.env` file in the project root:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key-here
```

Restart your Vite dev server (`npm run dev`) so Vite loads the new environment variables.

---

## 5. Storage Buckets Verification (Optional)

The SQL script creates the storage buckets automatically. You can confirm them in **Storage** in the Supabase Dashboard:
- `avatars` (Public bucket for profile avatars)
- `submissions` (Public / authenticated bucket for project `.zip` archives)

---

## 6. Architecture & Features

| Feature | Supabase Technology | Description |
| :--- | :--- | :--- |
| **Authentication** | Supabase Auth (`supabase.auth`) | Email/password login & registration with persistent JWT session management. |
| **Profiles** | `public.profiles` table + Trigger | Profile extension automatically created on signup; stores student name, division, class year, bio, and avatar. |
| **Events & Schedule** | `public.events` table | Stores upcoming and past events with speakers and schedule stored as structured JSONB documents. |
| **Tickets / Passes** | `public.tickets` table | Tracks user event registrations and team affiliations. |
| **Teams & Membership** | `public.teams` & `public.team_members` | Manages team formation and members for hackathons. |
| **Realtime Chat** | `public.messages` + Realtime Channel | Instant team chat broadcasting via Supabase Channels. |
| **Deliverables & Files**| `public.submissions` + Storage Bucket | Hackathon project submission tracking and `.zip` file uploads. |
| **Offline / Fallback** | Hybrid Mode | App automatically falls back to sample mock data if environment variables are not yet configured. |
