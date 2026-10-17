import { useState, useEffect, useRef } from 'react';
import type { NewsArticle, ArticleGalleryImage, ArticleStatus, NewsAuthor } from '../../types/news';
import { PRESET_NEWS_CATEGORIES } from '../../types/news';
import { generateSlug, calculateReadingTime } from '../../services/newsService';
import { authorService } from '../../services/authorService';
import { CoverImageUploader, GalleryImageManager } from './NewsImageUploader';
import RichTextEditor from './RichTextEditor';
import ArticlePreviewModal from './ArticlePreviewModal';
import AvatarCropperModal from './AvatarCropperModal';
import type { CompressedImageResult } from '../../utils/imageCompression';
import { formatBytes } from '../../utils/imageCompression';

interface NewsEditorModalProps {
  article?: NewsArticle | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    articleData: Partial<NewsArticle>,
    coverFile?: File | null,
    galleryItems?: ArticleGalleryImage[],
    deletedPaths?: string[]
  ) => Promise<void>;
  onDelete?: (id: string, title: string) => Promise<void>;
  currentAdminName?: string;
}

export default function NewsEditorModal({
  article,
  isOpen,
  onClose,
  onSave,
  onDelete,
  currentAdminName = 'E-Cell Team',
}: NewsEditorModalProps) {
  const [activeTab, setActiveTab] = useState<'content' | 'media' | 'seo'>('content');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);

  // Form fields
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [isSlugManual, setIsSlugManual] = useState(false);
  const [excerpt, setExcerpt] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState(PRESET_NEWS_CATEGORIES[0]);
  const [customCategory, setCustomCategory] = useState('');
  const [isCustomCategory, setIsCustomCategory] = useState(false);

  // Author Management fields
  const [authorList, setAuthorList] = useState<NewsAuthor[]>([]);
  const [author, setAuthor] = useState(currentAdminName);
  const [authorRole, setAuthorRole] = useState('');
  const [authorAvatar, setAuthorAvatar] = useState('');
  const [authorId, setAuthorId] = useState('');
  const [showCustomizeAuthor, setShowCustomizeAuthor] = useState(false);

  // Add New Author flow
  const [isAddingAuthor, setIsAddingAuthor] = useState(false);
  const [newAuthorName, setNewAuthorName] = useState('');
  const [newAuthorRole, setNewAuthorRole] = useState('');
  const [newAuthorAvatar, setNewAuthorAvatar] = useState('');
  const [newAuthorStats, setNewAuthorStats] = useState<{
    originalSize: number;
    compressedSize: number;
    reductionPercentage: number;
  } | null>(null);
  const [isCompressingAvatar, setIsCompressingAvatar] = useState(false);
  const [newAuthorError, setNewAuthorError] = useState('');

  // Profile Picture Cropper Modal state
  const [cropperFile, setCropperFile] = useState<File | null>(null);
  const [cropperSrc, setCropperSrc] = useState<string | null>(null);
  const [cropperOpen, setCropperOpen] = useState(false);
  const [cropperTarget, setCropperTarget] = useState<'new_author' | 'article_author'>('new_author');

  const [status, setStatus] = useState<ArticleStatus>('draft');
  const [seoDescription, setSeoDescription] = useState('');

  // Media
  const [coverImage, setCoverImage] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [galleryImages, setGalleryImages] = useState<ArticleGalleryImage[]>([]);
  const [deletedStoragePaths, setDeletedStoragePaths] = useState<string[]>([]);

  // Dirty state tracking for unsaved changes warning
  const [isDirty, setIsDirty] = useState(false);
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (isOpen) {
      const savedAuthors = authorService.getAuthors();
      setAuthorList(savedAuthors);

      if (article) {
        setTitle(article.title || '');
        setSlug(article.slug || '');
        setIsSlugManual(true);
        setExcerpt(article.excerpt || '');
        setContent(article.content || '');
        if (PRESET_NEWS_CATEGORIES.includes(article.category)) {
          setCategory(article.category);
          setIsCustomCategory(false);
        } else {
          setIsCustomCategory(true);
          setCustomCategory(article.category);
        }

        // Author resolution
        let rawAuthor = (article.author || currentAdminName).trim();
        let rawRole = (article.authorRole || '').trim();
        let rawAvatar = (article.authorAvatar || '').trim();
        let rawAuthorId = article.authorId || '';

        // Backward compatibility if author was typed as "Name - Designation"
        if (!rawRole && rawAuthor.includes(' - ')) {
          const parts = rawAuthor.split(' - ');
          rawAuthor = parts[0].trim();
          rawRole = parts.slice(1).join(' - ').trim();
        }

        // Try matching with remembered authors
        const matched = savedAuthors.find(
          (a) => a.id === rawAuthorId || a.name.toLowerCase() === rawAuthor.toLowerCase()
        );

        if (matched) {
          setAuthorId(matched.id);
          setAuthor(matched.name);
          setAuthorRole(rawRole || matched.role);
          setAuthorAvatar(rawAvatar || matched.avatar || '');
        } else {
          setAuthorId(rawAuthorId);
          setAuthor(rawAuthor);
          setAuthorRole(rawRole);
          setAuthorAvatar(rawAvatar);
        }

        setStatus(article.status || 'draft');
        setSeoDescription(article.seoDescription || '');
        setCoverImage(article.coverImage || '');
        setGalleryImages(article.galleryImages || []);
      } else {
        // Reset for new article
        setTitle('');
        setSlug('');
        setIsSlugManual(false);
        setExcerpt('');
        setContent('');
        setCategory(PRESET_NEWS_CATEGORIES[0]);
        setIsCustomCategory(false);
        setCustomCategory('');

        // Default to first saved author if available
        const defaultAuthor = savedAuthors[0];
        if (defaultAuthor) {
          setAuthorId(defaultAuthor.id);
          setAuthor(defaultAuthor.name);
          setAuthorRole(defaultAuthor.role);
          setAuthorAvatar(defaultAuthor.avatar || '');
        } else {
          setAuthorId('');
          setAuthor(currentAdminName);
          setAuthorRole('');
          setAuthorAvatar('');
        }

        setStatus('draft');
        setSeoDescription('');
        setCoverImage('');
        setGalleryImages([]);
      }
      setCoverFile(null);
      setDeletedStoragePaths([]);
      setError('');
      setIsDirty(false);
      setShowCustomizeAuthor(false);
      setIsAddingAuthor(false);
      isInitialMount.current = true;
    }
  }, [isOpen, article, currentAdminName]);

  // Mark dirty on changes after mount
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    setIsDirty(true);
  }, [title, slug, excerpt, content, category, author, authorRole, authorAvatar, status, seoDescription, coverFile, galleryImages]);

  // Auto-generate slug from title unless manually edited
  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!isSlugManual) {
      setSlug(generateSlug(val));
    }
  };

  const handleSlugChange = (val: string) => {
    setSlug(val.toLowerCase().replace(/[^a-z0-9-]/g, ''));
    setIsSlugManual(true);
  };

  const handleClose = () => {
    if (isDirty) {
      if (!window.confirm('You have unsaved changes. Are you sure you want to discard them and exit?')) {
        return;
      }
    }
    onClose();
  };

  const handleCoverSelect = (file: File | null, result?: CompressedImageResult) => {
    setCoverFile(file);
    if (result) {
      setCoverImage(result.previewUrl);
    }
  };

  const handleCoverRemove = () => {
    setCoverFile(null);
    setCoverImage('');
  };

  const handleSelectAuthor = (selectedId: string) => {
    if (selectedId === '__add_new__') {
      setIsAddingAuthor(true);
      setNewAuthorName('');
      setNewAuthorRole('');
      setNewAuthorAvatar('');
      setNewAuthorStats(null);
      setNewAuthorError('');
      return;
    }

    if (selectedId === '__custom__') {
      setAuthorId('');
      setShowCustomizeAuthor(true);
      return;
    }

    const found = authorList.find((a) => a.id === selectedId);
    if (found) {
      setAuthorId(found.id);
      setAuthor(found.name);
      setAuthorRole(found.role);
      setAuthorAvatar(found.avatar || '');
    }
  };

  const handleSelectNewAuthorFile = (file: File) => {
    setCropperFile(file);
    setCropperSrc(null);
    setCropperTarget('new_author');
    setCropperOpen(true);
  };

  const handleSelectCustomAvatarFile = (file: File) => {
    setCropperFile(file);
    setCropperSrc(null);
    setCropperTarget('article_author');
    setCropperOpen(true);
  };

  const handleOpenCropperForExisting = (target: 'new_author' | 'article_author') => {
    const src = target === 'new_author' ? newAuthorAvatar : authorAvatar;
    if (!src) return;
    setCropperFile(null);
    setCropperSrc(src);
    setCropperTarget(target);
    setCropperOpen(true);
  };

  const handleCropComplete = (res: {
    avatarUrl: string;
    file: File;
    originalSize: number;
    compressedSize: number;
    reductionPercentage: number;
  }) => {
    if (cropperTarget === 'new_author') {
      setNewAuthorAvatar(res.avatarUrl);
      setNewAuthorStats({
        originalSize: res.originalSize,
        compressedSize: res.compressedSize,
        reductionPercentage: res.reductionPercentage,
      });
    } else {
      setAuthorAvatar(res.avatarUrl);
      // If an author profile is connected, also update their saved avatar in remembered list
      if (authorId) {
        authorService.saveAuthor({
          id: authorId,
          name: author,
          role: authorRole,
          avatar: res.avatarUrl,
        });
        setAuthorList(authorService.getAuthors());
      }
    }
    setCropperOpen(false);
    setCropperFile(null);
    setCropperSrc(null);
  };

  const handleSaveNewAuthor = () => {
    setNewAuthorError('');
    const trimmedName = newAuthorName.trim();
    const trimmedRole = newAuthorRole.trim();

    if (!trimmedName) {
      setNewAuthorError('Please enter the author name.');
      return;
    }
    if (!trimmedRole) {
      setNewAuthorError('Please enter the author post/designation.');
      return;
    }

    try {
      const saved = authorService.saveAuthor({
        name: trimmedName,
        role: trimmedRole,
        avatar: newAuthorAvatar,
      });

      const updated = authorService.getAuthors();
      setAuthorList(updated);

      // Connect automatically to current article
      setAuthorId(saved.id);
      setAuthor(saved.name);
      setAuthorRole(saved.role);
      setAuthorAvatar(saved.avatar || '');

      setIsAddingAuthor(false);
      setNewAuthorName('');
      setNewAuthorRole('');
      setNewAuthorAvatar('');
      setNewAuthorStats(null);
    } catch (err: any) {
      setNewAuthorError(err.message || 'Failed to save author.');
    }
  };

  const handleDeleteSavedAuthor = (idToDelete: string) => {
    if (window.confirm('Are you sure you want to remove this author from the remembered list?')) {
      authorService.deleteAuthor(idToDelete);
      const updated = authorService.getAuthors();
      setAuthorList(updated);
      if (authorId === idToDelete) {
        if (updated.length > 0) {
          handleSelectAuthor(updated[0].id);
        } else {
          setAuthorId('');
        }
      }
    }
  };

  const handleSaveWithStatus = async (targetStatus?: ArticleStatus) => {
    setError('');
    const finalTitle = title.trim();
    if (!finalTitle) {
      setError('Please provide an article title.');
      setActiveTab('content');
      return;
    }

    const finalSlug = (slug || generateSlug(finalTitle)).trim();
    if (!finalSlug) {
      setError('Please provide a valid URL slug.');
      setActiveTab('content');
      return;
    }

    const finalCategory = isCustomCategory ? (customCategory.trim() || 'General') : category;
    const finalStatus = targetStatus || status;

    setSaving(true);
    try {
      await onSave(
        {
          id: article?.id,
          title: finalTitle,
          slug: finalSlug,
          excerpt: excerpt.trim(),
          content,
          category: finalCategory,
          author: author.trim() || currentAdminName,
          authorRole: authorRole.trim(),
          authorAvatar: authorAvatar.trim(),
          authorId: authorId || undefined,
          status: finalStatus,
          coverImage,
          seoDescription: seoDescription.trim(),
          readingTime: calculateReadingTime(content),
          publishedAt: finalStatus === 'published' ? (article?.publishedAt || new Date().toISOString()) : null,
        },
        coverFile,
        galleryImages,
        deletedStoragePaths
      );

      // Also auto-sync/remember this author profile with their avatar in authorService
      if (author.trim()) {
        try {
          authorService.saveAuthor({
            id: authorId || undefined,
            name: author.trim(),
            role: authorRole.trim(),
            avatar: authorAvatar.trim() || undefined,
          });
          setAuthorList(authorService.getAuthors());
        } catch (e) {
          console.warn('Auto-sync author profile failed:', e);
        }
      }

      setIsDirty(false);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save article.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const currentPreviewData: Partial<NewsArticle> = {
    title: title || 'Untitled Article',
    slug: slug || 'article-slug',
    excerpt,
    content,
    category: isCustomCategory ? customCategory : category,
    author: author || currentAdminName,
    authorRole,
    authorAvatar,
    authorId,
    coverImage: coverImage || '/background/image2.jpg',
    readingTime: calculateReadingTime(content),
    status,
    galleryImages,
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto">
        <div className="relative w-full max-w-5xl max-h-[92vh] bg-slate-900 border border-white/10 text-white rounded-2xl shadow-2xl flex flex-col my-auto overflow-hidden">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between px-6 py-4 bg-slate-950/80 border-b border-white/10 gap-3">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-widest text-indigo-400">
                {article ? 'Edit News & Blog Post' : 'Create New News & Blog Post'}
              </span>
              <h2 className="text-xl font-bold text-white truncate max-w-xl">
                {title || 'Untitled Article'}
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPreviewOpen(true)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/20 text-slate-200 transition-colors flex items-center gap-1.5"
              >
                👁 Preview
              </button>

              <button
                type="button"
                onClick={handleClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-white/10 px-6 bg-slate-950/40 text-xs font-semibold">
            {[
              { id: 'content', label: '1. Content & Details' },
              { id: 'media', label: `2. Images & Gallery (${(coverImage ? 1 : 0) + galleryImages.length})` },
              { id: 'seo', label: '3. SEO & Publishing' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-3 px-4 border-b-2 transition-colors cursor-pointer ${
                  activeTab === tab.id
                    ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mx-6 mt-4 p-3 bg-red-950/80 border border-red-500/40 rounded-xl text-xs text-red-300 flex items-center justify-between">
              <span>⚠️ {error}</span>
              <button type="button" onClick={() => setError('')} className="text-red-400 hover:text-white">✕</button>
            </div>
          )}

          {/* Modal Body */}
          <div className="p-6 overflow-y-auto flex-1 space-y-6">
            {/* TAB 1: Content & Details */}
            {activeTab === 'content' && (
              <div className="space-y-5">
                {/* Title */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                    Article Title <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. NKOCET Students Win Regional Hackathon Grand Prize"
                    value={title}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    className="w-full px-4 py-3 bg-black/50 border border-white/10 rounded-xl text-white font-medium text-base focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Slug */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                      URL Slug <span className="text-slate-400 font-normal">(/news/{slug || '...'})</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsSlugManual(!isSlugManual)}
                      className="text-[11px] text-indigo-400 hover:text-indigo-300"
                    >
                      {isSlugManual ? 'Reset to Auto-slug' : 'Edit Slug Manually'}
                    </button>
                  </div>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => handleSlugChange(e.target.value)}
                    placeholder="article-url-slug"
                    className="w-full px-4 py-2 bg-black/40 border border-white/10 rounded-lg text-slate-300 text-xs font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Category & Author Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Category */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                      Category
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={isCustomCategory ? '__custom__' : category}
                        onChange={(e) => {
                          if (e.target.value === '__custom__') {
                            setIsCustomCategory(true);
                          } else {
                            setIsCustomCategory(false);
                            setCategory(e.target.value);
                          }
                        }}
                        className="flex-1 px-3 py-2 bg-black/50 border border-white/10 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
                      >
                        {PRESET_NEWS_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                        <option value="__custom__">+ Custom Category...</option>
                      </select>
                      {isCustomCategory && (
                        <input
                          type="text"
                          placeholder="Type category..."
                          value={customCategory}
                          onChange={(e) => setCustomCategory(e.target.value)}
                          className="flex-1 px-3 py-2 bg-black/50 border border-white/10 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
                        />
                      )}
                    </div>
                  </div>

                  {/* Author & Designation / Post Selection */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                        Author & Post
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingAuthor(true);
                          setNewAuthorName('');
                          setNewAuthorRole('');
                          setNewAuthorAvatar('');
                          setNewAuthorStats(null);
                          setNewAuthorError('');
                        }}
                        className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
                      >
                        + Add New Author
                      </button>
                    </div>

                    <div className="space-y-2">
                      <select
                        value={
                          authorId ||
                          (authorList.find((a) => a.name.toLowerCase() === author.toLowerCase())?.id || '__custom__')
                        }
                        onChange={(e) => handleSelectAuthor(e.target.value)}
                        className="w-full px-3 py-2 bg-black/50 border border-white/10 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
                      >
                        {authorList.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name} {a.role ? `(${a.role})` : ''}
                          </option>
                        ))}
                        <option value="__add_new__">+ Add New Author...</option>
                        <option value="__custom__">Manual / Custom Author...</option>
                      </select>

                      {/* Connected Author Preview Box */}
                      <div className="p-2.5 rounded-xl bg-slate-950/60 border border-indigo-500/20 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {authorAvatar ? (
                            <img
                              src={authorAvatar}
                              alt={author}
                              className="w-9 h-9 rounded-full object-cover border border-indigo-400/50 flex-shrink-0"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-indigo-700/60 text-white font-bold flex items-center justify-center text-xs border border-indigo-400/40 flex-shrink-0">
                              {(author || 'A').charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                              <span>{author || 'Unnamed Author'}</span>
                              <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                ✓ Connected
                              </span>
                            </div>
                            <div className="text-[11px] text-indigo-300 truncate">
                              {authorRole || <span className="text-slate-400 italic">No post set</span>}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 flex-shrink-0">
                          {authorId && (
                            <button
                              type="button"
                              onClick={() => handleDeleteSavedAuthor(authorId)}
                              className="p-1 rounded text-slate-400 hover:text-red-400 hover:bg-red-500/10 text-xs transition-colors"
                              title="Delete this author from remembered list"
                            >
                              🗑
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setShowCustomizeAuthor(!showCustomizeAuthor)}
                            className="px-2 py-1 text-[11px] text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-md border border-white/10 transition-colors"
                          >
                            {showCustomizeAuthor ? 'Hide Custom' : 'Customize'}
                          </button>
                        </div>
                      </div>

                      {/* Collapsible article-specific custom fields */}
                      {showCustomizeAuthor && (
                        <div className="p-3 bg-black/40 border border-white/10 rounded-xl space-y-3 mt-2 animate-fade-in">
                          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                            Article-Specific Author Override
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[11px] text-slate-400 mb-1">Author Name</label>
                              <input
                                type="text"
                                value={author}
                                onChange={(e) => setAuthor(e.target.value)}
                                className="w-full px-2.5 py-1.5 bg-black/50 border border-white/10 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] text-slate-400 mb-1">Post / Designation</label>
                              <input
                                type="text"
                                value={authorRole}
                                placeholder="e.g. Design & Media Head"
                                onChange={(e) => setAuthorRole(e.target.value)}
                                className="w-full px-2.5 py-1.5 bg-black/50 border border-white/10 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[11px] text-slate-400 mb-1">
                              Author Photo (Auto-compressed)
                            </label>
                            <div className="flex items-center flex-wrap gap-2.5">
                              <label className="cursor-pointer px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 text-xs font-medium transition-colors">
                                <span>{authorAvatar ? 'Change Photo' : 'Upload Photo'}</span>
                                <input
                                  type="file"
                                  accept="image/jpeg,image/png,image/webp"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      handleSelectCustomAvatarFile(file);
                                      e.target.value = '';
                                    }
                                  }}
                                />
                              </label>

                              {authorAvatar && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenCropperForExisting('article_author')}
                                  className="px-2.5 py-1.5 text-xs text-indigo-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-colors flex items-center gap-1"
                                  title="Adjust zoom or position within the circular crop"
                                >
                                  <span>✂</span>
                                  <span>Fit / Crop</span>
                                </button>
                              )}

                              {authorAvatar && (
                                <button
                                  type="button"
                                  onClick={() => setAuthorAvatar('')}
                                  className="text-xs text-red-400 hover:text-red-300 ml-1"
                                >
                                  Remove Photo
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Short Excerpt */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                    Short Excerpt <span className="text-slate-400 font-normal">(shown on cards & search previews)</span>
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Brief 1-2 sentence hook summarizing the article..."
                    value={excerpt}
                    onChange={(e) => setExcerpt(e.target.value)}
                    className="w-full px-4 py-2.5 bg-black/50 border border-white/10 rounded-xl text-slate-200 text-xs leading-relaxed focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Rich-Text Content Body */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                      Article Body
                    </label>
                    <span className="text-[11px] text-slate-400">
                      ~{calculateReadingTime(content)} min read
                    </span>
                  </div>
                  <RichTextEditor
                    value={content}
                    onChange={setContent}
                    placeholder="Write or paste your article content here. Use the toolbar for headers, bullet points, quotes, and links..."
                    minHeight="340px"
                  />
                </div>
              </div>
            )}

            {/* TAB 2: Media & Gallery */}
            {activeTab === 'media' && (
              <div className="space-y-6">
                <CoverImageUploader
                  currentUrl={coverImage}
                  onFileSelect={handleCoverSelect}
                  onRemove={handleCoverRemove}
                />

                <div className="h-px bg-white/10" />

                <GalleryImageManager
                  images={galleryImages}
                  onChange={setGalleryImages}
                  onDeletedStoragePath={(path) => setDeletedStoragePaths((prev) => [...prev, path])}
                />
              </div>
            )}

            {/* TAB 3: SEO & Publishing */}
            {activeTab === 'seo' && (
              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                    Publication Status
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { val: 'draft', label: 'Draft', desc: 'Hidden from visitors' },
                      { val: 'published', label: 'Published', desc: 'Live on public website' },
                      { val: 'archived', label: 'Archived', desc: 'Preserved but unlisted' },
                    ].map((item) => (
                      <button
                        key={item.val}
                        type="button"
                        onClick={() => setStatus(item.val as ArticleStatus)}
                        className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                          status === item.val
                            ? 'bg-indigo-600/20 border-indigo-500 text-white'
                            : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                        }`}
                      >
                        <div className="text-xs font-bold uppercase">{item.label}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{item.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                    SEO Meta Description
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Recommended 140-160 characters for search engine snippets..."
                    value={seoDescription}
                    onChange={(e) => setSeoDescription(e.target.value)}
                    className="w-full px-4 py-2.5 bg-black/50 border border-white/10 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
                  />
                  <span className="text-[10px] text-slate-400 block mt-1">
                    {seoDescription.length} characters (optimal: 120-160)
                  </span>
                </div>

                {article && onDelete && (
                  <div className="pt-6 border-t border-red-500/20">
                    <h4 className="text-xs font-bold uppercase text-red-400 mb-1">Danger Zone</h4>
                    <p className="text-xs text-slate-400 mb-3">
                      Permanently delete this article and remove all associated cover and gallery photos.
                    </p>
                    <button
                      type="button"
                      onClick={async () => {
                        if (window.confirm(`Are you sure you want to delete "${article.title}"? This cannot be undone.`)) {
                          await onDelete(article.id, article.title);
                          onClose();
                        }
                      }}
                      className="px-4 py-2 rounded-lg bg-red-600/30 hover:bg-red-600 border border-red-500/50 text-red-200 hover:text-white text-xs font-semibold transition-colors"
                    >
                      Delete Article Permanently
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex flex-wrap items-center justify-between px-6 py-4 bg-slate-950 border-t border-white/10 gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>

            <div className="flex flex-wrap items-center gap-2">
              {/* Save Draft */}
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSaveWithStatus('draft')}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-slate-200 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save as Draft'}
              </button>

              {/* Archive */}
              {article && article.status === 'published' && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSaveWithStatus('archived')}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/30 transition-colors disabled:opacity-50"
                >
                  Archive
                </button>
              )}

              {/* Unpublish */}
              {article && article.status === 'published' && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSaveWithStatus('draft')}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-yellow-600/30 text-yellow-200 hover:bg-yellow-600/50 border border-yellow-500/40 transition-colors disabled:opacity-50"
                >
                  Unpublish
                </button>
              )}

              {/* Publish or Update */}
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSaveWithStatus('published')}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {saving
                  ? 'Saving...'
                  : article?.status === 'published'
                  ? 'Update Published'
                  : '🚀 Publish Article'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Live Preview Modal */}
      <ArticlePreviewModal
        article={currentPreviewData}
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
      />

      {/* Add New Author Modal Dialog */}
      {isAddingAuthor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-md bg-slate-900 border border-white/20 text-white rounded-2xl shadow-2xl overflow-hidden flex flex-col p-6 space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                  Author Management
                </span>
                <h3 className="text-lg font-bold text-white">Add New Author</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAddingAuthor(false);
                  setNewAuthorError('');
                }}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Enter the author's name, post, and photo. The photo will be compressed to save storage, and this author will be remembered so you can select them anytime without re-uploading.
            </p>

            {newAuthorError && (
              <div className="p-2.5 bg-red-950/80 border border-red-500/40 rounded-xl text-xs text-red-300">
                ⚠️ {newAuthorError}
              </div>
            )}

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Author Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ameya Ture"
                  value={newAuthorName}
                  onChange={(e) => setNewAuthorName(e.target.value)}
                  className="w-full px-3 py-2 bg-black/50 border border-white/10 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-indigo-500 font-medium"
                />
              </div>

              {/* Post / Designation */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Post of Author <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Design & Media Head"
                  value={newAuthorRole}
                  onChange={(e) => setNewAuthorRole(e.target.value)}
                  className="w-full px-3 py-2 bg-black/50 border border-white/10 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-indigo-500 font-medium"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Only this post and author name will be displayed on the website.
                </span>
              </div>

              {/* Author Picture (Compressed) */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Author Picture (Photo / Avatar)
                </label>

                <div className="flex items-center gap-4 p-3 bg-black/40 border border-white/10 rounded-xl">
                  {newAuthorAvatar ? (
                    <img
                      src={newAuthorAvatar}
                      alt="Avatar preview"
                      className="w-14 h-14 rounded-full object-cover border-2 border-indigo-400 shadow-md flex-shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-slate-800 border border-white/20 text-slate-400 flex items-center justify-center text-sm font-bold flex-shrink-0">
                      {(newAuthorName || 'A').charAt(0).toUpperCase()}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <label className="inline-block cursor-pointer px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors">
                      <span>{newAuthorAvatar ? 'Change Photo' : 'Upload Photo'}</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleSelectNewAuthorFile(file);
                            e.target.value = '';
                          }
                        }}
                      />
                    </label>

                    {newAuthorAvatar && (
                      <button
                        type="button"
                        onClick={() => handleOpenCropperForExisting('new_author')}
                        className="ml-2 px-2.5 py-1 text-xs text-indigo-300 hover:text-white bg-white/10 hover:bg-white/15 rounded-lg border border-white/10 transition-colors inline-flex items-center gap-1"
                        title="Adjust zoom or position within the circular crop"
                      >
                        <span>✂</span>
                        <span>Fit / Crop</span>
                      </button>
                    )}

                    {newAuthorAvatar && (
                      <button
                        type="button"
                        onClick={() => {
                          setNewAuthorAvatar('');
                          setNewAuthorStats(null);
                        }}
                        className="ml-2 text-xs text-red-400 hover:text-red-300"
                      >
                        Remove
                      </button>
                    )}

                    {newAuthorStats && (
                      <div className="mt-1.5 text-[10px] text-emerald-400 flex items-center gap-1 font-mono">
                        <span>⚡ Compressed:</span>
                        <span>{formatBytes(newAuthorStats.originalSize)}</span>
                        <span>→</span>
                        <span>{formatBytes(newAuthorStats.compressedSize)}</span>
                        <span className="font-bold text-emerald-300">(-{newAuthorStats.reductionPercentage}% saved)</span>
                      </div>
                    )}
                    {!newAuthorStats && !newAuthorAvatar && (
                      <div className="text-[10px] text-slate-400 mt-1">
                        Image will be automatically compressed client-side to save storage.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => {
                  setIsAddingAuthor(false);
                  setNewAuthorError('');
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveNewAuthor}
                disabled={isCompressingAvatar}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-colors disabled:opacity-50"
              >
                Save & Connect Author
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Profile Picture Circle Cropper / Fit Modal */}
      <AvatarCropperModal
        isOpen={cropperOpen}
        imageFile={cropperFile}
        imageSrc={cropperSrc}
        onClose={() => {
          setCropperOpen(false);
          setCropperFile(null);
          setCropperSrc(null);
        }}
        onCropComplete={handleCropComplete}
        authorName={cropperTarget === 'new_author' ? (newAuthorName || 'New Author') : (author || 'Author')}
      />
    </>
  );
}
