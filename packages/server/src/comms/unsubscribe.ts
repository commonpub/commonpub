import { createHmac, timingSafeEqual } from 'node:crypto';

// Stateless one-click unsubscribe tokens (email Phase 1b). An HMAC over the user
// id with the instance AUTH_SECRET — no DB column, not enumerable, and revocable
// by rotating the secret. Format: `<base64url(userId)>.<base64url(hmac)>`.

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function sign(userId: string, secret: string): string {
  return b64url(createHmac('sha256', secret).update(`unsub:${userId}`).digest());
}

/** Build the opaque unsubscribe token for a user. */
export function makeUnsubscribeToken(userId: string, secret: string): string {
  return `${b64url(Buffer.from(userId, 'utf8'))}.${sign(userId, secret)}`;
}

export interface UnsubscribeLinks {
  /** Visible footer link → the `/unsubscribe` page (offers digest-vs-all scope). */
  pageUrl: string;
  /** RFC 8058 one-click headers → `POST /api/unsubscribe`. */
  headers: { 'List-Unsubscribe': string; 'List-Unsubscribe-Post': string };
}

/**
 * Per-recipient unsubscribe links for one email: the visible footer page URL +
 * the one-click `List-Unsubscribe` headers. The single source of truth for the
 * unsubscribe URL/header shape — every non-transactional sender (notifications,
 * digests, broadcasts) uses this so the path/format stays consistent.
 */
export function buildUnsubscribeLinks(siteUrl: string, userId: string, secret: string): UnsubscribeLinks {
  const token = makeUnsubscribeToken(userId, secret);
  return {
    pageUrl: `${siteUrl}/unsubscribe?token=${token}`,
    headers: {
      'List-Unsubscribe': `<${siteUrl}/api/unsubscribe?token=${token}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  };
}

/**
 * Verify a token and return the userId, or null if malformed/forged. Constant-time
 * comparison on the signature so the token can't be brute-forced by timing.
 */
export function verifyUnsubscribeToken(token: string, secret: string): string | null {
  if (typeof token !== 'string') return null;
  const dot = token.indexOf('.');
  if (dot <= 0) return null;
  const idPart = token.slice(0, dot);
  const sigPart = token.slice(dot + 1);
  let userId: string;
  try {
    userId = Buffer.from(idPart.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
  } catch {
    return null;
  }
  if (!userId) return null;
  const expected = sign(userId, secret);
  const a = Buffer.from(sigPart);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  if (!timingSafeEqual(a, b)) return null;
  return userId;
}
