import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { NewsArticle } from '../types/news';
import { newsService } from '../services/newsService';
import CategoryFilter from '../components/news/CategoryFilter';
import FeaturedPost from '../components/news/FeaturedPost';
import PostCard from '../components/news/PostCard';

const CATEGORIES = ['All', 'Startup Stories', 'Opportunities', 'Events'];

export default function NewsListingPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCategory = searchParams.get('category') || 'All';
  const initialSearch = searchParams.get('search') || '';

  const [category, setCategory] = useState<string>(initialCategory);
  const [search, setSearch] = useState<string>(initialSearch);

  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllLatest, setShowAllLatest] = useState<boolean>(false);

  // Sync state with URL params
  useEffect(() => {
    const params: Record<string, string> = {};
    if (category && category !== 'All') params.category = category;
    if (search.trim()) params.search = search.trim();
    setSearchParams(params, { replace: true });
  }, [category, search, setSearchParams]);

  // Load published articles
  const loadArticles = useCallback(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    newsService
      .getPublishedArticles({
        limit: 50,
      })
      .then((res) => {
        if (!isMounted) return;
        setArticles(res.articles || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load published news:', err);
        if (!isMounted) return;
        setError(
          err.message || 'Unable to connect to the news server. Please try again.'
        );
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const cleanup = loadArticles();
    return cleanup;
  }, [loadArticles]);

  // Client-side filtering by category & search query
  const filteredArticles = useMemo(() => {
    return articles.filter((art) => {
      const matchesCat =
        category === 'All' ||
        art.category.toLowerCase() === category.toLowerCase();

      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        art.title.toLowerCase().includes(q) ||
        art.excerpt.toLowerCase().includes(q) ||
        art.author.toLowerCase().includes(q);

      return matchesCat && matchesSearch;
    });
  }, [articles, category, search]);

  // The featured post is the newest post (first matching post)
  const featuredArticle = filteredArticles.length > 0 ? filteredArticles[0] : null;
  const remainingArticles = featuredArticle ? filteredArticles.slice(1) : [];

  // 4 latest posts initially, expandable with "View all stories"
  const displayedLatestArticles = showAllLatest
    ? remainingArticles
    : remainingArticles.slice(0, 4);

  const hasMoreThanFour = remainingArticles.length > 4;

  return (
    <div className="news-page-wrapper">
      {/* Centered container with max-width 1200px, 24-32px side padding, 120px top padding */}
      <main
        className="news-container news-fade-in"
        style={{
          paddingTop: 'max(120px, calc(var(--nav-h, 80px) + 2.5rem))',
          paddingBottom: '80px',
        }}
      >
        {/* Page Title: Large serif "Our Blog" at top left */}
        <header style={{ marginBottom: '20px', textAlign: 'left' }}>
          <h1
            className="font-display"
            style={{
              fontSize: 'clamp(2.5rem, 5vw, 3.25rem)',
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              lineHeight: 1.15,
              letterSpacing: '-0.025em',
              margin: '0 0 16px 0',
            }}
          >
            Our Blog
          </h1>

          {/* Compact Category Filter Chips & Search Box in a single row */}
          <CategoryFilter
            categories={CATEGORIES}
            activeCategory={category}
            onSelectCategory={(cat) => {
              setCategory(cat);
              setShowAllLatest(false);
            }}
            searchQuery={search}
            onSearchChange={(q) => {
              setSearch(q);
              setShowAllLatest(false);
            }}
          />
        </header>

        {/* Content Section */}
        {loading ? (
          /* Skeletons matching the 2-column featured + 4-column latest panel */
          <div>
            {/* Featured Section Skeleton */}
            <div className="news-featured-ref">
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  justifyContent: 'center',
                }}
              >
                <div
                  style={{
                    height: '14px',
                    width: '120px',
                    backgroundColor: 'rgba(214, 197, 179, 0.35)',
                    borderRadius: '4px',
                  }}
                />
                <div
                  style={{
                    height: '36px',
                    width: '85%',
                    backgroundColor: 'rgba(214, 197, 179, 0.35)',
                    borderRadius: '6px',
                  }}
                />
                <div
                  style={{
                    height: '16px',
                    width: '100%',
                    backgroundColor: 'rgba(214, 197, 179, 0.25)',
                    borderRadius: '4px',
                  }}
                />
                <div
                  style={{
                    height: '16px',
                    width: '90%',
                    backgroundColor: 'rgba(214, 197, 179, 0.25)',
                    borderRadius: '4px',
                  }}
                />
                <div
                  style={{
                    height: '34px',
                    width: '100px',
                    backgroundColor: 'rgba(214, 197, 179, 0.35)',
                    borderRadius: '8px',
                    marginTop: '8px',
                  }}
                />
              </div>
              <div>
                <div
                  style={{
                    aspectRatio: '4 / 3',
                    backgroundColor: 'rgba(214, 197, 179, 0.3)',
                    borderRadius: '16px',
                    width: '100%',
                  }}
                />
              </div>
            </div>

            {/* Latest Posts Panel Skeleton */}
            <div className="news-latest-panel">
              <div
                style={{
                  height: '24px',
                  width: '140px',
                  backgroundColor: 'rgba(214, 197, 179, 0.35)',
                  borderRadius: '4px',
                  marginBottom: '24px',
                }}
              />
              <div className="news-latest-grid">
                {[1, 2, 3, 4].map((n) => (
                  <div
                    key={n}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                    }}
                  >
                    <div
                      style={{
                        aspectRatio: '4 / 3',
                        backgroundColor: 'rgba(214, 197, 179, 0.3)',
                        borderRadius: '12px',
                        width: '100%',
                      }}
                    />
                    <div
                      style={{
                        height: '16px',
                        width: '90%',
                        backgroundColor: 'rgba(214, 197, 179, 0.3)',
                        borderRadius: '4px',
                      }}
                    />
                    <div
                      style={{
                        height: '12px',
                        width: '40%',
                        backgroundColor: 'rgba(214, 197, 179, 0.2)',
                        borderRadius: '4px',
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : error ? (
          /* Error State */
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
              Unable to Load Stories
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
            <button
              type="button"
              onClick={loadArticles}
              className="news-btn-outline"
              style={{ marginTop: '8px' }}
            >
              ↻ Retry Loading
            </button>
          </div>
        ) : filteredArticles.length === 0 ? (
          /* Empty State */
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
            <div style={{ fontSize: '2.5rem' }}>📰</div>
            <h2
              className="font-display"
              style={{
                fontSize: '1.5rem',
                fontWeight: 700,
                color: 'var(--color-text-primary)',
                margin: 0,
              }}
            >
              No stories published yet. Check back soon.
            </h2>
            <p
              style={{
                fontSize: '0.875rem',
                color: 'var(--color-text-secondary)',
                lineHeight: 1.6,
                margin: 0,
              }}
            >
              {search || category !== 'All'
                ? `No articles found matching "${search || category}". Try resetting filters or searching for different keywords.`
                : 'Our editorial desk is preparing upcoming announcements and founder features. Check back soon!'}
            </p>
            {(search || category !== 'All') && (
              <button
                type="button"
                onClick={() => {
                  setCategory('All');
                  setSearch('');
                  setShowAllLatest(false);
                }}
                className="news-btn-outline"
                style={{ marginTop: '8px' }}
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          /* Main Blog Content */
          <div>
            {/* 1. Featured Post: 2-column split (Left text + Outlined Read More button, Right 4/3 image) */}
            {featuredArticle && <FeaturedPost post={featuredArticle} />}

            {/* 2. "Latest Posts" Panel: Full-width rounded container with 6% slate tint & 4-column grid */}
            {remainingArticles.length > 0 && (
              <section className="news-latest-panel" aria-label="Latest Posts">
                <h2 className="news-latest-heading">Latest Posts</h2>

                <div className="news-latest-grid">
                  {displayedLatestArticles.map((post) => (
                    <PostCard key={post.id} post={post} />
                  ))}
                </div>

                {/* "View all stories" / "Load more" button if there are more than 4 posts */}
                {hasMoreThanFour && (
                  <div style={{ textAlign: 'center' }}>
                    <button
                      type="button"
                      onClick={() => setShowAllLatest(!showAllLatest)}
                      className="news-btn-expand"
                    >
                      {showAllLatest
                        ? 'Show fewer stories ↑'
                        : `View all stories (${remainingArticles.length - 4} more) ↓`}
                    </button>
                  </div>
                )}
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

