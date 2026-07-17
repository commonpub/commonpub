import { describe, it, expect, afterEach, vi } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import {
  generateStorageKey,
  validateUpload,
  isProcessableImage,
  LocalStorageAdapter,
  S3StorageAdapter,
  createStorageFromEnv,
  ALLOWED_MIME_TYPES,
  ALLOWED_IMAGE_TYPES,
  MAX_UPLOAD_SIZES,
} from '../storage.js';

describe('generateStorageKey', () => {
  it('generates a key with purpose prefix and extension', () => {
    const key = generateStorageKey('photo.jpg', 'avatar');
    expect(key).toMatch(/^avatar\/[a-f0-9-]+\.jpg$/);
  });

  it('handles files without extension', () => {
    const key = generateStorageKey('README', 'content');
    expect(key).toMatch(/^content\/[a-f0-9-]+$/);
    expect(key).not.toContain('.');
  });

  it('generates unique keys for same filename', () => {
    const k1 = generateStorageKey('photo.png', 'avatar');
    const k2 = generateStorageKey('photo.png', 'avatar');
    expect(k1).not.toBe(k2);
  });

  it('sanitizes extension to prevent path traversal', () => {
    const key = generateStorageKey('file.../../etc/passwd', 'content');
    expect(key).not.toContain('..');
    expect(key).not.toContain('/etc');
    // Extension should be sanitized to alphanumeric only
    expect(key).toMatch(/^content\/[a-f0-9-]+(\.etcpasswd)?$/);
  });

  it('strips special characters from extension', () => {
    const key = generateStorageKey('file.t<x>t', 'content');
    expect(key).not.toContain('<');
    expect(key).not.toContain('>');
  });
});

describe('validateUpload', () => {
  it('accepts valid image upload', () => {
    const result = validateUpload('image/jpeg', 1024, 'avatar');
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('rejects disallowed MIME type', () => {
    const result = validateUpload('application/x-executable', 1024, 'content');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('not allowed');
  });

  it('rejects file exceeding size limit for purpose', () => {
    const result = validateUpload('image/png', 3 * 1024 * 1024, 'avatar'); // 3MB > 2MB limit
    expect(result.valid).toBe(false);
    expect(result.error).toContain('exceeds maximum');
  });

  it('accepts file within size limit', () => {
    const result = validateUpload('image/png', 1 * 1024 * 1024, 'avatar'); // 1MB < 2MB
    expect(result.valid).toBe(true);
  });

  it('accepts file at exactly the size limit', () => {
    const result = validateUpload('image/png', 2 * 1024 * 1024, 'avatar'); // exactly 2MB
    expect(result.valid).toBe(true);
  });

  it('rejects file at 1 byte over the limit', () => {
    const result = validateUpload('image/png', 2 * 1024 * 1024 + 1, 'avatar');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('2MB');
  });

  it('falls back to attachment limit for unknown purpose', () => {
    const result = validateUpload('application/pdf', 50 * 1024 * 1024, 'unknown-purpose');
    expect(result.valid).toBe(true);
  });

  it('accepts all allowed MIME types', () => {
    for (const mime of ALLOWED_MIME_TYPES) {
      const result = validateUpload(mime, 100, 'content');
      expect(result.valid).toBe(true);
    }
  });
});

describe('isProcessableImage', () => {
  it('returns true for processable image types', () => {
    expect(isProcessableImage('image/jpeg')).toBe(true);
    expect(isProcessableImage('image/png')).toBe(true);
    expect(isProcessableImage('image/gif')).toBe(true);
    expect(isProcessableImage('image/webp')).toBe(true);
  });

  it('returns false for non-image types', () => {
    expect(isProcessableImage('application/pdf')).toBe(false);
    expect(isProcessableImage('text/plain')).toBe(false);
    expect(isProcessableImage('image/svg+xml')).toBe(false);
  });
});

describe('ALLOWED_MIME_TYPES', () => {
  it('includes all image types', () => {
    for (const type of ALLOWED_IMAGE_TYPES) {
      expect(ALLOWED_MIME_TYPES.has(type)).toBe(true);
    }
  });

  it('includes document types', () => {
    expect(ALLOWED_MIME_TYPES.has('application/pdf')).toBe(true);
    expect(ALLOWED_MIME_TYPES.has('text/plain')).toBe(true);
    expect(ALLOWED_MIME_TYPES.has('text/markdown')).toBe(true);
  });

  it('includes svg, zip, gzip', () => {
    expect(ALLOWED_MIME_TYPES.has('image/svg+xml')).toBe(true);
    expect(ALLOWED_MIME_TYPES.has('application/zip')).toBe(true);
    expect(ALLOWED_MIME_TYPES.has('application/gzip')).toBe(true);
  });
});

describe('MAX_UPLOAD_SIZES', () => {
  it('has correct exact sizes in bytes', () => {
    expect(MAX_UPLOAD_SIZES['avatar']).toBe(2 * 1024 * 1024);
    expect(MAX_UPLOAD_SIZES['banner']).toBe(5 * 1024 * 1024);
    expect(MAX_UPLOAD_SIZES['cover']).toBe(10 * 1024 * 1024);
    expect(MAX_UPLOAD_SIZES['content']).toBe(10 * 1024 * 1024);
    expect(MAX_UPLOAD_SIZES['attachment']).toBe(100 * 1024 * 1024);
    expect(MAX_UPLOAD_SIZES['contest']).toBe(100 * 1024 * 1024);
  });

  it('avatar is smallest', () => {
    expect(MAX_UPLOAD_SIZES['avatar']).toBeLessThan(MAX_UPLOAD_SIZES['content']!);
  });

  it('attachment is largest', () => {
    expect(MAX_UPLOAD_SIZES['attachment']).toBeGreaterThan(MAX_UPLOAD_SIZES['content']!);
  });
});

describe('LocalStorageAdapter', () => {
  let tempDir: string;

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('uploads a buffer and returns URL', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'cpub-test-'));
    const adapter = new LocalStorageAdapter(tempDir, 'http://localhost:3000');

    const url = await adapter.upload('test/file.txt', Buffer.from('hello'), 'text/plain');
    expect(url).toBe('http://localhost:3000/uploads/test/file.txt');

    const content = await readFile(join(tempDir, 'test/file.txt'), 'utf-8');
    expect(content).toBe('hello');
  });

  it('deletes a file', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'cpub-test-'));
    const adapter = new LocalStorageAdapter(tempDir, 'http://localhost:3000');

    await adapter.upload('test/del.txt', Buffer.from('data'), 'text/plain');
    await adapter.delete('test/del.txt');

    await expect(readFile(join(tempDir, 'test/del.txt'))).rejects.toThrow();
  });

  it('ignores delete of non-existent file', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'cpub-test-'));
    const adapter = new LocalStorageAdapter(tempDir, 'http://localhost:3000');

    // Should not throw
    await adapter.delete('nonexistent/file.txt');
  });

  it('strips trailing slash from baseUrl', () => {
    const adapter = new LocalStorageAdapter('/tmp', 'http://localhost:3000/');
    expect(adapter.getUrl('test.txt')).toBe('http://localhost:3000/uploads/test.txt');
  });

  it('prevents path traversal on upload', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'cpub-test-'));
    const adapter = new LocalStorageAdapter(tempDir, 'http://localhost:3000');

    await expect(
      adapter.upload('../../../etc/passwd', Buffer.from('evil'), 'text/plain'),
    ).rejects.toThrow('path traversal');
  });

  it('prevents path traversal on delete', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'cpub-test-'));
    const adapter = new LocalStorageAdapter(tempDir, 'http://localhost:3000');

    await expect(adapter.delete('../../../etc/passwd')).rejects.toThrow('path traversal');
  });
});

describe('LocalStorageAdapter — private storage (P0)', () => {
  let tempDir: string;
  let privateDir: string;

  afterEach(async () => {
    if (tempDir) await rm(tempDir, { recursive: true, force: true });
    if (privateDir) await rm(privateDir, { recursive: true, force: true });
  });

  async function streamToString(body: NodeJS.ReadableStream): Promise<string> {
    const chunks: Buffer[] = [];
    for await (const c of body) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c as string));
    return Buffer.concat(chunks).toString('utf-8');
  }

  it('stores a private file OUTSIDE the public base dir and returns no URL', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'cpub-pub-'));
    privateDir = await mkdtemp(join(tmpdir(), 'cpub-priv-'));
    const adapter = new LocalStorageAdapter(tempDir, 'http://localhost:3000', privateDir);

    const ret = await adapter.uploadPrivate('contest/secret.pdf', Buffer.from('legal-doc'), 'application/pdf');
    expect(ret).toBeUndefined(); // no public URL for a private object

    // The bytes land in the PRIVATE dir, never the publicly-served base dir.
    expect(await readFile(join(privateDir, 'contest/secret.pdf'), 'utf-8')).toBe('legal-doc');
    await expect(readFile(join(tempDir, 'contest/secret.pdf'))).rejects.toThrow();
  });

  it('defaults the private base to a `-private` sibling outside the public base', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'cpub-pub-'));
    const adapter = new LocalStorageAdapter(tempDir, 'http://localhost:3000'); // no explicit private dir
    privateDir = `${tempDir}-private`;

    await adapter.uploadPrivate('contest/a.txt', Buffer.from('x'), 'text/plain');
    // Sibling dir, so the /uploads route (rooted at tempDir) can never reach it.
    expect(privateDir.startsWith(tempDir + '/')).toBe(false);
    expect(await readFile(join(privateDir, 'contest/a.txt'), 'utf-8')).toBe('x');
  });

  it('streams a private object back with its byte length', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'cpub-pub-'));
    privateDir = await mkdtemp(join(tmpdir(), 'cpub-priv-'));
    const adapter = new LocalStorageAdapter(tempDir, 'http://localhost:3000', privateDir);

    await adapter.uploadPrivate('contest/note.txt', Buffer.from('hello-private'), 'text/plain');
    const obj = await adapter.getPrivateObject('contest/note.txt');
    expect(obj.contentLength).toBe('hello-private'.length);
    expect(await streamToString(obj.body)).toBe('hello-private');
  });

  it('deletePrivate removes the private file; getPrivateObject then rejects (→ 404)', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'cpub-pub-'));
    privateDir = await mkdtemp(join(tmpdir(), 'cpub-priv-'));
    const adapter = new LocalStorageAdapter(tempDir, 'http://localhost:3000', privateDir);

    await adapter.uploadPrivate('contest/gone.txt', Buffer.from('bye'), 'text/plain');
    await adapter.deletePrivate('contest/gone.txt');
    await expect(adapter.getPrivateObject('contest/gone.txt')).rejects.toThrow();
  });

  it('enforces the traversal guard on every private method', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'cpub-pub-'));
    privateDir = await mkdtemp(join(tmpdir(), 'cpub-priv-'));
    const adapter = new LocalStorageAdapter(tempDir, 'http://localhost:3000', privateDir);

    await expect(adapter.uploadPrivate('../../etc/passwd', Buffer.from('e'), 'text/plain')).rejects.toThrow('path traversal');
    await expect(adapter.getPrivateObject('../../etc/passwd')).rejects.toThrow('path traversal');
    await expect(adapter.deletePrivate('../../etc/passwd')).rejects.toThrow('path traversal');
  });

  it('throws at construction if the private dir is nested inside the public dir (leak foot-gun)', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'cpub-pub-'));
    // PRIVATE_UPLOAD_DIR nested inside UPLOAD_DIR would let the open /uploads route
    // stream private bytes — the constructor must reject it.
    expect(() => new LocalStorageAdapter(tempDir, 'http://localhost:3000', join(tempDir, 'private'))).toThrow(/must not be equal to or nested within/);
    // Equal dirs are rejected too.
    expect(() => new LocalStorageAdapter(tempDir, 'http://localhost:3000', tempDir)).toThrow(/must not be equal to or nested within/);
    // A genuine sibling is accepted.
    privateDir = `${tempDir}-ok`;
    expect(() => new LocalStorageAdapter(tempDir, 'http://localhost:3000', privateDir)).not.toThrow();
  });

  it('rejects a sibling-prefix escape (../<base>-private) — trailing-separator boundary', async () => {
    // The public base is `<x>` and the private base defaults to `<x>-private`, a
    // sibling whose name has the base as a literal string prefix. A guard using a
    // bare startsWith(base) (no trailing sep) would let '../<base>-private/...'
    // through. Assert the public adapter cannot reach the private sibling tree.
    tempDir = await mkdtemp(join(tmpdir(), 'cpub-pub-'));
    const pub = new LocalStorageAdapter(tempDir, 'http://localhost:3000');
    privateDir = `${tempDir}-private`;
    const sibling = `../${tempDir.split('/').pop()}-private/leak.txt`;
    await expect(pub.upload(sibling, Buffer.from('x'), 'text/plain')).rejects.toThrow('path traversal');
    await expect(pub.delete(sibling)).rejects.toThrow('path traversal');
  });
});

describe('createStorageFromEnv', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns LocalStorageAdapter when S3_BUCKET is not set', () => {
    delete process.env.S3_BUCKET;
    const adapter = createStorageFromEnv();
    expect(adapter).toBeInstanceOf(LocalStorageAdapter);
  });

  it('returns S3StorageAdapter when S3_BUCKET is set', () => {
    process.env.S3_BUCKET = 'test-bucket';
    process.env.S3_REGION = 'us-west-2';
    process.env.S3_ACCESS_KEY = 'key';
    process.env.S3_SECRET_KEY = 'secret';
    const adapter = createStorageFromEnv();
    expect(adapter.getUrl('test.jpg')).toContain('test-bucket');
  });

  it('uses UPLOAD_DIR and SITE_URL env vars for local storage', () => {
    delete process.env.S3_BUCKET;
    process.env.UPLOAD_DIR = '/custom/uploads';
    process.env.SITE_URL = 'https://example.com';
    const adapter = createStorageFromEnv();
    expect(adapter.getUrl('file.txt')).toContain('https://example.com');
  });

  it('honors NUXT_UPLOAD_DIR for the local WRITE path (the production compose sets this)', async () => {
    // Regression: the prod compose set NUXT_UPLOAD_DIR but the adapter only read
    // UPLOAD_DIR, so it silently wrote to a CWD-relative ./uploads instead of the
    // configured (volume-mounted) dir — the EACCES upload 500.
    delete process.env.S3_BUCKET;
    delete process.env.UPLOAD_DIR;
    const dir = await mkdtemp(join(tmpdir(), 'cpub-nuxt-upload-'));
    process.env.NUXT_UPLOAD_DIR = dir;
    try {
      const adapter = createStorageFromEnv();
      await adapter.upload('content/probe.txt', Buffer.from('hello'), 'text/plain');
      expect(await readFile(join(dir, 'content/probe.txt'), 'utf8')).toBe('hello');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('prefers UPLOAD_DIR over NUXT_UPLOAD_DIR when both are set', async () => {
    delete process.env.S3_BUCKET;
    const dir = await mkdtemp(join(tmpdir(), 'cpub-upload-pref-'));
    process.env.UPLOAD_DIR = dir;
    process.env.NUXT_UPLOAD_DIR = '/should/not/be/used';
    try {
      const adapter = createStorageFromEnv();
      await adapter.upload('x.txt', Buffer.from('hi'), 'text/plain');
      expect(await readFile(join(dir, 'x.txt'), 'utf8')).toBe('hi');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('falls back to defaults when no env vars set', () => {
    delete process.env.S3_BUCKET;
    delete process.env.UPLOAD_DIR;
    delete process.env.SITE_URL;
    delete process.env.NUXT_PUBLIC_SITE_URL;
    const adapter = createStorageFromEnv();
    expect(adapter.getUrl('file.txt')).toContain('localhost:3000');
  });

  it('respects S3_FORCE_PATH_STYLE env var', () => {
    process.env.S3_BUCKET = 'bucket';
    process.env.S3_ACCESS_KEY = 'key';
    process.env.S3_SECRET_KEY = 'secret';
    process.env.S3_FORCE_PATH_STYLE = 'true';
    const adapter = createStorageFromEnv();
    // Just verify it creates without error
    expect(adapter).toBeDefined();
  });

  it('throws if S3_BUCKET is set but credentials are missing', () => {
    process.env.S3_BUCKET = 'bucket';
    delete process.env.S3_ACCESS_KEY;
    delete process.env.S3_SECRET_KEY;
    expect(() => createStorageFromEnv()).toThrow(/S3_BUCKET is set but/);
  });
});

describe('S3StorageAdapter upload Content-Disposition (SVG XSS hardening)', () => {
  const creds = { accessKeyId: 'k', secretAccessKey: 's' };

  /**
   * Mock @aws-sdk/client-s3 so PutObjectCommand records its input and the
   * S3Client merely captures sent commands. Returns the captured PutObject
   * inputs so each test can assert on the params the adapter built.
   */
  function mockS3() {
    const putInputs: Array<Record<string, unknown>> = [];
    vi.doMock('@aws-sdk/client-s3', () => {
      class PutObjectCommand {
        input: Record<string, unknown>;
        constructor(input: Record<string, unknown>) {
          this.input = input;
        }
      }
      class S3Client {
        async send(cmd: { input: Record<string, unknown> }): Promise<void> {
          putInputs.push(cmd.input);
        }
      }
      return { S3Client, PutObjectCommand, DeleteObjectCommand: class {} };
    });
    return putInputs;
  }

  afterEach(() => {
    vi.resetModules();
    vi.doUnmock('@aws-sdk/client-s3');
  });

  it('sets ContentDisposition: attachment for image/svg+xml uploads', async () => {
    const putInputs = mockS3();
    const { S3StorageAdapter: Adapter } = await import('../storage.js');
    const adapter = new Adapter({ bucket: 'b', region: 'us-east-1', ...creds });

    await adapter.upload('content/x.svg', Buffer.from('<svg/>'), 'image/svg+xml');

    expect(putInputs).toHaveLength(1);
    expect(putInputs[0]).toMatchObject({
      ContentType: 'image/svg+xml',
      ContentDisposition: 'attachment',
      ACL: 'public-read',
    });
  });

  it('does NOT set ContentDisposition for raster images (served inline)', async () => {
    const putInputs = mockS3();
    const { S3StorageAdapter: Adapter } = await import('../storage.js');
    const adapter = new Adapter({ bucket: 'b', region: 'us-east-1', ...creds });

    await adapter.upload('content/x.png', Buffer.from('binary'), 'image/png');

    expect(putInputs).toHaveLength(1);
    expect(putInputs[0]).toMatchObject({ ContentType: 'image/png' });
    expect(putInputs[0]).not.toHaveProperty('ContentDisposition');
  });
});

describe('S3StorageAdapter — private storage (P0)', () => {
  const creds = { accessKeyId: 'k', secretAccessKey: 's' };

  /** Mock @aws-sdk/client-s3 tagging each command so send() can route put/get/delete
   *  and return a canned GetObject body. Captures the inputs for assertions. */
  function mockS3Full(getResponse: Record<string, unknown>) {
    const put: Array<Record<string, unknown>> = [];
    const get: Array<Record<string, unknown>> = [];
    const del: Array<Record<string, unknown>> = [];
    vi.doMock('@aws-sdk/client-s3', () => {
      class PutObjectCommand { input: Record<string, unknown>; type = 'put'; constructor(i: Record<string, unknown>) { this.input = i; } }
      class GetObjectCommand { input: Record<string, unknown>; type = 'get'; constructor(i: Record<string, unknown>) { this.input = i; } }
      class DeleteObjectCommand { input: Record<string, unknown>; type = 'del'; constructor(i: Record<string, unknown>) { this.input = i; } }
      class S3Client {
        async send(cmd: { type: string; input: Record<string, unknown> }): Promise<unknown> {
          if (cmd.type === 'put') { put.push(cmd.input); return {}; }
          if (cmd.type === 'get') { get.push(cmd.input); return getResponse; }
          del.push(cmd.input); return {};
        }
      }
      return { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand };
    });
    return { put, get, del };
  }

  afterEach(() => {
    vi.resetModules();
    vi.doUnmock('@aws-sdk/client-s3');
  });

  it('uploadPrivate sends ACL:private (never public-read) — the prod confidentiality boundary', async () => {
    const { put } = mockS3Full({});
    const { S3StorageAdapter: Adapter } = await import('../storage.js');
    const adapter = new Adapter({ bucket: 'b', region: 'us-east-1', ...creds });

    await adapter.uploadPrivate('contest/doc.pdf', Buffer.from('legal'), 'application/pdf');

    expect(put).toHaveLength(1);
    expect(put[0]).toMatchObject({ Key: 'contest/doc.pdf', ContentType: 'application/pdf', ACL: 'private' });
    expect(put[0]!['ACL']).not.toBe('public-read');
  });

  it('uploadPrivate keeps the SVG attachment guard AND stays private', async () => {
    const { put } = mockS3Full({});
    const { S3StorageAdapter: Adapter } = await import('../storage.js');
    const adapter = new Adapter({ bucket: 'b', region: 'us-east-1', ...creds });

    await adapter.uploadPrivate('contest/sig.svg', Buffer.from('<svg/>'), 'image/svg+xml');

    expect(put[0]).toMatchObject({ ACL: 'private', ContentDisposition: 'attachment' });
  });

  it('getPrivateObject issues GetObjectCommand and returns body + metadata', async () => {
    const body = Readable.from([Buffer.from('secret-bytes')]);
    const { get } = mockS3Full({ Body: body, ContentType: 'application/pdf', ContentLength: 12 });
    const { S3StorageAdapter: Adapter } = await import('../storage.js');
    const adapter = new Adapter({ bucket: 'b', region: 'us-east-1', ...creds });

    const obj = await adapter.getPrivateObject('contest/doc.pdf');

    expect(get).toHaveLength(1);
    expect(get[0]).toMatchObject({ Bucket: 'b', Key: 'contest/doc.pdf' });
    expect(obj.contentType).toBe('application/pdf');
    expect(obj.contentLength).toBe(12);
    expect(obj.body).toBe(body);
  });

  it('getPrivateObject throws when the object body is empty', async () => {
    mockS3Full({ Body: undefined });
    const { S3StorageAdapter: Adapter } = await import('../storage.js');
    const adapter = new Adapter({ bucket: 'b', region: 'us-east-1', ...creds });

    await expect(adapter.getPrivateObject('contest/missing.pdf')).rejects.toThrow(/empty object body/i);
  });

  it('deletePrivate issues DeleteObjectCommand for the key', async () => {
    const { del } = mockS3Full({});
    const { S3StorageAdapter: Adapter } = await import('../storage.js');
    const adapter = new Adapter({ bucket: 'b', region: 'us-east-1', ...creds });

    await adapter.deletePrivate('contest/gone.pdf');

    expect(del).toHaveLength(1);
    expect(del[0]).toMatchObject({ Bucket: 'b', Key: 'contest/gone.pdf' });
  });
});

describe('S3StorageAdapter public URL derivation', () => {
  const creds = { accessKeyId: 'k', secretAccessKey: 's' };

  it('explicit publicUrl always wins (existing instances unaffected)', () => {
    const a = new S3StorageAdapter({
      bucket: 'b', region: 'nyc3',
      endpoint: 'https://nyc3.digitaloceanspaces.com',
      publicUrl: 'https://b.nyc3.cdn.digitaloceanspaces.com',
      cdn: false, ...creds,
    });
    expect(a.getUrl('cover/x.png')).toBe('https://b.nyc3.cdn.digitaloceanspaces.com/cover/x.png');
  });

  it('DO Spaces + cdn=true derives the CDN virtual-host URL', () => {
    const a = new S3StorageAdapter({
      bucket: 'heatsynclabs-uploads', region: 'nyc3',
      endpoint: 'https://nyc3.digitaloceanspaces.com', cdn: true, ...creds,
    });
    expect(a.getUrl('cover/x.png')).toBe(
      'https://heatsynclabs-uploads.nyc3.cdn.digitaloceanspaces.com/cover/x.png',
    );
  });

  it('DO Spaces + cdn=false keeps byte-identical legacy path-style (zero-regression)', () => {
    const a = new S3StorageAdapter({
      bucket: 'b', region: 'nyc3',
      endpoint: 'https://nyc3.digitaloceanspaces.com', cdn: false, ...creds,
    });
    expect(a.getUrl('k')).toBe('https://nyc3.digitaloceanspaces.com/b/k');
  });

  it('MinIO endpoint unchanged even with cdn=true (DO-only)', () => {
    const a = new S3StorageAdapter({
      bucket: 'b', region: 'us-east-1',
      endpoint: 'http://localhost:9000', cdn: true, ...creds,
    });
    expect(a.getUrl('k')).toBe('http://localhost:9000/b/k');
  });

  it('AWS (no endpoint) unchanged', () => {
    const a = new S3StorageAdapter({ bucket: 'b', region: 'us-west-2', cdn: true, ...creds });
    expect(a.getUrl('k')).toBe('https://b.s3.us-west-2.amazonaws.com/k');
  });
});
