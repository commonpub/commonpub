// Shell app server config — reads from commonpub.config.ts with env var overrides.
import { type CommonPubConfig } from '@commonpub/config';
import siteConfig from '~/commonpub.config';

let cachedConfig: CommonPubConfig | null = null;

function envBool(key: string): boolean | undefined {
  const val = process.env[key];
  if (val === undefined || val === '') return undefined;
  return val !== 'false' && val !== '0';
}

export function useConfig(): CommonPubConfig {
  if (cachedConfig) return cachedConfig;

  const runtimeConfig = useRuntimeConfig();
  const { config } = siteConfig;

  const domain = (runtimeConfig.public.domain as string) || config.instance.domain;
  const name = (runtimeConfig.public.siteName as string) || config.instance.name;
  const description = (runtimeConfig.public.siteDescription as string) || config.instance.description;

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
