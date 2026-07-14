import { describe, it, expect } from 'vitest';
import { featureFlagsSchema } from '@commonpub/config';
import { ENV_FLAG_MAP } from '~/server/utils/envFlagMap';

// Canonical boolean flag keys = FeatureFlags entries whose parsed default is a
// boolean. The nested `identity` object parses to an object and is excluded
// automatically — mirroring its intentional absence from ENV_FLAG_MAP (env-toggle
// only supports scalar booleans). This guard fails whenever a boolean flag is
// added to featureFlagsSchema without a matching ENV_FLAG_MAP entry (or vice
// versa), so the two can never silently drift again.
const booleanFlagKeys = Object.entries(featureFlagsSchema.parse({}))
  .filter(([, value]) => typeof value === 'boolean')
  .map(([key]) => key)
  .sort();

describe('ENV_FLAG_MAP parity with FeatureFlags', () => {
  it('maps every boolean FeatureFlags key to a FEATURE_ env var', () => {
    for (const key of booleanFlagKeys) {
      expect(ENV_FLAG_MAP, `boolean flag "${key}" has no ENV_FLAG_MAP entry`).toHaveProperty(key);
    }
  });

  it('has no stale entries that are not boolean FeatureFlags keys', () => {
    for (const key of Object.keys(ENV_FLAG_MAP)) {
      expect(booleanFlagKeys, `ENV_FLAG_MAP has stale/unknown key "${key}"`).toContain(key);
    }
  });

  it('excludes the nested identity object from env-toggle', () => {
    expect(ENV_FLAG_MAP).not.toHaveProperty('identity');
  });

  it('uses a distinct, well-formed FEATURE_ env var per flag', () => {
    const names = Object.values(ENV_FLAG_MAP);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(name).toMatch(/^FEATURE_[A-Z0-9_]+$/);
  });
});
