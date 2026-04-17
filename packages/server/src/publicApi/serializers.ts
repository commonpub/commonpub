import type { ApiKey } from '@commonpub/schema';

/**
 * Public API response shapes.
 *
 * These types define the EXACT wire format returned by `/api/public/v1/*`.
 * The corresponding `to*` helpers are allow-list serializers: any new column
 * added to the underlying table is excluded by default. That is the core
 * safety guarantee — we cannot accidentally leak a new private field just by
 * adding it to the DB.
 *
 * NEVER add: email, emailVerified, passwordHash, role, status, deletedAt,
 * session/auth tokens, emailNotifications, moderation flags, draft content,
 * any field from messages/reports/audit logs.
 */

export interface PublicUser {
  id: string;
  username: string;
  displayName: string | null;
  headline: string | null;
  bio: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  pronouns: string | null;
  location: string | null;
  website: string | null;
  skills: string[] | null;
  socialLinks: Record<string, string | undefined> | null;
  createdAt: string;
}

export interface PublicUserRow {
  id: string;
  username: string;
  displayName: string | null;
  headline: string | null;
  bio: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  pronouns: string | null;
  location: string | null;
  website: string | null;
  skills: unknown;
  socialLinks: unknown;
  createdAt: Date;
  /** Must be 'public' or we omit the user entirely in list endpoints. */
  profileVisibility: string;
  /** Must be null to include. */
  deletedAt: Date | null;
}

export function toPublicUser(row: PublicUserRow): PublicUser {
  return {
    id: row.id,
    username: row.username,
    displayName: row.displayName,
    headline: row.headline,
    bio: row.bio,
    avatarUrl: row.avatarUrl,
    bannerUrl: row.bannerUrl,
    pronouns: row.pronouns,
    location: row.location,
    website: row.website,
    skills: Array.isArray(row.skills) ? (row.skills as string[]) : null,
    socialLinks:
      row.socialLinks && typeof row.socialLinks === 'object' && !Array.isArray(row.socialLinks)
        ? (row.socialLinks as Record<string, string>)
        : null,
    createdAt: row.createdAt.toISOString(),
  };
}

export function isPublicUser(row: PublicUserRow): boolean {
  return row.deletedAt === null && row.profileVisibility === 'public';
}

// --- Content ---

export interface PublicContentSummary {
  id: string;
  type: string;
  title: string;
  slug: string;
  description: string | null;
  coverImageUrl: string | null;
  difficulty: string | null;
  publishedAt: string | null;
  updatedAt: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  author: Pick<PublicUser, 'id' | 'username' | 'displayName' | 'avatarUrl'>;
  canonicalUrl: string;
}

export interface PublicContentDetail extends PublicContentSummary {
  content: unknown; // BlockTuple[] or markdown string — opaque to API consumers
  tags: Array<{ id: string; name: string; slug: string }>;
}

export interface PublicContentRow {
  id: string;
  type: string;
  title: string;
  slug: string;
  description: string | null;
  coverImageUrl: string | null;
  difficulty: string | null;
  status: string;
  visibility: string | null;
  publishedAt: Date | null;
  updatedAt: Date;
  deletedAt: Date | null;
  viewCount: number | null;
  likeCount: number | null;
  commentCount: number | null;
  content?: unknown;
  author: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
}

export function isPublicContent(row: Pick<PublicContentRow, 'status' | 'visibility' | 'deletedAt'>): boolean {
  if (row.deletedAt !== null) return false;
  if (row.status !== 'published') return false;
  if (row.visibility !== null && row.visibility !== 'public') return false;
  return true;
}

export function toPublicContentSummary(row: PublicContentRow, domain: string): PublicContentSummary {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    slug: row.slug,
    description: row.description,
    coverImageUrl: row.coverImageUrl,
    difficulty: row.difficulty,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
    viewCount: row.viewCount ?? 0,
    likeCount: row.likeCount ?? 0,
    commentCount: row.commentCount ?? 0,
    author: row.author,
    canonicalUrl: `https://${domain}/u/${row.author.username}/${row.type}/${row.slug}`,
  };
}

export function toPublicContentDetail(
  row: PublicContentRow & { tags?: Array<{ id: string; name: string; slug: string }> },
  domain: string,
): PublicContentDetail {
  return {
    ...toPublicContentSummary(row, domain),
    content: row.content ?? null,
    tags: row.tags ?? [],
  };
}

// --- Hub ---

export interface PublicHub {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  hubType: string;
  iconUrl: string | null;
  bannerUrl: string | null;
  memberCount: number;
  postCount: number;
  isOfficial: boolean;
  categories: string[] | null;
  website: string | null;
  createdAt: string;
  canonicalUrl: string;
}

export interface PublicHubRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  hubType: string;
  iconUrl: string | null;
  bannerUrl: string | null;
  memberCount: number | null;
  postCount: number | null;
  isOfficial: boolean | null;
  categories: unknown;
  website: string | null;
  deletedAt: Date | null;
  createdAt: Date;
}

export function isPublicHub(row: Pick<PublicHubRow, 'deletedAt'>): boolean {
  return row.deletedAt === null;
}

export function toPublicHub(row: PublicHubRow, domain: string): PublicHub {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    hubType: row.hubType,
    iconUrl: row.iconUrl,
    bannerUrl: row.bannerUrl,
    memberCount: row.memberCount ?? 0,
    postCount: row.postCount ?? 0,
    isOfficial: row.isOfficial ?? false,
    categories: Array.isArray(row.categories) ? (row.categories as string[]) : null,
    website: row.website,
    createdAt: row.createdAt.toISOString(),
    canonicalUrl: `https://${domain}/hubs/${row.slug}`,
  };
}

// --- Instance metadata ---

export interface PublicInstance {
  name: string;
  description: string | null;
  domain: string;
  software: {
    name: string;
    version: string;
  };
  users: { total: number; activeMonth: number };
  content: { total: number };
  hubs: { total: number };
  features: Record<string, boolean>;
  openRegistrations: boolean;
  links: {
    nodeinfo: string;
    webfinger: string;
    api: string;
  };
}

// --- Admin-side API key view (never includes the raw token or hash) ---

export interface AdminApiKeyView {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  description: string | null;
  allowedOrigins: string[] | null;
  rateLimitPerMinute: number;
  createdBy: { id: string; username: string; displayName: string | null } | null;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  revokedBy: { id: string; username: string; displayName: string | null } | null;
}

export function toAdminApiKeyView(
  key: ApiKey,
  createdBy: { id: string; username: string; displayName: string | null } | null,
  revokedBy: { id: string; username: string; displayName: string | null } | null,
): AdminApiKeyView {
  return {
    id: key.id,
    name: key.name,
    prefix: key.prefix,
    scopes: key.scopes,
    description: key.description,
    allowedOrigins: key.allowedOrigins,
    rateLimitPerMinute: key.rateLimitPerMinute,
    createdBy,
    createdAt: key.createdAt.toISOString(),
    lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
    expiresAt: key.expiresAt?.toISOString() ?? null,
    revokedAt: key.revokedAt?.toISOString() ?? null,
    revokedBy,
  };
}
