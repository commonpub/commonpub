import { configSchema } from './schema.js';
import type { CommonPubConfig, ReferralConfig, RegisteredTheme } from './types.js';

export interface ConfigWarning {
  field: string;
  message: string;
}

export interface ConfigResult {
  config: CommonPubConfig;
  warnings: ConfigWarning[];
}

/**
 * Define and validate a CommonPub instance configuration.
 * Returns the validated config with defaults applied and any warnings.
 *
 * @throws {ZodError} if the config is invalid
 */
export function defineCommonPubConfig(input: {
  instance: {
    domain: string;
    name: string;
    description: string;
    contactEmail?: string;
    maxUploadSize?: number;
    contentTypes?: Array<'project' | 'article' | 'blog' | 'explainer'>; // 'article' accepted for compat, normalized to 'blog'
    contestCreation?: 'open' | 'staff' | 'admin';
  };
  features?: Partial<CommonPubConfig['features']>;
  auth?: Partial<CommonPubConfig['auth']>;
  federation?: Partial<CommonPubConfig['federation']>;
  /** Referral-link operator policy (cookieless mode, default window). The zod
   *  schema fills defaults, so this is optional; declare it to opt into
   *  cookieless attribution or change the default window. */
  referral?: Partial<ReferralConfig>;
  /** Code-registered themes (the zod schema always accepted these; the input
   *  type previously omitted them, so thin apps couldn't declare them
   *  without a type error). */
  themes?: RegisteredTheme[];
  /** Brand default theme id — see CommonPubConfig.defaultTheme. */
  defaultTheme?: string;
}): ConfigResult {
  const config = configSchema.parse(input) as CommonPubConfig;
  const warnings: ConfigWarning[] = [];

  if (config.auth.sharedAuthDb) {
    warnings.push({
      field: 'auth.sharedAuthDb',
      message:
        'Shared auth DB (Model C) couples instances at the database level. ' +
        'Only use this if you operate all connected instances.',
    });
  }

  if (config.features.federation && !config.auth.trustedInstances?.length) {
    warnings.push({
      field: 'features.federation',
      message:
        'Federation is enabled but no trusted instances are configured. ' +
        'AP Actor SSO (Model B) requires at least one trusted instance.',
    });
  }

  if (config.features.learning && !config.features.explainers) {
    warnings.push({
      field: 'features.explainers',
      message:
        'Learning is enabled but explainers are disabled. ' +
        'Explainers are a first-class lesson type in learning paths.',
    });
  }

  return { config, warnings };
}
