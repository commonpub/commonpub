import { setInstanceSetting, getInstanceSetting } from '@commonpub/server';
import type { FeatureFlags } from '@commonpub/config';
import { z } from 'zod';

const updateFeaturesSchema = z.object({
  overrides: z.record(z.string(), z.boolean()).refine(
    (obj) => Object.keys(obj).length <= 20,
    'Too many overrides',
  ),
});

/**
 * PUT /api/admin/features
 * Set feature flag overrides. Pass { overrides: { flagName: true/false } }.
 * To remove an override, omit the key from overrides.
 */
export default defineEventHandler(async (event) => {
  const user = requireAdmin(event);

  const body = await parseBody(event, updateFeaturesSchema);
  const db = useDB();

  // Validate that all keys are known feature flags
  const config = useConfig();
  const knownFlags = Object.keys(config.features);
  for (const key of Object.keys(body.overrides)) {
    if (!knownFlags.includes(key)) {
      throw createError({ statusCode: 400, statusMessage: `Unknown feature flag: ${key}` });
    }
  }

  // Merge with existing overrides (so partial updates work)
  const raw = await getInstanceSetting(db, 'features.overrides');
  const existing: Partial<FeatureFlags> = (raw && typeof raw === 'object' && !Array.isArray(raw))
    ? raw as Partial<FeatureFlags>
    : {};

  const merged = { ...existing, ...body.overrides };

  // Remove overrides that match the base config default (no point overriding to same value)
  const base = config.features as unknown as Record<string, boolean>;
  for (const [key, value] of Object.entries(merged)) {
    if (base[key] === value) {
      delete (merged as Record<string, unknown>)[key];
    }
  }

  await setInstanceSetting(db, 'features.overrides', merged, user.id, getRequestIP(event) ?? undefined);

  // Invalidate config cache so the change takes effect immediately
  if (typeof invalidateConfigCache === 'function') {
    invalidateConfigCache();
  }

  return { overrides: merged, message: 'Feature flags updated' };
});
