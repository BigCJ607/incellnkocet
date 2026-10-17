-- ==============================================================================
-- E-CELL NKOCET - NEWS & BLOGS MODULE SCHEMA & POLICIES
-- ==============================================================================
-- Run this script in the Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- This script is idempotent and safe to run multiple times.
-- ==============================================================================

-- 1. Create news_articles table
CREATE TABLE IF NOT EXISTS public.news_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  excerpt TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'Entrepreneurship',
  author TEXT NOT NULL DEFAULT 'E-Cell Team',
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  cover_image TEXT DEFAULT '',
  cover_image_path TEXT DEFAULT '',
  seo_description TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  reading_time INT NOT NULL DEFAULT 3,
  views_count INT NOT NULL DEFAULT 0,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure columns exist in case of partial runs
ALTER TABLE public.news_articles ADD COLUMN IF NOT EXISTS cover_image_path TEXT DEFAULT '';
ALTER TABLE public.news_articles ADD COLUMN IF NOT EXISTS seo_description TEXT DEFAULT '';
ALTER TABLE public.news_articles ADD COLUMN IF NOT EXISTS reading_time INT NOT NULL DEFAULT 3;
ALTER TABLE public.news_articles ADD COLUMN IF NOT EXISTS views_count INT NOT NULL DEFAULT 0;
ALTER TABLE public.news_articles ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
ALTER TABLE public.news_articles ADD COLUMN IF NOT EXISTS author_role TEXT DEFAULT '';
ALTER TABLE public.news_articles ADD COLUMN IF NOT EXISTS author_avatar TEXT DEFAULT '';
ALTER TABLE public.news_articles ADD COLUMN IF NOT EXISTS author_bio TEXT DEFAULT '';

-- 2. Create news_article_images table (gallery & embedded images)
CREATE TABLE IF NOT EXISTS public.news_article_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES public.news_articles(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  storage_path TEXT DEFAULT '',
  caption TEXT DEFAULT '',
  alt_text TEXT DEFAULT '',
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Indexes for performance
CREATE UNIQUE INDEX IF NOT EXISTS idx_news_articles_slug ON public.news_articles (slug);
CREATE INDEX IF NOT EXISTS idx_news_articles_status_pub ON public.news_articles (status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_articles_category ON public.news_articles (category);
CREATE INDEX IF NOT EXISTS idx_news_article_images_article ON public.news_article_images (article_id, display_order ASC);

-- 4. Automatic updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_news_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_news_article_updated ON public.news_articles;
CREATE TRIGGER on_news_article_updated
  BEFORE UPDATE ON public.news_articles
  FOR EACH ROW EXECUTE FUNCTION public.handle_news_updated_at();

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.news_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_article_images ENABLE ROW LEVEL SECURITY;

-- ─── 5a. news_articles RLS Policies ───

-- Public can ONLY read published articles
DROP POLICY IF EXISTS "Public can read published articles" ON public.news_articles;
CREATE POLICY "Public can read published articles"
  ON public.news_articles FOR SELECT
  USING (
    status = 'published'
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND (role = 'admin' OR LOWER(contact_email) = 'nikhildeosani@gmail.com')
    )
  );

-- Admins can insert articles
DROP POLICY IF EXISTS "Admins can insert articles" ON public.news_articles;
CREATE POLICY "Admins can insert articles"
  ON public.news_articles FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND (role = 'admin' OR LOWER(contact_email) = 'nikhildeosani@gmail.com')
    )
  );

-- Admins can update articles
DROP POLICY IF EXISTS "Admins can update articles" ON public.news_articles;
CREATE POLICY "Admins can update articles"
  ON public.news_articles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND (role = 'admin' OR LOWER(contact_email) = 'nikhildeosani@gmail.com')
    )
  );

-- Admins can delete articles
DROP POLICY IF EXISTS "Admins can delete articles" ON public.news_articles;
CREATE POLICY "Admins can delete articles"
  ON public.news_articles FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND (role = 'admin' OR LOWER(contact_email) = 'nikhildeosani@gmail.com')
    )
  );

-- ─── 5b. news_article_images RLS Policies ───

-- Public can read images belonging to published articles (or admin)
DROP POLICY IF EXISTS "Public can read published article images" ON public.news_article_images;
CREATE POLICY "Public can read published article images"
  ON public.news_article_images FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.news_articles
      WHERE news_articles.id = news_article_images.article_id
        AND news_articles.status = 'published'
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND (role = 'admin' OR LOWER(contact_email) = 'nikhildeosani@gmail.com')
    )
  );

-- Admins can insert gallery images
DROP POLICY IF EXISTS "Admins can insert article images" ON public.news_article_images;
CREATE POLICY "Admins can insert article images"
  ON public.news_article_images FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND (role = 'admin' OR LOWER(contact_email) = 'nikhildeosani@gmail.com')
    )
  );

-- Admins can update gallery images
DROP POLICY IF EXISTS "Admins can update article images" ON public.news_article_images;
CREATE POLICY "Admins can update article images"
  ON public.news_article_images FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND (role = 'admin' OR LOWER(contact_email) = 'nikhildeosani@gmail.com')
    )
  );

-- Admins can delete gallery images
DROP POLICY IF EXISTS "Admins can delete article images" ON public.news_article_images;
CREATE POLICY "Admins can delete article images"
  ON public.news_article_images FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND (role = 'admin' OR LOWER(contact_email) = 'nikhildeosani@gmail.com')
    )
  );

-- ─── 6. Storage Bucket for News Images ───

INSERT INTO storage.buckets (id, name, public)
VALUES ('news', 'news', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Public can download/view news images
DROP POLICY IF EXISTS "Allow public news image downloads" ON storage.objects;
CREATE POLICY "Allow public news image downloads"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'news');

-- Admins can upload news images
DROP POLICY IF EXISTS "Allow admin news image uploads" ON storage.objects;
CREATE POLICY "Allow admin news image uploads"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'news'
    AND (
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
          AND (role = 'admin' OR LOWER(contact_email) = 'nikhildeosani@gmail.com')
      )
    )
  );

-- Admins can update/replace news images
DROP POLICY IF EXISTS "Allow admin news image updates" ON storage.objects;
CREATE POLICY "Allow admin news image updates"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'news'
    AND (
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
          AND (role = 'admin' OR LOWER(contact_email) = 'nikhildeosani@gmail.com')
      )
    )
  );

-- Admins can delete news images
DROP POLICY IF EXISTS "Allow admin news image deletes" ON storage.objects;
CREATE POLICY "Allow admin news image deletes"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'news'
    AND (
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
          AND (role = 'admin' OR LOWER(contact_email) = 'nikhildeosani@gmail.com')
      )
    )
  );

-- ==============================================================================
-- 7. INITIAL SEED ARTICLES (Sample content for immediate display)
-- ==============================================================================

INSERT INTO public.news_articles (
  id,
  title,
  slug,
  excerpt,
  content,
  category,
  author,
  cover_image,
  status,
  reading_time,
  published_at
)
VALUES
(
  'e1a0b5c0-1111-4000-8000-000000000001',
  'NKOCET Entrepreneurship Cell Launches Annual Flagship Innovation Initiative',
  'nkocet-ecell-launches-annual-flagship-innovation-initiative',
  'The Entrepreneurship Cell at NKOCET has unveiled its groundbreaking startup acceleration and hackathon pipeline for 2026, offering students direct access to incubators and venture capital mentors.',
  '<h2>Fostering Student Entrepreneurship from Ground Zero</h2><p>The Entrepreneurship Cell (E-Cell) of Nagesh Karajagi Orchid College of Engineering and Technology (NKOCET) has officially launched its 2026 Innovation Initiative. Designed to bridge the gap between academic engineering and real-world venture building, this initiative brings together technical hackathons, venture capital pitching clinics, and direct pre-incubation grants.</p><p>Over 400 engineering students from across departments gathered in the main auditorium to witness the keynote addresses by prominent startup founders and institutional leaders.</p><h3>Key Highlights of the 2026 Initiative:</h3><ul><li><strong>Student Startup Grants:</strong> Seed capital support for top projects building proof-of-concept hardware and software products.</li><li><strong>Industry Mentorship:</strong> Weekly office hours with senior engineers and angel investors from Pune, Bengaluru, and Mumbai.</li><li><strong>Rapid Prototyping Labs:</strong> Dedicated 24/7 maker spaces equipped with rapid prototyping tooling, cloud compute credits, and IoT hardware.</li></ul><p>As the collegiate startup ecosystem matures, E-Cell NKOCET remains steadfast in empowering students to transform their final-year capstones into market-ready commercial enterprises.</p>',
  'E-Cell Activities',
  'E-Cell Editorial Team',
  '/background/image2.jpg',
  'published',
  4,
  NOW() - INTERVAL '2 days'
),
(
  'e1a0b5c0-2222-4000-8000-000000000002',
  'From Campus Dorm to Venture Funded: The Journey of Orchid Alumni Startups',
  'from-campus-dorm-to-venture-funded-orchid-alumni-startups',
  'An in-depth look at how three NKOCET engineering graduates built an AI-powered logistics SaaS platform that raised seed funding and now serves over 50 enterprise clients.',
  '<h2>The Power of Early Experimentation</h2><p>In 2023, while preparing for the annual campus hackathon, three Computer Science students recognized a critical inefficiency in regional supply chain freight management. Instead of letting the project end when the hackathon completed, they leveraged the mentorship provided by the E-Cell to continue iterating.</p><p>Today, that dorm-room prototype has transformed into a high-growth SaaS business employing over twenty engineers and processing millions of logistical routing operations every month.</p><blockquote>"The college hackathon gave us the initial pressure-cooker environment to validate our idea. Without the guidance of our E-Cell mentors on business modeling and customer discovery, we would have just built a school project instead of a company."</blockquote><h3>Advice for Aspiring Student Founders:</h3><ol><li><strong>Solve a problem you intimately understand:</strong> Do not build AI for the sake of hype; target genuine enterprise pain points.</li><li><strong>Find complementary co-founders:</strong> Balance deep technical capability with commercial storytelling and operations.</li><li><strong>Launch early and talk to customers:</strong> Real customer feedback is infinitely more valuable than internal code perfection.</li></ol>',
  'Startup Stories',
  'Nikhil Deosani',
  '/background/eureka.jpg',
  'published',
  5,
  NOW() - INTERVAL '5 days'
),
(
  'e1a0b5c0-3333-4000-8000-000000000003',
  'National Innovation Conclave 2026: Registration Now Live for Collegiate Teams',
  'national-innovation-conclave-2026-registration-now-live',
  'Students across Maharashtra are invited to pitch transformative ideas across CleanTech, EdTech, MedTech, and Generative AI at the upcoming flagship conclave.',
  '<h2>Showcase Your Innovation on the National Stage</h2><p>E-Cell NKOCET is proud to announce that team registrations for the 2026 National Innovation Conclave are now officially open. The competition welcomes undergraduate and postgraduate engineering teams from across the nation to present novel prototypes.</p><p>With a total prize pool exceeding INR 2,00,000 and direct entry into regional incubator acceleration programs, this event promises to be one of the premier collegiate technology showcases of the academic year.</p><h3>Tracks & Focus Sectors:</h3><ul><li><strong>CleanTech & Sustainable Mobility:</strong> EV telemetry, battery management systems, renewable microgrid optimization.</li><li><strong>Healthcare & MedTech:</strong> Affordable diagnostic tooling, assistive IoT hardware, clinical data workflows.</li><li><strong>Generative AI & Enterprise Automation:</strong> Autonomous agent pipelines, developer productivity tools, smart document intelligence.</li></ul><p>Early bird submissions close on the 25th of the month. Prepare your slide decks and functional prototypes!</p>',
  'Opportunities',
  'Innovation Council',
  '/background/image2.jpg',
  'published',
  3,
  NOW() - INTERVAL '10 days'
)
ON CONFLICT (slug) DO NOTHING;
