import { useState, useRef } from 'react';
import {
  compressImageClientSide,
  formatBytes,
  validateImageFile,
  type CompressedImageResult,
} from '../../utils/imageCompression';
import type { ArticleGalleryImage } from '../../types/news';

interface CoverImageUploaderProps {
  currentUrl?: string;
  onFileSelect: (file: File | null, result?: CompressedImageResult) => void;
  onRemove: () => void;
}

export function CoverImageUploader({
  currentUrl,
  onFileSelect,
  onRemove,
}: CoverImageUploaderProps) {
  const [compressing, setCompressing] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState(0);
  const [compressionStat, setCompressionStat] = useState<CompressedImageResult | null>(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (file: File) => {
    setError('');
    const validation = validateImageFile(file);
    if (!validation.valid) {
      setError(validation.error || 'Invalid image file.');
      return;
    }

    setCompressing(true);
    setCompressionProgress(10);

    try {
      const result = await compressImageClientSide(file, {
        maxDimension: 1200,
        quality: 0.8,
        targetSizeKB: 250,
        onProgress: (p) => setCompressionProgress(Math.round(p * 100)),
      });

      setCompressionStat(result);
      onFileSelect(result.file, result);
    } catch (err: any) {
      setError(`Compression error: ${err.message || 'Failed to compress image'}`);
      onFileSelect(null);
    } finally {
      setCompressing(false);
      setCompressionProgress(0);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const displayPreview = compressionStat?.previewUrl || currentUrl;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold tracking-wider text-slate-300 uppercase">
          Cover Image <span className="text-amber-400 font-normal">(Auto-optimized to WebP, max 1200px)</span>
        </label>
        {displayPreview && (
          <button
            type="button"
            onClick={() => {
              setCompressionStat(null);
              onRemove();
              if (fileInputRef.current) fileInputRef.current.value = '';
            }}
            className="text-xs text-red-400 hover:text-red-300 cursor-pointer transition-colors"
          >
            Remove Image
          </button>
        )}
      </div>

      {error && (
        <div className="p-3 text-xs text-red-300 bg-red-950/60 border border-red-500/40 rounded-lg">
          ⚠️ {error}
        </div>
      )}

      {/* Upload Zone / Preview */}
      {displayPreview ? (
        <div className="relative rounded-xl overflow-hidden border border-white/10 bg-black/40 group aspect-[16/9] max-h-72">
          <img
            src={displayPreview}
            alt="Cover preview"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow-lg"
            >
              Replace Image
            </button>
            <button
              type="button"
              onClick={() => {
                setCompressionStat(null);
                onRemove();
              }}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-lg shadow-lg"
            >
              Remove
            </button>
          </div>

          {/* Real-time Compression Badge */}
          {compressionStat && (
            <div className="absolute bottom-2 left-2 right-2 p-2 bg-black/85 backdrop-blur-md rounded-lg border border-emerald-500/30 text-[11px] text-emerald-300 flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold flex items-center gap-1">
                ✓ Client-side Compressed ({compressionStat.format.toUpperCase()}):
              </span>
              <span>
                {formatBytes(compressionStat.originalSize)} → <strong className="text-white">{formatBytes(compressionStat.compressedSize)}</strong>
                {' '}({compressionStat.reductionPercentage}% smaller)
              </span>
              <span className="text-slate-400 text-[10px]">
                {compressionStat.dimensions.width}×{compressionStat.dimensions.height}px
              </span>
            </div>
          )}
        </div>
      ) : (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-white/20 hover:border-indigo-400/60 rounded-xl p-8 text-center cursor-pointer transition-colors bg-white/5 hover:bg-white/[0.08]"
        >
          {compressing ? (
            <div className="space-y-2">
              <div className="animate-spin w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full mx-auto" />
              <p className="text-xs text-indigo-300 font-medium">
                Optimizing & compressing image ({compressionProgress}%)...
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="w-12 h-12 mx-auto rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 text-xl">
                🖼️
              </div>
              <p className="text-xs text-slate-200 font-medium">
                Click to upload cover image or drag and drop
              </p>
              <p className="text-[11px] text-slate-400">
                JPEG, PNG, or WebP up to 25 MB. Automatically resized & compressed (~150-250 KB) before network upload.
              </p>
            </div>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
        className="hidden"
      />
    </div>
  );
}

interface GalleryImageManagerProps {
  images: ArticleGalleryImage[];
  onChange: (images: ArticleGalleryImage[]) => void;
  onDeletedStoragePath?: (path: string) => void;
}

export function GalleryImageManager({
  images,
  onChange,
  onDeletedStoragePath,
}: GalleryImageManagerProps) {
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const handleMultiFiles = async (files: FileList | File[]) => {
    setError('');
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    if (images.length + fileArray.length > 12) {
      setError('Maximum 12 gallery images allowed per article.');
      return;
    }

    setProcessing(true);
    const newItems: ArticleGalleryImage[] = [];

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      const validation = validateImageFile(file);
      if (!validation.valid) {
        setError(`Skipped "${file.name}": ${validation.error}`);
        continue;
      }

      try {
        const compressed = await compressImageClientSide(file, {
          maxDimension: 1600,
          quality: 0.82,
          targetSizeKB: 300,
        });

        newItems.push({
          id: `pending-${Date.now()}-${i}`,
          imageUrl: compressed.previewUrl,
          localPreviewUrl: compressed.previewUrl,
          pendingFile: compressed.file,
          originalSize: compressed.originalSize,
          compressedSize: compressed.compressedSize,
          reductionPercentage: compressed.reductionPercentage,
          caption: '',
          altText: file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
          displayOrder: images.length + i,
        });
      } catch (err: any) {
        setError(`Failed to compress ${file.name}: ${err.message}`);
      }
    }

    onChange([...images, ...newItems]);
    setProcessing(false);
    if (galleryInputRef.current) galleryInputRef.current.value = '';
  };

  const handleUpdateItem = (index: number, updates: Partial<ArticleGalleryImage>) => {
    const next = [...images];
    next[index] = { ...next[index], ...updates };
    onChange(next);
  };

  const handleRemoveItem = (index: number) => {
    const item = images[index];
    if (item.storagePath && onDeletedStoragePath) {
      onDeletedStoragePath(item.storagePath);
    }
    const next = images.filter((_, i) => i !== index).map((img, i) => ({ ...img, displayOrder: i }));
    onChange(next);
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= images.length) return;
    const next = [...images];
    const temp = next[index];
    next[index] = next[targetIndex];
    next[targetIndex] = temp;
    // update displayOrder
    onChange(next.map((img, i) => ({ ...img, displayOrder: i })));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <label className="block text-xs font-semibold tracking-wider text-slate-300 uppercase">
            Article Gallery Images ({images.length}/12)
          </label>
          <p className="text-[11px] text-slate-400">
            High-res in-article photos. Each image is compressed client-side before upload.
          </p>
        </div>

        <button
          type="button"
          onClick={() => galleryInputRef.current?.click()}
          disabled={processing || images.length >= 12}
          className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-sm transition-colors"
        >
          {processing ? 'Compressing...' : '+ Add Gallery Images'}
        </button>
      </div>

      {error && (
        <div className="p-3 text-xs text-red-300 bg-red-950/60 border border-red-500/40 rounded-lg">
          ⚠️ {error}
        </div>
      )}

      {/* Gallery Items Grid */}
      {images.length > 0 ? (
        <div className="space-y-3">
          {images.map((item, idx) => (
            <div
              key={item.id || idx}
              className="p-3 bg-white/5 border border-white/10 rounded-xl flex flex-col md:flex-row gap-3 items-start md:items-center"
            >
              {/* Thumbnail */}
              <div className="relative w-24 h-20 rounded-lg overflow-hidden shrink-0 border border-white/10 bg-black">
                <img
                  src={item.localPreviewUrl || item.imageUrl}
                  alt={item.altText || 'Gallery item'}
                  className="w-full h-full object-cover"
                />
                <span className="absolute top-1 left-1 bg-black/80 text-[10px] text-white px-1.5 py-0.5 rounded font-mono">
                  #{idx + 1}
                </span>
              </div>

              {/* Fields */}
              <div className="flex-1 space-y-2 w-full">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-400 uppercase font-medium mb-1">
                      Caption (displayed under image)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Participants pitching in the auditorium..."
                      value={item.caption || ''}
                      onChange={(e) => handleUpdateItem(idx, { caption: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs bg-black/50 border border-white/10 rounded text-slate-200 focus:outline-none focus:border-indigo-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 uppercase font-medium mb-1">
                      Alt Text (SEO & Accessibility)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Students working on prototypes"
                      value={item.altText || ''}
                      onChange={(e) => handleUpdateItem(idx, { altText: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs bg-black/50 border border-white/10 rounded text-slate-200 focus:outline-none focus:border-indigo-400"
                    />
                  </div>
                </div>

                {/* Compression Info if newly compressed */}
                {item.compressedSize && item.originalSize && (
                  <div className="text-[11px] text-emerald-400 flex items-center gap-2">
                    <span>✓ Client-compressed:</span>
                    <span>
                      {formatBytes(item.originalSize)} → <strong>{formatBytes(item.compressedSize)}</strong>
                      {' '}({item.reductionPercentage}% saved)
                    </span>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-1 shrink-0 self-end md:self-center">
                <button
                  type="button"
                  title="Move Up"
                  disabled={idx === 0}
                  onClick={() => handleMove(idx, 'up')}
                  className="p-1.5 rounded hover:bg-white/10 text-slate-300 disabled:opacity-30 cursor-pointer"
                >
                  ▲
                </button>
                <button
                  type="button"
                  title="Move Down"
                  disabled={idx === images.length - 1}
                  onClick={() => handleMove(idx, 'down')}
                  className="p-1.5 rounded hover:bg-white/10 text-slate-300 disabled:opacity-30 cursor-pointer"
                >
                  ▼
                </button>
                <button
                  type="button"
                  title="Remove Image"
                  onClick={() => handleRemoveItem(idx)}
                  className="p-1.5 rounded hover:bg-red-500/20 text-red-400 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div
          onClick={() => galleryInputRef.current?.click()}
          className="p-6 border border-dashed border-white/15 rounded-xl text-center text-xs text-slate-400 cursor-pointer hover:border-white/30 transition-colors"
        >
          No additional gallery images added yet. Click "+ Add Gallery Images" to attach supporting event photos or infographics.
        </div>
      )}

      <input
        ref={galleryInputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => e.target.files && handleMultiFiles(e.target.files)}
        className="hidden"
      />
    </div>
  );
}
