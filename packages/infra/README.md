# @commonpub/infra

Framework-agnostic infrastructure utilities for CommonPub. Storage adapters, image processing, email, and security headers/rate limiting. No domain knowledge, no database dependency.

## Installation

```bash
pnpm add @commonpub/infra
```

## Modules

### Storage (`./storage`)

File upload storage with two adapter implementations:

- **`LocalStorageAdapter`** -- writes files to disk (`./uploads/`). For development.
- **`S3StorageAdapter`** -- S3-compatible storage (AWS S3, DigitalOcean Spaces, MinIO, Cloudflare R2). For production.
- **`createStorageFromEnv()`** -- auto-selects adapter from environment variables.

```ts
import { createStorageFromEnv, validateUpload, generateStorageKey } from '@commonpub/infra';

const storage = createStorageFromEnv();
const key = generateStorageKey('photo.jpg', 'content');
const url = await storage.upload(key, buffer, 'image/jpeg');
```

Upload validation with MIME type whitelist and per-purpose size limits (avatar 2MB, banner 5MB, content 10MB, attachment 100MB).

### Image Processing (`./image`)

Automatic image resizing and WebP conversion using `sharp`:

- Generates 4 variants: thumb (150px), small (300px), medium (600px), large (1200px)
- Converts all variants to WebP at quality 80
- Skips variants larger than the original image
- `getBestVariant()` selects the smallest variant that fits a given display width

```ts
import { processImage, getBestVariant } from '@commonpub/infra';

const processed = await processImage(buffer, 'photo.jpg', 'content', storage);
const url = getBestVariant(processed, 600); // best variant for 600px display
```

### Email (`./email`)

Email sending with adapter pattern:

- **`SmtpEmailAdapter`** -- SMTP transport via nodemailer (optional dependency).
- **`ResendEmailAdapter`** -- Resend API for transactional email. For production.
- **`ConsoleEmailAdapter`** -- logs emails to console. For development.
- **`emailTemplates`** -- pre-built templates: verification, password reset, notification digest, contest announcement, certificate issued.

```ts
import { ConsoleEmailAdapter, emailTemplates } from '@commonpub/infra';

const email = new ConsoleEmailAdapter();
const msg = emailTemplates.verification('MySite', 'https://example.com/verify?token=abc');
await email.send({ ...msg, to: 'user@example.com' });
```

### Security (`./security`)

HTTP security headers and rate limiting:

- **CSP** -- `buildCspDirectives(nonce?)` and `buildCspHeader()` for Content-Security-Policy with optional nonce-based script/style sources.
- **Security headers** -- `getSecurityHeaders(isDev)` returns X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy, and HSTS (production only).
- **Rate limiting** -- `RateLimitStore` with in-memory sliding window, 6 default tiers (auth: 5/min, upload: 10/min, social: 30/min, federation: 60/min, api: 60/min, general: 120/min), and `checkRateLimit()` for framework-agnostic checking with response headers.

```ts
import { RateLimitStore, checkRateLimit, getSecurityHeaders } from '@commonpub/infra';

const store = new RateLimitStore();
const { result, headers } = checkRateLimit(store, clientIp, pathname);
```

## Environment Variables (Storage)

| Variable | Description | Default |
|----------|-------------|---------|
| `S3_BUCKET` | Bucket name (enables S3 mode) | -- |
| `S3_REGION` | Region | `us-east-1` |
| `S3_ENDPOINT` | Custom endpoint (DO Spaces, MinIO) | -- |
| `S3_ACCESS_KEY` | Access key ID | -- |
| `S3_SECRET_KEY` | Secret access key | -- |
| `S3_PUBLIC_URL` | Public URL prefix (auto-derived if unset) | -- |
| `S3_FORCE_PATH_STYLE` | Set `true` for MinIO | auto |
| `UPLOAD_DIR` | Local upload directory | `./uploads` |
| `SITE_URL` | Base URL for local uploads | `http://localhost:3000` |

## Dependencies

- `sharp` -- image resizing and WebP conversion
- `@aws-sdk/client-s3` -- S3-compatible object storage
- `nodemailer` -- optional, required only for `SmtpEmailAdapter`

## Development

```bash
pnpm build        # Compile TypeScript
pnpm typecheck    # Type-check without emitting
```
