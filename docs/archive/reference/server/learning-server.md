# Learning Server Module

> Server-side functions for learning paths, modules, lessons, enrollment, progress tracking, and certificate issuance.

**Source**: `packages/server/src/learning.ts`

---

## Exports

| Category | Functions |
|----------|-----------|
| Path CRUD | `listPaths`, `getPathBySlug`, `createPath`, `updatePath`, `deletePath`, `publishPath` |
| Module Management | `createModule`, `updateModule`, `deleteModule`, `reorderModules` |
| Lesson Management | `createLesson`, `updateLesson`, `deleteLesson`, `reorderLessons`, `getLessonBySlug` |
| Enrollment | `enroll`, `unenroll`, `markLessonComplete`, `getEnrollment`, `getUserEnrollments`, `getCompletedLessonIds` |
| Certificates | `getUserCertificates`, `getCertificateByCode` |

All functions are async and accept `db: DB` as their first parameter.

---

## API Reference

### Path CRUD

#### `listPaths(db, filters?)`

List learning paths with optional filtering.

| Param | Type | Description |
|-------|------|-------------|
| `db` | `DB` | Database connection |
| `filters` | `object?` | Optional filters |
| `filters.status` | `string?` | Filter by publication status |
| `filters.difficulty` | `string?` | Filter by difficulty level |
| `filters.authorId` | `string?` | Filter by author |

**Returns**: `{ items: LearningPathListItem[], total: number }`

---

#### `getPathBySlug(db, slug)`

Fetch a learning path by its URL slug. The returned detail includes the full tree of modules and lessons, plus the current enrollment count.

| Param | Type | Description |
|-------|------|-------------|
| `db` | `DB` | Database connection |
| `slug` | `string` | Path URL slug |

**Returns**: `LearningPathDetail | null`

---

#### `createPath(db, authorId, input)`

Create a new learning path.

| Param | Type | Description |
|-------|------|-------------|
| `db` | `DB` | Database connection |
| `authorId` | `string` | Author user ID |
| `input` | `object` | Path payload (title, description, difficulty, etc.) |

**Returns**: Path record

---

#### `updatePath(db, pathId, authorId, input)`

Update a learning path. Only the original author may update.

| Param | Type | Description |
|-------|------|-------------|
| `db` | `DB` | Database connection |
| `pathId` | `string` | Path ID |
| `authorId` | `string` | Requesting user ID |
| `input` | `object` | Fields to update |

**Returns**: Updated path record

---

#### `deletePath(db, pathId, authorId)`

Soft-delete a learning path. The record is retained but hidden from listings.

| Param | Type | Description |
|-------|------|-------------|
| `db` | `DB` | Database connection |
| `pathId` | `string` | Path ID |
| `authorId` | `string` | Requesting user ID |

**Returns**: `boolean`

---

#### `publishPath(db, pathId, authorId)`

Publish a learning path, making it visible to all users.

| Param | Type | Description |
|-------|------|-------------|
| `db` | `DB` | Database connection |
| `pathId` | `string` | Path ID |
| `authorId` | `string` | Requesting user ID |

**Returns**: Published path record

---

### Module Management

#### `createModule(db, pathId, authorId, input)`

Create a new module within a learning path.

| Param | Type | Description |
|-------|------|-------------|
| `db` | `DB` | Database connection |
| `pathId` | `string` | Parent path ID |
| `authorId` | `string` | Requesting user ID |
| `input` | `object` | Module payload (title, description, etc.) |

**Returns**: Module record

---

#### `updateModule(db, moduleId, authorId, input)`

Update a module.

| Param | Type | Description |
|-------|------|-------------|
| `db` | `DB` | Database connection |
| `moduleId` | `string` | Module ID |
| `authorId` | `string` | Requesting user ID |
| `input` | `object` | Fields to update |

**Returns**: Updated module record

---

#### `deleteModule(db, moduleId, authorId)`

Delete a module and its lessons.

| Param | Type | Description |
|-------|------|-------------|
| `db` | `DB` | Database connection |
| `moduleId` | `string` | Module ID |
| `authorId` | `string` | Requesting user ID |

**Returns**: `boolean`

---

#### `reorderModules(db, pathId, authorId, orderedIds)`

Set the display order of modules within a path.

| Param | Type | Description |
|-------|------|-------------|
| `db` | `DB` | Database connection |
| `pathId` | `string` | Parent path ID |
| `authorId` | `string` | Requesting user ID |
| `orderedIds` | `string[]` | Module IDs in desired order |

**Returns**: `void`

---

### Lesson Management

#### `createLesson(db, moduleId, authorId, input)`

Create a new lesson within a module.

| Param | Type | Description |
|-------|------|-------------|
| `db` | `DB` | Database connection |
| `moduleId` | `string` | Parent module ID |
| `authorId` | `string` | Requesting user ID |
| `input` | `object` | Lesson payload (title, content, slug, etc.) |

**Returns**: Lesson record

---

#### `updateLesson(db, lessonId, authorId, input)`

Update a lesson.

| Param | Type | Description |
|-------|------|-------------|
| `db` | `DB` | Database connection |
| `lessonId` | `string` | Lesson ID |
| `authorId` | `string` | Requesting user ID |
| `input` | `object` | Fields to update |

**Returns**: Updated lesson record

---

#### `deleteLesson(db, lessonId, authorId)`

Delete a lesson.

| Param | Type | Description |
|-------|------|-------------|
| `db` | `DB` | Database connection |
| `lessonId` | `string` | Lesson ID |
| `authorId` | `string` | Requesting user ID |

**Returns**: `boolean`

---

#### `reorderLessons(db, moduleId, authorId, orderedIds)`

Set the display order of lessons within a module.

| Param | Type | Description |
|-------|------|-------------|
| `db` | `DB` | Database connection |
| `moduleId` | `string` | Parent module ID |
| `authorId` | `string` | Requesting user ID |
| `orderedIds` | `string[]` | Lesson IDs in desired order |

**Returns**: `void`

---

#### `getLessonBySlug(db, pathSlug, lessonSlug)`

Fetch a lesson by its slug, scoped to a learning path. Returns the lesson content along with contextual navigation data (previous/next lesson, parent module, etc.).

| Param | Type | Description |
|-------|------|-------------|
| `db` | `DB` | Database connection |
| `pathSlug` | `string` | Parent path URL slug |
| `lessonSlug` | `string` | Lesson URL slug |

**Returns**: Lesson + context

---

### Enrollment

#### `enroll(db, userId, pathId)`

Enroll a user in a learning path. Increments the path's `enrollmentCount`.

| Param | Type | Description |
|-------|------|-------------|
| `db` | `DB` | Database connection |
| `userId` | `string` | User ID |
| `pathId` | `string` | Path ID |

**Returns**: Enrollment record

---

#### `unenroll(db, userId, pathId)`

Remove a user's enrollment. Decrements the path's `enrollmentCount`.

| Param | Type | Description |
|-------|------|-------------|
| `db` | `DB` | Database connection |
| `userId` | `string` | User ID |
| `pathId` | `string` | Path ID |

**Returns**: `boolean`

---

#### `markLessonComplete(db, userId, lessonId, quizScore?, quizPassed?)`

Mark a lesson as completed for a user. This triggers several side effects:

1. Recalculates the user's overall progress percentage for the parent path.
2. Checks whether all lessons in the path are now complete.
3. If progress reaches 100%, automatically issues a certificate.

| Param | Type | Description |
|-------|------|-------------|
| `db` | `DB` | Database connection |
| `userId` | `string` | User ID |
| `lessonId` | `string` | Lesson ID |
| `quizScore` | `number?` | Optional quiz score |
| `quizPassed` | `boolean?` | Optional quiz pass/fail flag |

**Returns**: `void`

---

#### `getEnrollment(db, userId, pathId)`

Look up a single enrollment record.

| Param | Type | Description |
|-------|------|-------------|
| `db` | `DB` | Database connection |
| `userId` | `string` | User ID |
| `pathId` | `string` | Path ID |

**Returns**: Enrollment record or `null`

---

#### `getUserEnrollments(db, userId)`

List all learning paths a user is enrolled in.

| Param | Type | Description |
|-------|------|-------------|
| `db` | `DB` | Database connection |
| `userId` | `string` | User ID |

**Returns**: `EnrollmentItem[]`

---

#### `getCompletedLessonIds(db, userId, pathId)`

Get the IDs of all lessons a user has completed within a specific path.

| Param | Type | Description |
|-------|------|-------------|
| `db` | `DB` | Database connection |
| `userId` | `string` | User ID |
| `pathId` | `string` | Path ID |

**Returns**: `string[]`

---

### Certificates

#### `getUserCertificates(db, userId)`

List all certificates earned by a user.

| Param | Type | Description |
|-------|------|-------------|
| `db` | `DB` | Database connection |
| `userId` | `string` | User ID |

**Returns**: `CertificateItem[]`

---

#### `getCertificateByCode(db, verificationCode)`

Look up a certificate by its public verification code. This is intended for use as a public endpoint so third parties can verify certificate authenticity.

| Param | Type | Description |
|-------|------|-------------|
| `db` | `DB` | Database connection |
| `verificationCode` | `string` | Unique verification code |

**Returns**: Certificate detail
