import { z } from 'zod';

/**
 * Cross-instance identity feature gates. Phase rollout per
 * docs/sessions/136-cross-instance-identity-plan.md. All default OFF
 * — turning these on requires phase work to be deployed; flipping the
 * flag without the supporting code is a no-op (the runtime guards on
 * each surface).
 */
export const identityFeaturesSchema = z.object({
  /** Phase 1: allow users to link a remote Mastodon-API account (read-only). */
  linkRemoteAccounts: z.boolean().default(false),
  /** Phase 2: allow new users to sign up by signing in via a remote instance. */
  signInWithRemote: z.boolean().default(false),
  /** Phase 3: enable the "acting as" identity-context switcher + banner. */
  actingAs: z.boolean().default(false),
  /** Phase 4a: like/comment/follow via a linked identity (low blast radius). */
  remoteInteract: z.boolean().default(false),
  /** Phase 4b: publish via a linked identity (highest blast radius — last). */
  remotePublish: z.boolean().default(false),
});

export const featureFlagsSchema = z.object({
  content: z.boolean().default(true),
  social: z.boolean().default(true),
  hubs: z.boolean().default(true),
  docs: z.boolean().default(true),
  video: z.boolean().default(true),
  contests: z.boolean().default(false),
  // Per-stage submission artifacts (proposal → prototype). Default ON, but
  // inert until an organizer defines a stage `submissionTemplate`; no effect
  // unless `contests` is also on.
  contestStageSubmissions: z.boolean().default(true),
  // Form-first proposal submissions + draft placeholder project (Phase 4).
  // Default OFF; no effect unless `contests` is also on.
  contestProposals: z.boolean().default(false),
  // Offer PII field types in the submission-form builder (Phase 4). Default OFF.
  // Access to stored PII is always gated by `contest.pii` regardless.
  contestPii: z.boolean().default(false),
  events: z.boolean().default(false),
  learning: z.boolean().default(true),
  explainers: z.boolean().default(true),
  federation: z.boolean().default(false),
  seamlessFederation: z.boolean().default(false),
  federateHubs: z.boolean().default(false),
  editorial: z.boolean().default(true),
  admin: z.boolean().default(false),
  // Guided theme generator (@commonpub/theme-studio) in the admin theme
  // builder. Default ON — the granular token editor is unaffected when off.
  themeStudio: z.boolean().default(true),
  emailNotifications: z.boolean().default(false),
  // Admin broadcast emails to users (email Phase 3). Default OFF; no effect unless
  // email is actually configured + emailNotifications is on.
  adminBroadcast: z.boolean().default(false),
  // Require logged-in users to re-accept the Terms when `instance.termsVersion`
  // is bumped above what they last accepted (GDPR Phase 2). Default OFF.
  requireTermsAcceptance: z.boolean().default(false),
  publicApi: z.boolean().default(false),
  // URL content import (importFromUrl). Default on; operators can
  // disable URL import without disabling content authoring. The import
  // path is SSRF-safe (safeFetch) — this flag is the rule-#2 gate + an
  // operator off-switch for a remote-fetch surface.
  contentImport: z.boolean().default(true),
  // Phase 1 layout engine. Default OFF until consumer pages are wired
  // (Phase 4) and migration 0005 is run on every consumer DB.
  layoutEngine: z.boolean().default(false),
  // Global RBAC (session 175). Default OFF ⇒ resolver returns the legacy
  // admin-only mapping (byte-identical to pre-RBAC). Lives in the resolver
  // only, never gates the guards. See docs/plans/rbac.md.
  rbac: z.boolean().default(false),
  // Cross-instance delegated authorization. Nested object so the
  // namespace stays separate; all sub-flags default off.
  identity: identityFeaturesSchema.default(() => identityFeaturesSchema.parse({})),
  // Phase 4 registry. actAsRegistry = accept pings + serve the directory
  // (default OFF — only commonpub.io and operators who opt in act as a
  // registry). announceToRegistry = send heartbeats to federation.registryUrl
  // (default ON — instances are discoverable by default; the heartbeat self-
  // skips when registryUrl == own domain, and requires federation:true to run.
  // Set false to opt out of discovery).
  actAsRegistry: z.boolean().default(false),
  announceToRegistry: z.boolean().default(true),
  // Public-API federation reach metrics (`GET /api/public/v1/metrics/federation`).
  // Default OFF: this aggregates peer-instance/domain data (network topology about
  // THIRD parties), so exposing it is a deliberate operator opt-in beyond merely
  // granting the `read:federation` scope to a key. Has no effect unless
  // `publicApi` + `federation` are also on.
  publicApiMetricsFederation: z.boolean().default(false),
});

export const authConfigSchema = z.object({
  emailPassword: z.boolean().default(true),
  magicLink: z.boolean().default(false),
  passkeys: z.boolean().default(false),
  github: z
    .object({
      clientId: z.string().min(1),
      clientSecret: z.string().min(1),
    })
    .optional(),
  google: z
    .object({
      clientId: z.string().min(1),
      clientSecret: z.string().min(1),
    })
    .optional(),
  sharedAuthDb: z.string().url().optional(),
  trustedInstances: z.array(z.string().min(1)).optional(),
});

export const instanceConfigSchema = z.object({
  domain: z.string().min(1),
  name: z.string().min(1).max(128),
  description: z.string().min(1).max(500),
  contactEmail: z.string().email().optional(),
  maxUploadSize: z
    .number()
    .int()
    .positive()
    .default(10 * 1024 * 1024),
  contentTypes: z
    .array(z.enum(['project', 'article', 'blog', 'explainer']))
    .default(['project', 'blog', 'explainer']),
  contestCreation: z.enum(['open', 'staff', 'admin']).default('admin'),
  // Bump when the Terms/Code-of-Conduct text changes materially; recorded against
  // each user's acceptance so re-acceptance can be required later (GDPR, session 227).
  termsVersion: z.string().min(1).max(32).default('1'),
  // Version of the cookie policy; recorded when a logged-in user makes a cookie
  // consent choice (GDPR Phase 2).
  cookiePolicyVersion: z.string().min(1).max(32).default('1'),
});

export const federationConfigSchema = z.object({
  activityRetentionDays: z.number().int().positive().default(90),
  deliveryBatchSize: z.number().int().positive().max(100).default(20),
  deliveryIntervalMs: z.number().int().positive().default(30_000),
  maxDeliveryRetries: z.number().int().positive().max(20).default(6),
  instanceFollowPolicy: z.enum(['auto-accept', 'manual']).default('auto-accept'),
  backfillOnMirrorAccept: z.boolean().default(false),
  mirrorMaxItems: z.number().int().positive().optional(),
  hubSyncIntervalMs: z.number().int().positive().default(3_600_000),
  // Phase 4 registry: where this instance announces itself (when
  // features.announceToRegistry is on) + how often. Default registry is commonpub.io.
  registryUrl: z.string().url().default('https://commonpub.io'),
  registryPingIntervalMs: z.number().int().positive().default(21_600_000), // 6h
});

export const docsConfigSchema = z.object({
  searchLanguage: z.string().default('english'),
});

export const cookieDefinitionSchema = z.object({
  name: z.string().min(1),
  category: z.enum(['essential', 'functional', 'analytics']),
  description: z.string().min(1),
  duration: z.string().min(1),
  provider: z.string().optional(),
});

const themeIdSlug = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9_-]*$/i, 'Theme id must be alphanumeric with - or _');

export const registeredThemeSchema = z.object({
  id: themeIdSlug,
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  family: themeIdSlug,
  isDark: z.boolean(),
  pairId: themeIdSlug.optional(),
  preview: z
    .object({
      bg: z.string().optional(),
      surface: z.string().optional(),
      accent: z.string().optional(),
      text: z.string().optional(),
      border: z.string().optional(),
    })
    .optional(),
});

export const configSchema = z.object({
  instance: instanceConfigSchema,
  features: featureFlagsSchema.default(() => featureFlagsSchema.parse({})),
  auth: authConfigSchema.default(() => authConfigSchema.parse({})),
  // Defaulted (not optional) so federation knobs — incl. registryUrl / registryPingIntervalMs —
  // always resolve to their defaults rather than leaving `config.federation` undefined.
  federation: federationConfigSchema.default(() => federationConfigSchema.parse({})),
  docs: docsConfigSchema.default(() => docsConfigSchema.parse({})),
  cookies: z.array(cookieDefinitionSchema).optional(),
  themes: z.array(registeredThemeSchema).optional(),
  defaultTheme: z.string().max(64).optional(),
});
