export { defineCommonPubConfig } from './config.js';
export type {
  CommonPubConfig,
  FeatureFlags,
  IdentityFeatures,
  AuthConfig,
  InstanceConfig,
  FederationConfig,
  DocsConfig,
  CookieDefinition,
  RegisteredTheme,
} from './types.js';
export {
  configSchema,
  featureFlagsSchema,
  identityFeaturesSchema,
  authConfigSchema,
  instanceConfigSchema,
  federationConfigSchema,
  docsConfigSchema,
  cookieDefinitionSchema,
  registeredThemeSchema,
} from './schema.js';
