/**
 * @commonpub/infra — Framework-agnostic infrastructure utilities.
 *
 * Storage adapters, image processing, email, and security headers/rate limiting.
 * No domain knowledge, no database dependency.
 */

// Storage
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
} from './storage.js';
export type { StorageAdapter } from './storage.js';

// Image Processing
export {
  processImage,
  getBestVariant,
  IMAGE_VARIANTS,
} from './image.js';
export type { ProcessedImage, ImageVariant, ImageVariantName } from './image.js';

// Email
export {
  SmtpEmailAdapter,
  ResendEmailAdapter,
  ConsoleEmailAdapter,
  emailTemplates,
} from './email.js';
export type { EmailAdapter, EmailMessage } from './email.js';

// Security
export {
  buildCspDirectives,
  buildCspHeader,
  getSecurityHeaders,
  getStaticCacheHeaders,
  generateNonce,
  RateLimitStore,
  DEFAULT_TIERS,
  getTierForPath,
  shouldSkipRateLimit,
  checkRateLimit,
} from './security.js';
export type { RateLimitTier, RateLimitResult } from './security.js';
