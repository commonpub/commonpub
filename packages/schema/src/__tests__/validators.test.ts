import { describe, it, expect } from 'vitest';
import {
  usernameSchema,
  emailSchema,
  slugSchema,
  createUserSchema,
  updateProfileSchema,
  createContentSchema,
  createCommentSchema,
  createCommunitySchema,
  createPostSchema,
  createLearningPathSchema,
  createLessonSchema,
  createReportSchema,
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
    for (const type of ['project', 'article', 'guide', 'blog', 'explainer']) {
      const result = createContentSchema.safeParse({
        type,
        title: 'Test',
        slug: 'test',
      });
      expect(result.success).toBe(true);
    }
  });

  it('should reject invalid content type', () => {
    const result = createContentSchema.safeParse({
      type: 'invalid',
      title: 'Test',
      slug: 'test',
    });
    expect(result.success).toBe(false);
  });

  it('should reject tags over 20', () => {
    const result = createContentSchema.safeParse({
      type: 'project',
      title: 'Test',
      slug: 'test',
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

describe('createCommunitySchema', () => {
  it('should accept valid community', () => {
    const result = createCommunitySchema.safeParse({
      name: 'Robotics Club',
      slug: 'robotics-club',
    });
    expect(result.success).toBe(true);
  });

  it('should default join policy to open', () => {
    const result = createCommunitySchema.parse({
      name: 'Test',
      slug: 'test',
    });
    expect(result.joinPolicy).toBe('open');
  });
});

describe('createPostSchema', () => {
  it('should accept valid post', () => {
    const result = createPostSchema.safeParse({
      communityId: '550e8400-e29b-41d4-a716-446655440000',
      content: 'Hello community!',
    });
    expect(result.success).toBe(true);
  });

  it('should default type to text', () => {
    const result = createPostSchema.parse({
      communityId: '550e8400-e29b-41d4-a716-446655440000',
      content: 'Hello',
    });
    expect(result.type).toBe('text');
  });
});

describe('createLearningPathSchema', () => {
  it('should accept valid learning path', () => {
    const result = createLearningPathSchema.safeParse({
      title: 'Intro to Robotics',
      slug: 'intro-to-robotics',
      estimatedHours: 20,
    });
    expect(result.success).toBe(true);
  });

  it('should reject negative hours', () => {
    const result = createLearningPathSchema.safeParse({
      title: 'Test',
      slug: 'test',
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
        slug: 'test-lesson',
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
