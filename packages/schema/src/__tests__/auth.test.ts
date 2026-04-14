import { describe, it, expect } from 'vitest';
import {
  usernameSchema,
  emailSchema,
  createUserSchema,
  updateProfileSchema,
  socialLinksSchema,
} from '../validators';

describe('usernameSchema', () => {
  it('accepts valid usernames', () => {
    expect(usernameSchema.safeParse('alice').success).toBe(true);
    expect(usernameSchema.safeParse('bob-123').success).toBe(true);
    expect(usernameSchema.safeParse('user_name').success).toBe(true);
    expect(usernameSchema.safeParse('A-Z_09').success).toBe(true);
  });

  it('rejects usernames shorter than 3 characters', () => {
    expect(usernameSchema.safeParse('ab').success).toBe(false);
    expect(usernameSchema.safeParse('').success).toBe(false);
  });

  it('rejects usernames longer than 64 characters', () => {
    expect(usernameSchema.safeParse('a'.repeat(65)).success).toBe(false);
  });

  it('rejects usernames with special characters', () => {
    expect(usernameSchema.safeParse('user@name').success).toBe(false);
    expect(usernameSchema.safeParse('user name').success).toBe(false);
    expect(usernameSchema.safeParse('user.name').success).toBe(false);
    expect(usernameSchema.safeParse('user!name').success).toBe(false);
  });

  it('accepts boundary length usernames', () => {
    expect(usernameSchema.safeParse('abc').success).toBe(true); // min=3
    expect(usernameSchema.safeParse('a'.repeat(64)).success).toBe(true); // max=64
  });
});

describe('emailSchema', () => {
  it('accepts valid emails', () => {
    expect(emailSchema.safeParse('test@example.com').success).toBe(true);
    expect(emailSchema.safeParse('user+tag@domain.co.uk').success).toBe(true);
  });

  it('rejects invalid emails', () => {
    expect(emailSchema.safeParse('not-an-email').success).toBe(false);
    expect(emailSchema.safeParse('@missing-local.com').success).toBe(false);
    expect(emailSchema.safeParse('').success).toBe(false);
  });

  it('rejects emails longer than 255 characters', () => {
    expect(emailSchema.safeParse('a'.repeat(250) + '@x.com').success).toBe(false);
  });
});

describe('createUserSchema', () => {
  it('accepts valid user creation input', () => {
    const result = createUserSchema.safeParse({
      email: 'alice@example.com',
      username: 'alice',
      displayName: 'Alice',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe('alice@example.com');
      expect(result.data.username).toBe('alice');
      expect(result.data.displayName).toBe('Alice');
    }
  });

  it('allows omitting displayName', () => {
    const result = createUserSchema.safeParse({
      email: 'bob@example.com',
      username: 'bob',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.displayName).toBeUndefined();
    }
  });

  it('rejects missing required fields', () => {
    expect(createUserSchema.safeParse({}).success).toBe(false);
    expect(createUserSchema.safeParse({ email: 'a@b.com' }).success).toBe(false);
    expect(createUserSchema.safeParse({ username: 'alice' }).success).toBe(false);
  });

  it('validates email and username rules together', () => {
    expect(createUserSchema.safeParse({
      email: 'not-email',
      username: 'a',
    }).success).toBe(false);
  });
});

describe('updateProfileSchema', () => {
  it('accepts partial profile updates', () => {
    const result = updateProfileSchema.safeParse({
      bio: 'I build things.',
    });
    expect(result.success).toBe(true);
  });

  it('rejects bio over 2000 characters', () => {
    expect(updateProfileSchema.safeParse({
      bio: 'x'.repeat(2001),
    }).success).toBe(false);
  });

  it('coerces empty string website to undefined', () => {
    const result = updateProfileSchema.safeParse({
      website: '',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.website).toBeUndefined();
    }
  });

  it('accepts valid website URL', () => {
    const result = updateProfileSchema.safeParse({
      website: 'https://example.com',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid website URL', () => {
    expect(updateProfileSchema.safeParse({
      website: 'not-a-url',
    }).success).toBe(false);
  });
});

describe('socialLinksSchema', () => {
  it('accepts valid social links', () => {
    const result = socialLinksSchema.safeParse({
      github: 'https://github.com/alice',
      twitter: 'https://twitter.com/alice',
    });
    expect(result.success).toBe(true);
  });

  it('accepts empty social links object', () => {
    expect(socialLinksSchema.safeParse({}).success).toBe(true);
  });

  it('coerces empty string links to undefined', () => {
    const result = socialLinksSchema.safeParse({ github: '' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data!.github).toBeUndefined();
    }
  });

  it('rejects invalid URLs in social links', () => {
    expect(socialLinksSchema.safeParse({
      github: 'not-a-url',
    }).success).toBe(false);
  });
});
