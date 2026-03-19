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
  createdAt: Date;
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
  type: ContentType;
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
  publishedAt: Date | null;
  createdAt: Date;
  author: UserRef;
}

export interface ContentDetailAuthor extends UserRef {
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
  category: string | null;
  buildTime: string | null;
  estimatedCost: string | null;
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
  replyCount: number;
  createdAt: Date;
  updatedAt: Date;
  author: UserRef;
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
  author: UserRef;
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
