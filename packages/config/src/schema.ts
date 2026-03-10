import { z } from 'zod';

export const featureFlagsSchema = z.object({
  content: z.boolean().default(true),
  social: z.boolean().default(true),
  communities: z.boolean().default(true),
  docs: z.boolean().default(true),
  video: z.boolean().default(true),
  contests: z.boolean().default(false),
  learning: z.boolean().default(true),
  explainers: z.boolean().default(true),
  federation: z.boolean().default(false),
});

export const authConfigSchema = z.object({
  emailPassword: z.boolean().default(true),
  magicLink: z.boolean().default(false),
  passkeys: z.boolean().default(false),
  github: z
    .object({
      clientId: z.string().min(1),
      clientSecret: z.string().min(1),
    })
    .optional(),
  google: z
    .object({
      clientId: z.string().min(1),
      clientSecret: z.string().min(1),
    })
    .optional(),
  sharedAuthDb: z.string().url().optional(),
  trustedInstances: z.array(z.string().min(1)).optional(),
});

export const instanceConfigSchema = z.object({
  domain: z.string().min(1),
  name: z.string().min(1).max(128),
  description: z.string().min(1).max(500),
  contactEmail: z.string().email().optional(),
  maxUploadSize: z.number().int().positive().default(10 * 1024 * 1024),
  contentTypes: z
    .array(z.enum(['project', 'article', 'guide', 'blog']))
    .default(['project', 'article', 'guide', 'blog']),
});

export const configSchema = z.object({
  instance: instanceConfigSchema,
  features: featureFlagsSchema.default({}),
  auth: authConfigSchema.default({}),
});
