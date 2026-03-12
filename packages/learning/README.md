# @commonpub/learning

Learning path engine for CommonPub.

## Overview

Structured learning paths with modules, lessons, enrollment, progress tracking, and certificate generation. Lesson types include articles, videos, quizzes, projects, and interactive explainers (via `@commonpub/explainer`).

## Installation

```bash
pnpm add @commonpub/learning
```

## Core Concepts

```
Learning Path
  -> Module (ordered)
       -> Lesson (ordered)
            - article:   Rich text content
            - video:     Video with transcript
            - quiz:      Questions with scoring
            - project:   Hands-on build exercise
            - explainer: Interactive explainer module
```

## Usage

### Progress Tracking

```ts
import {
  calculatePathProgress,
  isPathComplete,
  getNextLesson,
  getLessonStatus,
  getCompletionPercentageByModule,
} from '@commonpub/learning';

// Calculate overall path progress
const progress = calculatePathProgress(path, completedLessonIds);
// { completed: 8, total: 12, percentage: 66.7 }

// Check if a path is 100% complete
const done = isPathComplete(path, completedLessonIds);

// Get the next incomplete lesson
const next = getNextLesson(path, completedLessonIds);

// Get status for a specific lesson
const status = getLessonStatus(lessonId, completedLessonIds);
// 'completed' | 'in_progress' | 'locked'

// Progress by module
const moduleProgress = getCompletionPercentageByModule(path, completedLessonIds);
// { 'module-1': 100, 'module-2': 50, 'module-3': 0 }
```

### Certificates

Auto-generated at 100% path completion with verifiable codes:

```ts
import {
  generateVerificationCode,
  formatCertificateData,
  buildVerificationUrl,
} from '@commonpub/learning';

// Generate a verification code
const code = generateVerificationCode();
// 'SNAP-A1B2C3-4D5E6F78'

// Format certificate data for display
const cert = formatCertificateData({
  userName: 'Alice',
  pathTitle: 'Electronics 101',
  completedAt: new Date(),
  verificationCode: code,
});

// Build the public verification URL
const url = buildVerificationUrl('hack.build', code);
// 'https://hack.build/certificates/SNAP-A1B2C3-4D5E6F78'
```

### Curriculum Utilities

```ts
import {
  flattenLessons,
  countLessons,
  calculateEstimatedDuration,
  formatDuration,
  buildCurriculumTree,
  reorderItems,
} from '@commonpub/learning';

// Flatten all lessons across modules
const allLessons = flattenLessons(path);

// Count total lessons
const count = countLessons(path); // 12

// Estimate total duration
const minutes = calculateEstimatedDuration(path); // 180
const formatted = formatDuration(180); // '3h 0m'

// Build a tree for rendering
const tree = buildCurriculumTree(path);

// Reorder items (drag-and-drop support)
const reordered = reorderItems(items, fromIndex, toIndex);
```

### Validators

```ts
import {
  updateLearningPathSchema,
  createModuleSchema,
  updateModuleSchema,
  updateLessonSchema,
  lessonContentSchema,
} from '@commonpub/learning';
```

## Lesson Content Types

```ts
type LessonContent =
  | ArticleLessonContent   // { type: 'article', blocks: BlockTuple[] }
  | VideoLessonContent     // { type: 'video', url: string, transcript?: string }
  | QuizLessonContent      // { type: 'quiz', questions: QuizQuestion[] }
  | ProjectLessonContent   // { type: 'project', instructions: BlockTuple[], requirements: string[] }
  | ExplainerLessonContent // { type: 'explainer', explainerId: string }
```

## Development

```bash
pnpm build        # Compile TypeScript
pnpm test         # Run 75 tests
pnpm typecheck    # Type-check without emitting
```

## Dependencies

- `zod`: Input validation
- `@commonpub/schema`: Table definitions
- `@commonpub/config`: Feature flags
- `@commonpub/explainer`: Explainer lesson type integration
- `@commonpub/editor`: BlockTuple types for article content
