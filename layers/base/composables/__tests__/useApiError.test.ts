/**
 * Tests for `useApiError().extract` — the single place every surface turns a
 * failed request into text a user reads.
 *
 * This composable had NO tests, and that is exactly how session 251's bug
 * shipped: the server attaches per-field Zod errors, but h3 nests
 * `createError({ data })` under a `data` key of the response BODY and ofetch
 * sets `FetchError.data` to that whole body — so the field map arrives at
 * `err.data.data.errors`. `extract` read the shallow `err.data.errors`, which is
 * always undefined, and fell through to the bare statusMessage. Every validation
 * failure in the app therefore read "Validation failed" with no field name.
 *
 * These tests are written against the REAL wire shapes (copied from live
 * responses), not against what the code happens to do.
 */
import { describe, it, expect } from 'vitest';
import { useApiError } from '../useApiError';

const { extract } = useApiError();

/** The exact body Nitro's prod error handler serialises for a route that throws
 *  `createError({ statusCode, statusMessage, data })`, wrapped the way ofetch
 *  delivers it (FetchError.data === the whole body). Verified against a live
 *  instance: `curl 'https://deveco.io/api/contests?limit=abc'`. */
function fetchError(body: Record<string, unknown>, statusCode = 400): unknown {
  return { statusCode, message: String(body.statusMessage ?? ''), data: body };
}

describe('useApiError — field-level validation errors', () => {
  it('surfaces the FIELD from h3\'s real nesting (the session-251 regression)', () => {
    const err = fetchError({
      error: true,
      url: '/api/content',
      statusCode: 400,
      statusMessage: 'Validation failed',
      message: 'Validation failed',
      data: { errors: { description: ['Too big: expected string to have <=2000 characters'] } },
    });
    const msg = extract(err);
    expect(msg).toContain('description');
    expect(msg).toContain('Too big');
    // The whole point: the author must NOT be left with the bare status line.
    expect(msg).not.toBe('Validation failed');
  });

  it('joins several failing fields so nothing is hidden', () => {
    const err = fetchError({
      statusCode: 400,
      statusMessage: 'Validation failed',
      data: { errors: { coverImageUrl: ['Invalid URL', 'Must be an http:// or https:// URL'], tags: ['Too big'] } },
    });
    const msg = extract(err);
    expect(msg).toContain('coverImageUrl: Invalid URL, Must be an http:// or https:// URL');
    expect(msg).toContain('tags: Too big');
  });

  it('still reads an already-unwrapped payload (caller hands us the inner object)', () => {
    const err = { statusCode: 400, data: { errors: { title: ['Required'] } } };
    expect(extract(err)).toBe('title: Required');
  });

  it('falls back to the status message when the error map is empty or absent', () => {
    expect(extract(fetchError({ statusCode: 400, statusMessage: 'Validation failed', data: { errors: {} } })))
      .toBe('Validation failed');
    expect(extract(fetchError({ statusCode: 403, statusMessage: 'Register for this contest before submitting an entry.' })))
      .toBe('Register for this contest before submitting an entry.');
  });

  it('does not crash on malformed error maps', () => {
    // A non-array value would have thrown on `.join` before the guard.
    expect(() => extract(fetchError({ statusCode: 400, data: { errors: { f: 'oops' as unknown as string[] } } }))).not.toThrow();
    expect(extract(fetchError({ statusCode: 400, data: { errors: { f: 'oops' as unknown as string[] } } }))).toContain('f: oops');
  });
});

describe('useApiError — non-validation failures', () => {
  it('prefers a server-supplied message over a status-code guess', () => {
    expect(extract(fetchError({ statusCode: 400, statusMessage: 'That project isn’t published yet.' })))
      .toBe('That project isn’t published yet.');
    expect(extract({ statusCode: 403, data: { message: 'Not the entry owner' } })).toBe('Not the entry owner');
  });

  it('maps bare status codes to something a user can act on', () => {
    expect(extract({ statusCode: 401 })).toMatch(/log in/i);
    expect(extract({ statusCode: 403 })).toMatch(/permission/i);
    expect(extract({ statusCode: 404 })).toMatch(/not found/i);
    expect(extract({ statusCode: 429 })).toMatch(/too many/i);
    expect(extract({ statusCode: 500 })).toMatch(/server error/i);
  });

  it('never returns an empty string, whatever it is handed', () => {
    for (const junk of [undefined, null, {}, 'a string', 0, [], new Error('boom')]) {
      const out = extract(junk);
      expect(typeof out).toBe('string');
      expect(out.length).toBeGreaterThan(0);
    }
    expect(extract(new Error('boom'))).toBe('boom');
    expect(extract({})).toMatch(/something went wrong/i);
  });
});
