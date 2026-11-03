/**
 * Client-side file compression and optimization utilities.
 * Supports image resizing/compression (JPEG/PNG) and PDF stream optimization.
 */

import { PDFDocument } from 'pdf-lib';

export interface CompressionResult {
  file: File | Blob;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number; // e.g. 0.35 = 35% smaller
  wasCompressed: boolean;
  type: string;
}

// Supported file extensions & mimes
export const SUPPORTED_EXTENSIONS = [
  'pdf',
  'doc',
  'docx',
  'ppt',
  'pptx',
  'xls',
  'xlsx',
  'jpg',
  'jpeg',
  'png',
  'zip',
] as const;

export function isFileSupported(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (!ext) return false;
  return SUPPORTED_EXTENSIONS.includes(ext as any);
}

/**
 * Compress an image using HTML5 canvas.
 * Scales down dimensions if over maxWidth/maxHeight and re-encodes with quality control.
 */
export async function compressImage(
  file: File,
  maxWidth: number = 2048,
  maxHeight: number = 2048,
  quality: number = 0.82
): Promise<CompressionResult> {
  const originalSize = file.size;

  return new Promise((resolve) => {
    // If small image (< 400KB), return as is without touching
    if (file.size < 400 * 1024) {
      return resolve({
        file,
        originalSize,
        compressedSize: originalSize,
        compressionRatio: 0,
        wasCompressed: false,
        type: file.type,
      });
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calculate aspect-ratio scaled dimensions
        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return resolve({
            file,
            originalSize,
            compressedSize: originalSize,
            compressionRatio: 0,
            wasCompressed: false,
            type: file.type,
          });
        }

        // Draw image
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob || blob.size >= originalSize) {
              // Compression didn't reduce size; keep original
              return resolve({
                file,
                originalSize,
                compressedSize: originalSize,
                compressionRatio: 0,
                wasCompressed: false,
                type: file.type,
              });
            }

            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });

            const ratio = (originalSize - blob.size) / originalSize;
            resolve({
              file: compressedFile,
              originalSize,
              compressedSize: blob.size,
              compressionRatio: ratio,
              wasCompressed: true,
              type: 'image/jpeg',
            });
          },
          'image/jpeg',
          quality
        );
      };

      img.onerror = () => {
        resolve({
          file,
          originalSize,
          compressedSize: originalSize,
          compressionRatio: 0,
          wasCompressed: false,
          type: file.type,
        });
      };

      img.src = event.target?.result as string;
    };

    reader.onerror = () => {
      resolve({
        file,
        originalSize,
        compressedSize: originalSize,
        compressionRatio: 0,
        wasCompressed: false,
        type: file.type,
      });
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Optimize PDF using pdf-lib stream compression if file is large (> 1.5MB).
 */
export async function optimizePdf(file: File): Promise<CompressionResult> {
  const originalSize = file.size;

  // Only optimize PDFs larger than 1.5MB to save unnecessary client compute
  if (originalSize < 1.5 * 1024 * 1024) {
    return {
      file,
      originalSize,
      compressedSize: originalSize,
      compressionRatio: 0,
      wasCompressed: false,
      type: 'application/pdf',
    };
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });

    // Save with object stream compression to minimize size
    const optimizedBytes = await pdfDoc.save({ useObjectStreams: true });

    if (optimizedBytes.byteLength < originalSize) {
      const optimizedBlob = new Blob([optimizedBytes as unknown as BlobPart], { type: 'application/pdf' });
      const optimizedFile = new File([optimizedBlob], file.name, {
        type: 'application/pdf',
        lastModified: Date.now(),
      });
      const ratio = (originalSize - optimizedBytes.byteLength) / originalSize;

      return {
        file: optimizedFile,
        originalSize,
        compressedSize: optimizedBytes.byteLength,
        compressionRatio: ratio,
        wasCompressed: true,
        type: 'application/pdf',
      };
    }
  } catch (err) {
    console.warn('PDF optimization skipped or encountered non-standard structure:', err);
  }

  return {
    file,
    originalSize,
    compressedSize: originalSize,
    compressionRatio: 0,
    wasCompressed: false,
    type: 'application/pdf',
  };
}

/**
 * Automatically compress file if applicable before upload.
 */
export async function processAndCompressFile(
  file: File,
  onProgress?: (status: string) => void
): Promise<CompressionResult> {
  const lowerName = file.name.toLowerCase();

  if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg') || lowerName.endsWith('.png')) {
    onProgress?.('Optimizing image for fast upload...');
    return compressImage(file);
  }

  if (lowerName.endsWith('.pdf')) {
    onProgress?.('Optimizing PDF structure...');
    return optimizePdf(file);
  }

  // Documents (doc, docx, ppt, pptx, xls, xlsx, zip) are already compressed or binary
  return {
    file,
    originalSize: file.size,
    compressedSize: file.size,
    compressionRatio: 0,
    wasCompressed: false,
    type: file.type || 'application/octet-stream',
  };
}

/**
 * Convert File/Blob to Base64 string for transmission to Google Apps Script.
 */
export function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result);
    };
    reader.onerror = (error) => reject(error);
  });
}
