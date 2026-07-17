import { createWriteStream } from 'node:fs';
import { mkdir, unlink } from 'node:fs/promises';
import { join, dirname, sep } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { randomUUID } from 'node:crypto';

/** A stored object's bytes + metadata, for streaming a PRIVATE file back through
 *  an authenticated serving route (P0). `contentType`/`contentLength` are
 *  best-effort — the serving route authoritatively sets Content-Type from the
 *  `files` row and MUST NOT trust these for security decisions. */
export interface StorageObject {
  body: Readable;
  contentType?: string;
  contentLength?: number;
}

/** Storage adapter interface for file uploads */
export interface StorageAdapter {
  /** Upload a PUBLIC file (public-read on S3; served by the open /uploads route
   *  locally). Returns the public URL. Unchanged historical behaviour. */
  upload(key: string, data: Buffer | Readable, mimeType: string): Promise<string>;
  /** Delete a public file by key */
  delete(key: string): Promise<void>;
  /** Get public URL for a stored file */
  getUrl(key: string): string;
  // --- Private storage (P0) — confidential bytes never exposed at a public URL ---
  /** Upload a PRIVATE file: `private` ACL on S3, or a separate non-served base
   *  dir locally. Returns nothing — a private object has NO public URL; it is
   *  reached only via the auth-gated serving route calling `getPrivateObject`. */
  uploadPrivate(key: string, data: Buffer | Readable, mimeType: string): Promise<void>;
  /** Stream a private object's bytes for an authenticated serving route. */
  getPrivateObject(key: string): Promise<StorageObject>;
  /** Delete a private file by key. */
  deletePrivate(key: string): Promise<void>;
}

/** Generate a unique storage key from original filename */
export function generateStorageKey(originalName: string, purpose: string): string {
  const rawExt = originalName.includes('.') ? originalName.split('.').pop() ?? '' : '';
  // Sanitize extension: only allow alphanumeric characters to prevent path traversal
  const ext = rawExt.replace(/[^a-zA-Z0-9]/g, '');
  const id = randomUUID();
  return `${purpose}/${id}${ext ? `.${ext}` : ''}`;
}

/** Local filesystem storage adapter — for development */
export class LocalStorageAdapter implements StorageAdapter {
  private basePath: string;
  private baseUrl: string;
  /** Base dir for PRIVATE files. MUST be OUTSIDE `basePath` so the open
   *  /uploads/<key> route (which streams anything under `basePath`) can never
   *  reach a private file. Defaults to a `-private` sibling of `basePath`. */
  private privateBasePath: string;

  constructor(basePath: string, baseUrl: string, privateBasePath?: string) {
    this.basePath = basePath;
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.privateBasePath = privateBasePath ?? `${basePath.replace(/\/$/, '')}-private`;
  }

  /** Resolve `base/key`, rejecting any key that would escape `base` (traversal).
   *  The boundary check appends a path separator so a SIBLING dir whose name has
   *  `base` as a string prefix (e.g. `<base>-private`) can't pass — matching the
   *  public /uploads route's guard. Without the trailing `sep`,
   *  `join('/x','../x-private/f')` = `/x-private/f` would `startsWith('/x')`. */
  private safePath(base: string, key: string): string {
    const filePath = join(base, key);
    const resolvedBase = join(base, '.');
    if (filePath !== resolvedBase && !filePath.startsWith(resolvedBase + sep)) {
      throw new Error('Invalid storage key: path traversal detected');
    }
    return filePath;
  }

  private async writeFile(filePath: string, data: Buffer | Readable): Promise<void> {
    await mkdir(dirname(filePath), { recursive: true });
    if (Buffer.isBuffer(data)) {
      const writeStream = createWriteStream(filePath);
      await new Promise<void>((resolve, reject) => {
        writeStream.write(data, (err) => {
          if (err) reject(err);
          else {
            writeStream.end();
            resolve();
          }
        });
      });
    } else {
      const writeStream = createWriteStream(filePath);
      await pipeline(data, writeStream);
    }
  }

  private async removeFile(filePath: string): Promise<void> {
    try {
      await unlink(filePath);
    } catch (err) {
      if ((err as { code?: string }).code !== 'ENOENT') throw err;
    }
  }

  async upload(key: string, data: Buffer | Readable, _mimeType: string): Promise<string> {
    await this.writeFile(this.safePath(this.basePath, key), data);
    return this.getUrl(key);
  }

  async delete(key: string): Promise<void> {
    await this.removeFile(this.safePath(this.basePath, key));
  }

  getUrl(key: string): string {
    return `${this.baseUrl}/uploads/${key}`;
  }

  async uploadPrivate(key: string, data: Buffer | Readable, _mimeType: string): Promise<void> {
    await this.writeFile(this.safePath(this.privateBasePath, key), data);
  }

  async getPrivateObject(key: string): Promise<StorageObject> {
    const { createReadStream } = await import('node:fs');
    const { stat } = await import('node:fs/promises');
    const filePath = this.safePath(this.privateBasePath, key);
    const stats = await stat(filePath); // throws ENOENT → surfaced as 404 by the route
    return { body: createReadStream(filePath), contentLength: stats.size };
  }

  async deletePrivate(key: string): Promise<void> {
    await this.removeFile(this.safePath(this.privateBasePath, key));
  }
}

/**
 * S3-compatible storage adapter — works with AWS S3, DigitalOcean Spaces, MinIO, R2.
 * Uses @aws-sdk/client-s3 for proper authentication.
 */
export class S3StorageAdapter implements StorageAdapter {
  private bucket: string;
  private publicUrl: string;
  private client: import('@aws-sdk/client-s3').S3Client | null = null;
  private config: {
    region: string;
    endpoint?: string;
    accessKeyId: string;
    secretAccessKey: string;
    forcePathStyle?: boolean;
  };

  constructor(config: {
    bucket: string;
    region: string;
    endpoint?: string;
    accessKeyId: string;
    secretAccessKey: string;
    publicUrl?: string;
    forcePathStyle?: boolean;
    /**
     * Serve assets through the DigitalOcean Spaces CDN edge. Only takes
     * effect when `publicUrl` is unset AND `endpoint` is a DO Spaces
     * endpoint — it rewrites the derived URL to the virtual-host
     * `<bucket>.<region>.cdn.digitaloceanspaces.com` form. Requires the
     * CDN to be enabled on the Space (DO console → Space → Settings).
     * No effect for MinIO/AWS or when an explicit `publicUrl` is given,
     * so existing instances are unaffected unless they opt in.
     */
    cdn?: boolean;
  }) {
    this.bucket = config.bucket;
    this.config = config;
    // Explicit publicUrl always wins. Otherwise derive:
    //   DO Spaces (endpoint `https://<region>.digitaloceanspaces.com`):
    //     origin → https://<bucket>.<region>.digitaloceanspaces.com
    //     cdn    → https://<bucket>.<region>.cdn.digitaloceanspaces.com
    //   MinIO / other S3-compatible (endpoint set): path-style endpoint/bucket
    //   AWS S3: https://<bucket>.s3.<region>.amazonaws.com
    this.publicUrl = config.publicUrl ?? S3StorageAdapter.derivePublicUrl(config);
  }

  private static derivePublicUrl(c: {
    bucket: string;
    region: string;
    endpoint?: string;
    cdn?: boolean;
  }): string {
    // Opt-in DO Spaces CDN: only diverges from the original derivation
    // when `cdn` is explicitly enabled and the endpoint is a DO Spaces
    // endpoint — every other case keeps byte-identical legacy behaviour
    // (strictly zero-regression for existing instances).
    if (c.cdn && c.endpoint) {
      const spaces = c.endpoint.match(
        /^https?:\/\/([a-z0-9-]+)\.digitaloceanspaces\.com\/?$/i,
      );
      if (spaces) {
        const region = c.region || spaces[1]!;
        return `https://${c.bucket}.${region}.cdn.digitaloceanspaces.com`;
      }
    }
    return c.endpoint
      ? `${c.endpoint}/${c.bucket}`
      : `https://${c.bucket}.s3.${c.region}.amazonaws.com`;
  }

  private async getClient(): Promise<import('@aws-sdk/client-s3').S3Client> {
    if (this.client) return this.client;

    const { S3Client } = await import('@aws-sdk/client-s3');
    this.client = new S3Client({
      region: this.config.region,
      endpoint: this.config.endpoint,
      credentials: {
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey,
      },
      forcePathStyle: this.config.forcePathStyle ?? !!this.config.endpoint,
    });
    return this.client;
  }

  private async toBuffer(data: Buffer | Readable): Promise<Buffer> {
    if (Buffer.isBuffer(data)) return data;
    const chunks: Buffer[] = [];
    for await (const chunk of data) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  async upload(key: string, data: Buffer | Readable, mimeType: string): Promise<string> {
    const body = await this.toBuffer(data);

    const { PutObjectCommand } = await import('@aws-sdk/client-s3');
    const client = await this.getClient();

    await client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: mimeType,
        ACL: 'public-read',
        // SVGs can carry inline <script>; served inline + same-origin they
        // execute as stored XSS. Force the browser to DOWNLOAD them instead
        // of rendering. Raster images stay inline (no disposition header).
        ...(mimeType === 'image/svg+xml' ? { ContentDisposition: 'attachment' } : {}),
      }),
    );

    return this.getUrl(key);
  }

  async delete(key: string): Promise<void> {
    const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
    const client = await this.getClient();

    await client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }

  getUrl(key: string): string {
    return `${this.publicUrl}/${key}`;
  }

  async uploadPrivate(key: string, data: Buffer | Readable, mimeType: string): Promise<void> {
    const body = await this.toBuffer(data);
    const { PutObjectCommand } = await import('@aws-sdk/client-s3');
    const client = await this.getClient();
    await client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: mimeType,
        // NOT public-read — the object is unreachable at its bucket URL; bytes
        // are streamed only through the auth-gated serving route.
        ACL: 'private',
        // Defence-in-depth for the (unlikely) case a private object is ever
        // fetched inline: SVGs download rather than execute.
        ...(mimeType === 'image/svg+xml' ? { ContentDisposition: 'attachment' } : {}),
      }),
    );
  }

  async getPrivateObject(key: string): Promise<StorageObject> {
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    const client = await this.getClient();
    const res = await client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    if (!res.Body) throw new Error('Empty object body');
    return {
      body: res.Body as Readable,
      contentType: res.ContentType,
      contentLength: res.ContentLength,
    };
  }

  async deletePrivate(key: string): Promise<void> {
    // Same bucket + DeleteObjectCommand — the ACL, not the key space, is what
    // makes a private object private, so deletion is identical to `delete`.
    await this.delete(key);
  }
}

/**
 * Create a storage adapter from environment variables.
 *
 * If S3_BUCKET is set, uses S3StorageAdapter (works with DO Spaces, MinIO, AWS S3).
 * Otherwise, uses LocalStorageAdapter writing to ./uploads/.
 *
 * Env vars:
 *   S3_BUCKET       — bucket name (required for S3 mode)
 *   S3_REGION       — region (default: us-east-1)
 *   S3_ENDPOINT     — custom endpoint (e.g. https://nyc3.digitaloceanspaces.com for DO Spaces,
 *                     http://localhost:9000 for MinIO)
 *   S3_ACCESS_KEY   — access key ID
 *   S3_SECRET_KEY   — secret access key
 *   S3_PUBLIC_URL   — public URL prefix (auto-derived if not set)
 *   S3_CDN          — "true" to serve via the DO Spaces CDN edge
 *                     (virtual-host <bucket>.<region>.cdn.digitaloceanspaces.com).
 *                     Only applies when S3_PUBLIC_URL is unset and the
 *                     endpoint is a DO Spaces endpoint; enable CDN on the
 *                     Space first. No effect otherwise.
 *   S3_FORCE_PATH_STYLE — set to "true" for MinIO (default: auto based on endpoint)
 *   UPLOAD_DIR      — local upload directory (default: ./uploads)
 *   SITE_URL        — base URL for local uploads (default: http://localhost:3000)
 */
export function createStorageFromEnv(): StorageAdapter {
  const bucket = process.env.S3_BUCKET;

  if (bucket) {
    const accessKeyId = process.env.S3_ACCESS_KEY;
    const secretAccessKey = process.env.S3_SECRET_KEY;
    if (!accessKeyId || !secretAccessKey) {
      // Fail fast at adapter init rather than producing opaque
      // `InvalidAccessKeyId` errors on every upload at request time.
      throw new Error(
        'S3_BUCKET is set but S3_ACCESS_KEY and/or S3_SECRET_KEY are missing. ' +
        'Set both, or unset S3_BUCKET to use the local filesystem adapter.',
      );
    }
    return new S3StorageAdapter({
      bucket,
      region: process.env.S3_REGION ?? 'us-east-1',
      endpoint: process.env.S3_ENDPOINT || undefined,
      accessKeyId,
      secretAccessKey,
      publicUrl: process.env.S3_PUBLIC_URL || undefined,
      cdn: process.env.S3_CDN === 'true',
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
    });
  }

  // Accept both the generic UPLOAD_DIR and the Nuxt-style NUXT_UPLOAD_DIR (which
  // the production compose sets) so the configured ABSOLUTE path takes effect —
  // never silently fall back to a CWD-relative './uploads' when a dir is set.
  const uploadDir = process.env.UPLOAD_DIR ?? process.env.NUXT_UPLOAD_DIR ?? './uploads';
  const siteUrl = process.env.SITE_URL ?? process.env.NUXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  // Private files live in a base dir OUTSIDE `uploadDir` (a `-private` sibling by
  // default, overridable via PRIVATE_UPLOAD_DIR) so the open /uploads route can
  // never stream them. In prod (S3 mode above) this path is unused — privacy is
  // the object ACL, not the key space.
  const privateUploadDir = process.env.PRIVATE_UPLOAD_DIR ?? process.env.NUXT_PRIVATE_UPLOAD_DIR;

  return new LocalStorageAdapter(uploadDir, siteUrl, privateUploadDir);
}

/** MIME type whitelist for uploads */
export const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

export const ALLOWED_MIME_TYPES = new Set([
  ...ALLOWED_IMAGE_TYPES,
  'image/svg+xml',
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/zip',
  'application/gzip',
]);

/** Max upload sizes by purpose */
export const MAX_UPLOAD_SIZES: Record<string, number> = {
  avatar: 2 * 1024 * 1024,     // 2MB
  banner: 5 * 1024 * 1024,     // 5MB
  cover: 10 * 1024 * 1024,     // 10MB
  content: 10 * 1024 * 1024,   // 10MB
  attachment: 100 * 1024 * 1024, // 100MB
  contest: 100 * 1024 * 1024,  // 100MB — private contest attachments (P0)
};

/** Validate file upload */
export function validateUpload(
  mimeType: string,
  sizeBytes: number,
  purpose: string,
): { valid: boolean; error?: string } {
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return { valid: false, error: `File type ${mimeType} is not allowed` };
  }

  const maxSize = MAX_UPLOAD_SIZES[purpose] ?? MAX_UPLOAD_SIZES['attachment'] ?? 100 * 1024 * 1024;
  if (sizeBytes > maxSize) {
    return { valid: false, error: `File size exceeds maximum of ${Math.round(maxSize / 1024 / 1024)}MB` };
  }

  return { valid: true };
}

/** Check if a MIME type is a processable image */
export function isProcessableImage(mimeType: string): boolean {
  return ALLOWED_IMAGE_TYPES.has(mimeType);
}
