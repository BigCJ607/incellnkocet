import React from 'react';
import { Link } from 'react-router-dom';
import type { NewsArticle } from '../../types/news';
import ShareButtons from './ShareButtons';
import { authorService } from '../../services/authorService';

interface ArticleHeaderProps {
  article: NewsArticle;
}

function formatDetailDate(dateStr?: string | null): string {
  if (!dateStr) return 'Recently Published';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'Recently Published';
  const day = d.getDate();
  const month = d.toLocaleDateString('en-US', { month: 'short' });
  const year = d.getFullYear();
  return `${day} ${month}, ${year}`;
}

export default function ArticleHeader({ article }: ArticleHeaderProps) {
  const formattedDate = formatDetailDate(article.publishedAt);
  
  let displayName = (article.author || 'E-Cell Team').trim();
  let displayPost = (article.authorRole || '').trim();

  // Smart backward compatibility: if previous author was saved as "Name - Designation"
  if (!displayPost && displayName.includes(' - ')) {
    const parts = displayName.split(' - ');
    displayName = parts[0].trim();
    displayPost = parts.slice(1).join(' - ').trim();
  }

  // Fallback to remembered author profile if avatar or role is not stored directly on article
  let displayAvatar = (article.authorAvatar || '').trim();
  const savedAuthors = authorService.getAuthors();
  const matchedAuthor = savedAuthors.find(
    (a) =>
      (article.authorId && a.id === article.authorId) ||
      a.name.toLowerCase() === displayName.toLowerCase()
  );

  if (!displayAvatar && matchedAuthor?.avatar) {
    displayAvatar = matchedAuthor.avatar;
  }
  if (!displayPost && matchedAuthor?.role) {
    displayPost = matchedAuthor.role;
  }

  const authorInitial = (displayName || 'E').charAt(0).toUpperCase();

  return (
    <header
      style={{
        maxWidth: '760px',
        margin: '0 auto',
        textAlign: 'left',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* 1. Small Meta Row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px',
          fontSize: '0.8125rem',
          color: 'var(--color-text-secondary)',
          fontFamily: 'var(--font-body)',
          marginBottom: '18px',
        }}
      >
        {/* Date with Clock Icon */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
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
            style={{ opacity: 0.8 }}
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span>{formattedDate}</span>
        </div>

        <span>•</span>
        <span>{article.readingTime || 3} min read</span>
        <span>•</span>

        {/* Category as small outlined pill */}
        <Link
          to={`/news?category=${encodeURIComponent(article.category)}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '3px 10px',
            borderRadius: '9999px',
            border: '1px solid var(--color-slate-blue, #3E5868)',
            color: 'var(--color-slate-blue, #3E5868)',
            fontSize: '11px',
            fontWeight: 600,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            textDecoration: 'none',
            transition: 'all 200ms ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--color-slate-blue)';
            e.currentTarget.style.color = '#FFFFFF';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = 'var(--color-slate-blue)';
          }}
        >
          {article.category}
        </Link>
      </div>

      {/* 2. Large Serif H1 */}
      <h1
        className="font-display"
        style={{
          fontSize: 'clamp(2rem, 4.5vw, 3.2rem)',
          lineHeight: 1.15,
          letterSpacing: '-0.02em',
          fontWeight: 700,
          color: 'var(--color-text-primary)',
          margin: '0 0 20px 0',
        }}
      >
        {article.title}
      </h1>

      {/* 3. Italic Subtitle / Excerpt in a larger body size */}
      {article.excerpt && (
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '1.125rem',
            lineHeight: 1.6,
            color: 'var(--color-text-secondary)',
            fontStyle: 'italic',
            margin: '0 0 28px 0',
          }}
        >
          {article.excerpt}
        </p>
      )}

      {/* 4. Author Row: 40px Circular Avatar + Name/Role stacked, Share buttons on the RIGHT */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          paddingTop: '20px',
          paddingBottom: '20px',
          borderTop: '1px solid rgba(214, 197, 179, 0.6)',
          borderBottom: '1px solid rgba(214, 197, 179, 0.6)',
        }}
      >
        {/* Left: Avatar + Author Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {displayAvatar ? (
            <img
              src={displayAvatar}
              alt={displayName}
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                objectFit: 'cover',
                border: '1px solid rgba(214, 197, 179, 0.7)',
                flexShrink: 0,
              }}
            />
          ) : (
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                backgroundColor: 'var(--color-slate-blue, #3E5868)',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '15px',
                fontFamily: 'var(--font-body)',
                flexShrink: 0,
              }}
            >
              {authorInitial}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '14px',
                fontWeight: 600,
                color: 'var(--color-text-primary)',
                lineHeight: 1.25,
              }}
            >
              {displayName}
            </span>
            {displayPost ? (
              <span
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '12px',
                  color: 'var(--color-text-secondary)',
                  lineHeight: 1.2,
                }}
              >
                {displayPost}
              </span>
            ) : null}
          </div>
        </div>

        {/* Right: Compact Share Icon Buttons */}
        <ShareButtons title={article.title} />
      </div>
    </header>
  );
}
