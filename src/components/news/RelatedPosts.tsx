import React from 'react';
import { Link } from 'react-router-dom';
import type { NewsArticle } from '../../types/news';
import PostCard from './PostCard';

interface RelatedPostsProps {
  articles: NewsArticle[];
  currentPostId: string;
}

export default function RelatedPosts({ articles, currentPostId }: RelatedPostsProps) {
  // Exclude current post and take up to 4 articles
  const otherArticles = articles
    .filter((a) => a.id !== currentPostId)
    .slice(0, 4);

  if (otherArticles.length === 0) return null;

  return (
    <section className="news-latest-panel" aria-label="More Stories">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '24px',
        }}
      >
        <h2 className="news-latest-heading" style={{ margin: 0 }}>
          More Stories
        </h2>

        <Link to="/news" className="news-btn-outline">
          View All Stories →
        </Link>
      </div>

      {/* 4-Column Grid reusing exactly the list page's news-latest-grid */}
      <div className="news-latest-grid">
        {otherArticles.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>
    </section>
  );
}
