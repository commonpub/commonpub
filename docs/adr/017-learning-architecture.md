# ADR 017: Learning System Architecture

## Status

Accepted

## Context

Phase 6 introduces a learning path system. The DB schema (6 tables) is locked in `packages/schema/src/learning.ts`. We need to define the business logic architecture, content model, and integration patterns.

## Decisions

### 1. Lesson Content — Discriminated Union in JSONB

Lesson content is stored in a single `content` JSONB column with a `type` discriminator on the lesson row:

| Type        | Content Shape                                                       | Rendering                          |
| ----------- | ------------------------------------------------------------------- | ---------------------------------- |
| `article`   | `{ type: 'article', blocks: BlockTuple[] }`                         | Reuse block renderer from editor   |
| `video`     | `{ type: 'video', url: string, platform?: string }`                 | Iframe embed                       |
| `quiz`      | `{ type: 'quiz', questions: QuizQuestion[], passingScore: number }` | Reuse ExplainerQuiz component      |
| `project`   | `{ type: 'project', slug: string }`                                 | Link to existing project content   |
| `explainer` | `{ type: 'explainer', slug: string }`                               | Link to existing explainer content |

**Why**: Single table, single column, no joins. The `type` enum on the lesson row already discriminates — the content shape follows.

### 2. Quiz Engine Reuse from @commonpub/explainer

Quiz-type lessons reuse `scoreQuiz`, `isQuizPassed`, `checkAnswer` from `@commonpub/explainer`. The `QuizQuestion` type is imported directly.

**Why**: Identical quiz semantics. No reason to duplicate scoring logic. The explainer package is pure TypeScript with no UI dependencies.

### 3. Auto-Certificate Flow

```
markLessonComplete() → recalculate progress → if 100% → generate certificate
```

- Certificate has unique verification code: `SNAP-{base36_timestamp}-{hex_8}`
- Public verification at `/certificates/{code}` (no feature flag, no auth)
- Certificate row links userId + pathId + verificationCode + issuedAt

**Why**: Certificates should be immediately verifiable by anyone (employers, peers). No manual approval step — completion is deterministic.

### 4. Single-Page Path Editor (Accordion)

The path editor is a single page at `/learn/[slug]/edit` with:

- Path metadata form (title, description, difficulty, hours)
- Accordion of modules, each expandable to show/edit lessons
- Inline add/edit/delete for modules and lessons
- Drag-to-reorder for modules and lessons

**Why**: Matches hack-build reference pattern. Avoids multi-step wizard complexity. All content visible in context.

### 5. Progress Calculation — Flat Count

```
progress = (completedLessons / totalLessons) * 100
```

- Stored as `numeric(5,2)` in enrollment row
- Recalculated on each `markLessonComplete` call
- `isPathComplete(progress)` checks `progress >= 100`

**Why**: Simple, transparent, predictable. Users can count lessons and know exactly where they stand.

### 6. Soft Delete for Paths, Hard Delete for Modules/Lessons

- Path deletion: `status → 'archived'` (preserves enrollment/certificate data)
- Module/lesson deletion: Hard delete with DB cascade (modules cascade to lessons via FK)
- Rationale: Archived paths remain referenceable from certificates; modules/lessons are internal structure

## Consequences

- `@commonpub/learning` depends on `@commonpub/explainer` for QuizQuestion type and quiz engine
- Lesson content validation uses Zod discriminated union matching the `type` field
- Certificate verification is a public route, exempt from feature flag
- Progress is always recalculated (not cached), ensuring consistency
