export type ArticleStatus = 'draft' | 'published' | 'archived';

export type NewsCategory =
  | 'Entrepreneurship'
  | 'Startup Stories'
  | 'E-Cell Activities'
  | 'Innovation'
  | 'Events'
  | 'Opportunities'
  | string;

export interface ArticleGalleryImage {
  id: string;
  articleId?: string;
  imageUrl: string;
  storagePath?: string;
  caption: string;
  altText: string;
  displayOrder: number;
  createdAt?: string;
  // Temporary client-side fields during editing
  localPreviewUrl?: string;
  pendingFile?: File;
  originalSize?: number;
  compressedSize?: number;
  reductionPercentage?: number;
}

export interface NewsAuthor {
  id: string;
  name: string;
  role: string; // Post / Designation of author (e.g. "Design & Media Head")
  avatar?: string; // Compressed photo URL or Data URL
  avatarStoragePath?: string;
  bio?: string;
  createdAt?: string;
}

export interface NewsArticle {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string; // Sanitized Rich HTML
  category: NewsCategory;
  author: string;
  authorId?: string;
  authorRole?: string;
  authorBio?: string;
  authorAvatar?: string;
  tags?: string[];
  keyPoints?: string[];
  coverImage: string; // Storage Public URL or fallback
  coverImagePath?: string; // Storage relative path for clean-up
  seoDescription?: string;
  status: ArticleStatus;
  readingTime: number; // in minutes
  viewsCount: number;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  galleryImages?: ArticleGalleryImage[];
}

export interface ArticleFilterOptions {
  category?: string;
  search?: string;
  status?: ArticleStatus | 'all';
  page?: number;
  limit?: number;
}

export interface PaginatedArticlesResult {
  articles: NewsArticle[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
  hasMore: boolean;
}

export const PRESET_NEWS_CATEGORIES: string[] = [
  'Entrepreneurship',
  'Startup Stories',
  'E-Cell Activities',
  'Innovation',
  'Events',
  'Opportunities',
];
