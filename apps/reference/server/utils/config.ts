// Singleton CommonPub config for Nitro server
import { defineCommonPubConfig, type CommonPubConfig } from '@commonpub/config';

let cachedConfig: CommonPubConfig | null = null;

export function useConfig(): CommonPubConfig {
  if (cachedConfig) return cachedConfig;

  const runtimeConfig = useRuntimeConfig();

  const { config } = defineCommonPubConfig({
    instance: {
      domain: (runtimeConfig.public.domain as string) || 'localhost:3000',
      name: (runtimeConfig.public.siteName as string) || 'CommonPub',
      description: (runtimeConfig.public.siteDescription as string) || 'A CommonPub instance',
    },
  });

  cachedConfig = config;
  return config;
}
