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
  MemoryRateLimitStore,
  RateLimitStore,
  DEFAULT_TIERS,
  getTierForPath,
  shouldSkipRateLimit,
  checkRateLimit,
} from './security.js';
export type { RateLimitTier, RateLimitResult } from './security.js';

// Redis — opt-in store backends when NUXT_REDIS_URL is set
export { createRedisClient, resetRedisClientsForTests } from './redis/client.js';
export type { RedisClient } from './redis/client.js';
export { RedisRateLimitStore } from './redis/rateLimitStore.js';
export type { RedisRateLimitStoreOptions } from './redis/rateLimitStore.js';
export { createRateLimitStore } from './redis/factory.js';
export type { CreateRateLimitStoreOptions } from './redis/factory.js';

// Realtime pub/sub — SSE fanout; memory fallback when NUXT_REDIS_URL is unset
export { MemoryRealtimePubSub } from './realtime/pubsub.js';
export type { RealtimePubSub } from './realtime/pubsub.js';
export { RedisRealtimePubSub } from './realtime/redisPubsub.js';
export { createRealtimePubSub } from './realtime/factory.js';
export type { CreateRealtimePubSubOptions } from './realtime/factory.js';
