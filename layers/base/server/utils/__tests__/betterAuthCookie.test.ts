/**
 * Federation-hardening Item 8 — Better Auth signed-cookie helper.
 *
 * Pins the cookie shape against the vendored Better Auth 1.6.4 /
 * better-call 1.3.5 spec. Three things must hold for `getSignedCookie`
 * (which `auth.api.getSession` calls under the hood) to read our cookie:
 *
 *   1. Cookie NAME: `__Secure-better-auth.session_token` when
 *      `NODE_ENV === 'production'` (matches `isProduction` in
 *      `better-auth/cookies/index.mjs:20`); plain
 *      `better-auth.session_token` otherwise.
 *
 *   2. Cookie VALUE format: `${token}.${signature}` then
 *      `encodeURIComponent`. Signature is `base64(HMAC-SHA256(secret, token))`
 *      with `=` padding (matches `better-call/dist/crypto.mjs:22-32`).
 *      Length-44-and-ends-with-`=` is enforced at verify time
 *      (`context.mjs:48`).
 *
 *   3. HMAC ROUND-TRIP: a cookie our helper produces must verify under
 *      the same WebCrypto HMAC-SHA256 the better-call verifier uses.
 *      Node's `createHmac('sha256', secret).digest('base64')` is
 *      byte-identical to better-call's `btoa(String.fromCharCode(...bytes))`
 *      output, so we can verify with WebCrypto directly.
 */
import { describe, it, expect } from 'vitest';
import { webcrypto } from 'node:crypto';
import {
  getBetterAuthSessionCookieName,
  getBetterAuthSessionDataCookieName,
  signBetterAuthCookieValue,
} from '../betterAuthCookie';

const TEST_SECRET = 'test-secret-32-chars-min-aaaaaaaaaaaa';

describe('getBetterAuthSessionCookieName', () => {
  it('uses the __Secure- prefix in production', () => {
    expect(getBetterAuthSessionCookieName(true)).toBe('__Secure-better-auth.session_token');
  });

  it('uses the bare name outside production', () => {
    expect(getBetterAuthSessionCookieName(false)).toBe('better-auth.session_token');
  });
});

describe('getBetterAuthSessionDataCookieName', () => {
  it('uses the __Secure- prefix in production', () => {
    expect(getBetterAuthSessionDataCookieName(true)).toBe('__Secure-better-auth.session_data');
  });

  it('uses the bare name outside production', () => {
    expect(getBetterAuthSessionDataCookieName(false)).toBe('better-auth.session_data');
  });
});

describe('signBetterAuthCookieValue', () => {
  it('produces a RAW value `${token}.${signature}` (no URL encoding here — h3 setCookie does it)', () => {
    const value = signBetterAuthCookieValue('abc123', TEST_SECRET);
    expect(value).toMatch(/^abc123\..+$/);
    // No percent-escapes at this stage: pre-encoding here would
    // double-encode through h3 → broken on the wire (see file doc).
    expect(value).not.toContain('%');
  });

  it('signature is 44 chars and ends with `=` (the shape getSignedCookie expects)', () => {
    const value = signBetterAuthCookieValue('a-real-session-token-uuid', TEST_SECRET);
    const sig = value.substring(value.lastIndexOf('.') + 1);
    // From better-call/dist/context.mjs:48 — the verify path requires
    // exactly 44 chars ending with `=`. This is a load-bearing assertion;
    // breaking it silently disables federated logins.
    expect(sig).toHaveLength(44);
    expect(sig.endsWith('=')).toBe(true);
  });

  it('changes with the secret (HMAC binding)', () => {
    const a = signBetterAuthCookieValue('tok', 'secret-A-' + 'x'.repeat(32));
    const b = signBetterAuthCookieValue('tok', 'secret-B-' + 'x'.repeat(32));
    expect(a).not.toBe(b);
  });

  it('changes with the token (HMAC binding)', () => {
    const a = signBetterAuthCookieValue('tok-A', TEST_SECRET);
    const b = signBetterAuthCookieValue('tok-B', TEST_SECRET);
    expect(a).not.toBe(b);
  });

  it('throws when secret is empty', () => {
    expect(() => signBetterAuthCookieValue('tok', '')).toThrow(/secret/);
  });

  it('round-trips under WebCrypto HMAC verify (the algorithm better-call uses)', async () => {
    const token = 'session-token-xyz';
    const value = signBetterAuthCookieValue(token, TEST_SECRET);
    // No URL-encoding to undo at this stage — see file doc.
    const dotPos = value.lastIndexOf('.');
    const signedValue = value.substring(0, dotPos);
    const signatureB64 = value.substring(dotPos + 1);

    // Replicate `verifySignature` from better-call/dist/crypto.mjs:12-21
    // exactly: atob the base64 signature, import the secret as an HMAC key,
    // verify against UTF-8(value).
    const sigBin = Buffer.from(signatureB64, 'base64');
    const key = await webcrypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(TEST_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const ok = await webcrypto.subtle.verify(
      { name: 'HMAC', hash: 'SHA-256' },
      key,
      sigBin,
      new TextEncoder().encode(signedValue),
    );
    expect(ok).toBe(true);
  });

  /**
   * Integration test through the cookie-es `serialize` → URL-decode-once
   * round trip. h3's `setCookie` calls `cookie-es.serialize(name, value,
   * opt)` which does `const enc = opt.encode || encodeURIComponent; var
   * encodedValue = enc(value);` — so h3 ALWAYS encodeURIComponents the
   * value exactly once on the way out (unless the caller overrides
   * `encode`).
   *
   * This is the test that catches the double-URL-encode P0 (session 150
   * audit): the algorithm tests above verify the helper output in
   * isolation, but the helper's output is then passed through h3 which
   * encodes again. If we pre-encode, the wire value contains `%25..` and
   * Better Auth's `getSignedCookie` reads a signature with the wrong
   * shape (length ≠ 44 or doesn't `endsWith('=')`) and returns null →
   * anonymous session.
   *
   * We skip importing h3 directly (it's not a direct dep of layer/base —
   * pulled transitively via nuxt at runtime) and simulate the cookie-es
   * step by hand. The contract we lock is exactly what cookie-es does to
   * `value`: one `encodeURIComponent` on serialize, then `decodeURIComponent`
   * on parse.
   */
  it('round-trips through cookie-es serialize → parse without losing the signature shape (P0 regression)', async () => {
    const token = 'integration-token-xyz';
    const value = signBetterAuthCookieValue(token, TEST_SECRET);

    // Simulate cookie-es `serialize(name, value, opt)`:
    //   encodedValue = (opt.encode || encodeURIComponent)(value)
    //   → `${name}=${encodedValue}; ...attrs`
    const wireValue = encodeURIComponent(value);
    // Roundtrip what the browser sends back (the URL-encoded value), then
    // what better-call's `parseCookies → tryDecode` does (single decode):
    const decodedOnce = decodeURIComponent(wireValue);

    // After the single decode, must equal the raw helper output. If the
    // helper pre-encoded, this would be the singly-encoded value, NOT the
    // raw `${token}.${signature}` — and the next assertions would fail.
    expect(decodedOnce).toBe(value);

    // Better Auth's invariant: signature is 44 chars and ends with `=`.
    // (Verified at better-call/dist/context.mjs:48.)
    const sig = decodedOnce.substring(decodedOnce.lastIndexOf('.') + 1);
    expect(sig).toHaveLength(44);
    expect(sig.endsWith('=')).toBe(true);

    // And the signature is a valid HMAC of the token under our secret —
    // proves Better Auth's `verifySignature` would succeed on this cookie.
    const sigBin = Buffer.from(sig, 'base64');
    const key = await webcrypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(TEST_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const verified = await webcrypto.subtle.verify(
      { name: 'HMAC', hash: 'SHA-256' },
      key,
      sigBin,
      new TextEncoder().encode(token),
    );
    expect(verified).toBe(true);
  });

  it('regression guard: pre-encoding the value would break the round-trip', () => {
    // Negative test — proves the previous (broken) helper would have failed
    // the regression test above. If someone re-introduces the pre-encode,
    // this stays green only because the broken `decodedOnce` is the
    // singly-encoded value, NOT the raw helper output.
    const token = 'token-with-special+/=chars';
    const rawValue = signBetterAuthCookieValue(token, TEST_SECRET);

    const brokenValue = encodeURIComponent(rawValue); // What the old helper produced.
    const wireValue = encodeURIComponent(brokenValue); // h3 encodes again.
    const decodedOnce = decodeURIComponent(wireValue);

    // After single decode, the value still contains `%XX` escapes from
    // the inner encode — NOT equal to the raw helper output.
    expect(decodedOnce).not.toBe(rawValue);
    expect(decodedOnce).toContain('%'); // Still encoded.

    // The signature would not be 44 chars + ending `=` after a single
    // decode — Better Auth's shape check would reject.
    const sig = decodedOnce.substring(decodedOnce.lastIndexOf('.') + 1);
    expect(sig.length === 44 && sig.endsWith('=')).toBe(false);
  });

  it('verifies false when the secret is wrong (no bypass)', async () => {
    const token = 'session-token-xyz';
    const value = signBetterAuthCookieValue(token, TEST_SECRET);
    const dotPos = value.lastIndexOf('.');
    const signedValue = value.substring(0, dotPos);
    const signatureB64 = value.substring(dotPos + 1);

    const sigBin = Buffer.from(signatureB64, 'base64');
    const wrongKey = await webcrypto.subtle.importKey(
      'raw',
      new TextEncoder().encode('different-secret-aaaaaaaaaaaaaa'),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const ok = await webcrypto.subtle.verify(
      { name: 'HMAC', hash: 'SHA-256' },
      wrongKey,
      sigBin,
      new TextEncoder().encode(signedValue),
    );
    expect(ok).toBe(false);
  });
});
