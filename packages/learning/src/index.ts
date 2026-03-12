// Types
export type {
  LessonType,
  Difficulty,
  PathStatus,
  LearningPath,
  LearningModule,
  Lesson,
  Enrollment,
  LessonProgressRecord,
  Certificate,
  CreatePathInput,
  UpdatePathInput,
  CreateModuleInput,
  UpdateModuleInput,
  CreateLessonInput,
  UpdateLessonInput,
  ArticleLessonContent,
  VideoLessonContent,
  QuizLessonContent,
  ProjectLessonContent,
  ExplainerLessonContent,
  LessonContent,
  LessonStatus,
  CurriculumNode,
  CertificateData,
} from './types.js';

// Validators
export {
  updateLearningPathSchema,
  createModuleSchema,
  updateModuleSchema,
  updateLessonSchema,
  lessonContentSchema,
} from './validators.js';

// Progress
export {
  calculatePathProgress,
  isPathComplete,
  getNextLesson,
  getLessonStatus,
  getCompletionPercentageByModule,
} from './progress.js';

// Certificate
export {
  generateVerificationCode,
  formatCertificateData,
  buildVerificationUrl,
} from './certificate.js';

// Curriculum
export {
  flattenLessons,
  countLessons,
  calculateEstimatedDuration,
  formatDuration,
  buildCurriculumTree,
  reorderItems,
} from './curriculum.js';
