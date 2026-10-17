-- ==============================================================================
-- SQL MIGRATION: ADD AUTHOR ROLE, AVATAR, BIO & AUTHOR_ID COLUMNS
-- ==============================================================================
-- Run this in your Supabase Dashboard:
-- 1. Go to Supabase Dashboard -> SQL Editor
-- 2. Click "+ New query"
-- 3. Paste and run this script:
-- ==============================================================================

-- 1. Add author columns to news_articles table if not already present
ALTER TABLE public.news_articles 
ADD COLUMN IF NOT EXISTS author_role TEXT DEFAULT '';

ALTER TABLE public.news_articles 
ADD COLUMN IF NOT EXISTS author_avatar TEXT DEFAULT '';

ALTER TABLE public.news_articles 
ADD COLUMN IF NOT EXISTS author_bio TEXT DEFAULT '';

ALTER TABLE public.news_articles 
ADD COLUMN IF NOT EXISTS author_id TEXT DEFAULT '';

-- 2. Ensure RLS policies allow reading and writing these columns
-- (Standard SELECT and UPDATE policies on news_articles will automatically cover these)

-- 3. Verification query to confirm columns were added successfully:
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'news_articles' 
  AND column_name IN ('author', 'author_role', 'author_avatar', 'author_bio', 'author_id');
