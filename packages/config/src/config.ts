import { configSchema } from './schema';
import type { SnaplifyConfig } from './types';

export interface ConfigWarning {
  field: string;
  message: string;
}

export interface ConfigResult {
  config: SnaplifyConfig;
  warnings: ConfigWarning[];
}

/**
 * Define and validate a Snaplify instance configuration.
 * Returns the validated config with defaults applied and any warnings.
 *
 * @throws {ZodError} if the config is invalid
 */
export function defineSnaplifyConfig(input: {
  instance: {
    domain: string;
    name: string;
    description: string;
    contactEmail?: string;
    maxUploadSize?: number;
    contentTypes?: Array<'project' | 'article' | 'guide' | 'blog'>;
  };
  features?: Partial<SnaplifyConfig['features']>;
  auth?: Partial<SnaplifyConfig['auth']>;
}): ConfigResult {
  const config = configSchema.parse(input) as SnaplifyConfig;
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
