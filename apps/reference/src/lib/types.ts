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
}

export interface ContentFilters {
  status?: string;
  type?: string;
  authorId?: string;
  tag?: string;
  limit?: number;
  offset?: number;
}

export type TagItem = InferSelectModel<typeof tags>;
