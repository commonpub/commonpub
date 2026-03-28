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
  /** Enable admin panel (user management, reports, instance settings) */
  admin: boolean;
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
  /** Supported content types */
  contentTypes?: Array<'project' | 'article' | 'blog' | 'explainer'>;
  /**
   * Who can create contests.
   * - 'open': any authenticated user
   * - 'staff': staff and admin roles only
   * - 'admin': admin role only (default)
   */
  contestCreation?: 'open' | 'staff' | 'admin';
}

export interface CommonPubConfig {
  instance: InstanceConfig;
  features: FeatureFlags;
  auth: AuthConfig;
}
