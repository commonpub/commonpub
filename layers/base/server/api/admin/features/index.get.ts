import { getInstanceSetting } from '@commonpub/server';
import type { FeatureFlags } from '@commonpub/config';

/**
 * GET /api/admin/features
 * Returns current feature flags with metadata about defaults vs overrides.
 */
export default defineEventHandler(async (event) => {
  requirePermission(event, 'settings.manage');

  const db = useDB();
  const config = useConfig();

  // Get DB overrides (may be null if never set)
  const raw = await getInstanceSetting(db, 'features.overrides');
  const overrides: Partial<FeatureFlags> = (raw && typeof raw === 'object' && !Array.isArray(raw))
    ? raw as Partial<FeatureFlags>
    : {};

  // Build response with default + effective values for each flag.
  //
  // BOOLEANS ONLY. `features` also carries `identity`, a nested OBJECT of
  // sub-flags. Listing it here rendered a toggle for it on /admin/features, and
  // flipping that toggle would have replaced the whole object with `true`,
  // silently destroying every identity sub-flag. The PUT validator rejects a
  // non-boolean, so the visible symptom was a 400 on save rather than
  // corruption, but the row should never have been offered.
  const flags = config.features as unknown as Record<string, unknown>;
  const result: Record<string, { enabled: boolean; isOverridden: boolean }> = {};

  for (const [key, value] of Object.entries(flags)) {
    if (typeof value !== 'boolean') continue;
    result[key] = {
      enabled: value,
      isOverridden: key in overrides,
    };
  }

  // Same filter on the stored overrides, so a previously-saved non-boolean
  // cannot be echoed straight back into the next PUT by the admin page.
  const booleanOverrides = Object.fromEntries(
    Object.entries(overrides).filter(([, v]) => typeof v === 'boolean'),
  );

  return { flags: result, overrides: booleanOverrides };
});
