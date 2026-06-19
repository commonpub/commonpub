/**
 * Unit tests for useFileUpload — the shared `/api/files/upload` POST helper.
 *
 * Eight call sites used to copy-paste the same FormData build + $fetch POST.
 * These lock the behaviour the refactor must preserve:
 *   - POSTs to `/api/files/upload` with method POST and a FormData body
 *   - appends the blob under the `file` field, and `purpose` only when given
 *   - returns the parsed response (caller picks the shape via the generic)
 *   - lets errors propagate (no swallowing in the composable)
 *
 * $fetch is a Nuxt auto-import; we stub it on globalThis. Vue primitives come
 * from test-setup.ts.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useFileUpload } from '../useFileUpload';

const g = globalThis as Record<string, unknown>;

interface FetchCall {
  url: string;
  opts: { method?: string; body?: unknown };
}

let fetchCalls: FetchCall[];

beforeEach(() => {
  fetchCalls = [];
  g.$fetch = vi.fn((url: string, opts: { method?: string; body?: unknown }) => {
    fetchCalls.push({ url, opts });
    return Promise.resolve({ url: 'https://cdn.example.com/stored.jpg' });
  });
});

afterEach(() => {
  delete g.$fetch;
});

function makeFile(): File {
  return new File([new Blob(['x'])], 'pic.jpg', { type: 'image/jpeg' });
}

describe('useFileUpload', () => {
  it('POSTs FormData to /api/files/upload with the file and purpose fields', async () => {
    const { uploadFile } = useFileUpload();
    const file = makeFile();

    const result = await uploadFile(file, 'avatar');

    expect(fetchCalls).toHaveLength(1);
    const call = fetchCalls[0]!;
    expect(call.url).toBe('/api/files/upload');
    expect(call.opts.method).toBe('POST');

    const body = call.opts.body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect(body.get('file')).toBe(file);
    expect(body.get('purpose')).toBe('avatar');

    expect(result.url).toBe('https://cdn.example.com/stored.jpg');
  });

  it('omits the purpose field when no purpose is given', async () => {
    const { uploadFile } = useFileUpload();
    const file = makeFile();

    await uploadFile(file);

    const body = fetchCalls[0]!.opts.body as FormData;
    expect(body.get('file')).toBe(file);
    expect(body.has('purpose')).toBe(false);
  });

  it('returns the response typed by the caller via the generic', async () => {
    g.$fetch = vi.fn((url: string, opts: { method?: string; body?: unknown }) => {
      fetchCalls.push({ url, opts });
      return Promise.resolve({ url: 'https://cdn.example.com/a.png', originalName: 'a.png', sizeBytes: 2048, mimeType: 'image/png' });
    });
    const { uploadFile } = useFileUpload();

    const res = await uploadFile<{ url: string; originalName: string; sizeBytes: number; mimeType: string }>(makeFile(), 'content');

    expect(res.originalName).toBe('a.png');
    expect(res.sizeBytes).toBe(2048);
    expect(res.mimeType).toBe('image/png');
  });

  it('surfaces errors from $fetch to the caller', async () => {
    g.$fetch = vi.fn(() => Promise.reject(new Error('413 Payload Too Large')));
    const { uploadFile } = useFileUpload();

    await expect(uploadFile(makeFile(), 'cover')).rejects.toThrow('413 Payload Too Large');
  });
});
