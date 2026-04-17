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
  /** 'local' if originated on this instance, 'federated' if mirrored from a peer. */
  source: 'local' | 'federated';
  /** Origin instance domain for federated items (e.g. 'deveco.io'); null for local. */
  sourceDomain: string | null;
  /** Authoritative AP URI of the content for federated items; null for local. */
  sourceUri: string | null;
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
  visibility?: string | null;
  publishedAt: Date | null;
  /** Either Date (single-item fetch) or a pre-stringified timestamp (list with snake_case). */
  updatedAt?: Date;
  createdAt?: Date;
  deletedAt?: Date | null;
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
  source?: 'local' | 'federated';
  sourceDomain?: string;
  sourceUri?: string;
}

export function isPublicContent(row: Pick<PublicContentRow, 'status' | 'visibility' | 'deletedAt'>): boolean {
  if (row.deletedAt !== null) return false;
  if (row.status !== 'published') return false;
  if (row.visibility !== null && row.visibility !== 'public') return false;
  return true;
}

export function toPublicContentSummary(row: PublicContentRow, domain: string): PublicContentSummary {
  const source = row.source ?? 'local';
  const canonicalHost = source === 'federated' && row.sourceDomain ? row.sourceDomain : domain;
  const updatedIso = row.updatedAt?.toISOString() ?? row.createdAt?.toISOString() ?? new Date(0).toISOString();
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    slug: row.slug,
    description: row.description,
    coverImageUrl: row.coverImageUrl,
    difficulty: row.difficulty,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    updatedAt: updatedIso,
    viewCount: row.viewCount ?? 0,
    likeCount: row.likeCount ?? 0,
    commentCount: row.commentCount ?? 0,
    author: {
      id: row.author.id,
      username: row.author.username,
      displayName: row.author.displayName,
      avatarUrl: row.author.avatarUrl,
    },
    canonicalUrl: row.sourceUri ?? `https://${canonicalHost}/u/${row.author.username}/${row.type}/${row.slug}`,
    source,
    sourceDomain: row.sourceDomain ?? null,
    sourceUri: row.sourceUri ?? null,
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

// --- Learning paths ---

export interface PublicLearningPath {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  coverImageUrl: string | null;
  difficulty: string | null;
  lessonCount: number;
  enrollmentCount: number;
  publishedAt: string | null;
  createdAt: string;
  author: Pick<PublicUser, 'id' | 'username' | 'displayName' | 'avatarUrl'>;
  canonicalUrl: string;
}

export interface PublicLearningPathRow {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  coverImageUrl: string | null;
  difficulty: string | null;
  status: string;
  lessonCount?: number | null;
  enrollmentCount?: number | null;
  publishedAt: Date | null;
  createdAt: Date;
  deletedAt?: Date | null;
  author: { id: string; username: string; displayName: string | null; avatarUrl: string | null };
}

export function isPublicLearningPath(row: Pick<PublicLearningPathRow, 'status' | 'deletedAt'>): boolean {
  if (row.deletedAt) return false;
  return row.status === 'published';
}

export function toPublicLearningPath(row: PublicLearningPathRow, domain: string): PublicLearningPath {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description,
    coverImageUrl: row.coverImageUrl,
    difficulty: row.difficulty,
    lessonCount: row.lessonCount ?? 0,
    enrollmentCount: row.enrollmentCount ?? 0,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    author: {
      id: row.author.id,
      username: row.author.username,
      displayName: row.author.displayName,
      avatarUrl: row.author.avatarUrl,
    },
    canonicalUrl: `https://${domain}/learn/${row.slug}`,
  };
}

// --- Events ---

export interface PublicEvent {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  coverImageUrl: string | null;
  eventType: string;
  status: string;
  location: string | null;
  locationUrl: string | null;
  startAt: string;
  endAt: string | null;
  timezone: string | null;
  capacity: number | null;
  attendeeCount: number;
  waitlistCount: number;
  hubId: string | null;
  createdAt: string;
  host: Pick<PublicUser, 'id' | 'username' | 'displayName' | 'avatarUrl'> | null;
  canonicalUrl: string;
}

export interface PublicEventRow {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  coverImageUrl: string | null;
  eventType: string;
  status: string;
  location: string | null;
  locationUrl: string | null;
  startAt: Date;
  endAt: Date | null;
  timezone: string | null;
  capacity: number | null;
  attendeeCount?: number | null;
  waitlistCount?: number | null;
  hubId: string | null;
  createdAt: Date;
  deletedAt?: Date | null;
  host?: { id: string; username: string; displayName: string | null; avatarUrl: string | null } | null;
}

const PUBLIC_EVENT_STATUSES = new Set(['published', 'active', 'completed', 'upcoming', 'past']);

export function isPublicEvent(row: Pick<PublicEventRow, 'status' | 'deletedAt'>): boolean {
  if (row.deletedAt) return false;
  return PUBLIC_EVENT_STATUSES.has(row.status);
}

export function toPublicEvent(row: PublicEventRow, domain: string): PublicEvent {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description,
    coverImageUrl: row.coverImageUrl,
    eventType: row.eventType,
    status: row.status,
    location: row.location,
    locationUrl: row.locationUrl,
    startAt: row.startAt.toISOString(),
    endAt: row.endAt?.toISOString() ?? null,
    timezone: row.timezone,
    capacity: row.capacity,
    attendeeCount: row.attendeeCount ?? 0,
    waitlistCount: row.waitlistCount ?? 0,
    hubId: row.hubId,
    createdAt: row.createdAt.toISOString(),
    host: row.host
      ? { id: row.host.id, username: row.host.username, displayName: row.host.displayName, avatarUrl: row.host.avatarUrl }
      : null,
    canonicalUrl: `https://${domain}/events/${row.slug}`,
  };
}

// --- Contests ---

export interface PublicContest {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  bannerUrl: string | null;
  status: string;
  startDate: string;
  endDate: string;
  entryDeadline: string | null;
  judgingDeadline: string | null;
  prizeDescription: string | null;
  entryCount: number;
  communityVotingEnabled: boolean;
  createdAt: string;
  canonicalUrl: string;
}

export interface PublicContestRow {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  bannerUrl: string | null;
  status: string;
  startDate: Date;
  endDate: Date;
  entryDeadline: Date | null;
  judgingDeadline: Date | null;
  prizeDescription: string | null;
  entryCount?: number | null;
  communityVotingEnabled?: boolean | null;
  createdAt: Date;
  deletedAt?: Date | null;
}

const PUBLIC_CONTEST_STATUSES = new Set(['upcoming', 'active', 'judging', 'completed']);

export function isPublicContest(row: Pick<PublicContestRow, 'status' | 'deletedAt'>): boolean {
  if (row.deletedAt) return false;
  return PUBLIC_CONTEST_STATUSES.has(row.status);
}

export function toPublicContest(row: PublicContestRow, domain: string): PublicContest {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description,
    bannerUrl: row.bannerUrl,
    status: row.status,
    startDate: row.startDate.toISOString(),
    endDate: row.endDate.toISOString(),
    entryDeadline: row.entryDeadline?.toISOString() ?? null,
    judgingDeadline: row.judgingDeadline?.toISOString() ?? null,
    prizeDescription: row.prizeDescription,
    entryCount: row.entryCount ?? 0,
    communityVotingEnabled: row.communityVotingEnabled ?? false,
    createdAt: row.createdAt.toISOString(),
    canonicalUrl: `https://${domain}/contests/${row.slug}`,
  };
}

// --- Videos ---

export interface PublicVideo {
  id: string;
  title: string;
  description: string | null;
  url: string;
  embedUrl: string | null;
  thumbnailUrl: string | null;
  duration: number | null;
  category: { id: string; name: string; slug: string } | null;
  viewCount: number;
  likeCount: number;
  createdAt: string;
  author: Pick<PublicUser, 'id' | 'username' | 'displayName' | 'avatarUrl'>;
  canonicalUrl: string;
}

export interface PublicVideoRow {
  id: string;
  title: string;
  description: string | null;
  url: string;
  embedUrl?: string | null;
  thumbnailUrl: string | null;
  duration: number | null;
  categoryId?: string | null;
  category?: { id: string; name: string; slug: string } | null;
  viewCount: number | null;
  likeCount: number | null;
  createdAt: Date;
  deletedAt?: Date | null;
  author: { id: string; username: string; displayName: string | null; avatarUrl: string | null };
}

export function isPublicVideo(row: Pick<PublicVideoRow, 'deletedAt'>): boolean {
  return !row.deletedAt;
}

export function toPublicVideo(row: PublicVideoRow, domain: string): PublicVideo {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    url: row.url,
    embedUrl: row.embedUrl ?? null,
    thumbnailUrl: row.thumbnailUrl,
    duration: row.duration,
    category: row.category ?? null,
    viewCount: row.viewCount ?? 0,
    likeCount: row.likeCount ?? 0,
    createdAt: row.createdAt.toISOString(),
    author: {
      id: row.author.id,
      username: row.author.username,
      displayName: row.author.displayName,
      avatarUrl: row.author.avatarUrl,
    },
    canonicalUrl: `https://${domain}/videos/${row.id}`,
  };
}

// --- Docs sites ---

export interface PublicDocSite {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  pageCount: number;
  versionCount: number;
  defaultVersion: string | null;
  createdAt: string;
  owner: Pick<PublicUser, 'id' | 'username' | 'displayName'> | null;
  canonicalUrl: string;
}

export interface PublicDocSiteRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  pageCount?: number | null;
  versionCount?: number | null;
  defaultVersion?: string | null;
  createdAt: Date;
  deletedAt?: Date | null;
  owner?: { id: string; username: string; displayName: string | null } | null;
}

export function isPublicDocSite(row: Pick<PublicDocSiteRow, 'deletedAt'>): boolean {
  return !row.deletedAt;
}

export function toPublicDocSite(row: PublicDocSiteRow, domain: string): PublicDocSite {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    pageCount: row.pageCount ?? 0,
    versionCount: row.versionCount ?? 0,
    defaultVersion: row.defaultVersion ?? null,
    createdAt: row.createdAt.toISOString(),
    owner: row.owner
      ? { id: row.owner.id, username: row.owner.username, displayName: row.owner.displayName }
      : null,
    canonicalUrl: `https://${domain}/docs/${row.slug}`,
  };
}

// --- Tags ---

export interface PublicTag {
  id: string;
  name: string;
  slug: string;
  usageCount: number;
  canonicalUrl: string;
}

export interface PublicTagRow {
  id: string;
  name: string;
  slug: string;
  usageCount?: number | null;
}

export function toPublicTag(row: PublicTagRow, domain: string): PublicTag {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    usageCount: row.usageCount ?? 0,
    canonicalUrl: `https://${domain}/tags/${row.slug}`,
  };
}
