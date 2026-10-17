-- ==============================================================================
-- SQL SCRIPT: DELETE ALL FAKE / MOCK SAMPLE BLOG ARTICLES
-- ==============================================================================
-- Run this in your Supabase Dashboard -> SQL Editor:
-- 1. Go to Supabase Dashboard -> SQL Editor
-- 2. Click "+ New query"
-- 3. Paste and run this script:
-- ==============================================================================

-- 1. Delete associated gallery images for fake / mock articles first
DELETE FROM public.news_article_images 
WHERE article_id IN (
  SELECT id FROM public.news_articles 
  WHERE id LIKE 'e1a0b5c0-%'
     OR slug IN (
       'nkocet-ecell-launches-annual-flagship-innovation-initiative',
       'from-campus-dorm-to-venture-funded-orchid-alumni-startups',
       'national-innovation-conclave-2026-registration-now-live',
       'inside-the-venture-incubation-cohort-prototyping-labs',
       'inside-the-venture-incubation-cohort-prototyping-labs-and-angel-mentorship',
       'agritech-innovation-smart-soil-sensor-granted-patent',
       'fireside-dialogue-navigating-early-founder-resilience'
     )
);

-- 2. Delete all fake / mock sample articles
DELETE FROM public.news_articles 
WHERE id LIKE 'e1a0b5c0-%'
   OR slug IN (
     'nkocet-ecell-launches-annual-flagship-innovation-initiative',
     'from-campus-dorm-to-venture-funded-orchid-alumni-startups',
     'national-innovation-conclave-2026-registration-now-live',
     'inside-the-venture-incubation-cohort-prototyping-labs',
     'inside-the-venture-incubation-cohort-prototyping-labs-and-angel-mentorship',
     'agritech-innovation-smart-soil-sensor-granted-patent',
     'fireside-dialogue-navigating-early-founder-resilience'
   );

-- 3. Verification query to show remaining genuine articles
SELECT id, title, slug, status, author, published_at 
FROM public.news_articles;
