// Singleton CommonPub config for Nitro server
//
// Config priority (highest wins):
// 1. DB overrides (instanceSettings 'features.overrides') — runtime changeable
// 2. Environment variables (FEATURE_*)
// 3. commonpub.config.ts defaults — build-time
//
// DB overrides are cached for 60 seconds to avoid per-request DB hits.
import { type CommonPubConfig, type FeatureFlags } from '@commonpub/config';
import {
  getInstanceSetting,
  INSTANCE_NAME_SETTING_KEY,
  INSTANCE_DESCRIPTION_SETTING_KEY,
} from '@commonpub/server';
import siteConfig from '~/commonpub.config';

/** Parse a boolean env var. Returns undefined if not set. */
function envBool(key: string): boolean | undefined {
  const val = process.env[key];
  if (val === undefined || val === '') return undefined;
  return val !== 'false' && val !== '0';
}

const ENV_FLAG_MAP: Record<string, string> = {
  content: 'FEATURE_CONTENT',
  social: 'FEATURE_SOCIAL',
  hubs: 'FEATURE_HUBS',
  docs: 'FEATURE_DOCS',
  video: 'FEATURE_VIDEO',
  contests: 'FEATURE_CONTESTS',
  events: 'FEATURE_EVENTS',
  learning: 'FEATURE_LEARNING',
  explainers: 'FEATURE_EXPLAINERS',
  editorial: 'FEATURE_EDITORIAL',
  federation: 'FEATURE_FEDERATION',
  federateHubs: 'FEATURE_FEDERATE_HUBS',
  seamlessFederation: 'FEATURE_SEAMLESS_FEDERATION',
  admin: 'FEATURE_ADMIN',
  emailNotifications: 'FEATURE_EMAIL_NOTIFICATIONS',
  adminBroadcast: 'FEATURE_ADMIN_BROADCAST',
  requireTermsAcceptance: 'FEATURE_REQUIRE_TERMS_ACCEPTANCE',
  contentImport: 'FEATURE_CONTENT_IMPORT',
  actAsRegistry: 'FEATURE_ACT_AS_REGISTRY',
  announceToRegistry: 'FEATURE_ANNOUNCE_TO_REGISTRY',
  publicApiMetricsFederation: 'FEATURE_PUBLIC_API_METRICS_FEDERATION',
  referralLinks: 'FEATURE_REFERRAL_LINKS',
  featuredHub: 'FEATURE_FEATURED_HUB',
};

/** Base config (config.ts + env overrides) — computed once at startup */
let baseConfig: CommonPubConfig | null = null;

/** Cached DB overrides with TTL */
let dbOverrides: Partial<FeatureFlags> | null = null;
/** Cached admin-set instance identity overrides (SEO brand), refreshed with the same TTL. */
let dbIdentity: { name?: string; description?: string } | null = null;
let dbOverridesFetchedAt = 0;
const DB_CACHE_TTL_MS = 60_000;

/** Coerce a jsonb setting scalar to a non-empty string, else undefined. */
function settingString(value: unknown): string | undefined {
  if (typeof value === 'string') return value.length > 0 ? value : undefined;
  if (typeof value === 'number') return String(value);
  return undefined;
}

/** Merged config (base + DB overrides) — refreshed when DB cache expires */
let mergedConfig: CommonPubConfig | null = null;

function getBaseConfig(): CommonPubConfig {
  if (baseConfig) return baseConfig;

  const runtimeConfig = useRuntimeConfig();
  const { config } = siteConfig;

  const domain = (runtimeConfig.public.domain as string) || config.instance.domain;
  const name = (runtimeConfig.public.siteName as string) || config.instance.name;
  const description = (runtimeConfig.public.siteDescription as string) || config.instance.description;

  const features = { ...config.features };
  for (const [flag, envKey] of Object.entries(ENV_FLAG_MAP)) {
    const envVal = envBool(envKey) ?? envBool(`NUXT_PUBLIC_FEATURES_${envKey.replace('FEATURE_', '')}`);
    if (envVal !== undefined) {
      // ENV_FLAG_MAP only references boolean-shaped feature flags;
      // identity is a nested object and not in the map. Cast through
      // unknown to satisfy the typechecker without weakening the index
      // signature semantically.
      (features as unknown as Record<string, boolean>)[flag] = envVal;
    }
  }

  baseConfig = {
    ...config,
    instance: { ...config.instance, domain, name, description },
    features,
  };
  return baseConfig;
}

function buildMergedConfig(
  base: CommonPubConfig,
  overrides: Partial<FeatureFlags> | null,
  identity: { name?: string; description?: string } | null,
): CommonPubConfig {
  const hasFeatureOverrides = overrides && Object.keys(overrides).length > 0;
  const hasIdentity = identity && (identity.name !== undefined || identity.description !== undefined);
  if (!hasFeatureOverrides && !hasIdentity) return base;
  return {
    ...base,
    instance: {
      ...base.instance,
      ...(identity?.name !== undefined ? { name: identity.name } : {}),
      ...(identity?.description !== undefined ? { description: identity.description } : {}),
    },
    features: hasFeatureOverrides ? { ...base.features, ...overrides } : base.features,
  };
}

/**
 * Get the current config. Returns cached version synchronously.
 * DB overrides are refreshed asynchronously in the background every 60s.
 */
export function useConfig(): CommonPubConfig {
  const base = getBaseConfig();

  // If DB overrides haven't been fetched yet or TTL expired, trigger background refresh
  const now = Date.now();
  if (now - dbOverridesFetchedAt > DB_CACHE_TTL_MS) {
    // Mark as fetched immediately to avoid concurrent fetches
    dbOverridesFetchedAt = now;
    refreshDbOverrides().catch(() => {
      // On failure, reset timestamp so next call retries
      dbOverridesFetchedAt = 0;
    });
  }

  // Return merged config (or base if no DB overrides yet)
  return mergedConfig ?? base;
}

/** Async: fetch DB overrides + instance identity and rebuild merged config */
async function refreshDbOverrides(): Promise<void> {
  try {
    const db = useDB();
    const raw = await getInstanceSetting(db, 'features.overrides');
    dbOverrides = (raw && typeof raw === 'object' && !Array.isArray(raw))
      ? raw as Partial<FeatureFlags>
      : null;
    // Admin-set SEO brand (name/description) — runtime-editable without redeploy.
    const name = settingString(await getInstanceSetting(db, INSTANCE_NAME_SETTING_KEY));
    const description = settingString(await getInstanceSetting(db, INSTANCE_DESCRIPTION_SETTING_KEY));
    dbIdentity = (name !== undefined || description !== undefined) ? { name, description } : null;
  } catch {
    // DB not available yet (startup) — use defaults
    dbOverrides = null;
    dbIdentity = null;
  }
  mergedConfig = buildMergedConfig(getBaseConfig(), dbOverrides, dbIdentity);
}

/** Force-refresh the config cache (call after admin changes feature overrides
 *  or the instance name/description). */
export function invalidateConfigCache(): void {
  dbOverridesFetchedAt = 0;
  mergedConfig = null;
  dbIdentity = null;
}
