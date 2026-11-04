import React, { useState, useRef, ChangeEvent } from 'react';
import { Camera, Upload, X, Check, Image as ImageIcon, Loader2, RefreshCw } from 'lucide-react';

interface PhotoUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPhotoSaved: (photoDataUrl: string) => Promise<void> | void;
  title?: string;
  subtitle?: string;
  aspectRatioLabel?: string;
  currentPhotoUrl?: string | null;
}

/**
 * Resizes and crops an image file to standard portrait passport photo dimensions (360 x 440px)
 * and returns a lightweight compressed JPEG data URL (< 80KB).
 */
export function processPassportImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      return reject(new Error('Selected file must be an image (PNG, JPG, or WebP).'));
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to parse image data.'));
      img.onload = () => {
        const targetWidth = 360;
        const targetHeight = 440;

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('Canvas 2D context not available.'));
        }

        // Draw clean white backdrop
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, targetWidth, targetHeight);

        // Calculate aspect ratios for center-crop portrait fill
        const imgRatio = img.width / img.height;
        const targetRatio = targetWidth / targetHeight;

        let renderWidth = targetWidth;
        let renderHeight = targetHeight;
        let offsetX = 0;
        let offsetY = 0;

        if (imgRatio > targetRatio) {
          // Source is wider than target: fit height, crop sides
          renderHeight = targetHeight;
          renderWidth = targetHeight * imgRatio;
          offsetX = (targetWidth - renderWidth) / 2;
        } else {
          // Source is taller than target: fit width, crop top/bottom
          renderWidth = targetWidth;
          renderHeight = targetWidth / imgRatio;
          offsetY = (targetHeight - renderHeight) / 2;
        }

        ctx.drawImage(img, offsetX, offsetY, renderWidth, renderHeight);

        // Convert to high-quality compressed JPEG (quality 0.85)
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
        resolve(compressedDataUrl);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export const PhotoUploadModal: React.FC<PhotoUploadModalProps> = ({
  isOpen,
  onClose,
  onPhotoSaved,
  title = 'Upload Passport Photo',
  subtitle = 'Official portrait photo for student profile and examination results',
  aspectRatioLabel = 'Standard Nigerian & Cambridge Passport Format (Portrait 4:5)',
  currentPhotoUrl,
}) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentPhotoUrl || null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFile = async (file: File) => {
    setError(null);
    setIsProcessing(true);
    try {
      if (file.size > 12 * 1024 * 1024) {
        throw new Error('Image file is too large (maximum size is 12MB).');
      }
      const processed = await processPassportImage(file);
      setSelectedFile(file);
      setPreviewUrl(processed);
    } catch (err: any) {
      setError(err?.message || 'Failed to process image');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleSave = async () => {
    if (!previewUrl) return;
    setIsSaving(true);
    setError(null);
    try {
      await onPhotoSaved(previewUrl);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save photograph. Please retry.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl relative text-left">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">{title}</h3>
              <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300">
            {error}
          </div>
        )}

        {/* Upload Zone & Preview */}
        <div className="my-5 flex flex-col items-center">
          {previewUrl ? (
            <div className="flex flex-col items-center gap-4">
              {/* Passport Photo Frame */}
              <div className="relative group">
                <div className="w-36 h-44 rounded-xl border-2 border-emerald-500 overflow-hidden shadow-xl bg-white flex items-center justify-center">
                  <img
                    src={previewUrl}
                    alt="Passport Preview"
                    className="w-full h-full object-cover object-center"
                  />
                </div>
                <div className="absolute -bottom-2 -right-2 bg-emerald-600 text-white p-1.5 rounded-full shadow-md border-2 border-slate-900">
                  <Check className="w-3.5 h-3.5" />
                </div>
              </div>

              <div className="text-center space-y-1">
                <span className="text-[11px] font-semibold text-emerald-400 block">
                  ✓ Photo Processed &amp; Optimized (Standard Passport Ratio)
                </span>
                <span className="text-[10px] text-slate-400 block font-mono">
                  {selectedFile ? `${selectedFile.name} • Ready to Sync` : 'Current Stored Photograph'}
                </span>
              </div>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs rounded-xl flex items-center gap-1.5 transition border border-slate-700 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3 text-amber-400" />
                Choose Different Photo
              </button>
            </div>
          ) : (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`w-full py-10 px-6 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition ${
                isDragging
                  ? 'border-emerald-400 bg-emerald-950/20'
                  : 'border-slate-700 hover:border-slate-500 bg-slate-950/40 hover:bg-slate-950/80'
              }`}
            >
              {isProcessing ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-10 h-10 animate-spin text-emerald-400" />
                  <span className="text-xs text-slate-300 font-medium">Processing &amp; cropping image...</span>
                </div>
              ) : (
                <>
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mb-3">
                    <Upload className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-bold text-white">Click or drag &amp; drop to upload photo</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs">
                    Supports JPG, PNG or WebP. Auto-crops into standard passport photograph.
                  </p>
                  <span className="mt-3 inline-block px-3 py-1 rounded-full bg-slate-800 text-[10px] text-slate-300 font-mono">
                    Max size: 12MB
                  </span>
                </>
              )}
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleInputChange}
          />
        </div>

        {/* Format Spec Note */}
        <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-0.5">
          <p className="text-amber-300 font-semibold">Format Specification:</p>
          <p>{aspectRatioLabel}</p>
          <p className="text-[10px] text-slate-500">
            Stored in high-resolution and rendered seamlessly across all student profiles, report cards, and broadsheet ledgers.
          </p>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 mt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!previewUrl || isSaving || isProcessing}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 transition cursor-pointer shadow-lg shadow-emerald-950 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                Saving to Database...
              </>
            ) : (
              <>
                <Check className="w-4 h-4 text-amber-300" />
                Save &amp; Synchronize Photo
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
