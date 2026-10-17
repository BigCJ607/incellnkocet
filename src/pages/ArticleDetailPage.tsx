import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import type { NewsArticle, ArticleGalleryImage } from '../types/news';
import { newsService } from '../services/newsService';
import ArticleHeader from '../components/news/ArticleHeader';
import ArticleBody from '../components/news/ArticleBody';
import AuthorCard from '../components/news/AuthorCard';
import RelatedPosts from '../components/news/RelatedPosts';

export default function ArticleDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [article, setArticle] = useState<NewsArticle | null>(null);
  const [allArticles, setAllArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  // Gallery Lightbox state
  const [lightboxImage, setLightboxImage] = useState<ArticleGalleryImage | null>(null);

  // Scroll Reading Progress Tracking
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight > 0) {
        const percent = Math.min(100, Math.max(0, (scrollY / docHeight) * 100));
        setProgress(percent);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Load article & all articles for the "More Stories" section
  const loadArticle = () => {
    if (!slug) return;
    setLoading(true);
    setError(null);

    newsService
      .getArticleBySlug(slug)
      .then(async (data) => {
        setArticle(data);
        setLoading(false);

        if (data) {
          // Update SEO document title
          document.title = `${data.title} | E-Cell NKOCET`;

          // Fetch other stories for the "More Stories" panel
          try {
            const res = await newsService.getPublishedArticles({ limit: 12 });
            setAllArticles(res.articles || []);
          } catch {
            // Non-critical fallback
          }
        }
      })
      .catch((err) => {
        console.error('Failed to load article:', err);
        setError(err.message || 'Unable to connect to the server. Please try again.');
        setLoading(false);
      });
  };

  useEffect(() => {
    loadArticle();
    window.scrollTo({ top: 0, behavior: 'smooth' });

    return () => {
      document.title = 'E-Cell NKOCET | Event Zero';
    };
  }, [slug]);

  if (loading) {
    return (
      <div className="news-page-wrapper">
        <main
          className="news-container"
          style={{
            paddingTop: 'max(120px, calc(var(--nav-h, 80px) + 2.5rem))',
            paddingBottom: '80px',
          }}
        >
          {/* Top back link skeleton */}
          <div
            style={{
              width: '140px',
              height: '14px',
              backgroundColor: 'rgba(214, 197, 179, 0.35)',
              borderRadius: '4px',
              marginBottom: '32px',
            }}
          />

          {/* Header Skeleton (760px column) */}
          <div
            style={{
              maxWidth: '760px',
              margin: '0 auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div
              style={{
                width: '180px',
                height: '14px',
                backgroundColor: 'rgba(214, 197, 179, 0.35)',
                borderRadius: '4px',
              }}
            />
            <div
              style={{
                width: '90%',
                height: '42px',
                backgroundColor: 'rgba(214, 197, 179, 0.35)',
                borderRadius: '8px',
              }}
            />
            <div
              style={{
                width: '75%',
                height: '42px',
                backgroundColor: 'rgba(214, 197, 179, 0.35)',
                borderRadius: '8px',
              }}
            />
            <div
              style={{
                width: '100%',
                height: '20px',
                backgroundColor: 'rgba(214, 197, 179, 0.25)',
                borderRadius: '4px',
                marginTop: '8px',
              }}
            />
          </div>

          {/* Hero Image Skeleton */}
          <div
            style={{
              maxWidth: '1100px',
              margin: '32px auto',
              aspectRatio: '16 / 9',
              backgroundColor: 'rgba(214, 197, 179, 0.3)',
              borderRadius: '16px',
              width: '100%',
            }}
          />

          {/* Body Skeleton */}
          <div
            style={{
              maxWidth: '720px',
              margin: '0 auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <div
                key={n}
                style={{
                  width: `${90 - (n % 3) * 15}%`,
                  height: '16px',
                  backgroundColor: 'rgba(214, 197, 179, 0.25)',
                  borderRadius: '4px',
                }}
              />
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="news-page-wrapper">
        <main
          className="news-container"
          style={{
            paddingTop: 'max(120px, calc(var(--nav-h, 80px) + 2.5rem))',
            paddingBottom: '80px',
          }}
        >
          <div
            style={{
              padding: '48px 32px',
              textAlign: 'center',
              maxWidth: '32rem',
              margin: '48px auto',
              backgroundColor: 'rgba(255, 255, 255, 0.85)',
              borderRadius: '16px',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px',
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: 'rgba(254, 242, 242, 1)',
                color: '#DC2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.25rem',
              }}
            >
              ⚠️
            </div>
            <h2
              className="font-display"
              style={{
                fontSize: '1.5rem',
                fontWeight: 700,
                color: 'var(--color-text-primary)',
                margin: 0,
              }}
            >
              Unable to Load Article
            </h2>
            <p
              style={{
                fontSize: '0.875rem',
                color: 'var(--color-text-secondary)',
                lineHeight: 1.6,
                margin: 0,
              }}
            >
              {error}
            </p>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={loadArticle}
                className="news-btn-outline"
              >
                ↻ Retry Loading
              </button>
              <Link to="/news" className="news-btn-outline">
                ← Back to News
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="news-page-wrapper">
        <main
          className="news-container"
          style={{
            paddingTop: 'max(120px, calc(var(--nav-h, 80px) + 2.5rem))',
            paddingBottom: '80px',
          }}
        >
          <div
            style={{
              padding: '64px 32px',
              textAlign: 'center',
              maxWidth: '36rem',
              margin: '48px auto',
              backgroundColor: 'rgba(255, 255, 255, 0.7)',
              borderRadius: '16px',
              border: '1px solid rgba(214, 197, 179, 0.6)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px',
            }}
          >
            <div style={{ fontSize: '2.5rem' }}>📄</div>
            <h2
              className="font-display"
              style={{
                fontSize: '1.5rem',
                fontWeight: 700,
                color: 'var(--color-text-primary)',
                margin: 0,
              }}
            >
              Article Not Found
            </h2>
            <p
              style={{
                fontSize: '0.875rem',
                color: 'var(--color-text-secondary)',
                lineHeight: 1.6,
                margin: 0,
              }}
            >
              The article you are searching for may have been moved or is no longer published.
            </p>
            <Link to="/news" className="news-btn-outline">
              ← Return to All Stories
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="news-page-wrapper">
      {/* 7. Reading-progress bar fixed at the very top in slate accent */}
      <div className="news-progress-bar" style={{ width: `${progress}%` }} />

      <main
        className="news-container news-fade-in"
        style={{
          paddingTop: 'max(120px, calc(var(--nav-h, 80px) + 2.5rem))',
          paddingBottom: '80px',
        }}
      >
        {/* 1. Top row inside container: "← Back to all stories" on left, simple */}
        <div style={{ marginBottom: '28px' }}>
          <Link to="/news" className="news-back-link">
            ← Back to all stories
          </Link>
        </div>

        {/* 2. Article Header (reading column, max-width 760px) */}
        <ArticleHeader article={article} />

        {/* 3. Hero image (max-width 1100px) & 4. Body (reading column max-width 720px) */}
        <ArticleBody article={article} />

        {/* Optional Gallery Section */}
        {article.galleryImages && article.galleryImages.length > 0 && (
          <section
            style={{
              maxWidth: '720px',
              margin: '48px auto 0 auto',
              paddingTop: '36px',
              borderTop: '1px solid rgba(214, 197, 179, 0.6)',
              boxSizing: 'border-box',
            }}
          >
            <h3
              className="font-display"
              style={{
                fontSize: '1.35rem',
                fontWeight: 700,
                color: 'var(--color-text-primary)',
                marginBottom: '20px',
              }}
            >
              Visual Archive ({article.galleryImages.length})
            </h3>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: '16px',
              }}
            >
              {article.galleryImages.map((img, idx) => (
                <div
                  key={img.id || idx}
                  onClick={() => setLightboxImage(img)}
                  style={{
                    borderRadius: '12px',
                    overflow: 'hidden',
                    backgroundColor: 'rgba(214, 197, 179, 0.25)',
                    cursor: 'pointer',
                    transition: 'transform 200ms ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.02)')}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                >
                  <div style={{ aspectRatio: '16 / 10', width: '100%', overflow: 'hidden' }}>
                    <img
                      src={img.imageUrl}
                      alt={img.altText || article.title}
                      loading="lazy"
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  </div>
                  {img.caption && (
                    <div
                      style={{
                        padding: '10px 12px',
                        fontSize: '12px',
                        color: 'var(--color-text-secondary)',
                        fontStyle: 'italic',
                        fontFamily: 'var(--font-body)',
                      }}
                    >
                      {img.caption}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 5. After body: tags, compact author card, and enjoyed-story share row */}
        <AuthorCard article={article} />

        {/* 6. "More stories" section reusing EXACTLY the Latest Posts panel style */}
        <RelatedPosts articles={allArticles} currentPostId={article.id} />
      </main>

      {/* Photo Lightbox Modal */}
      {lightboxImage && (
        <div
          onClick={() => setLightboxImage(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 150,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(8px)',
            cursor: 'zoom-out',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              maxWidth: '900px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <button
              type="button"
              onClick={() => setLightboxImage(null)}
              style={{
                position: 'absolute',
                top: '-36px',
                right: '0',
                color: '#FFFFFF',
                background: 'none',
                border: 'none',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              ✕ Close
            </button>
            <img
              src={lightboxImage.imageUrl}
              alt={lightboxImage.altText || 'Expanded photo'}
              style={{
                maxWidth: '100%',
                maxHeight: '80vh',
                objectFit: 'contain',
                borderRadius: '12px',
              }}
            />
            {lightboxImage.caption && (
              <p
                style={{
                  marginTop: '12px',
                  fontSize: '13px',
                  color: 'rgba(255, 255, 255, 0.8)',
                  fontStyle: 'italic',
                  textAlign: 'center',
                }}
              >
                {lightboxImage.caption}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

