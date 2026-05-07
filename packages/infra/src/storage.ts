import { createWriteStream } from 'node:fs';
import { mkdir, unlink } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { randomUUID } from 'node:crypto';

/** Storage adapter interface for file uploads */
export interface StorageAdapter {
  /** Upload a file, returns the public URL */
  upload(key: string, data: Buffer | Readable, mimeType: string): Promise<string>;
  /** Delete a file by key */
  delete(key: string): Promise<void>;
  /** Get public URL for a stored file */
  getUrl(key: string): string;
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

  constructor(basePath: string, baseUrl: string) {
    this.basePath = basePath;
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async upload(key: string, data: Buffer | Readable, _mimeType: string): Promise<string> {
    const filePath = join(this.basePath, key);
    // Guard against path traversal — resolved path must be within basePath
    const resolvedBase = join(this.basePath, '.');
    const resolvedFile = join(filePath, '.');
    if (!resolvedFile.startsWith(resolvedBase)) {
      throw new Error('Invalid storage key: path traversal detected');
    }
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

    return this.getUrl(key);
  }

  async delete(key: string): Promise<void> {
    const filePath = join(this.basePath, key);
    const resolvedBase = join(this.basePath, '.');
    const resolvedFile = join(filePath, '.');
    if (!resolvedFile.startsWith(resolvedBase)) {
      throw new Error('Invalid storage key: path traversal detected');
    }
    try {
      await unlink(filePath);
    } catch (err) {
      if ((err as { code?: string }).code !== 'ENOENT') throw err;
    }
  }

  getUrl(key: string): string {
    return `${this.baseUrl}/uploads/${key}`;
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
  }) {
    this.bucket = config.bucket;
    this.config = config;
    // DO Spaces: https://<bucket>.<region>.digitaloceanspaces.com
    // MinIO: use the endpoint directly
    // AWS S3: https://<bucket>.s3.<region>.amazonaws.com
    this.publicUrl = config.publicUrl
      ?? (config.endpoint
        ? `${config.endpoint}/${config.bucket}`
        : `https://${config.bucket}.s3.${config.region}.amazonaws.com`);
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

  async upload(key: string, data: Buffer | Readable, mimeType: string): Promise<string> {
    let body: Buffer;
    if (Buffer.isBuffer(data)) {
      body = data;
    } else {
      const chunks: Buffer[] = [];
      for await (const chunk of data) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      body = Buffer.concat(chunks);
    }

    const { PutObjectCommand } = await import('@aws-sdk/client-s3');
    const client = await this.getClient();

    await client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: mimeType,
        ACL: 'public-read',
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
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
    });
  }

  const uploadDir = process.env.UPLOAD_DIR ?? './uploads';
  const siteUrl = process.env.SITE_URL ?? process.env.NUXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

  return new LocalStorageAdapter(uploadDir, siteUrl);
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
