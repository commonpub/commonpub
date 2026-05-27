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

  // NOTE: previously this block tried to "remove overrides that match the
  // base config" as a dedup, but `config.features` is the EFFECTIVE config
  // (with overrides ALREADY applied) — so re-saving a previously-overridden
  // flag would see `base[key] === value` (because the override was applied
  // to base) and delete the override. The flag would then revert to the
  // build-time default on next read. User-visible symptom: "I flipped X on
  // in the UI but it kept reverting off." The dedup is dropped — the user's
  // explicit override is persisted verbatim. Future "reset to default" can
  // be a separate DELETE-overrides handler.

  await setInstanceSetting(db, 'features.overrides', merged, user.id, getRequestIP(event) ?? undefined);

  // Invalidate config cache so the change takes effect immediately
  if (typeof invalidateConfigCache === 'function') {
    invalidateConfigCache();
  }

  return { overrides: merged, message: 'Feature flags updated' };
});
