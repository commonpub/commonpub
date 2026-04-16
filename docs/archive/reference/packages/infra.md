# @commonpub/infra -- API Reference

Framework-agnostic infrastructure utilities. Storage adapters, image processing, email sending, and HTTP security (CSP, rate limiting). Contains no domain logic and has no database dependency.

## Storage

### `StorageAdapter` interface

```ts
interface StorageAdapter {
  upload(key: string, data: Buffer | Readable, mimeType: string): Promise<string>;
  delete(key: string): Promise<void>;
  getUrl(key: string): string;
}
```

### `LocalStorageAdapter`

Writes files to a local directory. Constructor takes `basePath` (disk path) and `baseUrl` (URL prefix). URLs are `{baseUrl}/uploads/{key}`.

### `S3StorageAdapter`

S3-compatible storage. Supports AWS S3, DigitalOcean Spaces, MinIO, and Cloudflare R2. Lazy-loads `@aws-sdk/client-s3` on first use.

Constructor config:
- `bucket` (required)
- `region` (required)
- `endpoint` (optional, for non-AWS providers)
- `accessKeyId`, `secretAccessKey` (required)
- `publicUrl` (optional, auto-derived)
- `forcePathStyle` (optional, auto-set when endpoint is provided)

### `createStorageFromEnv(): StorageAdapter`

Factory that reads `S3_BUCKET` from `process.env`. If set, returns `S3StorageAdapter`; otherwise returns `LocalStorageAdapter`.

### `generateStorageKey(originalName, purpose): string`

Generates a unique key: `{purpose}/{uuid}.{ext}`.

### `validateUpload(mimeType, sizeBytes, purpose): { valid, error? }`

Checks MIME type against whitelist and size against per-purpose limits.

### Constants

- `ALLOWED_MIME_TYPES` -- jpeg, png, gif, webp, svg+xml, pdf, text/plain, text/markdown, zip, gzip
- `ALLOWED_IMAGE_TYPES` -- jpeg, png, gif, webp
- `MAX_UPLOAD_SIZES` -- avatar: 2MB, banner: 5MB, cover: 10MB, content: 10MB, attachment: 100MB

---

## Image Processing

### `processImage(data, originalName, purpose, storage): Promise<ProcessedImage>`

Resizes an image buffer into standard variants (thumb 150px, small 300px, medium 600px, large 1200px), converts each to WebP, and uploads all variants plus the original to the provided storage adapter.

### `getBestVariant(processed, displayWidth): string`

Returns the URL of the smallest variant that is at least `displayWidth` pixels wide. Falls back to the original URL.

### `IMAGE_VARIANTS`

```ts
{ thumb: 150, small: 300, medium: 600, large: 1200 }
```

### Types

- `ProcessedImage` -- `{ originalKey, originalUrl, width, height, variants: ImageVariant[] }`
- `ImageVariant` -- `{ name, width, key, url }`
- `ImageVariantName` -- `'thumb' | 'small' | 'medium' | 'large'`

---

## Email

### `EmailAdapter` interface

```ts
interface EmailAdapter {
  send(message: EmailMessage): Promise<void>;
}

interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}
```

### `SmtpEmailAdapter`

SMTP transport. Dynamically imports `nodemailer` (must be installed separately). Constructor takes `{ host, port, secure?, user, pass, from }`.

### `ConsoleEmailAdapter`

Logs emails to `console.log`. For development and testing.

### `emailTemplates`

Pre-built HTML email templates with inline styles matching the CommonPub design system:

- `verification(siteName, verifyUrl)` -- email verification
- `passwordReset(siteName, resetUrl)` -- password reset
- `notificationDigest(siteName, username, notifications[])` -- notification digest
- `contestAnnouncement(siteName, title, url, message)` -- contest announcements
- `certificateIssued(siteName, pathTitle, code, url)` -- certificate issuance

All templates return `EmailMessage & { to: '' }` (caller must set `to`).

---

## Security

### CSP

- `buildCspDirectives(nonce?): Record<string, string>` -- returns CSP directive map. With nonce: scripts/styles use `nonce-{n}`. Without: scripts use `'self'`, styles use `'unsafe-inline'`.
- `buildCspHeader(directives?): string` -- serializes directives to a CSP header string.
- `generateNonce(): string` -- UUID-based nonce (hyphens stripped).

### Security Headers

- `getSecurityHeaders(isDev): Record<string, string>` -- X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy. HSTS added only when `isDev` is false.
- `getStaticCacheHeaders(): Record<string, string>` -- `Cache-Control: public, max-age=31536000, immutable` for hashed assets.

### Rate Limiting

- `RateLimitStore` -- in-memory sliding window store. Cleans up expired entries every 60 seconds. Call `destroy()` to stop cleanup.
- `RateLimitStore.check(key, tier): RateLimitResult` -- increments counter, returns `{ allowed, remaining, resetAt }`.
- `DEFAULT_TIERS` -- auth (5/min), social (30/min), federation (60/min), api (60/min), general (120/min).
- `getTierForPath(pathname): RateLimitTier` -- selects tier by URL prefix.
- `shouldSkipRateLimit(pathname): boolean` -- true for static assets.
- `checkRateLimit(store, ip, pathname): { result, headers }` -- full check with rate limit response headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After`).
