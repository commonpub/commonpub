import { needsTermsReacceptance } from '@commonpub/server';

/**
 * GET /api/consent/status — whether the logged-in user must re-accept the Terms
 * (GDPR Phase 2). The server computes it (flag + stored vs current terms version)
 * so the interstitial never needs the raw versions.
 */
export default defineEventHandler(async (event): Promise<{ termsReacceptanceRequired: boolean }> => {
  const user = requireAuth(event);
  const db = useDB();
  const config = useConfig();
  const required = await needsTermsReacceptance(db, user.id, {
    enabled: config.features.requireTermsAcceptance === true,
    termsVersion: config.instance.termsVersion ?? '1',
  });
  return { termsReacceptanceRequired: required };
});
