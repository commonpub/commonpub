import { listInstanceFollowers } from '@commonpub/server';
import { extractDomain } from '../../../utils/inbox';

/**
 * GET /api/admin/federation/followers
 * Instances mirroring US — remote actors that follow our instance Service actor.
 * Answers "who is mirroring me". Admin only.
 */
export default defineEventHandler(async (event) => {
  requireFeature('federation');
  requirePermission(event, 'federation.manage');

  const config = useConfig();
  const runtimeConfig = useRuntimeConfig();
  const domain = extractDomain((runtimeConfig.public?.siteUrl as string) || `https://${config.instance.domain}`);

  return listInstanceFollowers(useDB(), domain);
});
