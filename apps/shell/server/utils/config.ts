// Shell app server config — reads from commonpub.config.ts with env var overrides.
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
  learning: 'FEATURE_LEARNING',
  explainers: 'FEATURE_EXPLAINERS',
  editorial: 'FEATURE_EDITORIAL',
  federation: 'FEATURE_FEDERATION',
  federateHubs: 'FEATURE_FEDERATE_HUBS',
  seamlessFederation: 'FEATURE_SEAMLESS_FEDERATION',
  admin: 'FEATURE_ADMIN',
  emailNotifications: 'FEATURE_EMAIL_NOTIFICATIONS',
};

let baseConfig: CommonPubConfig | null = null;
let dbOverrides: Partial<FeatureFlags> | null = null;
let dbOverridesFetchedAt = 0;
const DB_CACHE_TTL_MS = 60_000;
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

export function useConfig(): CommonPubConfig {
  const base = getBaseConfig();
  const now = Date.now();
  if (now - dbOverridesFetchedAt > DB_CACHE_TTL_MS) {
    dbOverridesFetchedAt = now;
    refreshDbOverrides().catch(() => { dbOverridesFetchedAt = 0; });
  }
  return mergedConfig ?? base;
}

async function refreshDbOverrides(): Promise<void> {
  try {
    const db = useDB();
    const raw = await getInstanceSetting(db, 'features.overrides');
    dbOverrides = (raw && typeof raw === 'object' && !Array.isArray(raw))
      ? raw as Partial<FeatureFlags>
      : null;
  } catch {
    dbOverrides = null;
  }
  mergedConfig = buildMergedConfig(getBaseConfig(), dbOverrides);
}

export function invalidateConfigCache(): void {
  dbOverridesFetchedAt = 0;
  mergedConfig = null;
}
