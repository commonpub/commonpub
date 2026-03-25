/**
 * File upload endpoint.
 * Accepts multipart form data, validates file type/size, stores via configured adapter.
 * Images are processed into WebP variants (thumb/small/medium/large).
 */
import { files } from '@commonpub/schema';
import {
  createStorageFromEnv,
  generateStorageKey,
  validateUpload,
  isProcessableImage,
  processImage,
} from '@commonpub/server';

// Lazy-init storage adapter (created once on first request)
let storage: ReturnType<typeof createStorageFromEnv> | null = null;
function getStorage(): ReturnType<typeof createStorageFromEnv> {
  if (!storage) storage = createStorageFromEnv();
  return storage;
}

export default defineEventHandler(async (event) => {
  const db = useDB();
  const user = requireAuth(event);

  const formData = await readMultipartFormData(event);
  if (!formData || formData.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No file uploaded' });
  }

  const file = formData[0]!;
  const filename = file.filename || `upload-${Date.now()}`;
  const mimeType = file.type || 'application/octet-stream';
  const sizeBytes = file.data.length;
  const validPurposes = ['cover', 'content', 'avatar', 'banner', 'attachment'] as const;
  type Purpose = typeof validPurposes[number];
  const purposeRaw = formData.find((f) => f.name === 'purpose')?.data.toString() || 'content';
  if (!validPurposes.includes(purposeRaw as Purpose)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid upload purpose' });
  }
  const purpose = purposeRaw as Purpose;

  // Validate
  const validation = validateUpload(mimeType, sizeBytes, purpose);
  if (!validation.valid) {
    throw createError({ statusCode: 400, statusMessage: validation.error ?? 'Invalid upload' });
  }

  const adapter = getStorage();
  let publicUrl: string;
  let storageKey: string;
  let width: number | null = null;
  let height: number | null = null;
  let variants: Record<string, string> | null = null;

  if (isProcessableImage(mimeType)) {
    // Process image: generate thumbnails and convert to WebP
    const processed = await processImage(file.data, filename, purpose, adapter, mimeType);
    publicUrl = processed.originalUrl;
    storageKey = processed.originalKey;
    width = processed.width;
    height = processed.height;

    if (processed.variants.length > 0) {
      variants = {};
      for (const v of processed.variants) {
        variants[v.name] = v.url;
      }
    }
  } else {
    // Non-image file: upload as-is
    storageKey = generateStorageKey(filename, purpose);
    publicUrl = await adapter.upload(storageKey, file.data, mimeType);
  }

  // Store metadata in DB
  const [row] = await db
    .insert(files)
    .values({
      uploaderId: user.id,
      filename: storageKey,
      originalName: filename,
      mimeType,
      sizeBytes,
      storageKey,
      publicUrl,
      purpose,
      width,
      height,
    })
    .returning();

  return {
    id: row!.id,
    filename: row!.filename,
    originalName: filename,
    mimeType: row!.mimeType,
    sizeBytes: row!.sizeBytes,
    url: publicUrl,
    width,
    height,
    variants,
    purpose: row!.purpose,
  };
});
