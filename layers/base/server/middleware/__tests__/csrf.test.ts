/**
 * Unit tests for the cookie-CSRF middleware in `server/middleware/csrf.ts`
 * (audit session 204).
 *
 * The middleware is a pure `defineEventHandler` that decides purely from the
 * request method, path, the presence of a Better Auth session cookie, and the
 * Origin/Referer host vs the request host. It uses Nitro/h3 auto-imports
 * (`defineEventHandler`, `getRequestURL`, `getCookie`, `getRequestHeader`,
 * `createError`) as globals — we install stand-ins on `globalThis` that read
 * from per-test request state, exactly like inbox.test.ts.
 *
 * `getBetterAuthSessionCookieName` is the REAL helper (pure), so the cookie
 * names the middleware checks line up with the names we set in the fixture.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import type { H3Event } from 'h3';

interface HttpError extends Error {
  statusCode: number;
  statusMessage: string;
}

// Per-request state the global stand-ins read from.
let reqMethod: string;
let reqUrl: string;
let cookies: Record<string, string>;
let reqHeaders: Record<string, string>;

// Install the h3/Nitro auto-imports as globals BEFORE importing the middleware,
// since `defineEventHandler` is evaluated at module-eval time of csrf.ts.
{
  const g = globalThis as Record<string, unknown>;
  g.defineEventHandler = (fn: unknown): unknown => fn;
  g.createError = (opts: { statusCode: number; statusMessage: string }): HttpError => {
    const e = new Error(opts.statusMessage) as HttpError;
    e.statusCode = opts.statusCode;
    e.statusMessage = opts.statusMessage;
    return e;
  };
  // event.method is read directly; getRequestURL/getCookie/getRequestHeader are auto-imports.
  g.getRequestURL = (_event: H3Event): URL => new URL(reqUrl);
  g.getCookie = (_event: H3Event, name: string): string | undefined => cookies[name];
  g.getRequestHeader = (_event: H3Event, name: string): string | undefined =>
    reqHeaders[name.toLowerCase()];
}

const handlerMod = await import('../csrf');
const handler = handlerMod.default as (event: H3Event) => void;

const SESSION_COOKIE = 'better-auth.session_token';
const APP_ORIGIN = 'https://app.example';

/** Build a mock h3 event whose `.method` is read directly by the middleware. */
function makeEvent(method: string): H3Event {
  reqMethod = method.toUpperCase();
  return { method: reqMethod } as unknown as H3Event;
}

/** Invoke the handler; return the thrown HttpError or null if it passed. */
function run(event: H3Event): HttpError | null {
  try {
    handler(event);
    return null;
  } catch (e) {
    return e as HttpError;
  }
}

beforeEach(() => {
  reqUrl = `${APP_ORIGIN}/api/content/x`;
  cookies = {};
  reqHeaders = {};
});

describe('csrf middleware — cookie-authenticated unsafe requests', () => {
  it('(a) THROWS 403 on POST to /api/content/x with session cookie + cross-origin Origin', () => {
    cookies[SESSION_COOKIE] = 'tok.sig';
    reqHeaders.origin = 'https://attacker.example';
    const err = run(makeEvent('POST'));
    expect(err).not.toBeNull();
    expect(err?.statusCode).toBe(403);
    expect(err?.statusMessage).toMatch(/CSRF/i);
  });

  it('(b) PASSES on POST with session cookie + matching same-origin Origin', () => {
    cookies[SESSION_COOKIE] = 'tok.sig';
    reqHeaders.origin = APP_ORIGIN;
    expect(run(makeEvent('POST'))).toBeNull();
  });

  it('(c) PASSES when no session cookie is present (not cookie-CSRF-able)', () => {
    reqHeaders.origin = 'https://attacker.example'; // cross-origin, but no cookie
    expect(run(makeEvent('POST'))).toBeNull();
  });

  it('(d) PASSES on safe method GET regardless of origin/cookie', () => {
    cookies[SESSION_COOKIE] = 'tok.sig';
    reqHeaders.origin = 'https://attacker.example';
    expect(run(makeEvent('GET'))).toBeNull();
  });

  it('(e) PASSES on /api/auth/* (Better Auth owns its own CSRF)', () => {
    reqUrl = `${APP_ORIGIN}/api/auth/sign-in`;
    cookies[SESSION_COOKIE] = 'tok.sig';
    reqHeaders.origin = 'https://attacker.example';
    expect(run(makeEvent('POST'))).toBeNull();
  });

  it('(f) PASSES on /api/public/* (bearer-token, no cookie reliance)', () => {
    reqUrl = `${APP_ORIGIN}/api/public/content`;
    cookies[SESSION_COOKIE] = 'tok.sig';
    reqHeaders.origin = 'https://attacker.example';
    expect(run(makeEvent('POST'))).toBeNull();
  });

  it('also recognizes the __Secure- prefixed cookie name (prod) and enforces origin', () => {
    cookies['__Secure-better-auth.session_token'] = 'tok.sig';
    reqHeaders.origin = 'https://attacker.example';
    expect(run(makeEvent('POST'))?.statusCode).toBe(403);
  });

  it('falls back to Referer host when Origin is absent (cross-site → 403)', () => {
    cookies[SESSION_COOKIE] = 'tok.sig';
    reqHeaders.referer = 'https://attacker.example/page';
    expect(run(makeEvent('POST'))?.statusCode).toBe(403);
  });

  it('rejects a cookie-auth unsafe request with NO Origin AND NO Referer (cannot prove same-origin)', () => {
    cookies[SESSION_COOKIE] = 'tok.sig';
    expect(run(makeEvent('POST'))?.statusCode).toBe(403);
  });
});
