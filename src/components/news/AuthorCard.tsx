import React from 'react';
import type { NewsArticle } from '../../types/news';
import ShareButtons from './ShareButtons';
import { authorService } from '../../services/authorService';

interface AuthorCardProps {
  article: NewsArticle;
}

export default function AuthorCard({ article }: AuthorCardProps) {
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
  const authorBio = article.authorBio || '';

  return (
    <div
      style={{
        maxWidth: '720px',
        margin: '40px auto 0 auto',
        boxSizing: 'border-box',
        width: '100%',
      }}
    >
      {/* 1. Tag Pills (if present) */}
      {article.tags && article.tags.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '8px',
            marginBottom: '28px',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--color-text-secondary)',
              marginRight: '4px',
            }}
          >
            Tags:
          </span>
          {article.tags.map((tag) => (
            <span
              key={tag}
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '12px',
                padding: '4px 12px',
                borderRadius: '9999px',
                backgroundColor: 'rgba(255, 255, 255, 0.65)',
                border: '1px solid rgba(214, 197, 179, 0.7)',
                color: 'var(--color-text-secondary)',
              }}
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* 2. Compact Author Card */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '16px',
          padding: '24px',
          borderRadius: '12px',
          backgroundColor: 'rgba(62, 88, 104, 0.04)',
          border: '1px solid rgba(214, 197, 179, 0.5)',
          marginBottom: '24px',
          boxSizing: 'border-box',
        }}
      >
        {/* Avatar */}
        {displayAvatar ? (
          <img
            src={displayAvatar}
            alt={displayName}
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              objectFit: 'cover',
              border: '1px solid rgba(214, 197, 179, 0.7)',
              flexShrink: 0,
            }}
          />
        ) : (
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: 'var(--color-slate-blue, #3E5868)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '18px',
              fontFamily: 'var(--font-body)',
              flexShrink: 0,
            }}
          >
            {authorInitial}
          </div>
        )}

        {/* Name and Bio */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '15px',
                fontWeight: 700,
                color: 'var(--color-text-primary)',
              }}
            >
              {displayName}
            </span>
            {displayPost ? (
              <span
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--color-text-secondary)',
                  fontWeight: 600,
                }}
              >
                {displayPost}
              </span>
            ) : null}
          </div>

          {authorBio && (
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '13px',
                lineHeight: 1.6,
                color: 'var(--color-text-secondary)',
                margin: 0,
              }}
            >
              {authorBio}
            </p>
          )}
        </div>
      </div>

      {/* 3. Small "Enjoyed this story?" Share Row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          paddingTop: '16px',
          paddingBottom: '8px',
          borderTop: '1px solid rgba(214, 197, 179, 0.5)',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '13px',
            color: 'var(--color-text-secondary)',
            fontWeight: 500,
          }}
        >
          Enjoyed this story? Share with your network:
        </span>

        <ShareButtons title={article.title} />
      </div>
    </div>
  );
}
