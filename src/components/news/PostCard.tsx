import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import type { NewsArticle } from '../../types/news';

interface PostCardProps {
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

export default function PostCard({ post }: PostCardProps) {
  const [imgError, setImgError] = useState(false);
  const formattedDate = formatPostDate(post.publishedAt);

  return (
    <Link
      to={`/news/${post.slug}`}
      className="news-borderless-card"
      aria-label={`Read story: ${post.title}`}
    >
      {/* 4/3 Aspect Ratio Image with 12px radius */}
      <div className="news-borderless-img-wrap">
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
                'linear-gradient(135deg, rgba(62,88,104,0.18) 0%, rgba(118,137,151,0.12) 50%, rgba(233,221,201,0.45) 100%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
              textAlign: 'center',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '1.25rem',
                fontWeight: 700,
                color: 'var(--color-slate-blue)',
                marginBottom: '4px',
              }}
            >
              E-Cell
            </span>
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '0.625rem',
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                color: 'var(--color-text-secondary)',
                fontWeight: 600,
              }}
            >
              NKOCET
            </span>
          </div>
        )}
      </div>

      {/* 2-line-clamped Title (Inter, 15px, medium weight) */}
      <h3 className="news-borderless-title news-line-clamp-2">
        {post.title}
      </h3>

      {/* Date with small clock icon in muted text */}
      <div className="news-borderless-date">
        <svg
          width="12"
          height="12"
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
    </Link>
  );
}

