export interface FeatureFlags {
  /** Enable content system (CRUD, publishing, slugs) */
  content: boolean;
  /** Enable social features (likes, comments, bookmarks) */
  social: boolean;
  /** Enable hub system (feeds, membership, moderation) */
  hubs: boolean;
  /** Enable docs module (CodeMirror editor, versioning, search) */
  docs: boolean;
  /** Enable video content type */
  video: boolean;
  /** Enable contest system */
  contests: boolean;
  /**
   * Per-stage submission artifacts for multi-round contests (proposal →
   * prototype). Gates the stage template editor + the entrant submit/artifact
   * surfaces. Default ON — inert until an organizer adds a `submissionTemplate`
   * to a `submission` stage, so flipping it on changes nothing by itself.
   * No effect unless `contests` is also on.
   */
  contestStageSubmissions: boolean;
  /**
   * Form-first proposal submissions (Phase 4). When ON, a `submission` stage can
   * be set to proposal mode: an entrant submits a form (no pre-existing content
   * required) and the server creates a DRAFT placeholder project linked as the
   * entry, routing the entrant into the editor to develop it. Default OFF. No
   * effect unless `contests` is also on.
   */
  contestProposals: boolean;
  /**
   * Offer PII field types (email/address + the `pii` flag) in the contest
   * submission-form builder (Phase 4). Default OFF. Access to stored PII is
   * ALWAYS gated by the `contest.pii` permission regardless of this flag;
   * this only controls whether organizers can ADD PII fields. No effect unless
   * `contests` is also on.
   */
  contestPii: boolean;
  /** Enable events system (listing, RSVP, calendar) */
  events: boolean;
  /** Enable learning paths (enrollment, progress, certificates) */
  learning: boolean;
  /** Enable explainer system (interactive modules) */
  explainers: boolean;
  /** Enable ActivityPub federation */
  federation: boolean;
  /** Display mirrored content alongside local content in browse/search/feed */
  seamlessFederation: boolean;
  /** Enable hub/community federation via AP Group actors (default: false) */
  federateHubs: boolean;
  /** Enable editorial curation (staff picks, content categories, homepage editorial section) */
  editorial: boolean;
  /** Enable admin panel (user management, reports, instance settings) */
  admin: boolean;
  /** Enable the guided theme generator (theme-studio) in the admin theme builder (default: true) */
  themeStudio: boolean;
  /** Enable email notifications (instant + digest emails for likes, comments, follows, mentions) */
  emailNotifications: boolean;
  /** Enable admin broadcast emails to users (email Phase 3). */
  adminBroadcast: boolean;
  /** Require re-acceptance of the Terms when instance.termsVersion is bumped (GDPR Phase 2). */
  requireTermsAcceptance: boolean;
  /**
   * Enable the admin-provisioned public Read API at `/api/public/v1/*`.
   * OFF by default — turning it on does not create any keys; admin must
   * create keys via `/admin/api-keys` and share the one-time token.
   */
  publicApi: boolean;
  /**
   * Enable URL content import (`importFromUrl`). Default on; an
   * operator off-switch for the remote-fetch surface (rule #2 gate).
   */
  contentImport: boolean;
  /**
   * Phase 1 layout engine — when ON, the new `<LayoutSlot>` renderer
   * reads from the `layouts`/`layout_rows`/`layout_sections` DB tables
   * (migration 0005) instead of the legacy `homepage.sections` JSON
   * setting. Default OFF until the consumer code paths are wired into
   * every layout-bearing page (Phase 4). Flipping this without the
   * migration applied + a layout row for each route will result in
   * empty pages.
   */
  layoutEngine: boolean;
  /**
   * Global RBAC (session 175). When ON, the per-user permission resolver
   * unions grants from operator-defined roles (`user_roles` →
   * `role_permissions`) and `staff` gains its seeded moderator set. Default
   * OFF — with it off, the resolver returns the legacy mapping (admin→all,
   * else→none) ⇒ byte-identical to pre-RBAC. The flag lives ONLY in the
   * resolver, never in the guards (gating guards behind a feature flag would
   * 404 admin endpoints). See docs/plans/rbac.md.
   */
  rbac: boolean;
  /**
   * Cross-instance delegated authorization. Phased rollout per
   * docs/sessions/136-cross-instance-identity-plan.md. All sub-flags
   * default off; flipping each requires the corresponding phase work
   * to be deployed (the runtime guards on each surface).
   */
  identity: IdentityFeatures;
  /**
   * Act as an instance registry/directory (Phase 4). When ON, this instance
   * accepts signed `POST /api/registry/ping` heartbeats from other CommonPub
   * instances and serves the browse/search directory. Default OFF.
   */
  actAsRegistry: boolean;
  /**
   * Announce this instance to a registry (Phase 4). When ON, a heartbeat is
   * periodically sent to `federation.registryUrl` (default https://commonpub.io)
   * so the instance is discoverable. Default ON — set false to opt out. The
   * heartbeat self-skips when the registry is this instance's own domain and
   * only runs when `federation` is enabled.
   */
  announceToRegistry: boolean;
  /**
   * Expose federation reach metrics on the public API
   * (`GET /api/public/v1/metrics/federation`). Default OFF — aggregates
   * peer-instance/domain data, so it is an explicit operator opt-in on top of
   * the `read:federation` scope. No effect unless `publicApi` + `federation` are on.
   */
  publicApiMetricsFederation: boolean;
  /**
   * Enable user-owned referral links (session 229): personal signup-attribution
   * links that run bounded onboarding actions (auto-join a hub, redirect on
   * signup). Default OFF. Operator policy lives in `config.referral`.
   */
  referralLinks: boolean;
  /**
   * Hub governance (session 230): owner-to-member ownership transfer, the
   * Steward role (discussion moderation + flag projects/members for owner review,
   * no destructive powers), and self-unlink of shared projects. Default OFF.
   */
  hubGovernance: boolean;
}

export interface IdentityFeatures {
  /** Phase 1: allow users to link a remote Mastodon-API account (read-only). */
  linkRemoteAccounts: boolean;
  /** Phase 2: allow new users to sign up by signing in via a remote instance. */
  signInWithRemote: boolean;
  /** Phase 3: enable the "acting as" identity-context switcher + banner. */
  actingAs: boolean;
  /** Phase 4a: like/comment/follow via a linked identity (low blast radius). */
  remoteInteract: boolean;
  /** Phase 4b: publish via a linked identity (highest blast radius — last). */
  remotePublish: boolean;
}

export interface AuthConfig {
  /** Enable email/password authentication */
  emailPassword: boolean;
  /** Enable magic link authentication */
  magicLink: boolean;
  /** Enable passkey (WebAuthn) authentication */
  passkeys: boolean;
  /**
   * Require email verification before sign-in. Default OFF — signup works
   * without an email provider. Only enable once an email adapter is wired, or
   * new users get a verification email that never arrives.
   */
  requireEmailVerification?: boolean;
  /** GitHub OAuth credentials (omit to disable) */
  github?: { clientId: string; clientSecret: string };
  /** Google OAuth credentials (omit to disable) */
  google?: { clientId: string; clientSecret: string };
  /**
   * Use a shared auth database across instances (Model C).
   * WARNING: This couples instances at the database level.
   * Only enable if you operate all instances and accept the tradeoff.
   */
  sharedAuthDb?: string;
  /** Trusted instances for AP Actor SSO (Model B) */
  trustedInstances?: string[];
}

export interface InstanceConfig {
  /** Public domain of this instance (e.g., "hack.build") */
  domain: string;
  /** Human-readable instance name */
  name: string;
  /** Short description for NodeInfo and meta tags */
  description: string;
  /** Contact email for the instance operator */
  contactEmail?: string;
  /** Maximum upload size in bytes (default: 10MB) */
  maxUploadSize?: number;
  /** Supported content types ('article' is accepted for backwards compat, normalized to 'blog') */
  contentTypes?: Array<'project' | 'article' | 'blog' | 'explainer'>;
  /**
   * Who can create contests.
   * - 'open': any authenticated user
   * - 'staff': staff and admin roles only
   * - 'admin': admin role only (default)
   */
  contestCreation?: 'open' | 'staff' | 'admin';
  /**
   * Version string for the Terms of Service + Code of Conduct. Recorded against
   * each user's acceptance at signup; bump it when the terms change materially so
   * a future re-acceptance gate can detect stale consent. Default '1'.
   */
  termsVersion?: string;
  /** Cookie policy version, recorded with logged-in cookie consent (GDPR Phase 2). Default '1'. */
  cookiePolicyVersion?: string;
}

export interface FederationConfig {
  /** Days to retain delivered activities before cleanup (default: 90) */
  activityRetentionDays?: number;
  /** Max activities per delivery worker run (default: 20) */
  deliveryBatchSize?: number;
  /** Delivery worker poll interval in ms (default: 30000) */
  deliveryIntervalMs?: number;
  /** Max delivery retries before dead-lettering (default: 6) */
  maxDeliveryRetries?: number;
  /** How to handle inbound Follow requests (default: 'auto-accept') */
  instanceFollowPolicy?: 'auto-accept' | 'manual';
  /** Auto-backfill when mirror Follow is accepted (default: false) */
  backfillOnMirrorAccept?: boolean;
  /** Max items per mirror to prevent DB bloat (default: unlimited) */
  mirrorMaxItems?: number;
  /** Hub sync worker poll interval in ms (default: 3600000 = 1 hour) */
  hubSyncIntervalMs?: number;
  /** Registry this instance announces to when `features.announceToRegistry` is on (default: https://commonpub.io) */
  registryUrl?: string;
  /** Registry heartbeat interval in ms (default: 21600000 = 6 hours) */
  registryPingIntervalMs?: number;
}

/** A cookie registered by the instance for the consent banner and cookie policy page */
export interface CookieDefinition {
  /** Cookie name (e.g., '_ga', 'hubspot_utk') */
  name: string;
  /** Cookie category — essential cookies bypass consent */
  category: 'essential' | 'functional' | 'analytics';
  /** Human-readable description of what this cookie does */
  description: string;
  /** Human-readable duration (e.g., '1 year', 'session', '24 hours') */
  duration: string;
  /** Who sets this cookie (e.g., 'Google Analytics', 'HubSpot') */
  provider?: string;
}

/** Docs-specific configuration */
export interface DocsConfig {
  /** Postgres FTS language for docs search (default: 'english'). See: https://www.postgresql.org/docs/current/textsearch-dictionaries.html */
  searchLanguage: string;
}

/** Referral-link operator policy (session 229). Only used when `features.referralLinks` is on. */
export interface ReferralConfig {
  /**
   * When true the short link sets no carrier cookie; attribution relies solely on
   * the `?ref=` code forwarded to the claim endpoint (email-signup only). Sidesteps
   * the ePrivacy device-storage consent gate. Default false.
   */
  cookieless: boolean;
  /** Default attribution window in days for new links (per-link override allowed). Default 60. */
  defaultAttributionWindowDays: number;
}

/**
 * Code-registered theme declared by a thin layer app in `commonpub.config.ts`.
 * The accompanying CSS file is loaded via Nuxt's `css:` array — this entry
 * tells the admin UI the theme exists so it shows up in the selector.
 *
 * Code-registered themes are NOT user-editable (they ship with the app);
 * use DB-stored custom themes (created in the admin UI) for that.
 */
export interface RegisteredTheme {
  /** Slug used in `data-theme="<id>"` — must match the CSS selector. */
  id: string;
  /** Display name shown in the admin theme picker. */
  name: string;
  /** Short description shown under the name. */
  description?: string;
  /** Family slug — groups light + dark variants together. */
  family: string;
  /** Whether this is a dark theme. Picks the right variant when the user toggles. */
  isDark: boolean;
  /** Sibling theme ID for the opposite mode in the same family. Optional. */
  pairId?: string;
  /**
   * Preview swatches for the picker (hex strings). If omitted, derived
   * from CSS computed values at runtime.
   */
  preview?: {
    bg?: string;
    surface?: string;
    accent?: string;
    text?: string;
    border?: string;
  };
}

export interface CommonPubConfig {
  instance: InstanceConfig;
  features: FeatureFlags;
  auth: AuthConfig;
  /** Federation-specific configuration (only used when features.federation is true) */
  federation?: FederationConfig;
  /** Docs module configuration */
  docs: DocsConfig;
  /** Referral-link operator policy (only used when features.referralLinks is on) */
  referral?: ReferralConfig;
  /**
   * Additional cookies used by this instance (e.g., analytics, marketing).
   * CommonPub's own cookies (session, color scheme) are registered automatically.
   * These are shown in the cookie consent banner and cookie policy page.
   */
  cookies?: CookieDefinition[];
  /**
   * Themes registered in code by the thin layer app. These appear in the
   * admin theme picker alongside built-in and DB-stored custom themes.
   * The matching CSS file must be added separately to the Nuxt `css:` array.
   */
  themes?: RegisteredTheme[];
  /**
   * Default theme id used when the admin hasn't picked one in the DB
   * (`instance_settings` key `theme.default`). Lets a thin app pin its brand
   * theme in code instead of riding the layer's built-in fallback — without
   * this, an instance with a registered brand theme but no DB setting renders
   * (and light/dark-toggles) as the layer's default family. The DB setting,
   * when present, always wins.
   */
  defaultTheme?: string;
}
