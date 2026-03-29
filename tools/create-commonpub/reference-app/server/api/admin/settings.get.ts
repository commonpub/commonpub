import { getInstanceSettings } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  requireFeature('admin');
  requireAdmin(event);
  const db = useDB();
  const config = useConfig();

  // Get DB-stored settings
  const dbSettings = await getInstanceSettings(db);

  // Merge with running config defaults so the UI shows actual values
  const defaults: Record<string, string> = {
    'instance.name': config.instance.name,
    'instance.description': config.instance.description,
    'instance.registrationOpen': 'true',
    'instance.maxUploadSize': String(config.instance.maxUploadSize ?? 10485760),
    'instance.contactEmail': config.instance.contactEmail ?? '',
  };

  return { ...defaults, ...dbSettings };
});
