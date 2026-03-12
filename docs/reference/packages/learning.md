# @commonpub/learning

> Learning path engine: progress calculation, certificate generation, and curriculum utilities.

**npm**: `@commonpub/learning`
**Source**: `packages/learning/src/`
**Entry**: `packages/learning/src/index.ts`

---

## Exports

### Types (27)

| Export | Kind | Description |
|--------|------|-------------|
| `LessonType` | Type | `'article' \| 'video' \| 'quiz' \| 'project' \| 'explainer'` |
| `Difficulty` | Type | `'beginner' \| 'intermediate' \| 'advanced'` |
| `PathStatus` | Type | `'draft' \| 'published' \| 'archived'` |
| `LearningPath` | Type | Full learning path shape |
| `LearningModule` | Type | Module within a path |
| `Lesson` | Type | Individual lesson |
| `Enrollment` | Type | User enrollment record |
| `LessonProgressRecord` | Type | Per-lesson progress record |
| `Certificate` | Type | Completion certificate |
| `CreatePathInput` | Type | Input for creating a path |
| `UpdatePathInput` | Type | Input for updating a path |
| `CreateModuleInput` | Type | Input for creating a module |
| `UpdateModuleInput` | Type | Input for updating a module |
| `CreateLessonInput` | Type | Input for creating a lesson |
| `UpdateLessonInput` | Type | Input for updating a lesson |
| `ArticleLessonContent` | Type | Article-type lesson content |
| `VideoLessonContent` | Type | Video-type lesson content |
| `QuizLessonContent` | Type | Quiz-type lesson content |
| `ProjectLessonContent` | Type | Project-type lesson content |
| `ExplainerLessonContent` | Type | Explainer-type lesson content |
| `LessonContent` | Type | Union of all lesson content types |
| `LessonStatus` | Type | Computed lesson status |
| `CurriculumNode` | Type | Hierarchical curriculum tree node |
| `CertificateData` | Type | Data for certificate rendering |

### Validators (5)

| Export | Kind | Description |
|--------|------|-------------|
| `updateLearningPathSchema` | Zod Schema | Path update validator |
| `createModuleSchema` | Zod Schema | Module creation validator |
| `updateModuleSchema` | Zod Schema | Module update validator |
| `updateLessonSchema` | Zod Schema | Lesson update validator |
| `lessonContentSchema` | Zod Schema | Lesson content validator |

### Progress (5)

| Export | Kind | Description |
|--------|------|-------------|
| `calculatePathProgress` | Function | Calculate overall path progress percentage |
| `isPathComplete` | Function | Check if all lessons are completed |
| `getNextLesson` | Function | Get the next incomplete lesson |
| `getLessonStatus` | Function | Get computed status for a lesson |
| `getCompletionPercentageByModule` | Function | Get per-module completion stats |

### Certificate (3)

| Export | Kind | Description |
|--------|------|-------------|
| `generateVerificationCode` | Function | Generate unique certificate verification code |
| `formatCertificateData` | Function | Format data for certificate rendering |
| `buildVerificationUrl` | Function | Build public verification URL |

### Curriculum (6)

| Export | Kind | Description |
|--------|------|-------------|
| `flattenLessons` | Function | Flatten modules/lessons into ordered list |
| `countLessons` | Function | Count total lessons across modules |
| `calculateEstimatedDuration` | Function | Sum lesson durations |
| `formatDuration` | Function | Format minutes as human-readable string |
| `buildCurriculumTree` | Function | Build hierarchical curriculum tree |
| `reorderItems` | Function | Reorder items by sortOrder |

---

## API Reference

### Progress

#### `calculatePathProgress(lessons: Lesson[], progress: LessonProgressRecord[]): number`

Calculates the overall progress percentage (0–100) for a learning path.

**Parameters**:
- `lessons`: All lessons in the path (across all modules)
- `progress`: User's lesson progress records

**Returns**: Number 0–100.

#### `isPathComplete(lessons: Lesson[], progress: LessonProgressRecord[]): boolean`

Returns `true` if every lesson has a completed progress record.

#### `getNextLesson(lessons: Lesson[], progress: LessonProgressRecord[]): Lesson | null`

Returns the first lesson (by module sortOrder, then lesson sortOrder) that hasn't been completed.

#### `getLessonStatus(lesson: Lesson, progress: LessonProgressRecord | null): LessonStatus`

Returns the computed status for a lesson based on its progress record.

```typescript
interface LessonStatus {
  completed: boolean;
  completedAt?: Date;
  quizScore?: number;
  quizPassed?: boolean;
}
```

#### `getCompletionPercentageByModule(modules: LearningModule[], lessons: Lesson[], progress: LessonProgressRecord[]): Record<string, number>`

Returns a map of `moduleId → completion percentage`.

### Certificate

#### `generateVerificationCode(): string`

Generates a unique, URL-safe verification code for certificates.

#### `formatCertificateData(path: LearningPath, user: { username: string; displayName?: string }, enrollment: Enrollment): CertificateData`

Formats all data needed to render a certificate.

```typescript
interface CertificateData {
  pathTitle: string;
  recipientName: string;
  completedAt: Date;
  verificationCode: string;
  verificationUrl: string;
}
```

#### `buildVerificationUrl(domain: string, code: string): string`

Returns `https://{domain}/certificates/{code}`.

### Curriculum

#### `flattenLessons(modules: LearningModule[], lessons: Lesson[]): Lesson[]`

Flattens the module → lesson hierarchy into a single ordered list, sorted by module `sortOrder` then lesson `sortOrder`.

#### `countLessons(modules: LearningModule[], lessons: Lesson[]): number`

Returns the total number of lessons across all modules.

#### `calculateEstimatedDuration(lessons: Lesson[]): number`

Sums the `duration` field (in minutes) across all lessons. Lessons without duration are counted as 0.

#### `formatDuration(minutes: number): string`

Formats minutes as human-readable string (e.g., `"2h 30m"`, `"45m"`).

#### `buildCurriculumTree(modules: LearningModule[], lessons: Lesson[]): CurriculumNode[]`

Builds a hierarchical tree: `[{ module, lessons: [...] }]`.

```typescript
interface CurriculumNode {
  module: LearningModule;
  lessons: Lesson[];
}
```

#### `reorderItems<T extends { sortOrder: number }>(items: T[], itemId: string, newIndex: number): T[]`

Reorders items in a list, updating `sortOrder` values. Used for drag-and-drop reordering of modules and lessons.

---

## Lesson Content Types

Each lesson type has a specific content shape stored in `learningLessons.content` (jsonb):

```typescript
interface ArticleLessonContent {
  blocks: BlockTuple[];        // TipTap content
}

interface VideoLessonContent {
  url: string;
  platform: 'youtube' | 'vimeo' | 'other';
  embedUrl?: string;
}

interface QuizLessonContent {
  questions: QuizQuestion[];   // From @commonpub/explainer
  passingScore: number;
}

interface ProjectLessonContent {
  instructions: BlockTuple[];
  starterCode?: string;
  submissionType: 'url' | 'text';
}

interface ExplainerLessonContent {
  explainerId: string;         // References a contentItem of type 'explainer'
}

type LessonContent =
  | ArticleLessonContent
  | VideoLessonContent
  | QuizLessonContent
  | ProjectLessonContent
  | ExplainerLessonContent;
```

---

## Internal Architecture

```
packages/learning/src/
├── index.ts         → All exports
├── types.ts         → 27 type definitions
├── validators.ts    → 5 Zod validation schemas
├── progress.ts      → calculatePathProgress, isPathComplete, getNextLesson, getLessonStatus, getCompletionPercentageByModule
├── certificate.ts   → generateVerificationCode, formatCertificateData, buildVerificationUrl
└── curriculum.ts    → flattenLessons, countLessons, calculateEstimatedDuration, formatDuration, buildCurriculumTree, reorderItems
```
