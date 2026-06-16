/**
 * Downscale a large image File before upload. Presentations don't need
 * multi-thousand-pixel images, so cap the largest dimension and re-encode
 * to keep Blossom storage and load times reasonable.
 *
 * - Skips non-raster types (SVG, GIF) and images already within bounds.
 * - Preserves aspect ratio.
 * - Re-encodes to JPEG (or keeps PNG if the source has transparency).
 */
const MAX_DIMENSION = 1920;
const JPEG_QUALITY = 0.85;

export async function resizeImageForUpload(file: File): Promise<File> {
  // Leave vector and animated formats alone
  if (
    file.type === 'image/svg+xml' ||
    file.type === 'image/gif' ||
    !file.type.startsWith('image/')
  ) {
    return file;
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    // If decoding fails, fall back to the original file
    return file;
  }

  const { width, height } = bitmap;
  const largest = Math.max(width, height);

  // Already small enough — no need to re-encode
  if (largest <= MAX_DIMENSION) {
    bitmap.close();
    return file;
  }

  const scale = MAX_DIMENSION / largest;
  const targetW = Math.round(width * scale);
  const targetH = Math.round(height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    return file;
  }

  ctx.drawImage(bitmap, 0, 0, targetW, targetH);
  bitmap.close();

  // Detect whether we should keep PNG (transparency) or go JPEG
  const keepPng = file.type === 'image/png';
  const outType = keepPng ? 'image/png' : 'image/jpeg';
  const ext = keepPng ? 'png' : 'jpg';

  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob(resolve, outType, keepPng ? undefined : JPEG_QUALITY)
  );

  if (!blob) return file;

  // If somehow the re-encode is larger than the original, keep the original
  if (blob.size >= file.size) {
    return file;
  }

  const baseName = file.name.replace(/\.[^.]+$/, '') || 'image';
  return new File([blob], `${baseName}.${ext}`, { type: outType });
}
