// Canonical flag → environment-variable map for build-time feature overrides.
//
// Every BOOLEAN key of @commonpub/config `FeatureFlags` must appear here, or that
// flag can't be toggled via a FEATURE_* / NUXT_PUBLIC_FEATURES_* env var (only the
// DB override + config default would work). The nested `identity` object is
// deliberately absent (env-toggle only supports scalar booleans).
//
// Kept in its own zero-import module so the parity guard test can import it without
// pulling the @commonpub/server barrel. `env-flag-map-parity.test.ts` fails if this
// drifts from the schema — add the entry whenever you add a boolean flag.
export const ENV_FLAG_MAP: Record<string, string> = {
  content: 'FEATURE_CONTENT',
  social: 'FEATURE_SOCIAL',
  hubs: 'FEATURE_HUBS',
  docs: 'FEATURE_DOCS',
  video: 'FEATURE_VIDEO',
  contests: 'FEATURE_CONTESTS',
  contestStageSubmissions: 'FEATURE_CONTEST_STAGE_SUBMISSIONS',
  contestProposals: 'FEATURE_CONTEST_PROPOSALS',
  contestPii: 'FEATURE_CONTEST_PII',
  contestReminders: 'FEATURE_CONTEST_REMINDERS',
  contestEmailEditor: 'FEATURE_CONTEST_EMAIL_EDITOR',
  events: 'FEATURE_EVENTS',
  learning: 'FEATURE_LEARNING',
  explainers: 'FEATURE_EXPLAINERS',
  federation: 'FEATURE_FEDERATION',
  seamlessFederation: 'FEATURE_SEAMLESS_FEDERATION',
  federateHubs: 'FEATURE_FEDERATE_HUBS',
  editorial: 'FEATURE_EDITORIAL',
  registrationBlock: 'FEATURE_REGISTRATION_BLOCK',
  admin: 'FEATURE_ADMIN',
  themeStudio: 'FEATURE_THEME_STUDIO',
  emailNotifications: 'FEATURE_EMAIL_NOTIFICATIONS',
  emailUnverified: 'FEATURE_EMAIL_UNVERIFIED',
  adminBroadcast: 'FEATURE_ADMIN_BROADCAST',
  requireTermsAcceptance: 'FEATURE_REQUIRE_TERMS_ACCEPTANCE',
  publicApi: 'FEATURE_PUBLIC_API',
  contentImport: 'FEATURE_CONTENT_IMPORT',
  layoutEngine: 'FEATURE_LAYOUT_ENGINE',
  rbac: 'FEATURE_RBAC',
  actAsRegistry: 'FEATURE_ACT_AS_REGISTRY',
  announceToRegistry: 'FEATURE_ANNOUNCE_TO_REGISTRY',
  publicApiMetricsFederation: 'FEATURE_PUBLIC_API_METRICS_FEDERATION',
  referralLinks: 'FEATURE_REFERRAL_LINKS',
  featuredHub: 'FEATURE_FEATURED_HUB',
  hubGovernance: 'FEATURE_HUB_GOVERNANCE',
};
