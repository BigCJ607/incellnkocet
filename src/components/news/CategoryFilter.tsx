import React from 'react';

interface CategoryFilterProps {
  categories: string[];
  activeCategory: string;
  onSelectCategory: (category: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export default function CategoryFilter({
  categories,
  activeCategory,
  onSelectCategory,
  searchQuery,
  onSearchChange,
}: CategoryFilterProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        padding: '0 0 8px 0',
        marginBottom: '8px',
      }}
    >
      {/* Category Pills (Compact) */}
      <div
        className="hide-scrollbar"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          overflowX: 'auto',
          padding: '2px 0',
          maxWidth: '100%',
        }}
      >
        {categories.map((cat) => {
          const isActive = activeCategory === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => onSelectCategory(cat)}
              className={`news-filter-chip ${isActive ? 'active' : ''}`}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Search Input (Compact, doesn't dominate) */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '220px',
        }}
      >
        <input
          type="text"
          placeholder="Search stories..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{
            width: '100%',
            height: '34px',
            fontFamily: 'var(--font-body)',
            fontSize: '0.8125rem',
            padding: '6px 32px 6px 14px',
            borderRadius: '9999px',
            backgroundColor: 'rgba(255, 255, 255, 0.75)',
            color: 'var(--color-text-primary)',
            border: '1px solid rgba(214, 197, 179, 0.75)',
            outline: 'none',
            boxSizing: 'border-box',
            transition: 'all 200ms ease',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'var(--color-slate-blue)';
            e.currentTarget.style.backgroundColor = '#FFFFFF';
            e.currentTarget.style.boxShadow = '0 0 0 2px rgba(62, 88, 104, 0.12)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'rgba(214, 197, 179, 0.75)';
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.75)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        />
        {searchQuery ? (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            style={{
              position: 'absolute',
              right: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              fontSize: '0.75rem',
              color: 'var(--color-text-secondary)',
              cursor: 'pointer',
              padding: '2px',
            }}
            title="Clear search"
          >
            ✕
          </button>
        ) : (
          <span
            style={{
              position: 'absolute',
              right: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: '0.75rem',
              color: 'var(--color-text-secondary)',
              opacity: 0.6,
              pointerEvents: 'none',
            }}
          >
            🔍
          </span>
        )}
      </div>
    </div>
  );
}

