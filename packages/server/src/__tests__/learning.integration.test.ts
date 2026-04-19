import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import {
  createPath,
  listPaths,
  updatePath,
  deletePath,
  publishPath,
  createModule,
  updateModule,
  createLesson,
  enroll,
  unenroll,
  markLessonComplete,
  getUserEnrollments,
  getEnrollment,
} from '../learning/learning.js';

describe('learning integration', () => {
  let db: DB;
  let authorId: string;
  let learnerId: string;

  beforeAll(async () => {
    db = await createTestDB();
    const author = await createTestUser(db, { username: 'author' });
    authorId = author.id;
    const learner = await createTestUser(db, { username: 'learner' });
    learnerId = learner.id;
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  it('creates a learning path', async () => {
    const path = await createPath(db, authorId, {
      title: 'Intro to TinyML',
      description: 'Learn the basics of TinyML',
      difficulty: 'beginner',
    });

    expect(path).toBeDefined();
    expect(path.id).toBeDefined();
    expect(path.title).toBe('Intro to TinyML');
    expect(path.slug).toMatch(/^intro-to-tinyml/);
    expect(path.status).toBe('draft');
  });

  it('lists learning paths', async () => {
    const result = await listPaths(db);

    expect(result.items.length).toBeGreaterThanOrEqual(1);
    expect(result.total).toBeGreaterThanOrEqual(1);
  });

  it('updates a learning path', async () => {
    const created = await createPath(db, authorId, {
      title: 'Old Path Title',
    });

    const updated = await updatePath(db, created.id, authorId, {
      title: 'New Path Title',
      description: 'Updated description',
    });

    expect(updated).toBeDefined();
    expect(updated!.title).toBe('New Path Title');
  });

  it('deletes a learning path', async () => {
    const created = await createPath(db, authorId, {
      title: 'To Delete Path',
    });

    const deleted = await deletePath(db, created.id, authorId);
    expect(deleted).toBe(true);
  });

  it('creates modules and lessons', async () => {
    const path = await createPath(db, authorId, {
      title: 'Module Test Path',
    });

    const mod = await createModule(db, authorId, {
      pathId: path.id,
      title: 'Module 1: Setup',
      sortOrder: 0,
    });

    expect(mod).toBeDefined();
    expect(mod.title).toBe('Module 1: Setup');

    const lesson = await createLesson(db, authorId, {
      moduleId: mod.id,
      title: 'Lesson 1: Hello World',
      type: 'article',
    });

    expect(lesson).toBeDefined();
    expect(lesson.title).toBe('Lesson 1: Hello World');
  });

  it('updates a module', async () => {
    const path = await createPath(db, authorId, {
      title: 'Module Update Path',
    });

    const mod = await createModule(db, authorId, {
      pathId: path.id,
      title: 'Old Module',
      sortOrder: 0,
    });

    const updated = await updateModule(db, mod.id, authorId, {
      title: 'Updated Module',
    });

    expect(updated).toBeDefined();
    expect(updated!.title).toBe('Updated Module');
  });

  it('publishes a path', async () => {
    const path = await createPath(db, authorId, {
      title: 'Publishable Path',
    });

    const mod = await createModule(db, authorId, {
      pathId: path.id,
      title: 'First Module',
      sortOrder: 0,
    });

    await createLesson(db, authorId, {
      moduleId: mod.id,
      title: 'First Lesson',
      type: 'article',
    });

    const published = await publishPath(db, path.id, authorId);
    expect(published).toBeDefined();
    expect(published!.status).toBe('published');
  });

  it('enrolls and unenrolls a user', async () => {
    // Create and publish a path first (enroll requires published)
    const path = await createPath(db, authorId, {
      title: 'Enrollment Test Path',
    });
    const mod = await createModule(db, authorId, {
      pathId: path.id,
      title: 'Enroll Module',
      sortOrder: 0,
    });
    await createLesson(db, authorId, {
      moduleId: mod.id,
      title: 'Enroll Lesson',
      type: 'article',
    });
    await publishPath(db, path.id, authorId);

    const enrollment = await enroll(db, learnerId, path.id);
    expect(enrollment).toBeDefined();
    expect(enrollment.userId).toBe(learnerId);
    expect(enrollment.pathId).toBe(path.id);

    // Check enrollment exists
    const found = await getEnrollment(db, learnerId, path.id);
    expect(found).toBeDefined();

    // Unenroll
    const unenrolled = await unenroll(db, learnerId, path.id);
    expect(unenrolled).toBe(true);

    // Verify unenrolled
    const after = await getEnrollment(db, learnerId, path.id);
    expect(after).toBeNull();
  });

  it('tracks lesson completion', async () => {
    // Create and publish a path
    const path = await createPath(db, authorId, {
      title: 'Completion Test Path',
    });
    const mod = await createModule(db, authorId, {
      pathId: path.id,
      title: 'Completion Module',
      sortOrder: 0,
    });
    const lesson = await createLesson(db, authorId, {
      moduleId: mod.id,
      title: 'Completable Lesson',
      type: 'article',
    });
    await publishPath(db, path.id, authorId);

    await enroll(db, learnerId, path.id);
    const result = await markLessonComplete(db, learnerId, lesson.id);

    expect(result).toBeDefined();
    expect(result.progress).toBeGreaterThan(0);
  });

  it('lists user enrollments', async () => {
    // The learner enrolled in the completion test path above
    const enrollmentsList = await getUserEnrollments(db, learnerId);
    expect(enrollmentsList.length).toBeGreaterThanOrEqual(1);
  });

  describe('quiz lessons — server-side grading', () => {
    it('grades a quiz with correct answers → passes + records score', async () => {
      const path = await createPath(db, authorId, { title: 'Quiz Path Correct' });
      const mod = await createModule(db, authorId, {
        pathId: path.id,
        title: 'Quiz Module',
        sortOrder: 0,
      });
      const lesson = await createLesson(db, authorId, {
        moduleId: mod.id,
        title: 'Quiz Lesson',
        type: 'quiz',
        content: {
          type: 'quiz',
          passingScore: 70,
          questions: [
            {
              id: 'q1',
              question: '2+2?',
              options: [{ id: 'a', text: '3' }, { id: 'b', text: '4' }],
              correctOptionId: 'b',
            },
            {
              id: 'q2',
              question: '3+3?',
              options: [{ id: 'a', text: '6' }, { id: 'b', text: '7' }],
              correctOptionId: 'a',
            },
          ],
        },
      });
      await publishPath(db, path.id, authorId);
      await enroll(db, learnerId, path.id);

      const result = await markLessonComplete(db, learnerId, lesson.id, {
        q1: 'b',
        q2: 'a',
      });

      expect(result.quiz).toBeDefined();
      expect(result.quiz!.passed).toBe(true);
      expect(result.quiz!.score).toBe(100);
      expect(result.progress).toBeGreaterThan(0);
      expect(result.quiz!.results).toHaveLength(2);
      expect(result.quiz!.results[0]).toMatchObject({
        questionId: 'q1',
        selectedOptionId: 'b',
        correctOptionId: 'b',
        correct: true,
      });
      expect(result.quiz!.results[1]).toMatchObject({
        questionId: 'q2',
        selectedOptionId: 'a',
        correctOptionId: 'a',
        correct: true,
      });
    });

    it('rejects quiz lesson completion without answers', async () => {
      const path = await createPath(db, authorId, { title: 'Quiz Path No Answers' });
      const mod = await createModule(db, authorId, {
        pathId: path.id,
        title: 'M',
        sortOrder: 0,
      });
      const lesson = await createLesson(db, authorId, {
        moduleId: mod.id,
        title: 'Quiz Lesson',
        type: 'quiz',
        content: {
          type: 'quiz',
          passingScore: 50,
          questions: [
            {
              id: 'q1',
              question: 'x',
              options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }],
              correctOptionId: 'a',
            },
          ],
        },
      });
      await publishPath(db, path.id, authorId);
      await enroll(db, learnerId, path.id);

      await expect(markLessonComplete(db, learnerId, lesson.id)).rejects.toThrow(
        /Quiz lessons require answers/,
      );
      await expect(markLessonComplete(db, learnerId, lesson.id, {})).rejects.toThrow(
        /Quiz lessons require answers/,
      );
    });

    it('fails a quiz when answers are wrong — completion NOT recorded', async () => {
      const path = await createPath(db, authorId, { title: 'Quiz Path Wrong' });
      const mod = await createModule(db, authorId, {
        pathId: path.id,
        title: 'M',
        sortOrder: 0,
      });
      const lesson = await createLesson(db, authorId, {
        moduleId: mod.id,
        title: 'Quiz Lesson',
        type: 'quiz',
        content: {
          type: 'quiz',
          passingScore: 100,
          questions: [
            {
              id: 'q1',
              question: 'x',
              options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }],
              correctOptionId: 'a',
            },
          ],
        },
      });
      await publishPath(db, path.id, authorId);
      await enroll(db, learnerId, path.id);

      const result = await markLessonComplete(db, learnerId, lesson.id, { q1: 'b' });

      expect(result.quiz!.passed).toBe(false);
      expect(result.quiz!.score).toBe(0);
      // Path progress should stay at 0 since the only lesson didn't pass
      expect(result.progress).toBe(0);
    });

    it('retains a prior pass even if a subsequent attempt fails', async () => {
      const path = await createPath(db, authorId, { title: 'Quiz Path Retry' });
      const mod = await createModule(db, authorId, {
        pathId: path.id,
        title: 'M',
        sortOrder: 0,
      });
      const lesson = await createLesson(db, authorId, {
        moduleId: mod.id,
        title: 'Quiz Lesson',
        type: 'quiz',
        content: {
          type: 'quiz',
          passingScore: 50,
          questions: [
            {
              id: 'q1',
              question: 'x',
              options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }],
              correctOptionId: 'a',
            },
          ],
        },
      });
      await publishPath(db, path.id, authorId);
      await enroll(db, learnerId, path.id);

      // First attempt: pass
      const first = await markLessonComplete(db, learnerId, lesson.id, { q1: 'a' });
      expect(first.quiz!.passed).toBe(true);
      expect(first.progress).toBe(100);

      // Second attempt: fail. The lesson should REMAIN completed since the
      // user already passed it once — progress should not regress.
      const second = await markLessonComplete(db, learnerId, lesson.id, { q1: 'b' });
      expect(second.quiz!.passed).toBe(false);
      expect(second.progress).toBe(100);
    });
  });
});
