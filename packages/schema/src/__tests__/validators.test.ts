import { describe, it, expect } from 'vitest';
import { contestStatusEnum } from '../enums';
import { contestTransitionSchema } from '../validators';
import {
  usernameSchema,
  emailSchema,
  slugSchema,
  createUserSchema,
  updateProfileSchema,
  createContentSchema,
  createCommentSchema,
  createHubSchema,
  createPostSchema,
  createLearningPathSchema,
  createLessonSchema,
  createVideoSchema,
  videoFiltersSchema,
  updateContentSchema,
  createReportSchema,
  displayNameSchema,
  bioSchema,
  contentTypeSchema,
  contentStatusSchema,
  difficultySchema,
  hubTypeSchema,
  createReplySchema,
  createProductSchema,
  judgeEntrySchema,
  createContestSchema,
  updateContestSchema,
  sendMessageSchema,
  createDocsSiteSchema,
  createDocsPageSchema,
  updateDocsPageSchema,
  originPatternSchema,
  createApiKeySchema,
  createDocsVersionSchema,
  adminUpdateRoleSchema,
  adminUpdateStatusSchema,
  resolveReportSchema,
  likeTargetTypeSchema,
  commentTargetTypeSchema,
  contestStatusSchema,
  videoPlatformSchema,
  contestStageSchema,
  submissionTemplateFieldSchema,
  stageSubmissionSchema,
  contentFiltersSchema,
} from '../validators';

describe('usernameSchema', () => {
  it('should accept valid usernames', () => {
    expect(usernameSchema.safeParse('alice').success).toBe(true);
    expect(usernameSchema.safeParse('bob-123').success).toBe(true);
    expect(usernameSchema.safeParse('cool_maker').success).toBe(true);
  });

  it('should reject too short', () => {
    expect(usernameSchema.safeParse('ab').success).toBe(false);
  });

  it('should reject invalid characters', () => {
    expect(usernameSchema.safeParse('hello world').success).toBe(false);
    expect(usernameSchema.safeParse('user@name').success).toBe(false);
  });

  it('should reject too long', () => {
    expect(usernameSchema.safeParse('a'.repeat(65)).success).toBe(false);
  });
});

describe('emailSchema', () => {
  it('should accept valid emails', () => {
    expect(emailSchema.safeParse('user@example.com').success).toBe(true);
  });

  it('should reject invalid emails', () => {
    expect(emailSchema.safeParse('not-an-email').success).toBe(false);
  });
});

describe('slugSchema', () => {
  it('should accept valid slugs', () => {
    expect(slugSchema.safeParse('my-project').success).toBe(true);
    expect(slugSchema.safeParse('hello123').success).toBe(true);
    expect(slugSchema.safeParse('a').success).toBe(true);
  });

  it('should reject uppercase', () => {
    expect(slugSchema.safeParse('My-Project').success).toBe(false);
  });

  it('should reject spaces', () => {
    expect(slugSchema.safeParse('my project').success).toBe(false);
  });

  it('should reject leading/trailing hyphens', () => {
    expect(slugSchema.safeParse('-leading').success).toBe(false);
    expect(slugSchema.safeParse('trailing-').success).toBe(false);
  });

  it('should reject double hyphens', () => {
    expect(slugSchema.safeParse('double--hyphen').success).toBe(false);
  });
});

describe('createUserSchema', () => {
  it('should accept valid user creation', () => {
    const result = createUserSchema.safeParse({
      email: 'test@example.com',
      username: 'testuser',
    });
    expect(result.success).toBe(true);
  });

  it('should accept user with display name', () => {
    const result = createUserSchema.safeParse({
      email: 'test@example.com',
      username: 'testuser',
      displayName: 'Test User',
    });
    expect(result.success).toBe(true);
  });

  it('should reject missing email', () => {
    const result = createUserSchema.safeParse({ username: 'testuser' });
    expect(result.success).toBe(false);
  });
});

describe('updateProfileSchema', () => {
  it('should accept partial updates', () => {
    const result = updateProfileSchema.safeParse({ bio: 'Hello world' });
    expect(result.success).toBe(true);
  });

  it('should accept social links', () => {
    const result = updateProfileSchema.safeParse({
      socialLinks: { github: 'https://github.com/user' },
    });
    expect(result.success).toBe(true);
  });

  it('should reject bio over 2000 chars', () => {
    const result = updateProfileSchema.safeParse({ bio: 'x'.repeat(2001) });
    expect(result.success).toBe(false);
  });

  it('should reject skills over 50 items', () => {
    const result = updateProfileSchema.safeParse({
      skills: Array.from({ length: 51 }, (_, i) => `skill-${i}`),
    });
    expect(result.success).toBe(false);
  });
});

describe('createContentSchema', () => {
  it('should accept valid content', () => {
    const result = createContentSchema.safeParse({
      type: 'project',
      title: 'My Project',
      slug: 'my-project',
    });
    expect(result.success).toBe(true);
  });

  it('should accept all content types', () => {
    for (const type of ['project', 'article', 'blog', 'explainer']) {
      const result = createContentSchema.safeParse({
        type,
        title: 'Test',
      });
      expect(result.success).toBe(true);
    }
  });

  it('should reject invalid content type', () => {
    const result = createContentSchema.safeParse({
      type: 'invalid',
      title: 'Test',
    });
    expect(result.success).toBe(false);
  });

  it('should reject tags over 20', () => {
    const result = createContentSchema.safeParse({
      type: 'project',
      title: 'Test',
      tags: Array.from({ length: 21 }, (_, i) => `tag-${i}`),
    });
    expect(result.success).toBe(false);
  });
});

describe('createCommentSchema', () => {
  it('should accept valid comment', () => {
    const result = createCommentSchema.safeParse({
      targetType: 'project',
      targetId: '550e8400-e29b-41d4-a716-446655440000',
      content: 'Great project!',
    });
    expect(result.success).toBe(true);
  });

  it('should accept comment with parent', () => {
    const result = createCommentSchema.safeParse({
      targetType: 'post',
      targetId: '550e8400-e29b-41d4-a716-446655440000',
      parentId: '550e8400-e29b-41d4-a716-446655440001',
      content: 'Reply here',
    });
    expect(result.success).toBe(true);
  });

  it('should reject empty content', () => {
    const result = createCommentSchema.safeParse({
      targetType: 'project',
      targetId: '550e8400-e29b-41d4-a716-446655440000',
      content: '',
    });
    expect(result.success).toBe(false);
  });
});

describe('createHubSchema', () => {
  it('should accept valid community', () => {
    const result = createHubSchema.safeParse({
      name: 'Robotics Club',
    });
    expect(result.success).toBe(true);
  });

  it('should default join policy to open', () => {
    const result = createHubSchema.parse({
      name: 'Test',
    });
    expect(result.joinPolicy).toBe('open');
  });
});

describe('createPostSchema', () => {
  it('should accept valid post', () => {
    const result = createPostSchema.safeParse({
      hubId: '550e8400-e29b-41d4-a716-446655440000',
      content: 'Hello community!',
    });
    expect(result.success).toBe(true);
  });

  it('should default type to text', () => {
    const result = createPostSchema.parse({
      hubId: '550e8400-e29b-41d4-a716-446655440000',
      content: 'Hello',
    });
    expect(result.type).toBe('text');
  });
});

describe('createLearningPathSchema', () => {
  it('should accept valid learning path', () => {
    const result = createLearningPathSchema.safeParse({
      title: 'Intro to Robotics',
      estimatedHours: 20,
    });
    expect(result.success).toBe(true);
  });

  it('should reject negative hours', () => {
    const result = createLearningPathSchema.safeParse({
      title: 'Test',
      estimatedHours: -5,
    });
    expect(result.success).toBe(false);
  });
});

describe('createLessonSchema', () => {
  it('should accept all lesson types including explainer', () => {
    for (const type of ['article', 'video', 'quiz', 'project', 'explainer']) {
      const result = createLessonSchema.safeParse({
        moduleId: '550e8400-e29b-41d4-a716-446655440000',
        title: 'Test Lesson',
        type,
      });
      expect(result.success).toBe(true);
    }
  });
});

describe('createReportSchema', () => {
  it('should accept valid report', () => {
    const result = createReportSchema.safeParse({
      targetType: 'comment',
      targetId: '550e8400-e29b-41d4-a716-446655440000',
      reason: 'spam',
    });
    expect(result.success).toBe(true);
  });

  it('should accept report with description', () => {
    const result = createReportSchema.safeParse({
      targetType: 'user',
      targetId: '550e8400-e29b-41d4-a716-446655440000',
      reason: 'harassment',
      description: 'Repeated offensive messages',
    });
    expect(result.success).toBe(true);
  });
});

// =============================================================================
// BOUNDARY TESTS — Stryker mutation testing coverage
// =============================================================================

describe('usernameSchema — boundary tests', () => {
  it('rejects username shorter than 3 chars', () => {
    expect(() => usernameSchema.parse('ab')).toThrow();
  });

  it('accepts username of exactly 3 chars', () => {
    expect(usernameSchema.parse('abc')).toBe('abc');
  });

  it('accepts username of exactly 64 chars', () => {
    expect(usernameSchema.parse('a'.repeat(64))).toHaveLength(64);
  });

  it('rejects username of 65 chars', () => {
    expect(() => usernameSchema.parse('a'.repeat(65))).toThrow();
  });

  it('rejects username with spaces via regex', () => {
    expect(() => usernameSchema.parse('abc def')).toThrow();
  });

  it('rejects username with @ via regex', () => {
    expect(() => usernameSchema.parse('abc@def')).toThrow();
  });

  it('accepts underscores and hyphens via regex', () => {
    expect(usernameSchema.parse('a_b-c')).toBe('a_b-c');
  });

  it('rejects empty string', () => {
    expect(() => usernameSchema.parse('')).toThrow();
  });

  it('rejects 1-char string', () => {
    expect(() => usernameSchema.parse('a')).toThrow();
  });

  it('rejects 2-char string', () => {
    expect(() => usernameSchema.parse('ab')).toThrow();
  });

  it('accepts 4-char string', () => {
    expect(usernameSchema.parse('abcd')).toBe('abcd');
  });
});

describe('emailSchema — boundary tests', () => {
  it('rejects non-email string', () => {
    expect(() => emailSchema.parse('not-an-email')).toThrow();
  });

  it('accepts valid email at reasonable length', () => {
    expect(emailSchema.parse('a@b.co')).toBe('a@b.co');
  });

  it('accepts email of exactly 255 chars', () => {
    // Build a valid email that is exactly 255 chars
    const domain = 'b.co';
    const localPart = 'a'.repeat(255 - 1 - domain.length); // -1 for @
    const email = `${localPart}@${domain}`;
    expect(emailSchema.parse(email)).toHaveLength(255);
  });

  it('rejects email longer than 255 chars', () => {
    const domain = 'b.co';
    const localPart = 'a'.repeat(256 - 1 - domain.length);
    const email = `${localPart}@${domain}`;
    expect(() => emailSchema.parse(email)).toThrow();
  });

  it('rejects empty string', () => {
    expect(() => emailSchema.parse('')).toThrow();
  });
});

describe('displayNameSchema — boundary tests', () => {
  it('rejects empty string (min 1)', () => {
    expect(() => displayNameSchema.parse('')).toThrow();
  });

  it('accepts string of exactly 1 char', () => {
    expect(displayNameSchema.parse('A')).toBe('A');
  });

  it('accepts string of exactly 128 chars', () => {
    expect(displayNameSchema.parse('x'.repeat(128))).toHaveLength(128);
  });

  it('rejects string of 129 chars', () => {
    expect(() => displayNameSchema.parse('x'.repeat(129))).toThrow();
  });
});

describe('bioSchema — boundary tests', () => {
  it('accepts undefined (optional)', () => {
    expect(bioSchema.parse(undefined)).toBeUndefined();
  });

  it('accepts empty string', () => {
    expect(bioSchema.parse('')).toBe('');
  });

  it('accepts string of exactly 2000 chars', () => {
    expect(bioSchema.parse('x'.repeat(2000))).toHaveLength(2000);
  });

  it('rejects string of 2001 chars', () => {
    expect(() => bioSchema.parse('x'.repeat(2001))).toThrow();
  });
});

describe('slugSchema — boundary tests', () => {
  it('rejects empty string (min 1)', () => {
    expect(() => slugSchema.parse('')).toThrow();
  });

  it('accepts slug of exactly 1 char', () => {
    expect(slugSchema.parse('a')).toBe('a');
  });

  it('accepts slug of exactly 255 chars', () => {
    const validSlug = 'a'.repeat(255);
    expect(slugSchema.parse(validSlug)).toHaveLength(255);
  });

  it('rejects slug of 256 chars', () => {
    expect(() => slugSchema.parse('a'.repeat(256))).toThrow();
  });

  it('rejects uppercase letters via regex', () => {
    expect(() => slugSchema.parse('Hello')).toThrow();
  });

  it('rejects leading hyphen', () => {
    expect(() => slugSchema.parse('-abc')).toThrow();
  });

  it('rejects trailing hyphen', () => {
    expect(() => slugSchema.parse('abc-')).toThrow();
  });

  it('rejects consecutive hyphens', () => {
    expect(() => slugSchema.parse('ab--cd')).toThrow();
  });

  it('accepts single-segment slug', () => {
    expect(slugSchema.parse('hello')).toBe('hello');
  });

  it('accepts multi-segment slug', () => {
    expect(slugSchema.parse('hello-world-123')).toBe('hello-world-123');
  });
});

describe('contentTypeSchema — boundary tests', () => {
  it('accepts all valid content types', () => {
    for (const type of ['project', 'article', 'blog', 'explainer'] as const) {
      expect(contentTypeSchema.parse(type)).toBe(type);
    }
  });

  it('rejects invalid content type', () => {
    expect(() => contentTypeSchema.parse('podcast')).toThrow();
  });

  it('rejects empty string', () => {
    expect(() => contentTypeSchema.parse('')).toThrow();
  });
});

describe('contentStatusSchema — boundary tests', () => {
  it('accepts all valid statuses', () => {
    for (const status of ['draft', 'published', 'archived'] as const) {
      expect(contentStatusSchema.parse(status)).toBe(status);
    }
  });

  it('rejects invalid status', () => {
    expect(() => contentStatusSchema.parse('deleted')).toThrow();
  });
});

describe('difficultySchema — boundary tests', () => {
  it('accepts all valid difficulties', () => {
    for (const diff of ['beginner', 'intermediate', 'advanced'] as const) {
      expect(difficultySchema.parse(diff)).toBe(diff);
    }
  });

  it('rejects invalid difficulty', () => {
    expect(() => difficultySchema.parse('expert')).toThrow();
  });
});

describe('createContentSchema — boundary tests', () => {
  const validContent = {
    type: 'project' as const,
    title: 'Valid Title',
  };

  it('rejects title shorter than 1 char', () => {
    expect(() => createContentSchema.parse({ ...validContent, title: '' })).toThrow();
  });

  it('accepts title of exactly 1 char', () => {
    expect(createContentSchema.parse({ ...validContent, title: 'A' }).title).toBe('A');
  });

  it('accepts title of exactly 255 chars', () => {
    expect(
      createContentSchema.parse({ ...validContent, title: 'x'.repeat(255) }).title,
    ).toHaveLength(255);
  });

  it('rejects title of 256 chars', () => {
    expect(() =>
      createContentSchema.parse({ ...validContent, title: 'x'.repeat(256) }),
    ).toThrow();
  });

  it('accepts description of exactly 2000 chars', () => {
    expect(
      createContentSchema.parse({ ...validContent, description: 'x'.repeat(2000) }).description,
    ).toHaveLength(2000);
  });

  it('rejects description of 2001 chars', () => {
    expect(() =>
      createContentSchema.parse({ ...validContent, description: 'x'.repeat(2001) }),
    ).toThrow();
  });

  it('accepts tags array of exactly 20', () => {
    const data = { ...validContent, tags: Array(20).fill('tag') };
    expect(createContentSchema.parse(data).tags).toHaveLength(20);
  });

  it('rejects tags array of 21', () => {
    const data = { ...validContent, tags: Array(21).fill('tag') };
    expect(() => createContentSchema.parse(data)).toThrow();
  });

  it('accepts estimatedMinutes as positive integer', () => {
    expect(
      createContentSchema.parse({ ...validContent, estimatedMinutes: 1 }).estimatedMinutes,
    ).toBe(1);
  });

  it('rejects estimatedMinutes of 0 (not positive)', () => {
    expect(() =>
      createContentSchema.parse({ ...validContent, estimatedMinutes: 0 }),
    ).toThrow();
  });

  it('rejects estimatedMinutes of -1', () => {
    expect(() =>
      createContentSchema.parse({ ...validContent, estimatedMinutes: -1 }),
    ).toThrow();
  });

  it('rejects non-integer estimatedMinutes', () => {
    expect(() =>
      createContentSchema.parse({ ...validContent, estimatedMinutes: 1.5 }),
    ).toThrow();
  });
});

describe('createCommentSchema — boundary tests', () => {
  const uuid = crypto.randomUUID();

  it('rejects content shorter than 1 char', () => {
    expect(() =>
      createCommentSchema.parse({ targetType: 'project', targetId: uuid, content: '' }),
    ).toThrow();
  });

  it('accepts content of exactly 1 char', () => {
    expect(
      createCommentSchema.parse({ targetType: 'project', targetId: uuid, content: 'x' }).content,
    ).toBe('x');
  });

  it('accepts content of exactly 10000 chars', () => {
    expect(
      createCommentSchema.parse({
        targetType: 'project',
        targetId: uuid,
        content: 'x'.repeat(10000),
      }).content,
    ).toHaveLength(10000);
  });

  it('rejects content of 10001 chars', () => {
    expect(() =>
      createCommentSchema.parse({
        targetType: 'project',
        targetId: uuid,
        content: 'x'.repeat(10001),
      }),
    ).toThrow();
  });

  it('rejects invalid uuid for targetId', () => {
    expect(() =>
      createCommentSchema.parse({ targetType: 'project', targetId: 'not-uuid', content: 'hi' }),
    ).toThrow();
  });

  it('rejects invalid uuid for parentId', () => {
    expect(() =>
      createCommentSchema.parse({
        targetType: 'project',
        targetId: uuid,
        parentId: 'not-uuid',
        content: 'hi',
      }),
    ).toThrow();
  });
});

describe('hubTypeSchema — boundary tests', () => {
  it('accepts all valid hub types', () => {
    for (const type of ['community', 'product', 'company'] as const) {
      expect(hubTypeSchema.parse(type)).toBe(type);
    }
  });

  it('rejects invalid hub type', () => {
    expect(() => hubTypeSchema.parse('organization')).toThrow();
  });
});

describe('createHubSchema — boundary tests', () => {
  it('rejects name shorter than 1 char', () => {
    expect(() => createHubSchema.parse({ name: '' })).toThrow();
  });

  it('accepts name of exactly 1 char', () => {
    expect(createHubSchema.parse({ name: 'A' }).name).toBe('A');
  });

  it('accepts name of exactly 128 chars', () => {
    expect(createHubSchema.parse({ name: 'x'.repeat(128) }).name).toHaveLength(128);
  });

  it('rejects name of 129 chars', () => {
    expect(() => createHubSchema.parse({ name: 'x'.repeat(129) })).toThrow();
  });

  it('accepts description of exactly 2000 chars', () => {
    expect(
      createHubSchema.parse({ name: 'Test', description: 'x'.repeat(2000) }).description,
    ).toHaveLength(2000);
  });

  it('rejects description of 2001 chars', () => {
    expect(() =>
      createHubSchema.parse({ name: 'Test', description: 'x'.repeat(2001) }),
    ).toThrow();
  });

  it('accepts rules of exactly 10000 chars', () => {
    expect(
      createHubSchema.parse({ name: 'Test', rules: 'x'.repeat(10000) }).rules,
    ).toHaveLength(10000);
  });

  it('rejects rules of 10001 chars', () => {
    expect(() =>
      createHubSchema.parse({ name: 'Test', rules: 'x'.repeat(10001) }),
    ).toThrow();
  });

  it('accepts categories array of exactly 20', () => {
    expect(
      createHubSchema.parse({ name: 'Test', categories: Array(20).fill('cat') }).categories,
    ).toHaveLength(20);
  });

  it('rejects categories array of 21', () => {
    expect(() =>
      createHubSchema.parse({ name: 'Test', categories: Array(21).fill('cat') }),
    ).toThrow();
  });
});

describe('createPostSchema — boundary tests', () => {
  const uuid = crypto.randomUUID();

  it('rejects content shorter than 1 char', () => {
    expect(() => createPostSchema.parse({ hubId: uuid, content: '' })).toThrow();
  });

  it('accepts content of exactly 1 char', () => {
    expect(createPostSchema.parse({ hubId: uuid, content: 'x' }).content).toBe('x');
  });

  it('accepts content of exactly 10000 chars', () => {
    expect(
      createPostSchema.parse({ hubId: uuid, content: 'x'.repeat(10000) }).content,
    ).toHaveLength(10000);
  });

  it('rejects content of 10001 chars', () => {
    expect(() =>
      createPostSchema.parse({ hubId: uuid, content: 'x'.repeat(10001) }),
    ).toThrow();
  });

  it('accepts pollOptions of exactly 2 items (min)', () => {
    expect(
      createPostSchema.parse({
        hubId: uuid,
        content: 'Poll?',
        pollOptions: ['Yes', 'No'],
      }).pollOptions,
    ).toHaveLength(2);
  });

  it('rejects pollOptions of 1 item (below min 2)', () => {
    expect(() =>
      createPostSchema.parse({
        hubId: uuid,
        content: 'Poll?',
        pollOptions: ['Only one'],
      }),
    ).toThrow();
  });

  it('accepts pollOptions of exactly 10 items (max)', () => {
    expect(
      createPostSchema.parse({
        hubId: uuid,
        content: 'Poll?',
        pollOptions: Array(10).fill('opt'),
      }).pollOptions,
    ).toHaveLength(10);
  });

  it('rejects pollOptions of 11 items', () => {
    expect(() =>
      createPostSchema.parse({
        hubId: uuid,
        content: 'Poll?',
        pollOptions: Array(11).fill('opt'),
      }),
    ).toThrow();
  });
});

describe('createReplySchema — boundary tests', () => {
  const uuid = crypto.randomUUID();

  it('rejects content shorter than 1 char', () => {
    expect(() => createReplySchema.parse({ postId: uuid, content: '' })).toThrow();
  });

  it('accepts content of exactly 1 char', () => {
    expect(createReplySchema.parse({ postId: uuid, content: 'x' }).content).toBe('x');
  });

  it('accepts content of exactly 10000 chars', () => {
    expect(
      createReplySchema.parse({ postId: uuid, content: 'x'.repeat(10000) }).content,
    ).toHaveLength(10000);
  });

  it('rejects content of 10001 chars', () => {
    expect(() =>
      createReplySchema.parse({ postId: uuid, content: 'x'.repeat(10001) }),
    ).toThrow();
  });
});

describe('createProductSchema — boundary tests', () => {
  it('rejects name shorter than 1 char', () => {
    expect(() => createProductSchema.parse({ name: '' })).toThrow();
  });

  it('accepts name of exactly 1 char', () => {
    expect(createProductSchema.parse({ name: 'A' }).name).toBe('A');
  });

  it('accepts name of exactly 255 chars', () => {
    expect(createProductSchema.parse({ name: 'x'.repeat(255) }).name).toHaveLength(255);
  });

  it('rejects name of 256 chars', () => {
    expect(() => createProductSchema.parse({ name: 'x'.repeat(256) })).toThrow();
  });

  it('accepts description of exactly 5000 chars', () => {
    expect(
      createProductSchema.parse({ name: 'Test', description: 'x'.repeat(5000) }).description,
    ).toHaveLength(5000);
  });

  it('rejects description of 5001 chars', () => {
    expect(() =>
      createProductSchema.parse({ name: 'Test', description: 'x'.repeat(5001) }),
    ).toThrow();
  });

  it('accepts pricing.min of exactly 0', () => {
    expect(
      createProductSchema.parse({ name: 'Test', pricing: { min: 0 } }).pricing?.min,
    ).toBe(0);
  });

  it('rejects pricing.min below 0', () => {
    expect(() =>
      createProductSchema.parse({ name: 'Test', pricing: { min: -1 } }),
    ).toThrow();
  });

  it('rejects pricing.min of -0.01', () => {
    expect(() =>
      createProductSchema.parse({ name: 'Test', pricing: { min: -0.01 } }),
    ).toThrow();
  });

  it('accepts pricing.max of exactly 0', () => {
    expect(
      createProductSchema.parse({ name: 'Test', pricing: { max: 0 } }).pricing?.max,
    ).toBe(0);
  });

  it('rejects pricing.max below 0', () => {
    expect(() =>
      createProductSchema.parse({ name: 'Test', pricing: { max: -1 } }),
    ).toThrow();
  });
});

describe('judgeEntrySchema — boundary tests', () => {
  const uuid = crypto.randomUUID();

  it('rejects score below 1', () => {
    expect(() => judgeEntrySchema.parse({ entryId: uuid, score: -1 })).toThrow();
  });

  it('rejects score of exactly 0 (scores are 1–100)', () => {
    expect(() => judgeEntrySchema.parse({ entryId: uuid, score: 0 })).toThrow();
  });

  it('accepts score of exactly 1', () => {
    expect(judgeEntrySchema.parse({ entryId: uuid, score: 1 }).score).toBe(1);
  });

  it('accepts score of exactly 100', () => {
    expect(judgeEntrySchema.parse({ entryId: uuid, score: 100 }).score).toBe(100);
  });

  it('rejects score above 100', () => {
    expect(() => judgeEntrySchema.parse({ entryId: uuid, score: 101 })).toThrow();
  });

  it('rejects non-integer score', () => {
    expect(() => judgeEntrySchema.parse({ entryId: uuid, score: 50.5 })).toThrow();
  });

  it('accepts feedback of exactly 2000 chars', () => {
    expect(
      judgeEntrySchema.parse({ entryId: uuid, score: 50, feedback: 'x'.repeat(2000) }).feedback,
    ).toHaveLength(2000);
  });

  it('rejects feedback of 2001 chars', () => {
    expect(() =>
      judgeEntrySchema.parse({ entryId: uuid, score: 50, feedback: 'x'.repeat(2001) }),
    ).toThrow();
  });

  // Per-criterion scoring (session 173)
  it('accepts per-criterion scores without an overall score', () => {
    const parsed = judgeEntrySchema.parse({
      entryId: uuid,
      criteriaScores: [{ label: 'Docs', score: 18, max: 20 }, { label: 'Creativity', score: 24, max: 30 }],
    });
    expect(parsed.criteriaScores).toHaveLength(2);
    expect(parsed.score).toBeUndefined();
  });

  it('rejects a submission with neither score nor criteriaScores', () => {
    expect(() => judgeEntrySchema.parse({ entryId: uuid })).toThrow();
  });

  it('rejects a criterion score above its max', () => {
    expect(() =>
      judgeEntrySchema.parse({ entryId: uuid, criteriaScores: [{ label: 'Docs', score: 25, max: 20 }] }),
    ).toThrow();
  });
});

describe('createContestSchema — boundary tests', () => {
  const validContest = {
    title: 'Contest',
    startDate: '2026-01-01T00:00:00Z',
    endDate: '2026-02-01T00:00:00Z',
  };

  it('rejects title shorter than 1 char', () => {
    expect(() => createContestSchema.parse({ ...validContest, title: '' })).toThrow();
  });

  it('accepts title of exactly 1 char', () => {
    expect(createContestSchema.parse({ ...validContest, title: 'A' }).title).toBe('A');
  });

  it('accepts title of exactly 255 chars', () => {
    expect(
      createContestSchema.parse({ ...validContest, title: 'x'.repeat(255) }).title,
    ).toHaveLength(255);
  });

  it('rejects title of 256 chars', () => {
    expect(() =>
      createContestSchema.parse({ ...validContest, title: 'x'.repeat(256) }),
    ).toThrow();
  });

  // Long-form fields allow genuinely large content (50k, ~16 pages) but stay
  // bounded — an unbounded field is a DoS vector at ingest + render (the cap was
  // raised from 10k after a large-blob incident; the bound itself is load-bearing).
  it('accepts a 10000-char description (well within the cap)', () => {
    expect(
      createContestSchema.parse({ ...validContest, description: 'x'.repeat(10000) }).description,
    ).toHaveLength(10000);
  });

  it('accepts description of exactly 50000 chars (CONTEST_RICH_TEXT_MAX)', () => {
    expect(
      createContestSchema.parse({ ...validContest, description: 'x'.repeat(50000) }).description,
    ).toHaveLength(50000);
  });

  it('rejects description of 50001 chars (bound still enforced)', () => {
    expect(() =>
      createContestSchema.parse({ ...validContest, description: 'x'.repeat(50001) }),
    ).toThrow();
  });

  it('accepts rules of exactly 50000 chars', () => {
    expect(
      createContestSchema.parse({ ...validContest, rules: 'x'.repeat(50000) }).rules,
    ).toHaveLength(50000);
  });

  it('rejects rules of 50001 chars', () => {
    expect(() =>
      createContestSchema.parse({ ...validContest, rules: 'x'.repeat(50001) }),
    ).toThrow();
  });

  it('accepts per-field formats (markdown|html) independently, rejects others', () => {
    const parsed = createContestSchema.parse({
      ...validContest,
      descriptionFormat: 'html',
      rulesFormat: 'markdown',
      prizesDescriptionFormat: 'html',
    });
    expect(parsed.descriptionFormat).toBe('html');
    expect(parsed.rulesFormat).toBe('markdown');
    expect(parsed.prizesDescriptionFormat).toBe('html');
    expect(() => createContestSchema.parse({ ...validContest, descriptionFormat: 'raw' })).toThrow();
  });

  it('per-field formats are optional (defaults handled server-side)', () => {
    const parsed = createContestSchema.parse({ ...validContest });
    expect(parsed.descriptionFormat).toBeUndefined();
    expect(parsed.rulesFormat).toBeUndefined();
    expect(parsed.prizesDescriptionFormat).toBeUndefined();
  });

  // Cross-field date refinement (session 171).
  it('rejects an end date on or before the start date', () => {
    expect(() =>
      createContestSchema.parse({ ...validContest, startDate: '2026-02-01T00:00:00Z', endDate: '2026-02-01T00:00:00Z' }),
    ).toThrow();
    expect(() =>
      createContestSchema.parse({ ...validContest, startDate: '2026-03-01T00:00:00Z', endDate: '2026-02-01T00:00:00Z' }),
    ).toThrow();
  });

  it('rejects a judging end date before the end date', () => {
    expect(() =>
      createContestSchema.parse({ ...validContest, judgingEndDate: '2026-01-15T00:00:00Z' }),
    ).toThrow();
  });

  it('accepts a judging end date on or after the end date', () => {
    expect(
      createContestSchema.parse({ ...validContest, judgingEndDate: '2026-02-15T00:00:00Z' }).judgingEndDate,
    ).toBe('2026-02-15T00:00:00Z');
  });

  // New fields (session 171).
  it('accepts community voting, judging visibility, and a criteria rubric', () => {
    const parsed = createContestSchema.parse({
      ...validContest,
      communityVotingEnabled: true,
      judgingVisibility: 'public',
      judgingCriteria: [{ label: 'Docs', weight: 20, description: 'Clear log' }],
    });
    expect(parsed.communityVotingEnabled).toBe(true);
    expect(parsed.judgingVisibility).toBe('public');
    expect(parsed.judgingCriteria).toHaveLength(1);
  });

  it('rejects an invalid judging visibility value', () => {
    expect(() =>
      createContestSchema.parse({ ...validContest, judgingVisibility: 'everyone' }),
    ).toThrow();
  });

  it('accepts category-only prizes (place optional)', () => {
    const parsed = createContestSchema.parse({
      ...validContest,
      prizes: [{ category: 'Best in Show', title: 'Editor Pick', value: 'Trophy' }],
    });
    expect(parsed.prizes![0]!.place).toBeUndefined();
    expect(parsed.prizes![0]!.category).toBe('Best in Show');
  });

  // Entry eligibility + per-user cap (session 172).
  it('accepts eligibleContentTypes and maxEntriesPerUser', () => {
    const parsed = createContestSchema.parse({
      ...validContest,
      eligibleContentTypes: ['project', 'explainer'],
      maxEntriesPerUser: 3,
    });
    expect(parsed.eligibleContentTypes).toEqual(['project', 'explainer']);
    expect(parsed.maxEntriesPerUser).toBe(3);
  });

  it('rejects a non-positive maxEntriesPerUser', () => {
    expect(() => createContestSchema.parse({ ...validContest, maxEntriesPerUser: 0 })).toThrow();
    expect(() => createContestSchema.parse({ ...validContest, maxEntriesPerUser: -1 })).toThrow();
  });

  // Visibility + access (session 174)
  it('accepts visibility + visibleToRoles + stakeholders', () => {
    const parsed = createContestSchema.parse({
      ...validContest,
      visibility: 'private',
      visibleToRoles: ['staff', 'admin'],
      stakeholders: ['11111111-1111-4111-8111-111111111111'],
    });
    expect(parsed.visibility).toBe('private');
    expect(parsed.visibleToRoles).toEqual(['staff', 'admin']);
    expect(parsed.stakeholders).toHaveLength(1);
  });

  it('rejects an invalid visibility or role', () => {
    expect(() => createContestSchema.parse({ ...validContest, visibility: 'secret' })).toThrow();
    expect(() => createContestSchema.parse({ ...validContest, visibleToRoles: ['wizard'] })).toThrow();
  });
});

describe('updateContestSchema', () => {
  it('strips the judges field (judges are managed via the contest_judges table)', () => {
    const parsed = updateContestSchema.parse({
      title: 'Updated',
      judges: ['11111111-1111-1111-1111-111111111111'],
      eligibleContentTypes: ['project'],
    }) as Record<string, unknown>;
    expect(parsed.judges).toBeUndefined();
    expect(parsed.eligibleContentTypes).toEqual(['project']);
  });
});

describe('submissionTemplateFieldSchema + stage submissionTemplate', () => {
  const field = { key: 'repo_url', label: 'Repository URL', type: 'url', required: true };

  it('accepts a valid template field', () => {
    expect(submissionTemplateFieldSchema.safeParse(field).success).toBe(true);
  });

  it('rejects bad keys (uppercase, hyphens, blank, >40 chars)', () => {
    for (const key of ['RepoUrl', 'repo-url', '', 'a'.repeat(41)]) {
      expect(submissionTemplateFieldSchema.safeParse({ ...field, key }).success, key).toBe(false);
    }
  });

  it('rejects unknown field types', () => {
    expect(submissionTemplateFieldSchema.safeParse({ ...field, type: 'file' }).success).toBe(false);
  });

  it('a submission stage carries a template; duplicate keys are rejected', () => {
    const stage = { id: 's1', name: 'Proposals', kind: 'submission', submissionTemplate: [field] };
    expect(contestStageSchema.safeParse(stage).success).toBe(true);

    const dup = { ...stage, submissionTemplate: [field, { ...field, label: 'Again' }] };
    expect(contestStageSchema.safeParse(dup).success).toBe(false);
  });

  // --- Phase 4 field types ---
  it('accepts the new scalar field types (email/number/checkbox/date)', () => {
    for (const type of ['email', 'number', 'checkbox', 'date']) {
      expect(submissionTemplateFieldSchema.safeParse({ ...field, type }).success, type).toBe(true);
    }
  });

  it('accepts a select field WITH options and rejects one without', () => {
    const sel = { key: 'track', label: 'Track', type: 'select', required: true };
    expect(submissionTemplateFieldSchema.safeParse(sel).success).toBe(false);
    expect(submissionTemplateFieldSchema.safeParse({ ...sel, options: [] }).success).toBe(false);
    expect(
      submissionTemplateFieldSchema.safeParse({ ...sel, options: [{ value: 'a', label: 'Alpha' }] }).success,
    ).toBe(true);
  });

  it('accepts an agreement field WITH terms and rejects one without', () => {
    const agr = { key: 'tos', label: 'Terms', type: 'agreement', required: true, mustAccept: true };
    expect(submissionTemplateFieldSchema.safeParse(agr).success).toBe(false);
    expect(submissionTemplateFieldSchema.safeParse({ ...agr, terms: '   ' }).success).toBe(false);
    expect(
      submissionTemplateFieldSchema.safeParse({ ...agr, terms: 'You agree to ship the hardware.' }).success,
    ).toBe(true);
  });

  it('accepts a pii flag and an address field', () => {
    expect(submissionTemplateFieldSchema.safeParse({ key: 'addr', label: 'Mailing address', type: 'address', required: true, pii: true }).success).toBe(true);
    expect(submissionTemplateFieldSchema.safeParse({ ...field, type: 'email', pii: true }).success).toBe(true);
  });
});

describe('stageSubmissionSchema', () => {
  it('accepts a bounded fields record and rejects oversized values', () => {
    expect(stageSubmissionSchema.safeParse({ stageId: 'prop', fields: { summary: 'A plan' } }).success).toBe(true);
    expect(stageSubmissionSchema.safeParse({ stageId: 'prop', fields: { summary: 'x'.repeat(4001) } }).success).toBe(false);
  });

  it('rejects a payload-bomb field count (>50 keys)', () => {
    const fields = Object.fromEntries(Array.from({ length: 51 }, (_, i) => [`f${i}`, 'v']));
    expect(stageSubmissionSchema.safeParse({ stageId: 'prop', fields }).success).toBe(false);
  });
});

describe('createLearningPathSchema — boundary tests', () => {
  it('rejects title shorter than 1 char', () => {
    expect(() => createLearningPathSchema.parse({ title: '' })).toThrow();
  });

  it('accepts title of exactly 1 char', () => {
    expect(createLearningPathSchema.parse({ title: 'A' }).title).toBe('A');
  });

  it('accepts title of exactly 255 chars', () => {
    expect(
      createLearningPathSchema.parse({ title: 'x'.repeat(255) }).title,
    ).toHaveLength(255);
  });

  it('rejects title of 256 chars', () => {
    expect(() => createLearningPathSchema.parse({ title: 'x'.repeat(256) })).toThrow();
  });

  it('accepts estimatedHours of exactly 9999 (max)', () => {
    expect(
      createLearningPathSchema.parse({ title: 'Test', estimatedHours: 9999 }).estimatedHours,
    ).toBe(9999);
  });

  it('rejects estimatedHours above 9999', () => {
    expect(() =>
      createLearningPathSchema.parse({ title: 'Test', estimatedHours: 10000 }),
    ).toThrow();
  });

  it('accepts estimatedHours of small positive value', () => {
    expect(
      createLearningPathSchema.parse({ title: 'Test', estimatedHours: 0.5 }).estimatedHours,
    ).toBe(0.5);
  });

  it('rejects estimatedHours of 0 (not positive)', () => {
    expect(() =>
      createLearningPathSchema.parse({ title: 'Test', estimatedHours: 0 }),
    ).toThrow();
  });

  it('rejects negative estimatedHours', () => {
    expect(() =>
      createLearningPathSchema.parse({ title: 'Test', estimatedHours: -1 }),
    ).toThrow();
  });
});

describe('createLessonSchema — boundary tests', () => {
  const uuid = crypto.randomUUID();
  const validLesson = { moduleId: uuid, title: 'Lesson', type: 'article' as const };

  it('rejects title shorter than 1 char', () => {
    expect(() => createLessonSchema.parse({ ...validLesson, title: '' })).toThrow();
  });

  it('accepts title of exactly 1 char', () => {
    expect(createLessonSchema.parse({ ...validLesson, title: 'A' }).title).toBe('A');
  });

  it('accepts title of exactly 255 chars', () => {
    expect(
      createLessonSchema.parse({ ...validLesson, title: 'x'.repeat(255) }).title,
    ).toHaveLength(255);
  });

  it('rejects title of 256 chars', () => {
    expect(() =>
      createLessonSchema.parse({ ...validLesson, title: 'x'.repeat(256) }),
    ).toThrow();
  });

  it('accepts durationMinutes of exactly 1 (positive int)', () => {
    expect(createLessonSchema.parse({ ...validLesson, durationMinutes: 1 }).durationMinutes).toBe(1);
  });

  it('rejects durationMinutes of 0 (not positive)', () => {
    expect(() => createLessonSchema.parse({ ...validLesson, durationMinutes: 0 })).toThrow();
  });

  it('rejects negative durationMinutes', () => {
    expect(() => createLessonSchema.parse({ ...validLesson, durationMinutes: -1 })).toThrow();
  });

  it('accepts durationMinutes of exactly 9999 (max)', () => {
    expect(createLessonSchema.parse({ ...validLesson, durationMinutes: 9999 }).durationMinutes).toBe(9999);
  });

  it('rejects durationMinutes above 9999', () => {
    expect(() => createLessonSchema.parse({ ...validLesson, durationMinutes: 10000 })).toThrow();
  });

  it('rejects non-integer durationMinutes', () => {
    expect(() => createLessonSchema.parse({ ...validLesson, durationMinutes: 1.5 })).toThrow();
  });
});

describe('sendMessageSchema — boundary tests', () => {
  it('rejects body shorter than 1 char', () => {
    expect(() => sendMessageSchema.parse({ body: '' })).toThrow();
  });

  it('accepts body of exactly 1 char', () => {
    expect(sendMessageSchema.parse({ body: 'x' }).body).toBe('x');
  });

  it('accepts body of exactly 10000 chars', () => {
    expect(sendMessageSchema.parse({ body: 'x'.repeat(10000) }).body).toHaveLength(10000);
  });

  it('rejects body of 10001 chars', () => {
    expect(() => sendMessageSchema.parse({ body: 'x'.repeat(10001) })).toThrow();
  });
});

describe('createDocsSiteSchema — boundary tests', () => {
  it('rejects name shorter than 1 char', () => {
    expect(() => createDocsSiteSchema.parse({ name: '' })).toThrow();
  });

  it('accepts name of exactly 1 char', () => {
    expect(createDocsSiteSchema.parse({ name: 'A' }).name).toBe('A');
  });

  it('accepts name of exactly 128 chars', () => {
    expect(createDocsSiteSchema.parse({ name: 'x'.repeat(128) }).name).toHaveLength(128);
  });

  it('rejects name of 129 chars', () => {
    expect(() => createDocsSiteSchema.parse({ name: 'x'.repeat(129) })).toThrow();
  });
});

describe('createDocsVersionSchema — boundary tests', () => {
  it('rejects version shorter than 1 char', () => {
    expect(() => createDocsVersionSchema.parse({ version: '' })).toThrow();
  });

  it('accepts version of exactly 1 char', () => {
    expect(createDocsVersionSchema.parse({ version: '1' }).version).toBe('1');
  });

  it('accepts version of exactly 32 chars', () => {
    expect(
      createDocsVersionSchema.parse({ version: 'v'.repeat(32) }).version,
    ).toHaveLength(32);
  });

  it('rejects version of 33 chars', () => {
    expect(() => createDocsVersionSchema.parse({ version: 'v'.repeat(33) })).toThrow();
  });
});

describe('createReportSchema — boundary tests', () => {
  const uuid = crypto.randomUUID();

  it('accepts all valid reason enum values', () => {
    for (const reason of ['spam', 'harassment', 'inappropriate', 'copyright', 'other'] as const) {
      expect(
        createReportSchema.parse({ targetType: 'user', targetId: uuid, reason }).reason,
      ).toBe(reason);
    }
  });

  it('rejects invalid reason', () => {
    expect(() =>
      createReportSchema.parse({ targetType: 'user', targetId: uuid, reason: 'boring' }),
    ).toThrow();
  });

  it('accepts all valid targetType enum values', () => {
    for (const targetType of [
      'project', 'article', 'blog', 'post', 'comment', 'user', 'explainer',
    ] as const) {
      expect(
        createReportSchema.parse({ targetType, targetId: uuid, reason: 'spam' }).targetType,
      ).toBe(targetType);
    }
  });

  it('rejects invalid targetType', () => {
    expect(() =>
      createReportSchema.parse({ targetType: 'hub', targetId: uuid, reason: 'spam' }),
    ).toThrow();
  });

  it('accepts description of exactly 2000 chars', () => {
    expect(
      createReportSchema.parse({
        targetType: 'user',
        targetId: uuid,
        reason: 'spam',
        description: 'x'.repeat(2000),
      }).description,
    ).toHaveLength(2000);
  });

  it('rejects description of 2001 chars', () => {
    expect(() =>
      createReportSchema.parse({
        targetType: 'user',
        targetId: uuid,
        reason: 'spam',
        description: 'x'.repeat(2001),
      }),
    ).toThrow();
  });
});

describe('adminUpdateRoleSchema — boundary tests', () => {
  it('accepts all valid roles', () => {
    for (const role of ['member', 'pro', 'verified', 'staff', 'admin'] as const) {
      expect(adminUpdateRoleSchema.parse({ role }).role).toBe(role);
    }
  });

  it('rejects invalid role', () => {
    expect(() => adminUpdateRoleSchema.parse({ role: 'superadmin' })).toThrow();
  });
});

describe('adminUpdateStatusSchema — boundary tests', () => {
  it('accepts all valid statuses', () => {
    for (const status of ['active', 'suspended', 'deleted'] as const) {
      expect(adminUpdateStatusSchema.parse({ status }).status).toBe(status);
    }
  });

  it('rejects invalid status', () => {
    expect(() => adminUpdateStatusSchema.parse({ status: 'banned' })).toThrow();
  });
});

describe('resolveReportSchema — boundary tests', () => {
  it('rejects resolution shorter than 1 char', () => {
    expect(() =>
      resolveReportSchema.parse({ status: 'resolved', resolution: '' }),
    ).toThrow();
  });

  it('accepts resolution of exactly 1 char', () => {
    expect(
      resolveReportSchema.parse({ status: 'resolved', resolution: 'x' }).resolution,
    ).toBe('x');
  });

  it('accepts resolution of exactly 2000 chars', () => {
    expect(
      resolveReportSchema.parse({
        status: 'resolved',
        resolution: 'x'.repeat(2000),
      }).resolution,
    ).toHaveLength(2000);
  });

  it('rejects resolution of 2001 chars', () => {
    expect(() =>
      resolveReportSchema.parse({ status: 'resolved', resolution: 'x'.repeat(2001) }),
    ).toThrow();
  });

  it('accepts all valid status enum values', () => {
    for (const status of ['reviewed', 'resolved', 'dismissed'] as const) {
      expect(
        resolveReportSchema.parse({ status, resolution: 'Done' }).status,
      ).toBe(status);
    }
  });

  it('rejects invalid status', () => {
    expect(() =>
      resolveReportSchema.parse({ status: 'pending', resolution: 'Done' }),
    ).toThrow();
  });
});

describe('optionalUrl — boundary tests (via updateProfileSchema)', () => {
  it('transforms empty string to undefined', () => {
    const result = updateProfileSchema.parse({ socialLinks: { github: '' } });
    expect(result.socialLinks?.github).toBeUndefined();
  });

  it('transforms whitespace-only string to undefined', () => {
    const result = updateProfileSchema.parse({ socialLinks: { github: '   ' } });
    expect(result.socialLinks?.github).toBeUndefined();
  });

  it('preserves valid URL', () => {
    const result = updateProfileSchema.parse({
      socialLinks: { github: 'https://github.com/user' },
    });
    expect(result.socialLinks?.github).toBe('https://github.com/user');
  });

  it('rejects invalid URL (non-empty, non-whitespace)', () => {
    expect(() =>
      updateProfileSchema.parse({ socialLinks: { github: 'not-a-url' } }),
    ).toThrow();
  });

  it('accepts undefined value', () => {
    const result = updateProfileSchema.parse({ socialLinks: { github: undefined } });
    expect(result.socialLinks?.github).toBeUndefined();
  });
});

describe('likeTargetTypeSchema — boundary tests', () => {
  it('accepts all valid like target types', () => {
    for (const type of ['project', 'article', 'blog', 'comment', 'post', 'explainer', 'video'] as const) {
      expect(likeTargetTypeSchema.parse(type)).toBe(type);
    }
  });

  it('rejects invalid like target type', () => {
    expect(() => likeTargetTypeSchema.parse('lesson')).toThrow();
  });

  it('rejects empty string', () => {
    expect(() => likeTargetTypeSchema.parse('')).toThrow();
  });
});

describe('commentTargetTypeSchema — boundary tests', () => {
  it('accepts all valid comment target types', () => {
    for (const type of [
      'project', 'article', 'blog', 'explainer', 'post', 'lesson', 'video',
    ] as const) {
      expect(commentTargetTypeSchema.parse(type)).toBe(type);
    }
  });

  it('rejects invalid comment target type', () => {
    expect(() => commentTargetTypeSchema.parse('comment')).toThrow();
  });

  it('rejects empty string', () => {
    expect(() => commentTargetTypeSchema.parse('')).toThrow();
  });
});

describe('contestStatusSchema — boundary tests', () => {
  it('accepts all valid contest statuses', () => {
    for (const status of ['upcoming', 'active', 'judging', 'completed', 'cancelled'] as const) {
      expect(contestStatusSchema.parse(status)).toBe(status);
    }
  });

  it('rejects invalid contest status', () => {
    expect(() => contestStatusSchema.parse('invalid-status')).toThrow();
  });
});

describe('contest enum validators stay derived from the pgEnums (drift guard)', () => {
  it('contestStatusSchema mirrors contestStatusEnum exactly', () => {
    // RED if someone re-hardcodes the list and it drifts from the column enum.
    expect([...contestStatusSchema.options].sort()).toEqual([...contestStatusEnum.enumValues].sort());
    // Auto-covers every value (incl. draft + paused, which the boundary test omits).
    for (const v of contestStatusEnum.enumValues) {
      expect(contestStatusSchema.parse(v)).toBe(v);
    }
  });

  it('contestTransitionSchema.status accepts every contest status and rejects unknowns', () => {
    for (const v of contestStatusEnum.enumValues) {
      expect(contestTransitionSchema.safeParse({ status: v }).success).toBe(true);
    }
    expect(contestTransitionSchema.safeParse({ status: 'not-a-status' }).success).toBe(false);
  });
});

describe('videoPlatformSchema — boundary tests', () => {
  it('accepts all valid video platforms', () => {
    for (const platform of ['youtube', 'vimeo', 'other'] as const) {
      expect(videoPlatformSchema.parse(platform)).toBe(platform);
    }
  });

  it('rejects invalid video platform', () => {
    expect(() => videoPlatformSchema.parse('dailymotion')).toThrow();
  });
});

describe('createDocsPageSchema', () => {
  it('accepts minimal valid page', () => {
    const result = createDocsPageSchema.safeParse({ title: 'Getting Started' });
    expect(result.success).toBe(true);
  });

  it('accepts page with sidebarLabel and description', () => {
    const result = createDocsPageSchema.safeParse({
      title: 'Getting Started with CommonPub',
      sidebarLabel: 'Getting Started',
      description: 'A brief intro to the platform.',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sidebarLabel).toBe('Getting Started');
      expect(result.data.description).toBe('A brief intro to the platform.');
    }
  });

  it('rejects sidebarLabel over 128 chars', () => {
    const result = createDocsPageSchema.safeParse({
      title: 'Page',
      sidebarLabel: 'x'.repeat(129),
    });
    expect(result.success).toBe(false);
  });

  it('rejects description over 2000 chars', () => {
    const result = createDocsPageSchema.safeParse({
      title: 'Page',
      description: 'x'.repeat(2001),
    });
    expect(result.success).toBe(false);
  });

  it('allows omitting sidebarLabel and description', () => {
    const result = createDocsPageSchema.safeParse({ title: 'Page' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sidebarLabel).toBeUndefined();
      expect(result.data.description).toBeUndefined();
    }
  });

  it('accepts page with versionId', () => {
    const result = createDocsPageSchema.safeParse({
      title: 'Page',
      versionId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.versionId).toBe('550e8400-e29b-41d4-a716-446655440000');
    }
  });

  it('rejects invalid versionId (not UUID)', () => {
    const result = createDocsPageSchema.safeParse({
      title: 'Page',
      versionId: 'not-a-uuid',
    });
    expect(result.success).toBe(false);
  });

  it('allows omitting versionId (API resolves default)', () => {
    const result = createDocsPageSchema.safeParse({ title: 'Page' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.versionId).toBeUndefined();
    }
  });
});

describe('updateDocsPageSchema', () => {
  it('allows partial updates with only sidebarLabel', () => {
    const result = updateDocsPageSchema.safeParse({ sidebarLabel: 'Nav label' });
    expect(result.success).toBe(true);
  });

  it('allows partial updates with only description', () => {
    const result = updateDocsPageSchema.safeParse({ description: 'Updated desc' });
    expect(result.success).toBe(true);
  });

  it('allows empty object for no-op update', () => {
    const result = updateDocsPageSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

describe('originPatternSchema (public-API CORS)', () => {
  const accepts = [
    '*',
    'localhost',
    'http://localhost:3000',
    'http://localhost:*',
    'https://app.example.com',
    'https://*.example.com',
    '*://localhost:*',
    'http://127.0.0.1:5173',
  ];
  for (const v of accepts) {
    it(`accepts ${JSON.stringify(v)}`, () => {
      expect(originPatternSchema.safeParse(v).success).toBe(true);
    });
  }

  const rejects = [
    '',
    '   ',
    'javascript:alert(1)',
    'data:text/html,x',
    'file:///etc/passwd',
    'ftp://example.com',
    'notaurl',
    'http://',
    '*foo',
    'foo*',
    'https://example.com/path', // origins have no path
    'a'.repeat(300),
  ];
  for (const v of rejects) {
    it(`rejects ${JSON.stringify(v.length > 30 ? v.slice(0, 30) + '…' : v)}`, () => {
      expect(originPatternSchema.safeParse(v).success).toBe(false);
    });
  }

  it('trims surrounding whitespace before validating', () => {
    const r = originPatternSchema.safeParse('  https://app.example.com  ');
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toBe('https://app.example.com');
  });
});

describe('createApiKeySchema.allowedOrigins', () => {
  const base = { name: 'k', scopes: ['read:content'] };

  it('accepts a wildcard / localhost / exact mix (the bug this fixes)', () => {
    const r = createApiKeySchema.safeParse({
      ...base,
      allowedOrigins: ['*', 'localhost', 'https://app.example.com', 'http://localhost:*'],
    });
    expect(r.success).toBe(true);
  });

  it('rejects a non-http(s) scheme smuggled into the list', () => {
    const r = createApiKeySchema.safeParse({
      ...base,
      allowedOrigins: ['https://ok.com', 'javascript:alert(1)'],
    });
    expect(r.success).toBe(false);
  });

  it('still allows null / omitted (server-to-server, the default)', () => {
    expect(createApiKeySchema.safeParse({ ...base, allowedOrigins: null }).success).toBe(true);
    expect(createApiKeySchema.safeParse({ ...base }).success).toBe(true);
  });

  it('caps the list at 50 origins', () => {
    const many = Array.from({ length: 51 }, (_, i) => `https://h${i}.example.com`);
    expect(createApiKeySchema.safeParse({ ...base, allowedOrigins: many }).success).toBe(false);
  });
});

// Regression: validators must not STRIP fields the UI sends and the server can
// store. A z.object() drops unknown keys silently, which is exactly how these
// fields were getting lost between the form and the database.
describe('validator field-drop regressions', () => {
  it('createVideoSchema keeps categoryId (was silently stripped → videos saved with NULL category)', () => {
    const id = '11111111-1111-4111-8111-111111111111';
    const parsed = createVideoSchema.parse({
      title: 'A video',
      url: 'https://youtube.com/watch?v=abc',
      categoryId: id,
    });
    expect(parsed.categoryId).toBe(id);
  });

  it('createVideoSchema rejects a non-uuid categoryId', () => {
    expect(() =>
      createVideoSchema.parse({ title: 'v', url: 'https://x.test/v', categoryId: 'not-a-uuid' }),
    ).toThrow();
  });

  it('videoFiltersSchema keeps the sort option (was stripped → every sort returned identical results)', () => {
    expect(videoFiltersSchema.parse({ sort: 'recent' }).sort).toBe('recent');
    expect(videoFiltersSchema.parse({ sort: 'viewed' }).sort).toBe('viewed');
    expect(videoFiltersSchema.parse({ sort: 'liked' }).sort).toBe('liked');
    expect(() => videoFiltersSchema.parse({ sort: 'bogus' })).toThrow();
  });

  it('createContentSchema keeps a custom slug (editor slug field was a no-op)', () => {
    const parsed = createContentSchema.parse({ type: 'blog', title: 'Hello', slug: 'my-custom-slug' });
    expect(parsed.slug).toBe('my-custom-slug');
  });

  it('updateContentSchema keeps a custom slug', () => {
    const parsed = updateContentSchema.parse({ slug: 'renamed-slug' });
    expect(parsed.slug).toBe('renamed-slug');
  });

  it('createContentSchema coerces scheduledAt to a Date', () => {
    const parsed = createContentSchema.parse({ type: 'blog', title: 'Hello', scheduledAt: '2099-01-02T03:04:00.000Z' });
    expect(parsed.scheduledAt).toBeInstanceOf(Date);
    expect(parsed.scheduledAt?.toISOString()).toBe('2099-01-02T03:04:00.000Z');
  });

  it('createContentSchema accepts a datetime-local string for scheduledAt', () => {
    // <input type="datetime-local"> emits "YYYY-MM-DDTHH:mm" (no seconds/zone).
    const parsed = createContentSchema.parse({ type: 'blog', title: 'Hello', scheduledAt: '2099-06-20T14:30' });
    expect(parsed.scheduledAt).toBeInstanceOf(Date);
  });

  it('contentStatusSchema includes scheduled', () => {
    expect(contentStatusSchema.parse('scheduled')).toBe('scheduled');
  });

  it('contentFiltersSchema accepts the likes sort (powers the "Most Liked" search option)', () => {
    // Was missing → the search route 400'd the moment a user picked "Most Liked".
    expect(contentFiltersSchema.parse({ sort: 'likes' }).sort).toBe('likes');
    expect(contentFiltersSchema.parse({ sort: 'popular' }).sort).toBe('popular');
    expect(() => contentFiltersSchema.parse({ sort: 'bogus' })).toThrow();
  });
});
