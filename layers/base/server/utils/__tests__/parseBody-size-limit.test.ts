/**
 * Tests for the request-body size guard in `parseBody`.
 *
 * Every JSON write route funnels through `parseBody`, so its 1MB Content-Length
 * ceiling is the single chokepoint that stops a multi-MB payload from being
 * buffered + JSON-parsed (both synchronous, event-loop-blocking) at ingest —
 * the failure mode behind the "large HTML blob slowed the server" incident.
 *
 * `createError` / `getRequestHeader` / `readBody` are Nitro auto-imports
 * referenced as globals; we install stand-ins on globalThis (same approach as
 * contentQuery.test.ts / requirePermission.test.ts).
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import type { H3Event } from 'h3';
import type { ZodType } from 'zod';
import { parseBody } from '../validate';

let contentLength: string | undefined;
let body: unknown;
let rawBody: string | Buffer | undefined;

// A schema stub that accepts anything — keeps the test focused on the size guard
// (which throws *before* `safeParse` is reached on the oversize path) and avoids
// a hard zod dependency in the test.
const passThrough = { safeParse: (b: unknown) => ({ success: true as const, data: b }) } as unknown as ZodType<unknown>;
const fakeEvent = {} as H3Event;

beforeAll(() => {
  const g = globalThis as Record<string, unknown>;
  g.createError = (e: { statusCode: number; statusMessage?: string }): Error & { statusCode: number } => {
    const err = new Error(e.statusMessage ?? 'error') as Error & { statusCode: number };
    err.statusCode = e.statusCode;
    return err;
  };
  g.getRequestHeader = (_event: H3Event, name: string): string | undefined =>
    name === 'content-length' ? contentLength : undefined;
  g.readBody = async (_event: H3Event): Promise<unknown> => body;
  g.readRawBody = async (_event: H3Event): Promise<string | Buffer | undefined> => rawBody;
});

afterEach(() => {
  contentLength = undefined;
  body = undefined;
  rawBody = undefined;
});

describe('parseBody — request body size guard', () => {
  it('rejects a body whose Content-Length exceeds 10MB with 413', async () => {
    contentLength = String(10_000_001);
    await expect(parseBody(fakeEvent, passThrough)).rejects.toMatchObject({ statusCode: 413 });
  });

  it('accepts a body exactly at the 10MB boundary', async () => {
    contentLength = String(10_000_000);
    body = { ok: true };
    await expect(parseBody(fakeEvent, passThrough)).resolves.toEqual({ ok: true });
  });

  it('accepts a 1MB body (legitimate large content is not rejected)', async () => {
    contentLength = String(1_000_000);
    body = { ok: true };
    await expect(parseBody(fakeEvent, passThrough)).resolves.toEqual({ ok: true });
  });

  it('does not block when Content-Length is absent (chunked/unknown) and body is small', async () => {
    contentLength = undefined;
    rawBody = JSON.stringify({ ok: true });
    body = { ok: true };
    await expect(parseBody(fakeEvent, passThrough)).resolves.toEqual({ ok: true });
  });

  it('ignores a non-numeric Content-Length rather than rejecting', async () => {
    contentLength = 'not-a-number';
    rawBody = JSON.stringify({ ok: true });
    body = { ok: true };
    await expect(parseBody(fakeEvent, passThrough)).resolves.toEqual({ ok: true });
  });

  // The bypass: a chunked request omits Content-Length, so the header fast-path
  // passes; the cap must still be enforced on the ACTUAL buffered body size.
  it('rejects an oversize body when Content-Length is absent (string raw body)', async () => {
    contentLength = undefined;
    rawBody = 'x'.repeat(10_000_001);
    body = { ok: true };
    await expect(parseBody(fakeEvent, passThrough)).rejects.toMatchObject({ statusCode: 413 });
  });

  it('rejects an oversize body when Content-Length lies (smaller than actual)', async () => {
    contentLength = String(10); // attacker understates the size
    rawBody = Buffer.alloc(10_000_001);
    body = { ok: true };
    await expect(parseBody(fakeEvent, passThrough)).rejects.toMatchObject({ statusCode: 413 });
  });

  it('accepts a Buffer raw body at the 10MB boundary', async () => {
    contentLength = undefined;
    rawBody = Buffer.alloc(10_000_000);
    body = { ok: true };
    await expect(parseBody(fakeEvent, passThrough)).resolves.toEqual({ ok: true });
  });
});
