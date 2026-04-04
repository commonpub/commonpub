import { getInstanceSettings } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  requireFeature('admin');
  requireAdmin(event);
  const db = useDB();
  const config = useConfig();

  // Get DB-stored settings (returns Map — convert to plain object)
  const dbSettings = await getInstanceSettings(db);
  const stored: Record<string, unknown> = {};
  for (const [key, value] of dbSettings) {
    stored[key] = value;
  }

  // Merge with running config defaults so the UI shows actual values
  const defaults: Record<string, unknown> = {
    'instance.name': config.instance.name,
    'instance.description': config.instance.description,
    'instance.registrationOpen': 'true',
    'instance.maxUploadSize': String(config.instance.maxUploadSize ?? 10485760),
    'instance.contactEmail': config.instance.contactEmail ?? '',
  };

  return { ...defaults, ...stored };
});
