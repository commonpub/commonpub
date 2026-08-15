import { setInstanceSetting, getInstanceSetting } from '@commonpub/server';
import type { FeatureFlags } from '@commonpub/config';
import { z } from 'zod';

/**
 * The cap is NOT a magic number. `/admin/features` posts the ENTIRE accumulated
 * override set on every save (existing overrides + the pending change), so the
 * payload grows with the instance, not with the edit. A literal `20` was
 * written when the config had far fewer flags; by session 255 there were 46,
 * deveco had 38 of them on, and every single save 400'd with "Too many
 * overrides". An operator could not toggle anything.
 *
 * Every key is separately validated against the known flag list below, so the
 * largest legitimate payload IS the number of known flags. The cap is derived
 * from that in the handler and exists only to bound an absurd body.
 */
const updateFeaturesSchema = z.object({
  overrides: z.record(z.string(), z.boolean()),
});

/**
 * PUT /api/admin/features
 * Set feature flag overrides. Pass { overrides: { flagName: true/false } }.
 * To remove an override, omit the key from overrides.
 */
export default defineEventHandler(async (event) => {
  const user = requirePermission(event, 'settings.manage');

  const body = await parseBody(event, updateFeaturesSchema);
  const db = useDB();

  // Validate that all keys are known, TOGGLEABLE feature flags.
  //
  // Booleans only: `features.identity` is a nested object of sub-flags, and
  // accepting it here would replace that whole object with `true` and destroy
  // every sub-flag. It is excluded from `/admin/features` too, so nothing
  // offers it in the first place.
  const config = useConfig();
  const allFeatures = config.features as unknown as Record<string, unknown>;
  const knownFlags = Object.entries(allFeatures)
    .filter(([, v]) => typeof v === 'boolean')
    .map(([k]) => k);

  if (Object.keys(body.overrides).length > knownFlags.length) {
    throw createError({
      statusCode: 400,
      statusMessage: `Too many overrides: ${Object.keys(body.overrides).length} sent, `
        + `${knownFlags.length} flags exist`,
    });
  }

  for (const key of Object.keys(body.overrides)) {
    if (!knownFlags.includes(key)) {
      throw createError({
        statusCode: 400,
        statusMessage: key in allFeatures
          ? `Feature flag is not a simple toggle and cannot be overridden here: ${key}`
          : `Unknown feature flag: ${key}`,
      });
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
