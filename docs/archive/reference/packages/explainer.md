# @commonpub/explainer

> Interactive explainer module runtime: section registry, quiz engine, progress tracking, rendering, and HTML export.

**npm**: `@commonpub/explainer`
**Source**: `packages/explainer/src/`
**Entry**: `packages/explainer/src/index.ts`

---

## Exports

### Types (25)

| Export | Kind | Description |
|--------|------|-------------|
| `ExplainerSectionType` | Type | `'text' \| 'interactive' \| 'quiz' \| 'checkpoint'` |
| `ExplainerDifficulty` | Type | Difficulty level |
| `VisualConfig` | Type | Visual configuration for interactive sections |
| `SliderControl` | Type | Slider input control |
| `ToggleControl` | Type | Toggle input control |
| `SelectControl` | Type | Select dropdown control |
| `InteractiveControl` | Type | Union of slider, toggle, select controls |
| `QuizOption` | Type | Single quiz answer option |
| `QuizQuestion` | Type | Quiz question with options |
| `ExplainerSectionBase` | Type | Base section fields |
| `TextSection` | Type | Text-only section |
| `InteractiveSection` | Type | Interactive section with controls |
| `QuizSection` | Type | Quiz section with questions |
| `CheckpointSection` | Type | Checkpoint/gate section |
| `ExplainerSection` | Type | Union of all section types |
| `ExplainerMeta` | Type | Explainer metadata |
| `SectionDefinition` | Type | Registration shape for section types |
| `SectionProgress` | Type | Progress state for a single section |
| `ExplainerProgressState` | Type | Progress state for entire explainer |
| `TocItem` | Type | Table of contents entry |
| `ExportOptions` | Type | HTML export configuration |
| `AnswerResult` | Type | Result of checking a single answer |
| `QuizResult` | Type | Result of scoring a quiz |

### Schemas (7)

| Export | Kind | Description |
|--------|------|-------------|
| `textSectionSchema` | Zod Schema | Text section validator |
| `interactiveSectionSchema` | Zod Schema | Interactive section validator |
| `quizSectionSchema` | Zod Schema | Quiz section validator |
| `checkpointSectionSchema` | Zod Schema | Checkpoint section validator |
| `explainerSectionSchema` | Zod Schema | Union section validator |
| `explainerSectionsSchema` | Zod Schema | Array of sections validator |
| `explainerMetaSchema` | Zod Schema | Explainer metadata validator |

### Section Registry (6)

| Export | Kind | Description |
|--------|------|-------------|
| `registerSectionType` | Function | Register a custom section type |
| `lookupSectionType` | Function | Look up a section type by name |
| `listSectionTypes` | Function | List all registered section types |
| `validateSection` | Function | Validate a section against its schema |
| `clearRegistry` | Function | Clear all registrations (for testing) |
| `registerCoreSectionTypes` | Function | Register the 4 built-in section types |

### Quiz Engine (5)

| Export | Kind | Description |
|--------|------|-------------|
| `checkAnswer` | Function | Check a single answer against correct value |
| `scoreQuiz` | Function | Score an entire quiz |
| `isQuizPassed` | Function | Check if quiz score meets passing threshold |
| `validateQuizAnswers` | Function | Validate answer format before scoring |
| `shuffleOptions` | Function | Randomize quiz option order |

### Progress Tracker (6)

| Export | Kind | Description |
|--------|------|-------------|
| `createProgressState` | Function | Initialize progress state for an explainer |
| `markSectionCompleted` | Function | Mark a section as completed |
| `canAccessSection` | Function | Check if a section is accessible (respects gating) |
| `getCompletionPercentage` | Function | Calculate overall completion percentage |
| `getNextIncompleteSection` | Function | Find the next section to complete |
| `isExplainerComplete` | Function | Check if all sections are completed |

### Rendering (5)

| Export | Kind | Description |
|--------|------|-------------|
| `generateToc` | Function | Generate table of contents from sections |
| `renderBlockTuples` | Function | Render BlockTuples to HTML |
| `renderQuizHtml` | Function | Render quiz section to HTML |
| `renderControlsHtml` | Function | Render interactive controls to HTML |
| `renderCheckpointHtml` | Function | Render checkpoint section to HTML |
| `renderSection` | Function | Render any section type to HTML |

### Export (1)

| Export | Kind | Description |
|--------|------|-------------|
| `generateExplainerHtml` | Function | Generate complete standalone HTML export |

---

## API Reference

### Section Types

#### `TextSection`

```typescript
interface TextSection extends ExplainerSectionBase {
  type: 'text';
  content: BlockTuple[];   // Rich text content
}
```

#### `InteractiveSection`

```typescript
interface InteractiveSection extends ExplainerSectionBase {
  type: 'interactive';
  content: BlockTuple[];
  controls: InteractiveControl[];
  visualConfig?: VisualConfig;
}

type InteractiveControl = SliderControl | ToggleControl | SelectControl;

interface SliderControl {
  type: 'slider';
  id: string;
  label: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
}

interface ToggleControl {
  type: 'toggle';
  id: string;
  label: string;
  defaultValue: boolean;
}

interface SelectControl {
  type: 'select';
  id: string;
  label: string;
  options: { value: string; label: string }[];
  defaultValue: string;
}
```

#### `QuizSection`

```typescript
interface QuizSection extends ExplainerSectionBase {
  type: 'quiz';
  questions: QuizQuestion[];
  passingScore: number;        // 0–100
  showCorrectAnswers: boolean;
}

interface QuizQuestion {
  id: string;
  question: string;
  options: QuizOption[];
  correctOptionId: string;
  explanation?: string;
}

interface QuizOption {
  id: string;
  text: string;
}
```

#### `CheckpointSection`

```typescript
interface CheckpointSection extends ExplainerSectionBase {
  type: 'checkpoint';
  requiredSections: string[];  // IDs of sections that must be completed
  message: string;
}
```

### Quiz Engine

#### `checkAnswer(question: QuizQuestion, selectedOptionId: string): AnswerResult`

```typescript
interface AnswerResult {
  correct: boolean;
  correctOptionId: string;
  explanation?: string;
}
```

#### `scoreQuiz(questions: QuizQuestion[], answers: Record<string, string>): QuizResult`

```typescript
interface QuizResult {
  score: number;          // 0–100
  correct: number;
  total: number;
  results: AnswerResult[];
}
```

#### `isQuizPassed(score: number, passingScore: number): boolean`

Returns `true` if `score >= passingScore`.

#### `validateQuizAnswers(questions: QuizQuestion[], answers: Record<string, string>): boolean`

Validates that all questions have corresponding answers.

#### `shuffleOptions(options: QuizOption[]): QuizOption[]`

Returns a new array with options in random order.

### Progress Tracker

#### `createProgressState(sections: ExplainerSection[]): ExplainerProgressState`

```typescript
interface ExplainerProgressState {
  sections: Record<string, SectionProgress>;
  completedCount: number;
  totalCount: number;
}

interface SectionProgress {
  sectionId: string;
  completed: boolean;
  completedAt?: Date;
  quizScore?: number;
}
```

#### `markSectionCompleted(state: ExplainerProgressState, sectionId: string, quizScore?: number): ExplainerProgressState`

Returns a new state with the section marked complete.

#### `canAccessSection(state: ExplainerProgressState, section: ExplainerSection, allSections: ExplainerSection[]): boolean`

Checks gating rules — checkpoint sections block access until prerequisites are met.

#### `getCompletionPercentage(state: ExplainerProgressState): number`

Returns 0–100 percentage.

#### `getNextIncompleteSection(state: ExplainerProgressState, sections: ExplainerSection[]): ExplainerSection | null`

Returns the next section that hasn't been completed, or null if all done.

#### `isExplainerComplete(state: ExplainerProgressState): boolean`

Returns `true` if all sections are completed.

### HTML Export

#### `generateExplainerHtml(meta: ExplainerMeta, sections: ExplainerSection[], options?: ExportOptions): string`

Generates a complete standalone HTML file containing the entire explainer. Includes inline CSS, rendered sections, and embedded quiz/interactive states.

```typescript
interface ExplainerMeta {
  title: string;
  description?: string;
  difficulty?: string;
  estimatedMinutes?: number;
}

interface ExportOptions {
  includeStyles?: boolean;   // Default: true
  includeScripts?: boolean;  // Default: true
  theme?: string;
}
```

---

## Internal Architecture

```
packages/explainer/src/
├── index.ts              → All exports
├── types.ts              → 25 type definitions
├── schemas.ts            → 7 Zod validation schemas
├── sections/
│   └── registry.ts       → registerSectionType, lookupSectionType, listSectionTypes, validateSection, clearRegistry, registerCoreSectionTypes
├── quiz/
│   └── engine.ts         → checkAnswer, scoreQuiz, isQuizPassed, validateQuizAnswers, shuffleOptions
├── progress/
│   └── tracker.ts        → createProgressState, markSectionCompleted, canAccessSection, getCompletionPercentage, getNextIncompleteSection, isExplainerComplete
├── render/
│   ├── tocGenerator.ts   → generateToc
│   └── sectionRenderer.ts → renderBlockTuples, renderQuizHtml, renderControlsHtml, renderCheckpointHtml, renderSection
└── export/
    └── htmlExporter.ts   → generateExplainerHtml
```
