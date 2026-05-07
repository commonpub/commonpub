import type { StorageAdapter } from './storage.js';
import { generateStorageKey, isProcessableImage } from './storage.js';

/** Image variant sizes */
export const IMAGE_VARIANTS = {
  thumb: 150,
  small: 300,
  medium: 600,
  large: 1200,
} as const;

export type ImageVariantName = keyof typeof IMAGE_VARIANTS;

export interface ImageVariant {
  name: ImageVariantName;
  width: number;
  key: string;
  url: string;
}

export interface ProcessedImage {
  /** Original image key */
  originalKey: string;
  /** Original image URL */
  originalUrl: string;
  /** Original dimensions */
  width: number;
  height: number;
  /** Generated variants (WebP) */
  variants: ImageVariant[];
}

/**
 * Process an uploaded image: resize to standard variants and convert to WebP.
 * Uses sharp for image processing.
 *
 * @param data - Original image buffer
 * @param originalName - Original filename (used to derive storage key)
 * @param purpose - Storage purpose (avatar, cover, content, etc.)
 * @param storage - Storage adapter to write variants to
 * @returns ProcessedImage with all variant URLs
 */
export async function processImage(
  data: Buffer,
  originalName: string,
  purpose: string,
  storage: StorageAdapter,
  mimeType?: string,
): Promise<ProcessedImage> {
  // Validate MIME type before passing to sharp
  if (mimeType && !isProcessableImage(mimeType)) {
    throw new Error(`Cannot process image: unsupported type "${mimeType}"`);
  }

  const sharp = (await import('sharp')).default;

  // Cap decoded pixel count to defend against image-bomb DoS — a 10 MB PNG
  // can decode to a 50000×50000 bitmap (~7.5 GB). 100 megapixels caps
  // worst-case raw-bitmap memory at ~400 MB.
  const SHARP_OPTIONS = { limitInputPixels: 100_000_000 };

  // Get original metadata (also validates the buffer is a real image)
  let metadata: Awaited<ReturnType<ReturnType<typeof sharp>['metadata']>>;
  try {
    metadata = await sharp(data, SHARP_OPTIONS).metadata();
  } catch {
    throw new Error('Cannot process image: buffer is not a valid image');
  }
  const originalWidth = metadata.width ?? 0;
  const originalHeight = metadata.height ?? 0;

  // Upload original
  const originalKey = generateStorageKey(originalName, purpose);
  const originalUrl = await storage.upload(originalKey, data, `image/${metadata.format ?? 'jpeg'}`);

  // Generate variants — only create variants smaller than the original
  const variants: ImageVariant[] = [];
  const variantEntries = Object.entries(IMAGE_VARIANTS) as [ImageVariantName, number][];

  for (const [name, maxWidth] of variantEntries) {
    // Skip variants larger than original
    if (originalWidth > 0 && maxWidth >= originalWidth) continue;

    const resized = await sharp(data, SHARP_OPTIONS)
      .resize(maxWidth, undefined, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 80 })
      .toBuffer();

    const variantKey = generateStorageKey(`${name}.webp`, `${purpose}/variants`);
    const url = await storage.upload(variantKey, resized, 'image/webp');

    variants.push({ name, width: maxWidth, key: variantKey, url });
  }

  return {
    originalKey,
    originalUrl,
    width: originalWidth,
    height: originalHeight,
    variants,
  };
}

/**
 * Get the best variant URL for a given display width.
 * Falls back to the original if no variant is suitable.
 */
export function getBestVariant(
  processed: ProcessedImage,
  displayWidth: number,
): string {
  // Find the smallest variant that's >= displayWidth
  const sorted = [...processed.variants].sort((a, b) => a.width - b.width);
  const match = sorted.find((v) => v.width >= displayWidth);
  return match?.url ?? processed.originalUrl;
}
