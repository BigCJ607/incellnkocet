import imageCompression from 'browser-image-compression';

export interface CompressedImageResult {
  file: File;
  previewUrl: string;
  originalSize: number;
  compressedSize: number;
  reductionPercentage: number;
  dimensions: { width: number; height: number };
  format: string;
}

export interface CompressionOptions {
  maxDimension?: number; // 1200 for covers, 1600 for article images
  quality?: number; // 0.75 - 0.82
  targetSizeKB?: number; // ~100 - 300 KB
  onProgress?: (progress: number) => void;
}

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
const MAX_INPUT_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB max input limit

/**
 * Validates the uploaded file type and size.
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: 'No file provided.' };
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type.toLowerCase())) {
    return {
      valid: false,
      error: `Unsupported format "${file.type || 'unknown'}". Please upload a JPEG, PNG, or WebP image.`,
    };
  }

  if (file.size > MAX_INPUT_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `Image size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds the 25 MB limit. Please select a smaller file.`,
    };
  }

  return { valid: true };
}

/**
 * Formats bytes into a human-readable string (KB / MB).
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Gets natural dimensions of an image file.
 */
export function getImageDimensions(file: File | Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve({ width: 0, height: 0 });
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

/**
 * Generates a collision-resistant filename for Supabase Storage.
 */
export function generateCollisionResistantFilename(originalName: string, prefix = 'img'): string {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 9);
  const cleanBase = originalName
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .substring(0, 30);
  return `${prefix}_${cleanBase}_${timestamp}_${randomSuffix}.webp`;
}

/**
 * Compresses an image client-side before network upload.
 * Enforces max dimensions (~1200px cover, ~1600px article), converts to WebP,
 * targets ~100-300KB, and reports compression stats.
 */
export async function compressImageClientSide(
  file: File,
  options: CompressionOptions = {}
): Promise<CompressedImageResult> {
  const validation = validateImageFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const {
    maxDimension = 1200,
    quality = 0.8,
    targetSizeKB = 250,
    onProgress,
  } = options;

  const originalSize = file.size;

  // Configuration for browser-image-compression
  const compressionConfig = {
    maxSizeMB: Math.max(0.1, targetSizeKB / 1024),
    maxWidthOrHeight: maxDimension,
    useWebWorker: true,
    fileType: 'image/webp',
    initialQuality: quality,
    onProgress: (progress: number) => {
      if (onProgress) onProgress(progress);
    },
  };

  let compressedBlob: File | Blob;

  try {
    // Attempt compression with browser-image-compression
    compressedBlob = await imageCompression(file, compressionConfig);
  } catch (err) {
    console.warn('browser-image-compression failed, falling back to Canvas compressor:', err);
    // Canvas fallback if web worker or library fails
    compressedBlob = await canvasCompressFallback(file, maxDimension, quality);
  }

  // Ensure output is a File with .webp extension
  const newFilename = generateCollisionResistantFilename(file.name);
  const compressedFile = new File([compressedBlob], newFilename, {
    type: 'image/webp',
    lastModified: Date.now(),
  });

  const compressedSize = compressedFile.size;
  const reductionPercentage = originalSize > 0
    ? Math.max(0, Math.round(((originalSize - compressedSize) / originalSize) * 100))
    : 0;

  const dimensions = await getImageDimensions(compressedFile);
  const previewUrl = URL.createObjectURL(compressedFile);

  return {
    file: compressedFile,
    previewUrl,
    originalSize,
    compressedSize,
    reductionPercentage,
    dimensions,
    format: 'image/webp',
  };
}

/**
 * Fallback Canvas-based compression in case WebWorker/library environment is constrained.
 */
function canvasCompressFallback(file: File, maxDim: number, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      let { naturalWidth: width, naturalHeight: height } = img;

      // Scale maintaining aspect ratio
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas 2D context unavailable'));
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Canvas toBlob conversion returned null'));
          }
        },
        'image/webp',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image for canvas compression'));
    };

    img.src = url;
  });
}
