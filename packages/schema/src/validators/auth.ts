import { z } from 'zod';
import { optionalUrl } from './_shared.js';

// --- Auth validators ---

export const usernameSchema = z
  .string()
  .min(3)
  .max(64)
  .regex(
    /^[a-zA-Z0-9_-]+$/,
    'Username can only contain letters, numbers, hyphens, and underscores',
  );

export const emailSchema = z.string().email().max(255);

export const displayNameSchema = z.string().min(1).max(128);

export const bioSchema = z.string().max(2000).optional();

export const socialLinksSchema = z
  .object({
    github: optionalUrl(),
    twitter: optionalUrl(),
    linkedin: optionalUrl(),
    youtube: optionalUrl(),
    instagram: optionalUrl(),
    mastodon: optionalUrl(),
    discord: optionalUrl(),
  })
  .optional();

export const createUserSchema = z.object({
  email: emailSchema,
  username: usernameSchema,
  displayName: displayNameSchema.optional(),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateProfileSchema = z.object({
  displayName: displayNameSchema.optional(),
  bio: bioSchema,
  headline: z.preprocess((v) => typeof v === 'string' && v.trim() === '' ? undefined : v, z.string().trim().max(255).optional()),
  location: z.preprocess((v) => typeof v === 'string' && v.trim() === '' ? undefined : v, z.string().trim().max(128).optional()),
  website: optionalUrl(512),
  avatarUrl: optionalUrl(2048),
  bannerUrl: optionalUrl(2048),
  socialLinks: socialLinksSchema,
  skills: z.array(z.string().trim().min(1).max(64)).max(50).optional(),
  experience: z.array(z.object({
    title: z.string().trim().min(1).max(128),
    company: z.string().trim().max(128),
    startDate: z.string().max(32),
    endDate: z.string().max(32),
    description: z.string().trim().max(2000),
  })).max(20).optional(),
  pronouns: z.preprocess((v) => typeof v === 'string' && v.trim() === '' ? undefined : v, z.string().trim().max(32).optional()),
  timezone: z.string().max(64).optional(),
  emailNotifications: z
    .object({
      digest: z.enum(['daily', 'weekly', 'none']).optional(),
      likes: z.boolean().optional(),
      comments: z.boolean().optional(),
      follows: z.boolean().optional(),
      mentions: z.boolean().optional(),
      unsubscribedAll: z.boolean().optional(),
    })
    .optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
