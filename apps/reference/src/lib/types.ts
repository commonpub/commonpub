import type { InferSelectModel } from 'drizzle-orm';
import type { contentItems, tags } from '@snaplify/schema';

export type ContentItem = InferSelectModel<typeof contentItems>;

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
  author: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
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
  parts: ContentItem['parts'];
  sections: ContentItem['sections'];
  forkCount: number;
  updatedAt: Date;
  tags: Array<{ id: string; name: string; slug: string }>;
  isLiked?: boolean;
  isBookmarked?: boolean;
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
  tags?: string[];
  sections?: unknown;
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
  tags?: string[];
  status?: string;
  sections?: unknown;
}

export interface ContentFilters {
  status?: string;
  type?: string;
  authorId?: string;
  tag?: string;
  search?: string;
  sort?: 'recent' | 'popular' | 'featured';
  featured?: boolean;
  difficulty?: string;
  limit?: number;
  offset?: number;
}

export type TagItem = InferSelectModel<typeof tags>;

// --- Learning types ---

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
  author: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
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

export interface LearningPathFilters {
  status?: string;
  difficulty?: string;
  authorId?: string;
  limit?: number;
  offset?: number;
}

// --- Community types ---

export interface CommunityListItem {
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
  createdBy: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
}

export interface CommunityDetail extends CommunityListItem {
  rules: string | null;
  updatedAt: Date;
  currentUserRole: string | null;
  isBanned: boolean;
}

export interface CommunityMemberItem {
  communityId: string;
  userId: string;
  role: string;
  joinedAt: Date;
  user: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
}

export interface CommunityPostItem {
  id: string;
  communityId: string;
  type: string;
  content: string;
  isPinned: boolean;
  isLocked: boolean;
  likeCount: number;
  replyCount: number;
  createdAt: Date;
  updatedAt: Date;
  author: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
  sharedContent?: {
    contentId: string;
    title: string;
    slug: string;
    type: string;
  };
}

export interface CommunityReplyItem {
  id: string;
  postId: string;
  content: string;
  likeCount: number;
  createdAt: Date;
  updatedAt: Date;
  parentId: string | null;
  author: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
  replies?: CommunityReplyItem[];
}

export interface CommunityFilters {
  search?: string;
  joinPolicy?: string;
  limit?: number;
  offset?: number;
}

export interface CommunityPostFilters {
  communityId: string;
  type?: string;
  limit?: number;
  offset?: number;
}

export interface CommunityInviteItem {
  id: string;
  token: string;
  maxUses: number | null;
  useCount: number;
  expiresAt: Date | null;
  createdAt: Date;
  createdBy: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
}

export interface CommunityBanItem {
  id: string;
  reason: string | null;
  expiresAt: Date | null;
  createdAt: Date;
  user: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
  bannedBy: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
}

// --- User profile types ---

export interface UserProfile {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  createdAt: Date;
  stats: {
    projects: number;
    guides: number;
    explainers: number;
    articles: number;
    followers: number;
    following: number;
  };
}

export interface CommentItem {
  id: string;
  content: string;
  likeCount: number;
  createdAt: Date;
  updatedAt: Date;
  parentId: string | null;
  author: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
  replies?: CommentItem[];
}
