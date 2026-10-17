import DOMPurify from 'dompurify';
import type { NewsArticle } from '../../types/news';

interface ArticlePreviewModalProps {
  article: Partial<NewsArticle>;
  isOpen: boolean;
  onClose: () => void;
}

export default function ArticlePreviewModal({
  article,
  isOpen,
  onClose,
}: ArticlePreviewModalProps) {
  if (!isOpen) return null;

  const sanitizedContent = DOMPurify.sanitize(article.content || '<p>No content provided yet.</p>');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-fade-in">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-[var(--color-bg,#F5F1E8)] text-[var(--color-text-primary,#20282B)] rounded-2xl shadow-2xl overflow-hidden flex flex-col my-8">
        {/* Top Control Bar */}
        <div className="flex items-center justify-between px-6 py-4 bg-[var(--color-white,#FBF9F4)] border-b border-[var(--color-cream,#E9DDC9)]">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 text-xs font-bold uppercase tracking-wider rounded bg-amber-500/15 text-amber-800 border border-amber-300">
              Live Preview Mode
            </span>
            <span className="text-xs text-[var(--color-text-secondary,#687177)] font-mono">
              /news/{article.slug || 'untitled-article'}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-black/10 hover:bg-black/20 text-slate-800 transition-colors"
          >
            ✕ Close Preview
          </button>
        </div>

        {/* Article Body Preview */}
        <div className="p-6 md:p-12 overflow-y-auto flex-1 space-y-8">
          {/* Metadata */}
          <div className="space-y-4 max-w-3xl">
            <div className="flex flex-wrap items-center gap-3 text-xs tracking-wider uppercase font-semibold text-[var(--color-slate-blue,#3E5868)]">
              <span className="px-3 py-1 rounded-full bg-[var(--color-cream,#E9DDC9)] text-[var(--color-text-primary,#20282B)]">
                {article.category || 'Entrepreneurship'}
              </span>
              <span>•</span>
              <span>{article.readingTime || 3} min read</span>
              <span>•</span>
              <div className="inline-flex items-center gap-1.5 normal-case font-medium">
                {article.authorAvatar && (
                  <img
                    src={article.authorAvatar}
                    alt={article.author || 'Author'}
                    className="w-5 h-5 rounded-full object-cover border border-slate-300"
                  />
                )}
                <span className="font-semibold">{article.author || 'E-Cell Team'}</span>
                {article.authorRole && (
                  <span className="text-[var(--color-text-secondary,#687177)] text-[11px]">
                    ({article.authorRole})
                  </span>
                )}
              </div>
            </div>

            <h1
              className="font-display text-3xl md:text-5xl leading-tight font-extrabold text-[var(--color-text-primary,#20282B)]"
              style={{ fontFamily: 'Playfair Display, serif' }}
            >
              {article.title || 'Untitled Article'}
            </h1>

            {article.excerpt && (
              <p className="text-base md:text-lg text-[var(--color-text-secondary,#687177)] leading-relaxed font-serif italic border-l-2 border-[var(--color-slate-blue,#3E5868)] pl-4">
                {article.excerpt}
              </p>
            )}
          </div>

          {/* Cover image */}
          {article.coverImage && (
            <div className="rounded-2xl overflow-hidden aspect-[16/9] shadow-md border border-[var(--color-cream,#E9DDC9)]">
              <img
                src={article.coverImage}
                alt={article.title || 'Cover'}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Rich content */}
          <div
            className="prose max-w-3xl text-sm md:text-base leading-relaxed text-[var(--color-text-primary,#20282B)]"
            dangerouslySetInnerHTML={{ __html: sanitizedContent }}
          />

          {/* Gallery preview if any */}
          {article.galleryImages && article.galleryImages.length > 0 && (
            <div className="pt-8 border-t border-[var(--color-cream,#E9DDC9)] space-y-4">
              <h3 className="font-display text-xl font-bold text-[var(--color-text-primary,#20282B)]">
                Photo Gallery ({article.galleryImages.length})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {article.galleryImages.map((img, idx) => (
                  <div key={idx} className="rounded-xl overflow-hidden bg-white shadow-sm border border-[var(--color-cream,#E9DDC9)]">
                    <img
                      src={img.imageUrl || img.localPreviewUrl}
                      alt={img.altText || 'Gallery'}
                      className="w-full h-40 object-cover"
                    />
                    {img.caption && (
                      <p className="p-2 text-xs text-[var(--color-text-secondary,#687177)] italic">
                        {img.caption}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
