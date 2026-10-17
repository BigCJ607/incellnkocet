import React, { useState, useRef, useEffect, useCallback } from 'react';
import { compressImageClientSide, formatBytes } from '../../utils/imageCompression';

interface AvatarCropperModalProps {
  imageFile?: File | null;
  imageSrc?: string | null;
  isOpen: boolean;
  onClose: () => void;
  onCropComplete: (result: {
    avatarUrl: string;
    file: File;
    originalSize: number;
    compressedSize: number;
    reductionPercentage: number;
  }) => void;
  authorName?: string;
}

const VIEW_SIZE = 320; // Canvas dimensions
const CROP_DIAMETER = 240; // Diameter of circular crop window
const CROP_RADIUS = CROP_DIAMETER / 2;
const OUTPUT_SIZE = 360; // Output square size for crisp retina avatar

export default function AvatarCropperModal({
  imageFile,
  imageSrc,
  isOpen,
  onClose,
  onCropComplete,
  authorName = 'Author',
}: AvatarCropperModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [imgElement, setImgElement] = useState<HTMLImageElement | null>(null);

  // Transform states
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0); // in degrees: 0, 90, 180, 270

  // Drag tracking
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const panStartRef = useRef({ x: 0, y: 0 });

  // Processing state
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  // Load image file or src into an HTMLImageElement
  useEffect(() => {
    if (!isOpen || (!imageFile && !imageSrc)) {
      setImgElement(null);
      return;
    }

    setError('');
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setRotation(0);

    const isBlobUrl = !!imageFile;
    const srcUrl = imageFile ? URL.createObjectURL(imageFile) : (imageSrc as string);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setImgElement(img);
      if (isBlobUrl) URL.revokeObjectURL(srcUrl);
    };
    img.onerror = () => {
      setError('Failed to load image for cropping.');
      if (isBlobUrl) URL.revokeObjectURL(srcUrl);
    };
    img.src = srcUrl;

    return () => {
      if (isBlobUrl) URL.revokeObjectURL(srcUrl);
    };
  }, [isOpen, imageFile, imageSrc]);

  // Calculate base scale so image comfortably covers the crop circle
  const getBaseScale = useCallback((img: HTMLImageElement, rot: number) => {
    const isRotated90 = rot === 90 || rot === 270;
    const w = isRotated90 ? img.naturalHeight : img.naturalWidth;
    const h = isRotated90 ? img.naturalWidth : img.naturalHeight;
    return Math.max(CROP_DIAMETER / w, CROP_DIAMETER / h);
  }, []);

  // Redraw canvas whenever img, pan, zoom, or rotation changes
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imgElement) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, VIEW_SIZE, VIEW_SIZE);

    const centerX = VIEW_SIZE / 2;
    const centerY = VIEW_SIZE / 2;

    const baseScale = getBaseScale(imgElement, rotation);
    const scale = baseScale * zoom;

    // 1. Draw transformed image
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(pan.x, pan.y);
    ctx.scale(scale, scale);
    ctx.drawImage(
      imgElement,
      -imgElement.naturalWidth / 2,
      -imgElement.naturalHeight / 2,
      imgElement.naturalWidth,
      imgElement.naturalHeight
    );
    ctx.restore();

    // 2. Draw dark vignette mask with clear circular aperture
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
    ctx.beginPath();
    ctx.rect(0, 0, VIEW_SIZE, VIEW_SIZE);
    ctx.arc(centerX, centerY, CROP_RADIUS, 0, Math.PI * 2, true);
    ctx.fill();

    // 3. Draw circle outline & subtle guidelines
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#6366F1'; // Indigo accent
    ctx.beginPath();
    ctx.arc(centerX, centerY, CROP_RADIUS, 0, Math.PI * 2);
    ctx.stroke();

    // Subtle center crosshairs
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(centerX - 16, centerY);
    ctx.lineTo(centerX + 16, centerY);
    ctx.moveTo(centerX, centerY - 16);
    ctx.lineTo(centerX, centerY + 16);
    ctx.stroke();
    ctx.restore();
  }, [imgElement, pan, zoom, rotation, getBaseScale]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Mouse & Touch Drag Handlers
  const handlePointerDown = (clientX: number, clientY: number) => {
    setIsDragging(true);
    dragStartRef.current = { x: clientX, y: clientY };
    panStartRef.current = { ...pan };
  };

  const handlePointerMove = (clientX: number, clientY: number) => {
    if (!isDragging) return;
    const dx = clientX - dragStartRef.current.x;
    const dy = clientY - dragStartRef.current.y;
    setPan({
      x: panStartRef.current.x + dx,
      y: panStartRef.current.y + dy,
    });
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  // Wheel zoom handler
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY * -0.0015;
    setZoom((prev) => Math.min(3.5, Math.max(1, prev + delta)));
  };

  // Rotate 90 degrees clockwise
  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
    setPan({ x: 0, y: 0 }); // reset pan on rotation to keep in bounds
  };

  // Reset adjustments
  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setRotation(0);
  };

  // Apply crop & compress
  const handleApplyCrop = async () => {
    if (!imgElement) return;
    setProcessing(true);
    setError('');

    try {
      // 1. Create output square canvas
      const outCanvas = document.createElement('canvas');
      outCanvas.width = OUTPUT_SIZE;
      outCanvas.height = OUTPUT_SIZE;
      const outCtx = outCanvas.getContext('2d');
      if (!outCtx) throw new Error('Could not create output canvas context');

      const outCenter = OUTPUT_SIZE / 2;
      const ratio = OUTPUT_SIZE / CROP_DIAMETER;
      const baseScale = getBaseScale(imgElement, rotation);
      const totalScale = baseScale * zoom * ratio;

      // Enable high-quality smoothing
      outCtx.imageSmoothingEnabled = true;
      outCtx.imageSmoothingQuality = 'high';

      // 2. Draw transformed image onto output canvas
      outCtx.save();
      outCtx.translate(outCenter, outCenter);
      outCtx.rotate((rotation * Math.PI) / 180);
      outCtx.translate(pan.x * ratio, pan.y * ratio);
      outCtx.scale(totalScale, totalScale);
      outCtx.drawImage(
        imgElement,
        -imgElement.naturalWidth / 2,
        -imgElement.naturalHeight / 2,
        imgElement.naturalWidth,
        imgElement.naturalHeight
      );
      outCtx.restore();

      // 3. Convert to blob and compress
      const blob = await new Promise<Blob>((resolve, reject) => {
        outCanvas.toBlob(
          (b) => {
            if (b) resolve(b);
            else reject(new Error('Failed to generate image blob'));
          },
          'image/webp',
          0.92
        );
      });

      const croppedFile = new File([blob], `${imageFile?.name || 'author_avatar'}.webp`, {
        type: 'image/webp',
      });

      // Compress client-side down to 320px, ~35KB
      const compressionRes = await compressImageClientSide(croppedFile, {
        maxDimension: 320,
        quality: 0.82,
        targetSizeKB: 35,
      });

      // Convert to base64 Data URL for zero-dependency persistence
      const reader = new FileReader();
      const base64Url = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(compressionRes.file);
      });

      onCropComplete({
        avatarUrl: base64Url,
        file: compressionRes.file,
        originalSize: imageFile?.size || compressionRes.originalSize,
        compressedSize: compressionRes.compressedSize,
        reductionPercentage: compressionRes.reductionPercentage,
      });

      onClose();
    } catch (err: any) {
      setError(err.message || 'Crop processing failed.');
    } finally {
      setProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg bg-slate-900 border border-white/15 text-white rounded-2xl shadow-2xl overflow-hidden flex flex-col p-5 sm:p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
              Profile Photo Editor
            </span>
            <h3 className="text-base sm:text-lg font-bold text-white">
              Fit & Crop Profile Picture
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            ✕
          </button>
        </div>

        <p className="text-xs text-slate-300">
          Drag to position your photo and use the slider to zoom so it fits inside the circle.
        </p>

        {error && (
          <div className="p-2.5 bg-red-950/80 border border-red-500/40 rounded-xl text-xs text-red-300">
            ⚠️ {error}
          </div>
        )}

        {/* Main Crop Viewport */}
        <div className="flex flex-col sm:flex-row items-center gap-5 justify-center">
          {/* Interactive Canvas */}
          <div
            className="relative rounded-2xl overflow-hidden shadow-inner bg-slate-950 border border-white/10 select-none cursor-grab active:cursor-grabbing"
            style={{ width: VIEW_SIZE, height: VIEW_SIZE }}
            onMouseDown={(e) => handlePointerDown(e.clientX, e.clientY)}
            onMouseMove={(e) => handlePointerMove(e.clientX, e.clientY)}
            onMouseUp={handlePointerUp}
            onMouseLeave={handlePointerUp}
            onTouchStart={(e) => {
              if (e.touches[0]) handlePointerDown(e.touches[0].clientX, e.touches[0].clientY);
            }}
            onTouchMove={(e) => {
              if (e.touches[0]) handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
            }}
            onTouchEnd={handlePointerUp}
            onWheel={handleWheel}
          >
            <canvas
              ref={canvasRef}
              width={VIEW_SIZE}
              height={VIEW_SIZE}
              className="w-full h-full block"
            />

            <span className="absolute bottom-2 left-2 text-[10px] text-slate-400 bg-black/60 px-2 py-0.5 rounded pointer-events-none">
              ✥ Drag to move
            </span>
          </div>

          {/* Real-time Circular Preview Pill */}
          <div className="flex flex-col items-center gap-3 p-3 bg-black/40 border border-white/10 rounded-xl min-w-[130px]">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Live Preview
            </span>

            {/* Simulated 48px Avatar as displayed on the blog */}
            <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-indigo-400 shadow-lg relative bg-slate-800">
              {imgElement && (
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    backgroundImage: `url(${imgElement.src})`,
                    backgroundPosition: `calc(50% + ${pan.x * (56 / CROP_DIAMETER)}px) calc(50% + ${pan.y * (56 / CROP_DIAMETER)}px)`,
                    backgroundSize: `${100 * zoom}% auto`,
                    backgroundRepeat: 'no-repeat',
                    transform: `rotate(${rotation}deg)`,
                  }}
                />
              )}
            </div>

            <div className="text-center">
              <div className="text-xs font-bold text-white truncate max-w-[110px]">
                {authorName}
              </div>
              <div className="text-[10px] text-emerald-400 font-medium">
                48px Circle
              </div>
            </div>
          </div>
        </div>

        {/* Zoom & Control Bar */}
        <div className="space-y-3 pt-2">
          {/* Zoom slider */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 font-medium w-12">Zoom</span>
            <button
              type="button"
              onClick={() => setZoom((prev) => Math.max(1, +(prev - 0.1).toFixed(2)))}
              className="w-6 h-6 rounded bg-white/10 hover:bg-white/20 text-white text-xs flex items-center justify-center"
            >
              −
            </button>
            <input
              type="range"
              min="1"
              max="3"
              step="0.05"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="flex-1 accent-indigo-500 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
            />
            <button
              type="button"
              onClick={() => setZoom((prev) => Math.min(3, +(prev + 0.1).toFixed(2)))}
              className="w-6 h-6 rounded bg-white/10 hover:bg-white/20 text-white text-xs flex items-center justify-center"
            >
              +
            </button>
            <span className="text-xs text-indigo-300 font-mono w-9 text-right">
              {zoom.toFixed(1)}x
            </span>
          </div>

          {/* Quick buttons: Rotate & Reset */}
          <div className="flex items-center justify-between text-xs pt-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRotate}
                className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 transition-colors flex items-center gap-1"
              >
                ⟳ Rotate 90°
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
              >
                Reset
              </button>
            </div>

            <span className="text-[11px] text-slate-400">
              Compresses to ~30 KB
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
          <button
            type="button"
            onClick={onClose}
            disabled={processing}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApplyCrop}
            disabled={processing || !imgElement}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            {processing ? 'Compressing...' : '✓ Crop & Use Profile Pic'}
          </button>
        </div>
      </div>
    </div>
  );
}
