import { verifyUnsubscribeToken } from '@commonpub/server';

/**
 * GET /api/unsubscribe?token=...
 *
 * The RFC 2369 `List-Unsubscribe: <https://…/api/unsubscribe?token=…>` header is a
 * plain URL, so a mail client that lacks one-click POST support (and a human who
 * clicks the footer link) issues a GET. Without this handler those requests 405.
 *
 * A GET is a safe, idempotent navigation, so unlike the POST it does NOT mutate
 * preferences here: it verifies the token (mirroring the POST's HMAC check) and
 * redirects to the `/unsubscribe` page, which offers the digest-vs-all confirm
 * flow. An invalid/expired token lands on the same page tokenless, which renders
 * its error state. Token-authenticated, so it is safe cross-origin from a mailbox.
 */
export default defineEventHandler((event): Promise<void> => {
  const secret = (useRuntimeConfig().authSecret as string) || '';
  const query = getQuery(event);
  const token = typeof query.token === 'string' ? query.token : '';

  const userId = token ? verifyUnsubscribeToken(token, secret) : null;
  const target = userId ? `/unsubscribe?token=${encodeURIComponent(token)}` : '/unsubscribe';

  // 302 to the confirm page (SEO-irrelevant email link; a temporary redirect keeps
  // the token out of any cached permanent-redirect entry).
  return sendRedirect(event, target, 302);
});
