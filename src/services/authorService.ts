import type { NewsAuthor } from '../types/news';
import { compressImageClientSide, validateImageFile } from '../utils/imageCompression';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const AUTHORS_STORAGE_KEY = 'ecell_news_authors_v1';
const STORAGE_BUCKET = 'news';

export const DEFAULT_PRESET_AUTHORS: NewsAuthor[] = [
  {
    id: 'author-ameya-ture',
    name: 'Ameya Ture',
    role: 'Design & Media Head',
    bio: 'Design & Media Head at E-Cell NKOCET, leading creative design and brand narratives.',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'author-sufiyan-shaikh',
    name: 'Sufiyan Shaikh',
    role: 'Lead Developer & Admin',
    bio: 'Lead Developer at E-Cell NKOCET, architecting digital innovation systems.',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'author-editorial-team',
    name: 'E-Cell Editorial Team',
    role: 'Editorial & Research Board',
    bio: 'The official editorial and research board of E-Cell NKOCET.',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'author-nikhil-deosani',
    name: 'Nikhil Deosani',
    role: 'Alumni Contributor',
    bio: 'NKOCET alumnus sharing insights on engineering startups and enterprise venture building.',
    createdAt: new Date().toISOString(),
  },
];

function convertBlobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export const authorService = {
  /**
   * Get all remembered authors from persistent storage.
   * Initializes with default preset authors on first access.
   */
  getAuthors(): NewsAuthor[] {
    try {
      const raw = localStorage.getItem(AUTHORS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (err) {
      console.warn('Failed to parse saved authors:', err);
    }

    // Default initialization
    this.saveAllAuthors(DEFAULT_PRESET_AUTHORS);
    return [...DEFAULT_PRESET_AUTHORS];
  },

  /**
   * Save authors list to localStorage.
   */
  saveAllAuthors(authors: NewsAuthor[]): void {
    try {
      localStorage.setItem(AUTHORS_STORAGE_KEY, JSON.stringify(authors));
    } catch (err) {
      console.warn('Failed to persist authors to storage:', err);
    }
  },

  /**
   * Create or update a single author.
   */
  saveAuthor(authorData: {
    id?: string;
    name: string;
    role: string;
    avatar?: string;
    bio?: string;
  }): NewsAuthor {
    const name = (authorData.name || '').trim();
    const role = (authorData.role || '').trim();
    if (!name) throw new Error('Author name is required.');
    if (!role) throw new Error('Author post/designation is required.');

    const currentList = this.getAuthors();
    let updatedAuthor: NewsAuthor;

    if (authorData.id) {
      const existingIdx = currentList.findIndex((a) => a.id === authorData.id);
      if (existingIdx !== -1) {
        updatedAuthor = {
          ...currentList[existingIdx],
          name,
          role,
          avatar: authorData.avatar !== undefined ? authorData.avatar : currentList[existingIdx].avatar,
          bio: authorData.bio !== undefined ? authorData.bio : currentList[existingIdx].bio,
        };
        currentList[existingIdx] = updatedAuthor;
      } else {
        updatedAuthor = {
          id: authorData.id,
          name,
          role,
          avatar: authorData.avatar || '',
          bio: authorData.bio || '',
          createdAt: new Date().toISOString(),
        };
        currentList.push(updatedAuthor);
      }
    } else {
      // Check if an author with identical name already exists to prevent duplicates
      const existing = currentList.find((a) => a.name.toLowerCase() === name.toLowerCase());
      if (existing) {
        existing.role = role;
        if (authorData.avatar) existing.avatar = authorData.avatar;
        if (authorData.bio) existing.bio = authorData.bio;
        updatedAuthor = existing;
      } else {
        updatedAuthor = {
          id: `author-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
          name,
          role,
          avatar: authorData.avatar || '',
          bio: authorData.bio || '',
          createdAt: new Date().toISOString(),
        };
        currentList.unshift(updatedAuthor);
      }
    }

    this.saveAllAuthors(currentList);
    return updatedAuthor;
  },

  /**
   * Delete an author by id.
   */
  deleteAuthor(id: string): void {
    const list = this.getAuthors().filter((a) => a.id !== id);
    this.saveAllAuthors(list);
  },

  /**
   * Compresses an uploaded author picture client-side to save storage,
   * converts to compact format (WebP, max 320px, ~30-40KB), and produces a durable
   * base64 Data URL and/or Supabase storage URL.
   */
  async compressAndProcessAuthorAvatar(file: File): Promise<{
    avatarUrl: string;
    originalSize: number;
    compressedSize: number;
    reductionPercentage: number;
  }> {
    const validation = validateImageFile(file);
    if (!validation.valid) {
      throw new Error(validation.error || 'Invalid image file.');
    }

    // High quality downscaling for circular avatars: max 320x320 px, ~35KB
    const compressedResult = await compressImageClientSide(file, {
      maxDimension: 320,
      quality: 0.82,
      targetSizeKB: 40,
    });

    // Generate reliable base64 data URL for local storage preservation
    const dataUrl = await convertBlobToDataUrl(compressedResult.file);
    let finalUrl = dataUrl;

    // If Supabase Storage is configured, also attempt to upload to storage
    if (isSupabaseConfigured()) {
      try {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 7);
        const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storagePath = `authors/${timestamp}_${random}_${cleanName}.webp`;

        const { error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(storagePath, compressedResult.file, {
            cacheControl: '31536000',
            upsert: true,
            contentType: 'image/webp',
          });

        if (!uploadError) {
          const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);
          if (data?.publicUrl) {
            finalUrl = data.publicUrl;
          }
        }
      } catch (err) {
        console.warn('Supabase author avatar upload fallback to local dataUrl:', err);
      }
    }

    return {
      avatarUrl: finalUrl,
      originalSize: compressedResult.originalSize,
      compressedSize: compressedResult.compressedSize,
      reductionPercentage: compressedResult.reductionPercentage,
    };
  },
};
