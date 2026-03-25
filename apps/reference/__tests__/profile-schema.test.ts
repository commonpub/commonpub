import { describe, it, expect } from 'vitest';
import { z } from 'zod';

const baseProfileSchema = z.object({
  displayName: z.string().max(128).optional(),
  bio: z.string().max(2000).optional(),
  headline: z.string().max(255).optional(),
  location: z.string().max(128).optional(),
  website: z.string().url().optional().or(z.literal('')),
});

const extendedProfileSchema = baseProfileSchema.extend({
  avatarUrl: z.string().url().optional().or(z.literal('')),
  bannerUrl: z.string().url().optional().or(z.literal('')),
});

describe('profile update schema', () => {
  it('accepts valid avatar URL', () => {
    const result = extendedProfileSchema.safeParse({
      avatarUrl: 'https://cdn.example.com/avatar/test.jpg',
    });
    expect(result.success).toBe(true);
  });

  it('accepts empty string for avatar (clears it)', () => {
    const result = extendedProfileSchema.safeParse({ avatarUrl: '' });
    expect(result.success).toBe(true);
  });

  it('accepts undefined for avatar (no change)', () => {
    const result = extendedProfileSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('rejects non-URL string for avatar', () => {
    const result = extendedProfileSchema.safeParse({ avatarUrl: 'not-a-url' });
    expect(result.success).toBe(false);
  });

  it('accepts valid banner URL', () => {
    const result = extendedProfileSchema.safeParse({
      bannerUrl: 'https://cdn.example.com/banner/test.jpg',
    });
    expect(result.success).toBe(true);
  });

  it('accepts valid website URL', () => {
    const result = extendedProfileSchema.safeParse({
      website: 'https://example.com',
    });
    expect(result.success).toBe(true);
  });

  it('accepts all fields together', () => {
    const result = extendedProfileSchema.safeParse({
      displayName: 'Test User',
      bio: 'Hello world',
      headline: 'Developer',
      location: 'NYC',
      website: 'https://example.com',
      avatarUrl: 'https://example.com/avatar.png',
      bannerUrl: 'https://example.com/banner.png',
    });
    expect(result.success).toBe(true);
  });

  it('rejects overly long displayName', () => {
    const result = extendedProfileSchema.safeParse({
      displayName: 'a'.repeat(200),
    });
    expect(result.success).toBe(false);
  });
});

describe('empty string to undefined conversion', () => {
  it('converts empty string URLs to undefined', () => {
    const raw = { avatarUrl: '', bannerUrl: '', website: '' };
    const input = {
      ...raw,
      avatarUrl: raw.avatarUrl || undefined,
      bannerUrl: raw.bannerUrl || undefined,
      website: raw.website || undefined,
    };
    expect(input.avatarUrl).toBeUndefined();
    expect(input.bannerUrl).toBeUndefined();
    expect(input.website).toBeUndefined();
  });

  it('preserves valid URLs', () => {
    const raw = { avatarUrl: 'https://example.com/a.png', bannerUrl: '', website: 'https://example.com' };
    const input = {
      ...raw,
      avatarUrl: raw.avatarUrl || undefined,
      bannerUrl: raw.bannerUrl || undefined,
      website: raw.website || undefined,
    };
    expect(input.avatarUrl).toBe('https://example.com/a.png');
    expect(input.bannerUrl).toBeUndefined();
    expect(input.website).toBe('https://example.com');
  });
});
