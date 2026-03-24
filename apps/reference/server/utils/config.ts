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
      content: envBool('FEATURE_CONTENT'),
      social: envBool('FEATURE_SOCIAL'),
      hubs: envBool('FEATURE_HUBS'),
      docs: envBool('FEATURE_DOCS'),
      video: envBool('FEATURE_VIDEO'),
      contests: envBool('FEATURE_CONTESTS'),
      learning: envBool('FEATURE_LEARNING'),
      explainers: envBool('FEATURE_EXPLAINERS'),
      federation: envBool('FEATURE_FEDERATION'),
      admin: envBool('FEATURE_ADMIN'),
    } as Record<string, boolean | undefined>,
  });

  cachedConfig = config;
  return config;
}
