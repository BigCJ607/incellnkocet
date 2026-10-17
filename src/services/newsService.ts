import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type {
  NewsArticle,
  ArticleGalleryImage,
  ArticleFilterOptions,
  PaginatedArticlesResult,
  ArticleStatus,
} from '../types/news';
import { INITIAL_MOCK_ARTICLES } from '../mocks/newsData';
import { compressImageClientSide } from '../utils/imageCompression';
import { authorService } from './authorService';

const STORAGE_BUCKET = 'news';
const LOCAL_STORAGE_KEY = 'ecell_local_news_articles_v5';
const QUERY_TIMEOUT_MS = 2500;

/**
 * Races a promise against a timeout to prevent hanging indefinite network requests.
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs = QUERY_TIMEOUT_MS): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Backend request timed out')), timeoutMs)
    ),
  ]);
}

// Calculate estimated reading time based on 200 words per minute
export function calculateReadingTime(text: string): number {
  if (!text) return 2;
  const clean = text.replace(/<[^>]*>/g, ' ').trim();
  const wordCount = clean.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(wordCount / 200));
}

// Generate URL slug from title
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const FAKE_ARTICLE_SLUGS = [
  'nkocet-ecell-launches-annual-flagship-innovation-initiative',
  'from-campus-dorm-to-venture-funded-orchid-alumni-startups',
  'national-innovation-conclave-2026-registration-now-live',
  'inside-the-venture-incubation-cohort-prototyping-labs',
  'inside-the-venture-incubation-cohort-prototyping-labs-and-angel-mentorship',
  'agritech-innovation-smart-soil-sensor-granted-patent',
  'fireside-dialogue-navigating-early-founder-resilience',
];

export function isFakeMockArticle(art?: Partial<NewsArticle> | { id?: string; slug?: string } | null): boolean {
  if (!art) return false;
  if (art.id && (art.id.startsWith('e1a0b5c0-') || art.id.startsWith('mock-'))) return true;
  if (art.slug && FAKE_ARTICLE_SLUGS.includes(art.slug)) return true;
  return false;
}

// Immediate purge of fake articles from all local storage versions
try {
  ['ecell_local_news_articles_v1', 'ecell_local_news_articles_v2', 'ecell_local_news_articles_v3', 'ecell_local_news_articles_v4'].forEach((k) => {
    localStorage.removeItem(k);
  });
  const existingRaw = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (existingRaw) {
    const parsed = JSON.parse(existingRaw);
    if (Array.isArray(parsed)) {
      const filtered = parsed.filter((a) => !isFakeMockArticle(a));
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(filtered));
    }
  }
} catch (_) {}

// Local storage helpers for mock/offline mode
function getLocalArticles(): NewsArticle[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const cleaned = parsed.filter((a) => !isFakeMockArticle(a));
        if (cleaned.length !== parsed.length) {
          saveLocalArticles(cleaned);
        }
        return cleaned;
      }
    }
  } catch (err) {
    console.warn('Failed to load local articles from storage:', err);
  }
  return [];
}

function saveLocalArticles(articles: NewsArticle[]): void {
  try {
    const cleaned = articles.filter((a) => !isFakeMockArticle(a));
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cleaned));
  } catch (err) {
    console.warn('Failed to persist articles in local storage:', err);
  }
}

/**
 * Resolves author role, avatar, and id from database row, local articles mirror, or remembered author profiles.
 * Ensures author photo and post are NEVER lost even if database columns are missing.
 */
function resolveAuthorFields(
  authorName?: string,
  authorId?: string,
  dbRole?: string,
  dbAvatar?: string,
  dbBio?: string,
  articleId?: string,
  slug?: string
) {
  let role = (dbRole || '').trim();
  let avatar = (dbAvatar || '').trim();
  let bio = (dbBio || '').trim();
  let finalId = (authorId || '').trim();

  // 1. Check local articles mirror if database had missing columns
  if (!role || !avatar) {
    const local = getLocalArticles().find((a) => (articleId && a.id === articleId) || (slug && a.slug === slug));
    if (local) {
      if (!role && local.authorRole) role = local.authorRole;
      if (!avatar && local.authorAvatar) avatar = local.authorAvatar;
      if (!bio && local.authorBio) bio = local.authorBio;
      if (!finalId && local.authorId) finalId = local.authorId;
    }
  }

  // 2. Check remembered author profiles from authorService
  if (!role || !avatar) {
    const saved = authorService.getAuthors();
    const matched = saved.find(
      (a) =>
        (finalId && a.id === finalId) ||
        (authorName && a.name.toLowerCase() === authorName.trim().toLowerCase())
    );
    if (matched) {
      if (!role && matched.role) role = matched.role;
      if (!avatar && matched.avatar) avatar = matched.avatar;
      if (!bio && matched.bio) bio = matched.bio;
      if (!finalId && matched.id) finalId = matched.id;
    }
  }

  return { role, avatar, bio, authorId: finalId };
}

export const newsService = {
  /**
   * Upload an image to the Supabase Storage bucket 'news'.
   * Always receives an already compressed file!
   */
  async uploadCompressedImage(
    file: File,
    folder: 'covers' | 'gallery' = 'covers'
  ): Promise<{ publicUrl: string; storagePath: string }> {
    if (!isSupabaseConfigured()) {
      const localUrl = URL.createObjectURL(file);
      return { publicUrl: localUrl, storagePath: '' };
    }

    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${folder}/${timestamp}_${random}_${cleanName}`;

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, file, {
        cacheControl: '31536000',
        upsert: true,
        contentType: file.type || 'image/webp',
      });

    if (uploadError) {
      console.warn('Storage upload error, attempting fallback to local URL:', uploadError);
      return { publicUrl: URL.createObjectURL(file), storagePath: '' };
    }

    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);
    return {
      publicUrl: data.publicUrl,
      storagePath,
    };
  },

  /**
   * Safely delete an array of storage paths from the 'news' bucket.
   */
  async deleteStorageImages(paths: string[]): Promise<void> {
    if (!isSupabaseConfigured() || !paths || paths.length === 0) return;
    const validPaths = paths.filter((p) => p && !p.startsWith('http') && !p.startsWith('blob:'));
    if (validPaths.length === 0) return;

    try {
      await supabase.storage.from(STORAGE_BUCKET).remove(validPaths);
    } catch (err) {
      console.warn('Failed to delete images from storage:', err);
    }
  },

  /**
   * Fetch public articles with category filtering, search, and pagination.
   */
  async getPublishedArticles(options: ArticleFilterOptions = {}): Promise<PaginatedArticlesResult> {
    const { category, search, page = 1, limit = 9 } = options;

    if (!isSupabaseConfigured()) {
      return this.getLocalPublishedArticles(options);
    }

    try {
      let query = supabase
        .from('news_articles')
        .select('*', { count: 'exact' })
        .eq('status', 'published')
        .order('published_at', { ascending: false });

      if (category && category !== 'All') {
        query = query.eq('category', category);
      }

      if (search && search.trim().length > 0) {
        const q = search.trim();
        query = query.or(`title.ilike.%${q}%,excerpt.ilike.%${q}%,author.ilike.%${q}%`);
      }

      const from = (page - 1) * limit;
      const to = from + limit - 1;
      query = query.range(from, to);

      const { data, count, error } = (await withTimeout(query as any, 2500)) as any;

      if (error) {
        console.warn('Supabase query news_articles error, falling back to local:', error);
        return this.getLocalPublishedArticles(options);
      }

      if (!data || data.length === 0) {
        return {
          articles: [],
          totalCount: 0,
          currentPage: page,
          totalPages: 1,
          hasMore: false,
        };
      }

      const articles: NewsArticle[] = (data || [])
        .filter((row: any) => !isFakeMockArticle(row))
        .map((row: any) => {
        const resolved = resolveAuthorFields(
          row.author,
          row.author_id,
          row.author_role,
          row.author_avatar,
          row.author_bio,
          row.id,
          row.slug
        );
        return {
          id: row.id,
          title: row.title,
          slug: row.slug,
          excerpt: row.excerpt || '',
          content: row.content || '',
          category: row.category,
          author: row.author || 'E-Cell Team',
          authorId: resolved.authorId,
          authorRole: resolved.role,
          authorAvatar: resolved.avatar,
          authorBio: resolved.bio,
          coverImage: row.cover_image || '/background/image2.jpg',
          coverImagePath: row.cover_image_path,
          seoDescription: row.seo_description,
          status: row.status,
          readingTime: row.reading_time || calculateReadingTime(row.content),
          viewsCount: row.views_count || 0,
          publishedAt: row.published_at,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };
      });

      const totalCount = count || 0;
      const totalPages = Math.max(1, Math.ceil(totalCount / limit));

      return {
        articles,
        totalCount,
        currentPage: page,
        totalPages,
        hasMore: page < totalPages,
      };
    } catch (err) {
      console.warn('Failed to fetch published articles from Supabase:', err);
      return this.getLocalPublishedArticles(options);
    }
  },

  /**
   * Local / mock fallback query for published articles.
   */
  getLocalPublishedArticles(options: ArticleFilterOptions = {}): PaginatedArticlesResult {
    const { category, search, page = 1, limit = 9 } = options;
    let list = getLocalArticles().filter((a) => a.status === 'published' && !isFakeMockArticle(a));

    if (category && category !== 'All') {
      list = list.filter((a) => a.category === category);
    }

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.excerpt.toLowerCase().includes(q) ||
          a.author.toLowerCase().includes(q)
      );
    }

    // Sort by publication date
    list.sort((a, b) => {
      const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return dateB - dateA;
    });

    const totalCount = list.length;
    const from = (page - 1) * limit;
    const paginated = list.slice(from, from + limit);
    const totalPages = Math.max(1, Math.ceil(totalCount / limit));

    return {
      articles: paginated,
      totalCount,
      currentPage: page,
      totalPages,
      hasMore: page < totalPages,
    };
  },

  /**
   * Fetch a single article by its unique slug, including its gallery images.
   */
  async getArticleBySlug(slug: string): Promise<NewsArticle | null> {
    if (!slug || FAKE_ARTICLE_SLUGS.includes(slug)) return null;

    if (!isSupabaseConfigured()) {
      const local = getLocalArticles().find((a) => a.slug === slug && !isFakeMockArticle(a));
      return local || null;
    }

    try {
      const { data: articleRow, error: articleErr } = (await withTimeout(
        supabase
          .from('news_articles')
          .select('*')
          .eq('slug', slug)
          .single() as any,
        2500
      )) as any;

      if (articleErr || !articleRow || isFakeMockArticle(articleRow)) {
        console.warn('Article not found in Supabase, checking local:', articleErr);
        const local = getLocalArticles().find((a) => a.slug === slug && !isFakeMockArticle(a));
        return local || null;
      }

      // Fetch associated gallery images
      const { data: galleryRows } = (await withTimeout(
        supabase
          .from('news_article_images')
          .select('*')
          .eq('article_id', articleRow.id)
          .order('display_order', { ascending: true }) as any,
        2500
      )) as any;

      const galleryImages: ArticleGalleryImage[] = (galleryRows || []).map((img) => ({
        id: img.id,
        articleId: img.article_id,
        imageUrl: img.image_url,
        storagePath: img.storage_path,
        caption: img.caption || '',
        altText: img.alt_text || '',
        displayOrder: img.display_order || 0,
        createdAt: img.created_at,
      }));

      // Increment views count silently
      try {
        await supabase
          .from('news_articles')
          .update({ views_count: (articleRow.views_count || 0) + 1 })
          .eq('id', articleRow.id);
      } catch {
        // Non-critical
      }

      const resolved = resolveAuthorFields(
        articleRow.author,
        articleRow.author_id,
        articleRow.author_role,
        articleRow.author_avatar,
        articleRow.author_bio,
        articleRow.id,
        articleRow.slug
      );

      return {
        id: articleRow.id,
        title: articleRow.title,
        slug: articleRow.slug,
        excerpt: articleRow.excerpt || '',
        content: articleRow.content || '',
        category: articleRow.category,
        author: articleRow.author || 'E-Cell Team',
        authorId: resolved.authorId,
        authorRole: resolved.role,
        authorAvatar: resolved.avatar,
        authorBio: resolved.bio,
        coverImage: articleRow.cover_image || '/background/image2.jpg',
        coverImagePath: articleRow.cover_image_path,
        seoDescription: articleRow.seo_description,
        status: articleRow.status,
        readingTime: articleRow.reading_time || calculateReadingTime(articleRow.content),
        viewsCount: (articleRow.views_count || 0) + 1,
        publishedAt: articleRow.published_at,
        createdAt: articleRow.created_at,
        updatedAt: articleRow.updated_at,
        galleryImages,
      };
    } catch (err) {
      console.warn('getArticleBySlug error:', err);
      const local = getLocalArticles().find((a) => a.slug === slug);
      return local || null;
    }
  },

  /**
   * Fetch related articles from the same category or latest.
   */
  async getRelatedArticles(currentSlug: string, category: string, limit = 3): Promise<NewsArticle[]> {
    const result = await this.getPublishedArticles({ category, limit: limit + 2 });
    let related = result.articles.filter((a) => a.slug !== currentSlug);

    // If not enough in same category, get recent articles
    if (related.length < limit) {
      const recentResult = await this.getPublishedArticles({ limit: limit + 2 });
      const recent = recentResult.articles.filter(
        (a) => a.slug !== currentSlug && !related.some((r) => r.slug === a.slug)
      );
      related = [...related, ...recent];
    }

    return related.slice(0, limit);
  },

  /**
   * Fetch all articles for the Admin Dashboard (including drafts & archived).
   */
  async getAllArticlesAdmin(filter?: { status?: string; search?: string }): Promise<NewsArticle[]> {
    if (!isSupabaseConfigured()) {
      let list = getLocalArticles().filter((a) => !isFakeMockArticle(a));
      if (filter?.status && filter.status !== 'all') {
        list = list.filter((a) => a.status === filter.status);
      }
      if (filter?.search && filter.search.trim()) {
        const q = filter.search.trim().toLowerCase();
        list = list.filter(
          (a) =>
            a.title.toLowerCase().includes(q) ||
            a.slug.toLowerCase().includes(q) ||
            a.category.toLowerCase().includes(q)
        );
      }
      return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    try {
      let query = supabase
        .from('news_articles')
        .select('*')
        .order('created_at', { ascending: false });

      if (filter?.status && filter.status !== 'all') {
        query = query.eq('status', filter.status);
      }

      if (filter?.search && filter.search.trim()) {
        const q = filter.search.trim();
        query = query.or(`title.ilike.%${q}%,slug.ilike.%${q}%,category.ilike.%${q}%`);
      }

      const { data, error } = (await withTimeout(query as any, 2500)) as any;
      if (error) {
        console.warn('Admin getAllArticles error, using local fallback:', error);
        return this.getAllArticlesAdmin(filter);
      }

      return (data || []).filter((row: any) => !isFakeMockArticle(row)).map((row) => {
        const resolved = resolveAuthorFields(
          row.author,
          row.author_id,
          row.author_role,
          row.author_avatar,
          row.author_bio,
          row.id,
          row.slug
        );
        return {
          id: row.id,
          title: row.title,
          slug: row.slug,
          excerpt: row.excerpt || '',
          content: row.content || '',
          category: row.category,
          author: row.author || 'E-Cell Team',
          authorId: resolved.authorId,
          authorRole: resolved.role,
          authorAvatar: resolved.avatar,
          authorBio: resolved.bio,
          coverImage: row.cover_image || '/background/image2.jpg',
          coverImagePath: row.cover_image_path,
          seoDescription: row.seo_description,
          status: row.status,
          readingTime: row.reading_time || calculateReadingTime(row.content),
          viewsCount: row.views_count || 0,
          publishedAt: row.published_at,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };
      });
    } catch (err) {
      console.warn('Supabase admin fetch error:', err);
      return this.getAllArticlesAdmin(filter);
    }
  },

  /**
   * Check whether a slug already exists for another article.
   */
  async isSlugAvailable(slug: string, excludeArticleId?: string): Promise<boolean> {
    if (!slug) return false;
    if (!isSupabaseConfigured()) {
      const local = getLocalArticles();
      return !local.some((a) => a.slug === slug && a.id !== excludeArticleId);
    }

    try {
      let query = supabase.from('news_articles').select('id').eq('slug', slug);
      if (excludeArticleId) {
        query = query.neq('id', excludeArticleId);
      }
      const { data } = await query;
      return !data || data.length === 0;
    } catch {
      return true;
    }
  },

  /**
   * Create a new article with optional cover and gallery images.
   */
  async createArticle(
    articleData: Partial<NewsArticle>,
    coverFile?: File | null,
    galleryItems?: { file?: File; caption: string; altText: string }[]
  ): Promise<NewsArticle> {
    const title = (articleData.title || '').trim();
    if (!title) throw new Error('Article title is required.');

    let slug = generateSlug(articleData.slug || title);
    const available = await this.isSlugAvailable(slug);
    if (!available) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    const readingTime = calculateReadingTime(articleData.content || '');
    const nowIso = new Date().toISOString();
    const publishedAt =
      articleData.status === 'published' ? (articleData.publishedAt || nowIso) : null;

    let coverImage = articleData.coverImage || '/background/image2.jpg';
    let coverImagePath = '';

    // Handle Cover Image upload if provided
    if (coverFile) {
      const compressionResult = await compressImageClientSide(coverFile, {
        maxDimension: 1200,
        quality: 0.8,
        targetSizeKB: 250,
      });
      const uploadRes = await this.uploadCompressedImage(compressionResult.file, 'covers');
      coverImage = uploadRes.publicUrl;
      coverImagePath = uploadRes.storagePath;
    }

    const newArticleRecord: NewsArticle = {
      id: crypto.randomUUID(),
      title,
      slug,
      excerpt: (articleData.excerpt || '').trim(),
      content: articleData.content || '',
      category: articleData.category || 'Entrepreneurship',
      author: articleData.author || 'E-Cell Team',
      authorId: articleData.authorId,
      authorRole: articleData.authorRole || '',
      authorAvatar: articleData.authorAvatar || '',
      authorBio: articleData.authorBio || '',
      coverImage,
      coverImagePath,
      seoDescription: articleData.seoDescription || '',
      status: articleData.status || 'draft',
      readingTime,
      viewsCount: 0,
      publishedAt,
      createdAt: nowIso,
      updatedAt: nowIso,
      galleryImages: [],
    };

    // Save to Supabase if configured
    if (isSupabaseConfigured()) {
      try {
        const insertPayload: any = {
          id: newArticleRecord.id,
          title: newArticleRecord.title,
          slug: newArticleRecord.slug,
          excerpt: newArticleRecord.excerpt,
          content: newArticleRecord.content,
          category: newArticleRecord.category,
          author: newArticleRecord.author,
          author_id: newArticleRecord.authorId,
          cover_image: newArticleRecord.coverImage,
          cover_image_path: newArticleRecord.coverImagePath,
          seo_description: newArticleRecord.seoDescription,
          status: newArticleRecord.status,
          reading_time: newArticleRecord.readingTime,
          views_count: 0,
          published_at: newArticleRecord.publishedAt,
        };
        if (newArticleRecord.authorRole) insertPayload.author_role = newArticleRecord.authorRole;
        if (newArticleRecord.authorAvatar) insertPayload.author_avatar = newArticleRecord.authorAvatar;

        let { data: inserted, error: insertErr } = await supabase
          .from('news_articles')
          .insert(insertPayload)
          .select()
          .single();

        // Graceful fallback if columns do not exist in current DB schema
        if (insertErr && (insertErr.message?.includes('column') || insertErr.code === '42703')) {
          delete insertPayload.author_role;
          delete insertPayload.author_avatar;
          delete insertPayload.author_bio;
          delete insertPayload.author_id;
          const retry = await supabase.from('news_articles').insert(insertPayload).select().single();
          inserted = retry.data;
          insertErr = retry.error;
        }

        if (insertErr) {
          console.warn('Supabase insert article error, storing in local fallback:', insertErr);
        } else if (inserted) {
          newArticleRecord.id = inserted.id;
        }

        // Process gallery images
        if (galleryItems && galleryItems.length > 0) {
          const galleryInserts: any[] = [];
          for (let i = 0; i < galleryItems.length; i++) {
            const item = galleryItems[i];
            let itemUrl = '';
            let itemStoragePath = '';

            if (item.file) {
              const compRes = await compressImageClientSide(item.file, {
                maxDimension: 1600,
                quality: 0.82,
                targetSizeKB: 300,
              });
              const upRes = await this.uploadCompressedImage(compRes.file, 'gallery');
              itemUrl = upRes.publicUrl;
              itemStoragePath = upRes.storagePath;
            }

            if (itemUrl) {
              galleryInserts.push({
                article_id: newArticleRecord.id,
                image_url: itemUrl,
                storage_path: itemStoragePath,
                caption: item.caption || '',
                alt_text: item.altText || '',
                display_order: i,
              });
            }
          }

          if (galleryInserts.length > 0) {
            const { data: savedGallery } = await supabase
              .from('news_article_images')
              .insert(galleryInserts)
              .select();

            if (savedGallery) {
              newArticleRecord.galleryImages = savedGallery.map((g) => ({
                id: g.id,
                articleId: g.article_id,
                imageUrl: g.image_url,
                storagePath: g.storage_path,
                caption: g.caption,
                altText: g.alt_text,
                displayOrder: g.display_order,
                createdAt: g.created_at,
              }));
            }
          }
        }
      } catch (err) {
        console.warn('Supabase article creation error:', err);
      }
    }

    // Always update local storage mirror
    const local = getLocalArticles();
    local.unshift(newArticleRecord);
    saveLocalArticles(local);

    return newArticleRecord;
  },

  /**
   * Update an existing article.
   */
  async updateArticle(
    id: string,
    updates: Partial<NewsArticle>,
    coverFile?: File | null,
    galleryItems?: {
      existingId?: string;
      imageUrl?: string;
      file?: File;
      caption: string;
      altText: string;
      storagePath?: string;
    }[],
    deletedStoragePaths?: string[]
  ): Promise<NewsArticle> {
    const existing = await this.getArticleBySlug(updates.slug || '') ||
      getLocalArticles().find((a) => a.id === id);

    let coverImage = updates.coverImage || existing?.coverImage || '/background/image2.jpg';
    let coverImagePath = updates.coverImagePath || existing?.coverImagePath || '';

    // Handle new Cover Image
    if (coverFile) {
      // Clean up old cover image if it existed in Supabase
      if (coverImagePath) {
        await this.deleteStorageImages([coverImagePath]);
      }
      const compressionResult = await compressImageClientSide(coverFile, {
        maxDimension: 1200,
        quality: 0.8,
        targetSizeKB: 250,
      });
      const uploadRes = await this.uploadCompressedImage(compressionResult.file, 'covers');
      coverImage = uploadRes.publicUrl;
      coverImagePath = uploadRes.storagePath;
    }

    // Clean up requested deleted gallery images
    if (deletedStoragePaths && deletedStoragePaths.length > 0) {
      await this.deleteStorageImages(deletedStoragePaths);
    }

    const readingTime = updates.content
      ? calculateReadingTime(updates.content)
      : existing?.readingTime || 3;

    const nowIso = new Date().toISOString();

    let publishedAt = updates.publishedAt !== undefined ? updates.publishedAt : existing?.publishedAt;
    if (updates.status === 'published' && !publishedAt) {
      publishedAt = nowIso;
    }

    const updatedData: Partial<NewsArticle> = {
      ...updates,
      author: updates.author !== undefined ? updates.author : existing?.author,
      authorId: updates.authorId !== undefined ? updates.authorId : existing?.authorId,
      authorRole: updates.authorRole !== undefined ? updates.authorRole : existing?.authorRole,
      authorAvatar: updates.authorAvatar !== undefined ? updates.authorAvatar : existing?.authorAvatar,
      authorBio: updates.authorBio !== undefined ? updates.authorBio : existing?.authorBio,
      coverImage,
      coverImagePath,
      readingTime,
      publishedAt,
      updatedAt: nowIso,
    };

    if (isSupabaseConfigured()) {
      try {
        const updatePayload: any = {
          title: updatedData.title,
          slug: updatedData.slug,
          excerpt: updatedData.excerpt,
          content: updatedData.content,
          category: updatedData.category,
          author: updatedData.author,
          cover_image: coverImage,
          cover_image_path: coverImagePath,
          seo_description: updatedData.seoDescription,
          status: updatedData.status,
          reading_time: readingTime,
          published_at: publishedAt,
          updated_at: nowIso,
        };
        if (updatedData.authorRole !== undefined) updatePayload.author_role = updatedData.authorRole;
        if (updatedData.authorAvatar !== undefined) updatePayload.author_avatar = updatedData.authorAvatar;
        if (updatedData.authorId !== undefined) updatePayload.author_id = updatedData.authorId;

        let { error: updateErr } = await supabase
          .from('news_articles')
          .update(updatePayload)
          .eq('id', id);

        if (updateErr && (updateErr.message?.includes('column') || updateErr.code === '42703')) {
          delete updatePayload.author_role;
          delete updatePayload.author_avatar;
          delete updatePayload.author_bio;
          delete updatePayload.author_id;
          const retry = await supabase.from('news_articles').update(updatePayload).eq('id', id);
          updateErr = retry.error;
        }

        if (updateErr) {
          console.warn('Supabase update error:', updateErr);
        }

        // Process gallery updates if provided
        if (galleryItems) {
          // Delete old gallery records
          await supabase.from('news_article_images').delete().eq('article_id', id);

          const galleryInserts: any[] = [];
          for (let i = 0; i < galleryItems.length; i++) {
            const item = galleryItems[i];
            let itemUrl = item.imageUrl || '';
            let itemStoragePath = item.storagePath || '';

            if (item.file) {
              const compRes = await compressImageClientSide(item.file, {
                maxDimension: 1600,
                quality: 0.82,
                targetSizeKB: 300,
              });
              const upRes = await this.uploadCompressedImage(compRes.file, 'gallery');
              itemUrl = upRes.publicUrl;
              itemStoragePath = upRes.storagePath;
            }

            if (itemUrl) {
              galleryInserts.push({
                article_id: id,
                image_url: itemUrl,
                storage_path: itemStoragePath,
                caption: item.caption || '',
                alt_text: item.altText || '',
                display_order: i,
              });
            }
          }

          if (galleryInserts.length > 0) {
            await supabase.from('news_article_images').insert(galleryInserts);
          }
        }
      } catch (err) {
        console.warn('Supabase update failed:', err);
      }
    }

    // Update local storage mirror
    const local = getLocalArticles();
    const index = local.findIndex((a) => a.id === id);
    const merged: NewsArticle = {
      ...(existing || (local[index] as NewsArticle)),
      ...updatedData,
      id,
    } as NewsArticle;

    if (index !== -1) {
      local[index] = merged;
    } else {
      local.unshift(merged);
    }
    saveLocalArticles(local);

    return merged;
  },

  /**
   * Delete an article and all its associated cover and gallery files.
   */
  async deleteArticle(id: string): Promise<void> {
    // 1. Gather all storage paths for cleanup
    const pathsToDelete: string[] = [];

    if (isSupabaseConfigured()) {
      try {
        const { data: article } = await supabase
          .from('news_articles')
          .select('cover_image_path')
          .eq('id', id)
          .single();

        if (article?.cover_image_path) {
          pathsToDelete.push(article.cover_image_path);
        }

        const { data: gallery } = await supabase
          .from('news_article_images')
          .select('storage_path')
          .eq('article_id', id);

        if (gallery) {
          gallery.forEach((g) => {
            if (g.storage_path) pathsToDelete.push(g.storage_path);
          });
        }

        // 2. Remove files from Supabase Storage
        if (pathsToDelete.length > 0) {
          await this.deleteStorageImages(pathsToDelete);
        }

        // 3. Delete row in database (cascade deletes gallery images)
        await supabase.from('news_articles').delete().eq('id', id);
      } catch (err) {
        console.warn('Supabase delete error:', err);
      }
    }

    // 4. Update local storage mirror
    const local = getLocalArticles().filter((a) => a.id !== id);
    saveLocalArticles(local);
  },

  /**
   * Toggle publication status (Draft, Published, Archived).
   */
  async toggleArticleStatus(id: string, newStatus: ArticleStatus): Promise<NewsArticle> {
    const publishedAt = newStatus === 'published' ? new Date().toISOString() : null;
    return this.updateArticle(id, {
      status: newStatus,
      publishedAt: newStatus === 'published' ? publishedAt : undefined,
    });
  },

  /**
   * Permanently purge fake mock articles from Supabase and localStorage.
   */
  async purgeFakeArticles(): Promise<void> {
    const cleaned = getLocalArticles().filter((a) => !isFakeMockArticle(a));
    saveLocalArticles(cleaned);

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('news_articles').delete().like('id', 'e1a0b5c0-%');
        for (const s of FAKE_ARTICLE_SLUGS) {
          await supabase.from('news_articles').delete().eq('slug', s);
        }
      } catch (err) {
        console.warn('Failed to purge fake articles from Supabase:', err);
      }
    }
  },
};

// Automatically run purge once on import
newsService.purgeFakeArticles().catch(() => {});

