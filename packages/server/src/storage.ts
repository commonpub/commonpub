// Re-export from @commonpub/infra for backward compatibility
export {
  LocalStorageAdapter,
  S3StorageAdapter,
  createStorageFromEnv,
  generateStorageKey,
  validateUpload,
  isProcessableImage,
  ALLOWED_MIME_TYPES,
  ALLOWED_IMAGE_TYPES,
  MAX_UPLOAD_SIZES,
} from '@commonpub/infra/storage';
export type { StorageAdapter, StorageObject } from '@commonpub/infra/storage';
