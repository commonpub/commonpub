import { z } from 'zod';
import type { FeatureFlags } from './types.js';

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
  // Private contest file/signature attachments (P0/P6 — rich registration). Gates
  // the private-storage upload path (purpose=`contest`, stored non-public) and the
  // /api/files/[id]/raw serving route. A non-owner read requires `contest.pii` AND
  // organizer status on a contest the file's OWNER submitted it to (owner / global
  // contest.manage / per-contest editor — see contestIdsForPrivateFile, which matches
  // only rows where user_id = the file's uploader, closing uuid-injection). A
  // per-contest editor is thus scoped to their own contest's files; a global
  // contest.manage/contest.pii staffer can read any legitimately-submitted file (the
  // same reach they already have over all registrants/PII, by RBAC design). Default
  // OFF. Inert unless `contestPii` is on (file/signature are personal-data types).
  contestPrivateFiles: z.boolean().default(false),
  // Automatic contest deadline reminder emails to registered participants.
  // Default OFF; the reminder sweep is inert unless this AND emailNotifications
  // are on (the outbox worker only drains when emailNotifications is on).
  contestReminders: z.boolean().default(false),
  // Per-contest email-template editor (session 232): organizers customize the
  // subject + plain-text intro of the confirmation + reminder emails per contest.
  // Default OFF. Gates the editor UI + preview route AND the send-side application
  // of any stored override (flag off ⇒ every send uses built-in default copy).
  // No effect unless `contests` is also on.
  contestEmailEditor: z.boolean().default(false),
  // Two-tier contest signup card (session 239): explicit "Register for this contest"
  // + a lower-commitment "Just get reminders" tier, an optional post-register info
  // form (what you're building / experience / team), and status-aware "what's next"
  // onboarding copy. Default ON (the intended default registration experience);
  // when off the card falls back to the simple single reminders opt-in. No effect
  // unless `contests` is also on.
  contestSignup: z.boolean().default(true),
  events: z.boolean().default(false),
  learning: z.boolean().default(true),
  explainers: z.boolean().default(true),
  federation: z.boolean().default(false),
  seamlessFederation: z.boolean().default(false),
  federateHubs: z.boolean().default(false),
  editorial: z.boolean().default(true),
  // Registration-link CTA block in the block editor (droppable into any
  // content + the contest email body). Default ON — gates only the editor
  // PALETTE; already-authored blocks always render regardless.
  registrationBlock: z.boolean().default(true),
  admin: z.boolean().default(false),
  // Guided theme generator (@commonpub/theme-studio) in the admin theme
  // builder. Default ON — the granular token editor is unaffected when off.
  themeStudio: z.boolean().default(true),
  emailNotifications: z.boolean().default(false),
  // Deliver notification/reminder/broadcast email to users whose address is NOT
  // verified. Default OFF (the safe posture — only email confirmed addresses).
  // When ON, verification gates sign-in only; email reaches all opted-in users
  // regardless of verified status. Deliverability caveat: sending to unconfirmed
  // addresses can hurt sender reputation — enable only for a trusted audience.
  emailUnverified: z.boolean().default(false),
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
  // Referral links (session 229). Lets users create personal signup-attribution
  // links that run bounded onboarding actions (auto-join a hub, redirect).
  // Default OFF. Operator policy knobs live in `config.referral`, not here.
  referralLinks: z.boolean().default(false),
  // Featured hub (session 230). Renders one operator-chosen hub as a full-width
  // hero atop the hubs listing. The chosen hub id lives in
  // instance_settings['hubs.featuredId']; this flag gates the hero + the admin
  // picker. Default OFF.
  featuredHub: z.boolean().default(false),
  // Hub governance (session 230): owner transfers ownership, owner grants the
  // Steward role (moderate discussions + flag projects/members, no destructive
  // powers), and members unlink their own shared projects. Default OFF.
  hubGovernance: z.boolean().default(false),
});

// --- Compile-time parity guard --------------------------------------------------
// `FeatureFlags` (types.ts) is a HAND-WRITTEN mirror of `featureFlagsSchema` and has
// silently drifted before (a flag added to the Zod schema but not the interface, so
// the flag couldn't be set/read type-safely — session 243). These two assignments
// fail to compile if the interface and the schema keys ever diverge (a key missing
// from either side breaks assignability), so `pnpm typecheck` catches the drift that
// vitest's esbuild transpile cannot. Type-only — erased at build, zero runtime cost.
type _FlagsFromSchema = z.infer<typeof featureFlagsSchema>;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _flagsParityForward: FeatureFlags = null as unknown as _FlagsFromSchema;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _flagsParityBackward: _FlagsFromSchema = null as unknown as FeatureFlags;

export const authConfigSchema = z.object({
  emailPassword: z.boolean().default(true),
  magicLink: z.boolean().default(false),
  passkeys: z.boolean().default(false),
  // Require users to verify their email before they can sign in. Default OFF so
  // signup works out of the box without an email provider. Turn ON only once an
  // email adapter (Resend/SMTP) is actually wired, otherwise new users get a
  // verification email that is never sent and can't complete signup.
  requireEmailVerification: z.boolean().default(false),
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

/**
 * Referral-link operator policy (session 229). Only active when
 * `features.referralLinks` is on. Server-side only — not mirrored to the client
 * runtimeConfig.
 */
export const referralConfigSchema = z.object({
  // When true, the short link does NOT set a carrier cookie; attribution relies
  // solely on the `?ref=` code the register page forwards to the claim endpoint
  // (email-signup only). Sidesteps the ePrivacy device-storage consent gate.
  cookieless: z.boolean().default(false),
  // Default attribution window (days) for new links; per-link override allowed.
  defaultAttributionWindowDays: z.number().int().min(1).max(365).default(60),
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
  referral: referralConfigSchema.default(() => referralConfigSchema.parse({})),
  cookies: z.array(cookieDefinitionSchema).optional(),
  themes: z.array(registeredThemeSchema).optional(),
  defaultTheme: z.string().max(64).optional(),
});
