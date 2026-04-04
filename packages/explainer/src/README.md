# @commonpub/explainer — TypeScript Engine

Pure TypeScript runtime for interactive explainers. Zero UI dependencies — use with any framework (Vue, React, Svelte) or server-side.

## Modules

### Section Derivation (`sections/derive.ts`)

Derives presentation sections from a flat `BlockTuple[]` array.

```ts
import { deriveSections, computeSectionRanges } from '@commonpub/explainer';

const blocks: BlockTuple[] = [
  ['sectionHeader', { tag: '§ 01', title: 'Intro', body: 'Welcome.' }],
  ['text', { html: '<p>Content here.</p>' }],
  ['sectionHeader', { tag: '§ 02', title: 'Deep Dive', body: '' }],
  ['quiz', { question: '...', options: [...] }],
];

const sections = deriveSections(blocks);
// [
//   { title: 'Intro', tag: '§ 01', body: 'Welcome.', blockIndex: 0 },
//   { title: 'Deep Dive', tag: '§ 02', body: '', blockIndex: 2 },
// ]

const ranges = computeSectionRanges(sections, blocks.length);
// [
//   { start: 1, end: 2 },   // blocks[1] belongs to section 0
//   { start: 3, end: 4 },   // blocks[3] belongs to section 1
// ]
```

**Fallback behavior:**
1. Scans for `sectionHeader` blocks
2. If none found, falls back to H2 headings (`heading` blocks with `level <= 2`)
3. If none found, wraps all content as a single section

`deriveSections()` accepts an optional `fallbackTitle` for the single-section case.

### Progress Tracking (`progress/tracker.ts`)

Immutable state machine for tracking user progress through an explainer.

```ts
import {
  createProgressState,
  markSectionCompleted,
  canAccessSection,
  getCompletionPercentage,
  getNextIncompleteSection,
  isExplainerComplete,
} from '@commonpub/explainer';
```

#### `createProgressState(sections: ExplainerSection[]): ExplainerProgressState`

Initialize empty progress for all sections.

```ts
const state = createProgressState(sections);
// { sections: { 'id-1': { completed: false }, ... }, startedAt: '...', lastAccessedAt: '...' }
```

#### `markSectionCompleted(state, sectionId, quizScore?): ExplainerProgressState`

Returns a new state with the section marked complete. Immutable — does not mutate the input.

```ts
const updated = markSectionCompleted(state, 'section-1');
const withScore = markSectionCompleted(state, 'section-2', 85); // quiz score
```

#### `canAccessSection(state, sections, sectionId): boolean`

Checks gate logic:
- First section is always accessible
- Quiz sections with `isGate: true` block subsequent sections until passed
- Checkpoint sections with `requiresPrevious: true` require all prior sections complete

```ts
if (canAccessSection(state, sections, 'section-3')) {
  // User can view this section
}
```

#### `getCompletionPercentage(state): number`

Returns 0-100 based on completed section count.

#### `getNextIncompleteSection(state, sections): string | null`

Returns the ID of the next accessible but incomplete section, or null if all done.

#### `isExplainerComplete(state): boolean`

Returns true if every section is completed.

### Quiz Engine (`quiz/engine.ts`)

Scoring, validation, and answer checking for quiz blocks.

```ts
import {
  checkAnswer,
  scoreQuiz,
  isQuizPassed,
  validateQuizAnswers,
  shuffleOptions,
} from '@commonpub/explainer';
```

#### `checkAnswer(question: QuizQuestion, selectedOptionId: string): AnswerResult`

```ts
const result = checkAnswer(question, 'option-b');
// { correct: true, explanation: 'Binary search divides the search space...' }
```

#### `scoreQuiz(questions: QuizQuestion[], answers: Map<string, string>, passingScore?: number): QuizResult`

```ts
const result = scoreQuiz(questions, answersMap, 70);
// { score: 85, passed: true, total: 5, correct: 4 }
```

Default passing score is 70%.

#### `validateQuizAnswers(questions, answers): { valid: boolean; unanswered: string[] }`

Check if all questions have been answered.

#### `shuffleOptions<T>(items: T[], seed?: number): T[]`

Fisher-Yates shuffle. Deterministic when seed is provided (mulberry32 PRNG).

```ts
const shuffled = shuffleOptions(question.options);       // random
const seeded = shuffleOptions(question.options, 42);     // deterministic
```

### Validation (`schemas.ts`)

Zod schemas for all data types. Use for runtime validation of user input or API responses.

```ts
import {
  textSectionSchema,
  interactiveSectionSchema,
  quizSectionSchema,
  checkpointSectionSchema,
  explainerSectionSchema,     // discriminated union of all types
  explainerSectionsSchema,    // array of sections
  explainerMetaSchema,        // { estimatedMinutes, difficulty, prerequisites?, learningObjectives? }
} from '@commonpub/explainer';

const result = explainerSectionSchema.safeParse(data);
if (!result.success) {
  console.error(result.error.issues);
}
```

### Section Registry (`sections/registry.ts`)

Dynamic registration of section types with their Zod schemas.

```ts
import {
  registerSectionType,
  lookupSectionType,
  listSectionTypes,
  validateSection,
  clearRegistry,
  registerCoreSectionTypes,
} from '@commonpub/explainer';

// Register all built-in types
registerCoreSectionTypes();

// Register a custom type
registerSectionType({
  type: 'lab' as any,
  schema: myLabSchema,
  label: 'Lab Exercise',
});

// Validate
const result = validateSection(sectionData);
```

### HTML Rendering (`render/`)

Server-side HTML generation from blocks and sections.

#### `renderBlockTuples(blocks: BlockTuple[]): string`

Converts blocks to HTML. Supports: text, heading, code (with language/filename), image, quote, callout.

```ts
import { renderBlockTuples } from '@commonpub/explainer';
const html = renderBlockTuples(blocks);
```

HTML is sanitized (scripts, event handlers, javascript: URLs stripped).

#### `renderSection(section: ExplainerSection): string`

Renders a complete section including type-specific content (quiz forms, slider controls, checkpoints).

#### `generateToc(sections, progress, activeSectionId): TocItem[]`

Generates table of contents with completion and lock state.

```ts
import { generateToc } from '@commonpub/explainer';
const toc = generateToc(sections, progressState, 'section-2');
// [{ id, title, anchor, completed: true, active: false, locked: false }, ...]
```

### HTML Export (`export/`)

Generate self-contained HTML documents with embedded CSS and JavaScript.

```ts
import { generateExplainerHtml } from '@commonpub/explainer';

const html = generateExplainerHtml(sections, {
  theme: 'base',              // 'base' | 'deepwood' | 'hackbuild' | 'deveco'
  title: 'My Explainer',
  description: 'A guide to...',
  author: 'Jane Doe',
  includeAnimations: false,
  inlineImages: false,
});

// Write to file
fs.writeFileSync('explainer.html', html);
```

The generated HTML is fully standalone:
- Inline CSS with theme variables
- Vanilla JS for quiz submission, progress tracking, keyboard navigation
- localStorage-based progress persistence
- TOC sidebar with section navigation
- No external dependencies

**Available themes:** `base`, `deepwood`, `hackbuild`, `deveco`

## Types

### Core Types

```ts
type ExplainerSectionType = 'text' | 'interactive' | 'quiz' | 'checkpoint';
type ExplainerDifficulty = 'beginner' | 'intermediate' | 'advanced';

interface ExplainerSection = TextSection | InteractiveSection | QuizSection | CheckpointSection;

interface ExplainerMeta {
  estimatedMinutes: number;
  difficulty: ExplainerDifficulty;
  prerequisites?: string[];
  learningObjectives?: string[];
}
```

### Section Types

```ts
interface TextSection {
  type: 'text';
  id: string; title: string; anchor: string;
  content: BlockTuple[];
  visualConfig?: VisualConfig;
}

interface InteractiveSection {
  type: 'interactive';
  id: string; title: string; anchor: string;
  content: BlockTuple[];
  controls: InteractiveControl[];  // SliderControl | ToggleControl | SelectControl
  visualConfig: VisualConfig;
}

interface QuizSection {
  type: 'quiz';
  id: string; title: string; anchor: string;
  content: BlockTuple[];
  questions: QuizQuestion[];
  passingScore: number;     // 0-100
  isGate: boolean;          // blocks next section if true
}

interface CheckpointSection {
  type: 'checkpoint';
  id: string; title: string; anchor: string;
  content: BlockTuple[];
  requiresPrevious: boolean;  // requires all prior sections complete
}
```

### Progress Types

```ts
interface SectionProgress {
  completed: boolean;
  quizScore?: number;
  completedAt?: string;
}

interface ExplainerProgressState {
  sections: Record<string, SectionProgress>;
  startedAt: string;
  lastAccessedAt: string;
}
```

### Quiz Types

```ts
interface QuizQuestion {
  id: string;
  question: string;
  options: QuizOption[];        // { id: string; text: string }
  correctOptionId: string;
  explanation?: string;
}

interface AnswerResult { correct: boolean; explanation?: string; }
interface QuizResult { score: number; passed: boolean; total: number; correct: number; }
```

### Derived Section Types

```ts
interface DerivedSection {
  title: string;
  tag: string;      // e.g. '§ 01'
  body: string;     // intro text
  blockIndex: number; // index in the BlockTuple[] array
}

interface SectionRange {
  start: number;    // first body block index (after header)
  end: number;      // exclusive end index
}
```

## File Structure

```
src/
├── index.ts                  # All exports
├── types.ts                  # Type definitions (25+ types)
├── schemas.ts                # Zod validators for all types
├── sections/
│   ├── derive.ts             # deriveSections(), computeSectionRanges()
│   └── registry.ts           # Dynamic section type registration
├── progress/
│   └── tracker.ts            # Progress state machine (6 functions)
├── quiz/
│   └── engine.ts             # Quiz scoring (5 functions)
├── render/
│   ├── sectionRenderer.ts    # Block → HTML rendering
│   └── tocGenerator.ts       # TOC generation with gate logic
└── export/
    ├── htmlExporter.ts       # Self-contained HTML document generation
    ├── templates.ts          # CSS/JS templates (4 themes)
    └── inlineAssets.ts       # CSS/JS minification utilities
```

## Tests

```bash
pnpm test          # Run all 131 tests (8 suites)
pnpm test -- -t "progress"  # Run specific suite
```

Test suites:
- `schemas.test.ts` — Zod validation for all section/block types
- `progress.test.ts` — Gate logic, completion tracking, navigation
- `quiz.test.ts` — Scoring, validation, seeded shuffling
- `sectionRenderer.test.ts` — HTML rendering, sanitization
- `htmlExporter.test.ts` — Full document generation
- `registry.test.ts` — Type registration and lookup
- `tocGenerator.test.ts` — TOC generation with lock states
