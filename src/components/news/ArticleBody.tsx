import React, { useState } from 'react';
import DOMPurify from 'dompurify';
import type { NewsArticle } from '../../types/news';

interface ArticleBodyProps {
  article: NewsArticle;
}

export default function ArticleBody({ article }: ArticleBodyProps) {
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  const sanitizedContent = article.content
    ? DOMPurify.sanitize(article.content)
    : '';

  return (
    <div style={{ width: '100%' }}>
      {/* 3. Hero Image: container width up to 1100px, aspect-ratio 16/9, border-radius 16px, 32px vertical margin */}
      <div
        style={{
          maxWidth: '1100px',
          width: '100%',
          margin: '32px auto',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            width: '100%',
            aspectRatio: '16 / 9',
            borderRadius: '16px',
            overflow: 'hidden',
            backgroundColor: 'rgba(214, 197, 179, 0.25)',
            position: 'relative',
          }}
        >
          {article.coverImage && !imgError ? (
            <img
              src={article.coverImage}
              alt={article.title}
              loading="lazy"
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgError(true)}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
                opacity: imgLoaded ? 1 : 0,
                transition: 'opacity 400ms ease',
              }}
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
                padding: '24px',
                textAlign: 'center',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '2.5rem',
                  fontWeight: 700,
                  color: 'var(--color-slate-blue)',
                  marginBottom: '8px',
                }}
              >
                E-Cell
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '0.8125rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.14em',
                  color: 'var(--color-text-secondary)',
                  fontWeight: 600,
                }}
              >
                NKOCET Journal Article
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Optional "Key Takeaways" box (only rendered if article.keyPoints exists and is not empty) */}
      {article.keyPoints && article.keyPoints.length > 0 && (
        <aside
          aria-label="Key Takeaways"
          style={{
            maxWidth: '720px',
            margin: '0 auto 36px auto',
            padding: '24px',
            borderRadius: '12px',
            backgroundColor: 'rgba(62, 88, 104, 0.05)',
            border: '1px solid rgba(214, 197, 179, 0.6)',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '0.6875rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              color: 'var(--color-slate-blue, #3E5868)',
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>💡</span>
            <span>Key Takeaways</span>
          </div>
          <ul
            style={{
              margin: 0,
              paddingLeft: '1.25rem',
              fontFamily: 'var(--font-body)',
              fontSize: '0.9375rem',
              lineHeight: 1.6,
              color: 'var(--color-text-primary)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            {article.keyPoints.map((point, idx) => (
              <li key={idx}>{point}</li>
            ))}
          </ul>
        </aside>
      )}

      {/* 4. Body: centered reading column (max-width 720px), Inter 18px, line-height 1.8 */}
      <div
        className="news-article-reading-body"
        style={{
          maxWidth: '720px',
          margin: '0 auto',
          boxSizing: 'border-box',
          width: '100%',
        }}
        dangerouslySetInnerHTML={{ __html: sanitizedContent }}
      />
    </div>
  );
}
