/**
 * File upload endpoint.
 * Accepts multipart form data, validates file type/size, stores via configured adapter.
 * Images are processed into WebP variants (thumb/small/medium/large).
 */
import { files } from '@commonpub/schema';
import {
  generateStorageKey,
  validateUpload,
  isProcessableImage,
  processImage,
} from '@commonpub/server';

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
  // `contest` is the PRIVATE purpose (P0): the bytes are stored non-public and
  // served only through the auth + contest.pii-gated /api/files/[id]/raw route.
  const validPurposes = ['cover', 'content', 'avatar', 'banner', 'attachment', 'contest'] as const;
  type Purpose = typeof validPurposes[number];
  const purposeRaw = formData.find((f) => f.name === 'purpose')?.data.toString() || 'content';
  if (!validPurposes.includes(purposeRaw as Purpose)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid upload purpose' });
  }
  const purpose = purposeRaw as Purpose;
  const isPrivate = purpose === 'contest';
  // Dark-launched until the file/signature field types ship (P6). Gating here
  // means the private-storage path cannot be exercised until the operator opts in.
  if (isPrivate) requireFeature('contestPrivateFiles');

  // Validate
  const validation = validateUpload(mimeType, sizeBytes, purpose);
  if (!validation.valid) {
    throw createError({ statusCode: 400, statusMessage: validation.error ?? 'Invalid upload' });
  }

  const adapter = useFileStorage();
  let publicUrl: string | null = null;
  let storageKey: string;
  let width: number | null = null;
  let height: number | null = null;
  let variants: Record<string, string> | null = null;

  if (isPrivate) {
    // NEVER run image processing on a private upload — processImage writes its
    // WebP variants through the PUBLIC adapter, which would leak a "private"
    // signature/document to a public URL. Store the raw bytes privately only.
    storageKey = generateStorageKey(filename, purpose);
    await adapter.uploadPrivate(storageKey, file.data, mimeType);
  } else if (isProcessableImage(mimeType)) {
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
      publicUrl, // null for private uploads
      purpose,
      visibility: isPrivate ? 'private' : 'public',
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
    // A private file has no public URL — hand back the gated serving route.
    url: isPrivate ? `/api/files/${row!.id}/raw` : publicUrl,
    visibility: row!.visibility,
    width,
    height,
    variants,
    purpose: row!.purpose,
  };
});
