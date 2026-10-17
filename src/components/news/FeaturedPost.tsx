import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import type { NewsArticle } from '../../types/news';

interface FeaturedPostProps {
  post: NewsArticle;
}

function formatPostDate(dateStr?: string): string {
  if (!dateStr) return 'Recent';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'Recent';
  const day = d.getDate();
  const month = d.toLocaleDateString('en-US', { month: 'short' });
  const year = d.getFullYear();
  return `${day} ${month}, ${year}`;
}

export default function FeaturedPost({ post }: FeaturedPostProps) {
  const [imgError, setImgError] = useState(false);
  const formattedDate = formatPostDate(post.publishedAt);

  return (
    <article className="news-featured-ref">
      {/* Left Column: Vertically Centered Text Content */}
      <div className="news-featured-text-col">
        {/* Small date with clock icon */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.8125rem',
            color: 'var(--color-text-secondary)',
            fontFamily: 'var(--font-body)',
            fontWeight: 400,
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            style={{ display: 'inline-block', flexShrink: 0, opacity: 0.8 }}
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span>{formattedDate}</span>
        </div>

        {/* Serif H2 Title (about 2rem, tight line-height) */}
        <Link
          to={`/news/${post.slug}`}
          style={{ textDecoration: 'none', color: 'inherit' }}
        >
          <h2
            className="font-display"
            style={{
              fontSize: 'clamp(1.75rem, 2.5vw, 2.15rem)',
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              lineHeight: 1.18,
              letterSpacing: '-0.02em',
              margin: 0,
              transition: 'color 200ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--color-slate-blue)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--color-text-primary)';
            }}
          >
            {post.title}
          </h2>
        </Link>

        {/* 3-4 Line Muted Description (line-clamp-4, small text) */}
        <p
          className="news-line-clamp-4"
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '0.875rem',
            color: 'var(--color-text-secondary)',
            lineHeight: 1.65,
            margin: 0,
          }}
        >
          {post.excerpt}
        </p>

        {/* OUTLINED "Read More" button */}
        <Link to={`/news/${post.slug}`} className="news-btn-outline">
          Read More
        </Link>
      </div>

      {/* Right Column: Post Image (4/3 aspect-ratio, 16px radius, object-fit: cover) */}
      <div className="news-featured-img-col">
        <Link
          to={`/news/${post.slug}`}
          className="news-featured-img-wrap"
          aria-label={`Read featured story: ${post.title}`}
        >
          {post.coverImage && !imgError ? (
            <img
              src={post.coverImage}
              alt={post.title}
              onError={() => setImgError(true)}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                background:
                  'linear-gradient(135deg, rgba(62,88,104,0.18) 0%, rgba(118,137,151,0.15) 50%, rgba(233,221,201,0.45) 100%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '24px',
                textAlign: 'center',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '2rem',
                  fontWeight: 700,
                  color: 'var(--color-slate-blue)',
                  marginBottom: '6px',
                }}
              >
                E-Cell
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '0.75rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                  color: 'var(--color-text-secondary)',
                  fontWeight: 600,
                }}
              >
                NKOCET Journal
              </span>
            </div>
          )}
        </Link>
      </div>
    </article>
  );
}

