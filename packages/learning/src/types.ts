import type { BlockTuple } from '@commonpub/editor';
import type { QuizQuestion } from '@commonpub/explainer';

// --- Enums ---

export type LessonType = 'article' | 'video' | 'quiz' | 'project' | 'explainer';
export type Difficulty = 'beginner' | 'intermediate' | 'advanced';
export type PathStatus = 'draft' | 'published' | 'archived';

// --- DB Row Shapes ---

export interface LearningPath {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  coverImageUrl: string | null;
  difficulty: Difficulty | null;
  estimatedHours: string | null;
  authorId: string;
  status: PathStatus;
  enrollmentCount: number;
  completionCount: number;
  averageRating: string | null;
  reviewCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface LearningModule {
  id: string;
  pathId: string;
  title: string;
  description: string | null;
  sortOrder: number;
  createdAt: Date;
}

export interface Lesson {
  id: string;
  moduleId: string;
  title: string;
  slug: string;
  type: LessonType;
  content: unknown;
  duration: number | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Enrollment {
  id: string;
  userId: string;
  pathId: string;
  progress: string;
  startedAt: Date;
  completedAt: Date | null;
}

export interface LessonProgressRecord {
  id: string;
  userId: string;
  lessonId: string;
  completed: boolean;
  completedAt: Date | null;
  quizScore: string | null;
  quizPassed: boolean | null;
}

export interface Certificate {
  id: string;
  userId: string;
  pathId: string;
  verificationCode: string;
  certificateUrl: string | null;
  issuedAt: Date;
}

// --- Input Types ---

export interface CreatePathInput {
  title: string;
  description?: string;
  coverImageUrl?: string;
  difficulty?: Difficulty;
  estimatedHours?: number;
}

export interface UpdatePathInput {
  title?: string;
  description?: string;
  coverImageUrl?: string;
  difficulty?: Difficulty;
  estimatedHours?: number;
  status?: PathStatus;
}

export interface CreateModuleInput {
  pathId: string;
  title: string;
  description?: string;
  sortOrder?: number;
}

export interface UpdateModuleInput {
  title?: string;
  description?: string;
  sortOrder?: number;
}

export interface CreateLessonInput {
  moduleId: string;
  title: string;
  type: LessonType;
  content?: LessonContent;
  durationMinutes?: number;
}

export interface UpdateLessonInput {
  title?: string;
  type?: LessonType;
  content?: LessonContent;
  durationMinutes?: number;
}

// --- Lesson Content Discriminated Union ---

export interface ArticleLessonContent {
  type: 'article';
  blocks: BlockTuple[];
}

export interface VideoLessonContent {
  type: 'video';
  url: string;
  platform?: string;
}

export interface QuizLessonContent {
  type: 'quiz';
  questions: QuizQuestion[];
  passingScore: number;
}

export interface ProjectLessonContent {
  type: 'project';
  slug: string;
}

export interface ExplainerLessonContent {
  type: 'explainer';
  slug: string;
}

export type LessonContent =
  | ArticleLessonContent
  | VideoLessonContent
  | QuizLessonContent
  | ProjectLessonContent
  | ExplainerLessonContent;

// --- Computed Types ---

export type LessonStatus = 'completed' | 'current' | 'locked';

export interface CurriculumNode {
  module: LearningModule;
  lessons: Array<{
    lesson: Lesson;
    status: LessonStatus;
  }>;
  completionPercentage: number;
}

export interface CertificateData {
  pathTitle: string;
  earnerName: string;
  issuedAt: Date;
  verificationCode: string;
  formattedDate: string;
}
