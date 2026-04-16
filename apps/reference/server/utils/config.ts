// Singleton CommonPub config for Nitro server
//
// Config priority (highest wins):
// 1. DB overrides (instanceSettings 'features.overrides') — runtime changeable
// 2. Environment variables (FEATURE_*)
// 3. commonpub.config.ts defaults — build-time
//
// DB overrides are cached for 60 seconds to avoid per-request DB hits.
import { type CommonPubConfig, type FeatureFlags } from '@commonpub/config';
import { getInstanceSetting } from '@commonpub/server';
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
};

/** Base config (config.ts + env overrides) — computed once at startup */
let baseConfig: CommonPubConfig | null = null;

/** Cached DB overrides with TTL */
let dbOverrides: Partial<FeatureFlags> | null = null;
let dbOverridesFetchedAt = 0;
const DB_CACHE_TTL_MS = 60_000;

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
      (features as Record<string, boolean>)[flag] = envVal;
    }
  }

  baseConfig = {
    ...config,
    instance: { ...config.instance, domain, name, description },
    features,
  };
  return baseConfig;
}

function buildMergedConfig(base: CommonPubConfig, overrides: Partial<FeatureFlags> | null): CommonPubConfig {
  if (!overrides || Object.keys(overrides).length === 0) return base;
  return {
    ...base,
    features: { ...base.features, ...overrides },
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

/** Async: fetch DB overrides and rebuild merged config */
async function refreshDbOverrides(): Promise<void> {
  try {
    const db = useDB();
    const raw = await getInstanceSetting(db, 'features.overrides');
    dbOverrides = (raw && typeof raw === 'object' && !Array.isArray(raw))
      ? raw as Partial<FeatureFlags>
      : null;
  } catch {
    // DB not available yet (startup) — use defaults
    dbOverrides = null;
  }
  mergedConfig = buildMergedConfig(getBaseConfig(), dbOverrides);
}

/** Force-refresh the config cache (call after admin changes feature overrides) */
export function invalidateConfigCache(): void {
  dbOverridesFetchedAt = 0;
  mergedConfig = null;
}
