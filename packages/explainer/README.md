# @snaplify/explainer

Interactive explainer module runtime for Snaplify.

## Overview

Explainers are scroll-driven, interactive educational modules. This package has three layers: a section type system with Zod schemas, a quiz engine, a progress tracker (pure state machine), a TOC generator, section rendering, and a self-contained HTML exporter.

Explainers can be used standalone or embedded as a lesson type in `@snaplify/learning`.

## Installation

```bash
pnpm add @snaplify/explainer
```

## Section Types

| Type          | Description                                          |
| ------------- | ---------------------------------------------------- |
| `text`        | Rich text content (rendered from BlockTuples)        |
| `interactive` | Controls (sliders, toggles, selects) with visuals    |
| `quiz`        | Multiple-choice questions with scoring               |
| `checkpoint`  | Progress gate, must complete to continue             |

### Section Registry

```ts
import { registerCoreSectionTypes, registerSectionType, lookupSectionType } from '@snaplify/explainer';

// Register all 4 core section types
registerCoreSectionTypes();

// Custom section type
registerSectionType({
  type: 'video',
  schema: videoSectionSchema,
  renderer: renderVideoSection,
});
```

## Quiz Engine

Deterministic quiz with seeded PRNG for reproducible option shuffling:

```ts
import { checkAnswer, scoreQuiz, isQuizPassed, shuffleOptions } from '@snaplify/explainer';

// Check a single answer
const result = checkAnswer(question, selectedOptionId);
// { correct: true, correctOptionId: '...' }

// Score all answers
const score = scoreQuiz(questions, answers);
// { total: 5, correct: 4, percentage: 80 }

// Check pass threshold (default 70%)
const passed = isQuizPassed(score, 0.7);

// Shuffle options deterministically
const shuffled = shuffleOptions(options, seed);
```

## Progress Tracker

Pure state machine for tracking section completion:

```ts
import {
  createProgressState,
  markSectionCompleted,
  canAccessSection,
  getCompletionPercentage,
  getNextIncompleteSection,
  isExplainerComplete,
} from '@snaplify/explainer';

// Initialize progress state
let state = createProgressState(sections);

// Mark a section complete
state = markSectionCompleted(state, 'section-1');

// Check access (respects checkpoint gates)
const canAccess = canAccessSection(state, 'section-3');

// Get completion percentage
const pct = getCompletionPercentage(state); // 33.3

// Find next incomplete section
const next = getNextIncompleteSection(state); // 'section-2'

// Check if explainer is fully complete
const done = isExplainerComplete(state); // false
```

## Rendering

### Section Rendering

```ts
import { renderSection, renderBlockTuples, renderQuizHtml } from '@snaplify/explainer';

// Render a single section to HTML
const html = renderSection(section);

// Render block tuples to HTML
const contentHtml = renderBlockTuples(tuples);

// Render quiz to HTML (with form elements)
const quizHtml = renderQuizHtml(quizSection);
```

### TOC Generation

```ts
import { generateToc } from '@snaplify/explainer';

const toc = generateToc(sections);
// [{ id: 'intro', title: 'Introduction', anchor: '#intro' }, ...]
```

## HTML Export

Generates a self-contained HTML file with inlined CSS and vanilla JS:

```ts
import { generateExplainerHtml } from '@snaplify/explainer';

const html = generateExplainerHtml({
  title: 'How LEDs Work',
  sections,
  theme: 'base',
  includeProgress: true,
});

// Result: Complete HTML document, zero external dependencies
```

## Schemas

Zod schemas for validating section data:

```ts
import {
  textSectionSchema,
  interactiveSectionSchema,
  quizSectionSchema,
  checkpointSectionSchema,
  explainerSectionSchema,   // union of all types
  explainerMetaSchema,       // title, difficulty, estimated time
} from '@snaplify/explainer';
```

## Development

```bash
pnpm build        # Compile TypeScript
pnpm test         # Run 127 tests
pnpm typecheck    # Type-check without emitting
```

## Dependencies

- `zod`: Schema validation
- `@snaplify/editor`: BlockTuple rendering
- `@snaplify/schema`: Content type definitions
- `@snaplify/config`: Feature flags
