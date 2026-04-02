import { getStoredTrustedInstances } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  requireFeature('admin');
  requireAdmin(event);
  const db = useDB();
  const config = useConfig();

  const stored = await getStoredTrustedInstances(db);
  const configDomains = config.auth.trustedInstances ?? [];

  return {
    configDomains,
    storedDomains: stored,
  };
});
