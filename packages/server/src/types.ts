import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from '@commonpub/schema';
import type {
  ContentType,
  ContentStatus,
  Difficulty,
  HubType,
  JoinPolicy,
  HubPrivacy,
  HubRole,
  PostType,
  LessonType,
  ContentFilters as SchemaContentFilters,
  HubFilters as SchemaHubFilters,
  LearningPathFilters as SchemaLearningPathFilters,
  HubPostFilters as SchemaHubPostFilters,
} from '@commonpub/schema';

/** Framework-agnostic database type for Drizzle ORM with node-postgres */
export type DB = NodePgDatabase<typeof schema>;

// --- Utility Types ---

/** JSON serialization converts Date → string. Use on API response types for frontend. */
export type Serialized<T> = {
  [K in keyof T]: T[K] extends Date ? string
    : T[K] extends Date | null ? string | null
    : T[K] extends Date | undefined ? string | undefined
    : T[K] extends Array<infer U> ? Array<Serialized<U>>
    : T[K] extends Record<string, unknown> ? Serialized<T[K]>
    : T[K];
};

/** Paginated response wrapper */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
}

// --- Re-export literal union types from schema ---
export type { ContentType, ContentStatus, Difficulty, HubType, JoinPolicy, HubPrivacy, HubRole, PostType, LessonType } from '@commonpub/schema';

// --- Re-export filter types from schema (now typed with literal unions) ---
export type ContentFilters = SchemaContentFilters;
export type HubFilters = SchemaHubFilters;
export type LearningPathFilters = SchemaLearningPathFilters;
export type HubPostFilters = SchemaHubPostFilters;

// --- Re-export input types from schema (no longer duplicated here) ---
export type {
  CreateContentInput,
  UpdateContentInput,
  CreateHubInput,
  UpdateHubInput,
  CreatePostInput,
  CreateReplyInput,
  CreateLearningPathInput,
  UpdateLearningPathInput,
  CreateModuleInput,
  CreateLessonInput,
  CreateDocsSiteInput,
  CreateDocsPageInput,
  CreateDocsVersionInput,
  CreateVideoInput,
  CreateProductInput,
  UpdateProductInput,
  CreateCommentInput,
  CreateReportInput,
  SendMessageInput,
  CreateConversationInput,
  BanUserInput,
  ChangeRoleInput,
  CreateInviteInput,
  AdminSettingInput,
} from '@commonpub/schema';

// --- User Types ---

export interface UserRef {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface UserProfile {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  headline: string | null;
  location: string | null;
  website: string | null;
  bannerUrl: string | null;
  socialLinks: {
    github?: string;
    twitter?: string;
    linkedin?: string;
    youtube?: string;
    instagram?: string;
    mastodon?: string;
    discord?: string;
  } | null;
  skills: string[] | null;
  experience: Array<{
    title: string;
    company: string;
    startDate: string;
    endDate: string;
    description: string;
  }> | null;
  pronouns: string | null;
  emailNotifications: {
    digest?: 'daily' | 'weekly' | 'none';
    likes?: boolean;
    comments?: boolean;
    follows?: boolean;
    mentions?: boolean;
  } | null;
  createdAt: Date;
  followerCount: number;
  followingCount: number;
  viewCount: number;
  likeCount: number;
  stats: {
    projects: number;
    explainers: number;
    articles: number;
    followers: number;
    following: number;
  };
}

// --- Content Types ---

export interface ContentListItem {
  id: string;
  type: ContentType | string;
  title: string;
  slug: string;
  description: string | null;
  coverImageUrl: string | null;
  status: ContentStatus;
  difficulty: Difficulty | null;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  buildCount: number;
  isFeatured?: boolean;
  isEditorial?: boolean;
  editorialNote?: string | null;
  categoryId?: string | null;
  categoryName?: string | null;
  categorySlug?: string | null;
  categoryColor?: string | null;
  categoryIcon?: string | null;
  publishedAt: Date | null;
  createdAt: Date;
  author: UserRef;
  /** Present when item is from a federated instance */
  source?: 'local' | 'federated';
  /** Origin instance domain (e.g., 'deveco.io') */
  sourceDomain?: string;
  /** AP object URI of the original content */
  sourceUri?: string;
  /** ID in federated_content table — used for federation API calls */
  federatedContentId?: string;
}

export interface ContentDetailAuthor extends UserRef {
  bannerUrl?: string | null;
  bio?: string | null;
  headline?: string | null;
  followerCount?: number;
  articleCount?: number;
  totalViews?: number;
}

export interface ContentRelatedItem {
  id: string;
  type: ContentType;
  slug: string;
  title: string;
  viewCount: number;
  coverImageUrl: string | null;
}

export interface ContentDetail extends ContentListItem {
  subtitle: string | null;
  content: unknown;
  bannerUrl: string | null;
  category: string | null;
  buildTime: string | null;
  estimatedCost: string | null;
  estimatedMinutes: number | null;
  licenseType: string | null;
  series: string | null;
  visibility: 'public' | 'members' | 'private';
  isFeatured: boolean;
  seoDescription: string | null;
  previewToken: string | null;
  parts: unknown;
  sections: unknown;
  forkCount: number;
  updatedAt: Date;
  tags: Array<{ id: string; name: string; slug: string }>;
  author: ContentDetailAuthor;
  related?: ContentRelatedItem[];
}

// --- Hub Types ---

export interface HubListItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  hubType: 'community' | 'product' | 'company';
  iconUrl: string | null;
  bannerUrl: string | null;
  joinPolicy: JoinPolicy;
  isOfficial: boolean;
  memberCount: number;
  postCount: number;
  createdAt: Date;
  createdBy: UserRef;
}

export interface HubDetail extends HubListItem {
  rules: string | null;
  updatedAt: Date;
  currentUserRole: HubRole | null;
  isBanned: boolean;
  hubType: HubType;
  privacy: HubPrivacy;
  website: string | null;
  categories: string[] | null;
}

export interface HubMemberItem {
  hubId: string;
  userId: string;
  role: HubRole;
  joinedAt: Date;
  user: UserRef;
}

export interface HubPostItem {
  id: string;
  hubId: string;
  type: PostType;
  content: string;
  isPinned: boolean;
  isLocked: boolean;
  likeCount: number;
  voteScore: number;
  replyCount: number;
  createdAt: Date;
  updatedAt: Date;
  /** Local author (null for federated posts from remote members) */
  author: UserRef | null;
  /** Remote actor URI for federated posts */
  remoteActorUri?: string | null;
  /** Cached display name of remote actor */
  remoteActorName?: string | null;
  /** Avatar URL resolved from remoteActors cache */
  remoteActorAvatarUrl?: string | null;
  sharedContent?: unknown;
}

export interface HubReplyItem {
  id: string;
  postId: string;
  content: string;
  likeCount: number;
  createdAt: Date;
  updatedAt: Date;
  parentId: string | null;
  /** Local author (null for federated replies) */
  author: UserRef | null;
  /** Remote actor URI for federated replies */
  remoteActorUri?: string | null;
  /** Cached display name of remote actor */
  remoteActorName?: string | null;
  /** Avatar URL resolved from remoteActors cache */
  remoteActorAvatarUrl?: string | null;
  replies?: HubReplyItem[];
}

export interface HubInviteItem {
  id: string;
  token: string;
  maxUses: number | null;
  useCount: number;
  expiresAt: Date | null;
  createdAt: Date;
  createdBy: UserRef;
}

export interface HubBanItem {
  id: string;
  reason: string | null;
  expiresAt: Date | null;
  createdAt: Date;
  user: UserRef;
  bannedBy: UserRef;
}

// --- Federated Hub Types ---

export interface FederatedHubListItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  hubType: string;
  iconUrl: string | null;
  bannerUrl: string | null;
  memberCount: number;
  postCount: number;
  originDomain: string;
  url: string | null;
  actorUri: string;
  followStatus: 'pending' | 'accepted' | 'rejected';
  receivedAt: Date;
  source: 'federated';
}

export interface SharedContentMeta {
  type: string;
  title: string;
  summary?: string | null;
  coverImageUrl?: string | null;
  originUrl?: string | null;
  originDomain?: string | null;
}

export interface FederatedHubPostItem {
  id: string;
  federatedHubId: string;
  content: string;
  postType: string;
  isPinned: boolean;
  localLikeCount: number;
  localReplyCount: number;
  remoteLikeCount: number;
  remoteReplyCount: number;
  publishedAt: Date | null;
  receivedAt: Date;
  objectUri: string;
  sharedContentMeta: SharedContentMeta | null;
  author: {
    actorUri: string;
    preferredUsername: string | null;
    displayName: string | null;
    avatarUrl: string | null;
    instanceDomain: string;
  };
  source: 'federated';
}

export interface FederatedHubPostReplyItem {
  id: string;
  federatedHubPostId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  parentId: string | null;
  author: UserRef | null;
  remoteActorUri?: string | null;
  remoteActorName?: string | null;
  remoteActorAvatarUrl?: string | null;
  replies?: FederatedHubPostReplyItem[];
}

// --- Social Types ---

export interface CommentItem {
  id: string;
  content: string;
  likeCount: number;
  createdAt: Date;
  updatedAt: Date;
  parentId: string | null;
  author: UserRef;
  replies?: CommentItem[];
}

// --- Learning Types ---

export interface LearningPathListItem {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  coverImageUrl: string | null;
  difficulty: Difficulty | null;
  estimatedHours: string | null;
  enrollmentCount: number;
  completionCount: number;
  averageRating: string | null;
  moduleCount: number;
  status: ContentStatus;
  createdAt: Date;
  author: UserRef;
}

export interface LearningPathDetail extends LearningPathListItem {
  reviewCount: number;
  updatedAt: Date;
  modules: Array<{
    id: string;
    title: string;
    description: string | null;
    sortOrder: number;
    lessons: Array<{
      id: string;
      title: string;
      slug: string;
      type: LessonType;
      duration: number | null;
      sortOrder: number;
    }>;
  }>;
  isEnrolled: boolean;
  enrollment: {
    id: string;
    progress: string;
    startedAt: Date;
    completedAt: Date | null;
  } | null;
}

export interface EnrollmentItem {
  id: string;
  progress: string;
  startedAt: Date;
  completedAt: Date | null;
  path: {
    id: string;
    title: string;
    slug: string;
    coverImageUrl: string | null;
    difficulty: Difficulty | null;
  };
}

export interface CertificateItem {
  id: string;
  verificationCode: string;
  issuedAt: Date;
  path: {
    id: string;
    title: string;
    slug: string;
  };
}
