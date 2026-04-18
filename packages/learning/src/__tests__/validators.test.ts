import { describe, it, expect } from 'vitest';
import {
  updateLearningPathSchema,
  createModuleSchema,
  updateModuleSchema,
  updateLessonSchema,
  lessonContentSchema,
  completeLessonSchema,
} from '../validators';

describe('updateLearningPathSchema', () => {
  it('should accept a valid partial update', () => {
    const result = updateLearningPathSchema.safeParse({ title: 'New Title' });
    expect(result.success).toBe(true);
  });

  it('should accept status field', () => {
    const result = updateLearningPathSchema.safeParse({ status: 'published' });
    expect(result.success).toBe(true);
  });

  it('should reject invalid status', () => {
    const result = updateLearningPathSchema.safeParse({ status: 'invalid' });
    expect(result.success).toBe(false);
  });

  it('should accept empty object (all fields optional)', () => {
    const result = updateLearningPathSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

describe('createModuleSchema', () => {
  it('should accept a valid module', () => {
    const result = createModuleSchema.safeParse({
      pathId: '550e8400-e29b-41d4-a716-446655440000',
      title: 'Introduction',
    });
    expect(result.success).toBe(true);
  });

  it('should reject missing pathId', () => {
    const result = createModuleSchema.safeParse({ title: 'Intro' });
    expect(result.success).toBe(false);
  });

  it('should reject non-uuid pathId', () => {
    const result = createModuleSchema.safeParse({ pathId: 'not-a-uuid', title: 'Intro' });
    expect(result.success).toBe(false);
  });

  it('should reject empty title', () => {
    const result = createModuleSchema.safeParse({
      pathId: '550e8400-e29b-41d4-a716-446655440000',
      title: '',
    });
    expect(result.success).toBe(false);
  });

  it('should accept optional description and sortOrder', () => {
    const result = createModuleSchema.safeParse({
      pathId: '550e8400-e29b-41d4-a716-446655440000',
      title: 'Module 1',
      description: 'A module',
      sortOrder: 0,
    });
    expect(result.success).toBe(true);
  });
});

describe('updateModuleSchema', () => {
  it('should accept partial update without pathId', () => {
    const result = updateModuleSchema.safeParse({ title: 'Updated' });
    expect(result.success).toBe(true);
  });

  it('should accept empty object', () => {
    const result = updateModuleSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

describe('updateLessonSchema', () => {
  it('should accept partial update without moduleId', () => {
    const result = updateLessonSchema.safeParse({ title: 'Updated Lesson' });
    expect(result.success).toBe(true);
  });

  it('should accept empty object', () => {
    const result = updateLessonSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

describe('lessonContentSchema', () => {
  it('should validate article content', () => {
    const result = lessonContentSchema.safeParse({
      type: 'article',
      blocks: [['text', { html: '<p>Hello</p>' }]],
    });
    expect(result.success).toBe(true);
  });

  it('should validate video content', () => {
    const result = lessonContentSchema.safeParse({
      type: 'video',
      url: 'https://youtube.com/watch?v=abc',
      platform: 'youtube',
    });
    expect(result.success).toBe(true);
  });

  it('should validate quiz content', () => {
    const result = lessonContentSchema.safeParse({
      type: 'quiz',
      questions: [
        {
          id: 'q1',
          question: 'What is 1+1?',
          options: [
            { id: 'a', text: '1' },
            { id: 'b', text: '2' },
          ],
          correctOptionId: 'b',
        },
      ],
      passingScore: 70,
    });
    expect(result.success).toBe(true);
  });

  it('should validate project content', () => {
    const result = lessonContentSchema.safeParse({
      type: 'project',
      slug: 'my-project',
    });
    expect(result.success).toBe(true);
  });

  it('should validate explainer content', () => {
    const result = lessonContentSchema.safeParse({
      type: 'explainer',
      slug: 'how-it-works',
    });
    expect(result.success).toBe(true);
  });

  it('should reject unknown type', () => {
    const result = lessonContentSchema.safeParse({
      type: 'unknown',
      data: {},
    });
    expect(result.success).toBe(false);
  });

  it('should reject video with invalid url', () => {
    const result = lessonContentSchema.safeParse({
      type: 'video',
      url: 'not-a-url',
    });
    expect(result.success).toBe(false);
  });

  it('should reject quiz with no questions', () => {
    const result = lessonContentSchema.safeParse({
      type: 'quiz',
      questions: [],
      passingScore: 70,
    });
    expect(result.success).toBe(false);
  });

  it('should reject quiz with passingScore > 100', () => {
    const result = lessonContentSchema.safeParse({
      type: 'quiz',
      questions: [
        {
          id: 'q1',
          question: 'Q?',
          options: [
            { id: 'a', text: 'A' },
            { id: 'b', text: 'B' },
          ],
          correctOptionId: 'a',
        },
      ],
      passingScore: 150,
    });
    expect(result.success).toBe(false);
  });

  it('should reject article with non-array blocks', () => {
    const result = lessonContentSchema.safeParse({
      type: 'article',
      blocks: 'not an array',
    });
    expect(result.success).toBe(false);
  });

  it('should accept video without optional platform', () => {
    const result = lessonContentSchema.safeParse({
      type: 'video',
      url: 'https://example.com/video.mp4',
    });
    expect(result.success).toBe(true);
  });
});

describe('completeLessonSchema', () => {
  it('accepts empty body (non-quiz lessons)', () => {
    expect(completeLessonSchema.safeParse({}).success).toBe(true);
  });

  it('accepts valid answers map', () => {
    const result = completeLessonSchema.safeParse({
      answers: { q1: 'a', q2: 'b' },
    });
    expect(result.success).toBe(true);
  });

  it('rejects client-supplied quizScore (strict mode strips unknown keys)', () => {
    const result = completeLessonSchema.safeParse({ quizScore: 100 });
    expect(result.success).toBe(false);
  });

  it('rejects client-supplied quizPassed', () => {
    const result = completeLessonSchema.safeParse({ quizPassed: true });
    expect(result.success).toBe(false);
  });

  it('rejects both quizScore and answers together', () => {
    const result = completeLessonSchema.safeParse({
      answers: { q1: 'a' },
      quizScore: 100,
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-string answer values', () => {
    const result = completeLessonSchema.safeParse({ answers: { q1: 5 } });
    expect(result.success).toBe(false);
  });

  it('rejects empty-string answer values', () => {
    const result = completeLessonSchema.safeParse({ answers: { q1: '' } });
    expect(result.success).toBe(false);
  });
});
