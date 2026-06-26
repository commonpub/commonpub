import { recordConsent } from '@commonpub/server';
import { consentInputSchema } from '@commonpub/schema';

/**
 * POST /api/consent — record the logged-in user's consent (GDPR Phase 2).
 * `kind:'terms'` re-accepts the Terms at the current instance version (clears the
 * re-acceptance gate); `kind:'cookies'` records a cookie-consent choice. The
 * version is server-supplied (clients can't backdate or spoof a version).
 */
export default defineEventHandler(async (event): Promise<{ ok: true }> => {
  const user = requireAuth(event);
  const db = useDB();
  const config = useConfig();
  const { kind } = await parseBody(event, consentInputSchema);

  const version =
    kind === 'cookies'
      ? config.instance.cookiePolicyVersion ?? '1'
      : config.instance.termsVersion ?? '1';

  await recordConsent(db, { userId: user.id, kind, version, ip: getRequestIP(event) ?? undefined });
  return { ok: true };
});
