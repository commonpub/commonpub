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
  /** Enable email notifications (instant + digest emails for likes, comments, follows, mentions) */
  emailNotifications: boolean;
}

export interface AuthConfig {
  /** Enable email/password authentication */
  emailPassword: boolean;
  /** Enable magic link authentication */
  magicLink: boolean;
  /** Enable passkey (WebAuthn) authentication */
  passkeys: boolean;
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

export interface CommonPubConfig {
  instance: InstanceConfig;
  features: FeatureFlags;
  auth: AuthConfig;
  /** Federation-specific configuration (only used when features.federation is true) */
  federation?: FederationConfig;
  /** Docs module configuration */
  docs: DocsConfig;
  /**
   * Additional cookies used by this instance (e.g., analytics, marketing).
   * CommonPub's own cookies (session, color scheme) are registered automatically.
   * These are shown in the cookie consent banner and cookie policy page.
   */
  cookies?: CookieDefinition[];
}
