import { getInstanceSetting } from '@commonpub/server';
import type { FeatureFlags } from '@commonpub/config';

/**
 * GET /api/admin/features
 * Returns current feature flags with metadata about defaults vs overrides.
 */
export default defineEventHandler(async (event) => {
  requireAdmin(event);

  const db = useDB();
  const config = useConfig();

  // Get DB overrides (may be null if never set)
  const raw = await getInstanceSetting(db, 'features.overrides');
  const overrides: Partial<FeatureFlags> = (raw && typeof raw === 'object' && !Array.isArray(raw))
    ? raw as Partial<FeatureFlags>
    : {};

  // Build response with default + effective values for each flag
  const flags = config.features as unknown as Record<string, boolean>;
  const result: Record<string, { enabled: boolean; isOverridden: boolean }> = {};

  for (const [key, value] of Object.entries(flags)) {
    result[key] = {
      enabled: value,
      isOverridden: key in overrides,
    };
  }

  return { flags: result, overrides };
});
