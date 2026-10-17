import { useState, useEffect, useCallback } from 'react';
import type { NewsArticle, ArticleStatus, ArticleGalleryImage } from '../../types/news';
import { newsService } from '../../services/newsService';
import NewsEditorModal from './NewsEditorModal';
import ArticlePreviewModal from './ArticlePreviewModal';

interface AdminNewsTabProps {
  currentAdminName?: string;
}

export default function AdminNewsTab({ currentAdminName = 'Admin' }: AdminNewsTabProps) {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ArticleStatus>('all');
  const [actionMessage, setActionMessage] = useState('');

  // Modals
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<NewsArticle | null>(null);
  const [previewArticle, setPreviewArticle] = useState<NewsArticle | null>(null);

  const loadArticles = useCallback(async () => {
    setLoading(true);
    try {
      const data = await newsService.getAllArticlesAdmin({
        status: statusFilter,
        search,
      });
      setArticles(data);
    } catch (err) {
      console.error('Failed to load articles for admin:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    loadArticles();
  }, [loadArticles]);

  const showToast = (msg: string) => {
    setActionMessage(msg);
    setTimeout(() => setActionMessage(''), 3500);
  };

  const handleCreateNew = () => {
    setEditingArticle(null);
    setEditorOpen(true);
  };

  const handleEdit = async (art: NewsArticle) => {
    // Fetch full details including gallery images
    const full = await newsService.getArticleBySlug(art.slug) || art;
    setEditingArticle(full);
    setEditorOpen(true);
  };

  const handleSave = async (
    data: Partial<NewsArticle>,
    coverFile?: File | null,
    galleryItems?: ArticleGalleryImage[],
    deletedPaths?: string[]
  ) => {
    if (editingArticle?.id) {
      await newsService.updateArticle(
        editingArticle.id,
        data,
        coverFile,
        galleryItems,
        deletedPaths
      );
      showToast(`Article "${data.title}" updated successfully!`);
    } else {
      await newsService.createArticle(data, coverFile, galleryItems as any);
      showToast(`Article "${data.title}" created successfully!`);
    }
    await loadArticles();
  };

  const handleDelete = async (id: string, title: string) => {
    try {
      await newsService.deleteArticle(id);
      showToast(`Article "${title}" deleted.`);
      await loadArticles();
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handleTogglePublish = async (art: NewsArticle) => {
    const nextStatus: ArticleStatus = art.status === 'published' ? 'draft' : 'published';
    try {
      await newsService.toggleArticleStatus(art.id, nextStatus);
      showToast(
        nextStatus === 'published'
          ? `"${art.title}" is now LIVE on the public website.`
          : `"${art.title}" has been unpublished (Draft).`
      );
      await loadArticles();
    } catch (err: any) {
      alert(`Failed to update status: ${err.message}`);
    }
  };

  const handleArchive = async (art: NewsArticle) => {
    try {
      await newsService.toggleArticleStatus(art.id, 'archived');
      showToast(`"${art.title}" moved to archive.`);
      await loadArticles();
    } catch (err: any) {
      alert(`Failed to archive: ${err.message}`);
    }
  };

  // KPIs
  const totalCount = articles.length;
  const publishedCount = articles.filter((a) => a.status === 'published').length;
  const draftCount = articles.filter((a) => a.status === 'draft').length;
  const archivedCount = articles.filter((a) => a.status === 'archived').length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Toast Notification */}
      {actionMessage && (
        <div
          className="fixed bottom-6 right-6 z-50 px-6 py-4 flex items-center gap-3 font-semibold text-xs tracking-wider shadow-2xl rounded-xl"
          style={{
            background: 'rgba(16,185,129,0.2)',
            border: '1px solid #10B981',
            color: '#6ee7b7',
            backdropFilter: 'blur(12px)',
          }}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          {actionMessage.toUpperCase()}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card-glass p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-indigo-500" />
          <span className="text-xs text-slate-400 uppercase tracking-wider block font-semibold mb-1">
            Total Articles
          </span>
          <div className="text-3xl font-display text-white">{totalCount}</div>
          <p className="text-[11px] text-slate-500 mt-1">All editorial entries</p>
        </div>

        <div className="card-glass p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-emerald-500" />
          <span className="text-xs text-emerald-400 uppercase tracking-wider block font-semibold mb-1">
            Live Published
          </span>
          <div className="text-3xl font-display text-emerald-300">{publishedCount}</div>
          <p className="text-[11px] text-slate-500 mt-1">Visible on public site</p>
        </div>

        <div className="card-glass p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-amber-500" />
          <span className="text-xs text-amber-400 uppercase tracking-wider block font-semibold mb-1">
            Drafts
          </span>
          <div className="text-3xl font-display text-amber-300">{draftCount}</div>
          <p className="text-[11px] text-slate-500 mt-1">Unpublished / in progress</p>
        </div>

        <div className="card-glass p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-purple-500" />
          <span className="text-xs text-purple-400 uppercase tracking-wider block font-semibold mb-1">
            Archived
          </span>
          <div className="text-3xl font-display text-purple-300">{archivedCount}</div>
          <p className="text-[11px] text-slate-500 mt-1">Preserved historical stories</p>
        </div>
      </div>

      {/* Action Header & Search */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Search & Filters */}
        <div className="flex flex-wrap items-center gap-3 flex-1 max-w-2xl">
          <input
            type="text"
            placeholder="Search news by title, slug, or category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[220px] px-4 py-2.5 bg-black/40 border border-white/10 text-white text-xs rounded-xl focus:outline-none focus:border-indigo-500"
          />

          <div className="flex items-center gap-1.5 bg-white/5 p-1 rounded-xl border border-white/10 text-xs">
            {(['all', 'published', 'draft', 'archived'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setStatusFilter(mode)}
                className={`px-3 py-1.5 rounded-lg font-semibold uppercase text-[11px] transition-colors cursor-pointer ${
                  statusFilter === mode
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        {/* Create Button */}
        <button
          type="button"
          onClick={handleCreateNew}
          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
        >
          <span>+</span>
          <span>CREATE NEW ARTICLE</span>
        </button>
      </div>

      {/* Articles Management Table / List */}
      <div className="card-glass overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            <div className="animate-spin w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full mx-auto mb-3" />
            Loading articles directory...
          </div>
        ) : articles.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <div className="text-4xl">📰</div>
            <h3 className="text-white text-base font-bold font-display">No articles found</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              {search || statusFilter !== 'all'
                ? 'No articles match your active filter. Try resetting your search or filter.'
                : 'Get started by publishing your first campus startup announcement or editorial blog post.'}
            </p>
            <button
              type="button"
              onClick={handleCreateNew}
              className="mt-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl"
            >
              + Create First Article
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.02] text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                  <th className="p-4">Article</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Author</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Date</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-xs text-slate-300">
                {articles.map((art) => (
                  <tr key={art.id} className="hover:bg-white/[0.03] transition-colors">
                    {/* Title + Thumbnail */}
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={art.coverImage || '/background/image2.jpg'}
                          alt={art.title}
                          className="w-14 h-10 rounded-lg object-cover bg-black/40 shrink-0 border border-white/10"
                        />
                        <div className="min-w-0 max-w-sm">
                          <div className="font-semibold text-white truncate hover:text-indigo-300 transition-colors cursor-pointer" onClick={() => handleEdit(art)}>
                            {art.title}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono truncate">
                            /news/{art.slug}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Category */}
                    <td className="p-4">
                      <span className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-white/5 border border-white/10 text-slate-300 whitespace-nowrap">
                        {art.category}
                      </span>
                    </td>

                    {/* Author */}
                    <td className="p-4 text-slate-400 whitespace-nowrap">
                      {art.author}
                    </td>

                    {/* Status Badge */}
                    <td className="p-4 whitespace-nowrap">
                      {art.status === 'published' ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5 w-fit">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          Published
                        </span>
                      ) : art.status === 'draft' ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1.5 w-fit">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                          Draft
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1.5 w-fit">
                          Archived
                        </span>
                      )}
                    </td>

                    {/* Date */}
                    <td className="p-4 text-slate-400 whitespace-nowrap text-[11px]">
                      {art.publishedAt
                        ? new Date(art.publishedAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        : new Date(art.createdAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                    </td>

                    {/* Actions */}
                    <td className="p-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Preview */}
                        <button
                          type="button"
                          title="Preview Article"
                          onClick={() => setPreviewArticle(art)}
                          className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/15 text-slate-300 text-[11px] font-medium transition-colors"
                        >
                          👁
                        </button>

                        {/* Edit */}
                        <button
                          type="button"
                          onClick={() => handleEdit(art)}
                          className="px-3 py-1 rounded bg-indigo-600/30 hover:bg-indigo-600 text-indigo-200 hover:text-white border border-indigo-500/40 text-[11px] font-semibold transition-colors"
                        >
                          Edit
                        </button>

                        {/* Quick Publish / Unpublish */}
                        <button
                          type="button"
                          onClick={() => handleTogglePublish(art)}
                          className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
                            art.status === 'published'
                              ? 'bg-yellow-600/20 hover:bg-yellow-600/40 text-yellow-300 border border-yellow-500/30'
                              : 'bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          {art.status === 'published' ? 'Unpublish' : 'Publish'}
                        </button>

                        {/* Archive (if not archived) */}
                        {art.status !== 'archived' && (
                          <button
                            type="button"
                            title="Archive Article"
                            onClick={() => handleArchive(art)}
                            className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-slate-400 hover:text-slate-200 text-[11px] transition-colors"
                          >
                            📦
                          </button>
                        )}

                        {/* Delete */}
                        <button
                          type="button"
                          title="Delete Article"
                          onClick={() => {
                            if (window.confirm(`Delete article "${art.title}"? This cannot be undone.`)) {
                              handleDelete(art.id, art.title);
                            }
                          }}
                          className="px-2 py-1 rounded bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white text-[11px] transition-colors"
                        >
                          🗑
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* News Article Editor Modal */}
      <NewsEditorModal
        article={editingArticle}
        isOpen={editorOpen}
        onClose={() => {
          setEditorOpen(false);
          setEditingArticle(null);
        }}
        onSave={handleSave}
        onDelete={handleDelete}
        currentAdminName={currentAdminName}
      />

      {/* Article Live Preview Modal */}
      <ArticlePreviewModal
        article={previewArticle || {}}
        isOpen={!!previewArticle}
        onClose={() => setPreviewArticle(null)}
      />
    </div>
  );
}
