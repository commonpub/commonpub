// Singleton CommonPub config for Nitro server
//
// Reads from commonpub.config.ts (the project's single source of truth),
// then allows env vars to override individual feature flags.
import { type CommonPubConfig } from '@commonpub/config';
import siteConfig from '~/commonpub.config';

let cachedConfig: CommonPubConfig | null = null;

/** Parse a boolean env var. Returns undefined if not set. */
function envBool(key: string): boolean | undefined {
  const val = process.env[key];
  if (val === undefined || val === '') return undefined;
  return val !== 'false' && val !== '0';
}

export function useConfig(): CommonPubConfig {
  if (cachedConfig) return cachedConfig;

  const runtimeConfig = useRuntimeConfig();

  // Start from the site config (commonpub.config.ts)
  const { config } = siteConfig;

  // Allow env vars to override instance settings
  const domain = (runtimeConfig.public.domain as string) || config.instance.domain;
  const name = (runtimeConfig.public.siteName as string) || config.instance.name;
  const description = (runtimeConfig.public.siteDescription as string) || config.instance.description;

  // Allow env vars to override feature flags
  const features = { ...config.features };
  const envOverrides: Record<string, string> = {
    content: 'FEATURE_CONTENT',
    social: 'FEATURE_SOCIAL',
    hubs: 'FEATURE_HUBS',
    docs: 'FEATURE_DOCS',
    video: 'FEATURE_VIDEO',
    contests: 'FEATURE_CONTESTS',
    learning: 'FEATURE_LEARNING',
    explainers: 'FEATURE_EXPLAINERS',
    federation: 'FEATURE_FEDERATION',
    federateHubs: 'FEATURE_FEDERATE_HUBS',
    seamlessFederation: 'FEATURE_SEAMLESS_FEDERATION',
    admin: 'FEATURE_ADMIN',
    emailNotifications: 'FEATURE_EMAIL_NOTIFICATIONS',
  };

  for (const [flag, envKey] of Object.entries(envOverrides)) {
    const envVal = envBool(envKey) ?? envBool(`NUXT_PUBLIC_FEATURES_${envKey.replace('FEATURE_', '')}`);
    if (envVal !== undefined) {
      (features as Record<string, boolean>)[flag] = envVal;
    }
  }

  cachedConfig = {
    ...config,
    instance: { ...config.instance, domain, name, description },
    features,
  };

  return cachedConfig;
}
