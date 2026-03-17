import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

/** Framework-agnostic database type for Drizzle ORM with node-postgres */
export type DB = NodePgDatabase;

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
  type: string;
  title: string;
  slug: string;
  description: string | null;
  coverImageUrl: string | null;
  status: string;
  difficulty: string | null;
  viewCount: number;
  likeCount: number;
  commentCount: number;
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
  type: string;
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
  visibility: string;
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

export interface ContentFilters {
  status?: string;
  type?: string;
  authorId?: string;
  featured?: boolean;
  difficulty?: string;
  search?: string;
  tag?: string;
  sort?: 'recent' | 'popular' | 'featured';
  limit?: number;
  offset?: number;
}

export interface CreateContentInput {
  type: string;
  title: string;
  subtitle?: string;
  description?: string;
  content?: unknown;
  coverImageUrl?: string;
  category?: string;
  difficulty?: string;
  buildTime?: string;
  estimatedCost?: string;
  visibility?: string;
  seoDescription?: string;
  sections?: unknown;
  tags?: string[];
}

export interface UpdateContentInput {
  title?: string;
  subtitle?: string;
  description?: string;
  content?: unknown;
  coverImageUrl?: string;
  category?: string;
  difficulty?: string;
  seoDescription?: string;
  sections?: unknown;
  buildTime?: string;
  estimatedCost?: string;
  visibility?: string;
  status?: string;
  tags?: string[];
}

// --- Hub Types ---

export interface HubListItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  iconUrl: string | null;
  bannerUrl: string | null;
  joinPolicy: string;
  isOfficial: boolean;
  memberCount: number;
  postCount: number;
  createdAt: Date;
  createdBy: UserRef;
}

export interface HubDetail extends HubListItem {
  rules: string | null;
  updatedAt: Date;
  currentUserRole: string | null;
  isBanned: boolean;
  hubType: string;
  privacy: string;
  website: string | null;
  categories: string[] | null;
}

export interface HubFilters {
  search?: string;
  joinPolicy?: string;
  limit?: number;
  offset?: number;
}

export interface HubMemberItem {
  hubId: string;
  userId: string;
  role: string;
  joinedAt: Date;
  user: UserRef;
}

export interface HubPostItem {
  id: string;
  hubId: string;
  type: string;
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

export interface HubPostFilters {
  hubId?: string;
  type?: string;
  limit?: number;
  offset?: number;
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
  difficulty: string | null;
  estimatedHours: string | null;
  enrollmentCount: number;
  completionCount: number;
  averageRating: string | null;
  status: string;
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
      type: string;
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

export interface LearningPathFilters {
  status?: string;
  difficulty?: string;
  authorId?: string;
  limit?: number;
  offset?: number;
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
    difficulty: string | null;
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
