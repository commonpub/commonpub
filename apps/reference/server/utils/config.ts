// Singleton CommonPub config for Nitro server
import { defineCommonPubConfig, type CommonPubConfig } from '@commonpub/config';

let cachedConfig: CommonPubConfig | null = null;

/** Parse a boolean env var. Returns undefined if not set (let Zod defaults apply). */
function envBool(key: string): boolean | undefined {
  const val = process.env[key];
  if (val === undefined || val === '') return undefined;
  return val !== 'false' && val !== '0';
}

export function useConfig(): CommonPubConfig {
  if (cachedConfig) return cachedConfig;

  const runtimeConfig = useRuntimeConfig();

  // Read content types from env (comma-separated) or fall through to Zod default
  const rawContentTypes = process.env.CONTENT_TYPES || process.env.NUXT_PUBLIC_CONTENT_TYPES;
  const contentTypes = rawContentTypes
    ? (rawContentTypes.split(',').map(s => s.trim()).filter(Boolean) as Array<'project' | 'article' | 'blog' | 'explainer'>)
    : undefined;

  const contestCreation = (process.env.CONTEST_CREATION || process.env.NUXT_PUBLIC_CONTEST_CREATION) as 'open' | 'staff' | 'admin' | undefined;

  const { config } = defineCommonPubConfig({
    instance: {
      domain: (runtimeConfig.public.domain as string) || 'localhost:3000',
      name: (runtimeConfig.public.siteName as string) || 'CommonPub',
      description: (runtimeConfig.public.siteDescription as string) || 'A CommonPub instance',
      ...(contentTypes && { contentTypes }),
      ...(contestCreation && { contestCreation }),
    },
    features: {
      content: envBool('FEATURE_CONTENT') ?? envBool('NUXT_PUBLIC_FEATURES_CONTENT'),
      social: envBool('FEATURE_SOCIAL') ?? envBool('NUXT_PUBLIC_FEATURES_SOCIAL'),
      hubs: envBool('FEATURE_HUBS') ?? envBool('NUXT_PUBLIC_FEATURES_HUBS'),
      docs: envBool('FEATURE_DOCS') ?? envBool('NUXT_PUBLIC_FEATURES_DOCS'),
      video: envBool('FEATURE_VIDEO') ?? envBool('NUXT_PUBLIC_FEATURES_VIDEO'),
      contests: envBool('FEATURE_CONTESTS') ?? envBool('NUXT_PUBLIC_FEATURES_CONTESTS'),
      learning: envBool('FEATURE_LEARNING') ?? envBool('NUXT_PUBLIC_FEATURES_LEARNING'),
      explainers: envBool('FEATURE_EXPLAINERS') ?? envBool('NUXT_PUBLIC_FEATURES_EXPLAINERS'),
      federation: envBool('FEATURE_FEDERATION') ?? envBool('NUXT_PUBLIC_FEATURES_FEDERATION'),
      federateHubs: envBool('FEATURE_FEDERATE_HUBS') ?? envBool('NUXT_PUBLIC_FEATURES_FEDERATE_HUBS'),
      seamlessFederation: envBool('FEATURE_SEAMLESS_FEDERATION') ?? envBool('NUXT_PUBLIC_FEATURES_SEAMLESS_FEDERATION'),
      admin: envBool('FEATURE_ADMIN') ?? envBool('NUXT_PUBLIC_FEATURES_ADMIN'),
    } as Record<string, boolean | undefined>,
  });

  cachedConfig = config;
  return config;
}
