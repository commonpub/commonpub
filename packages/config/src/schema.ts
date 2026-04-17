import { z } from 'zod';

export const featureFlagsSchema = z.object({
  content: z.boolean().default(true),
  social: z.boolean().default(true),
  hubs: z.boolean().default(true),
  docs: z.boolean().default(true),
  video: z.boolean().default(true),
  contests: z.boolean().default(false),
  events: z.boolean().default(false),
  learning: z.boolean().default(true),
  explainers: z.boolean().default(true),
  federation: z.boolean().default(false),
  seamlessFederation: z.boolean().default(false),
  federateHubs: z.boolean().default(false),
  editorial: z.boolean().default(true),
  admin: z.boolean().default(false),
  emailNotifications: z.boolean().default(false),
  publicApi: z.boolean().default(false),
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
  maxUploadSize: z
    .number()
    .int()
    .positive()
    .default(10 * 1024 * 1024),
  contentTypes: z
    .array(z.enum(['project', 'article', 'blog', 'explainer']))
    .default(['project', 'blog', 'explainer']),
  contestCreation: z.enum(['open', 'staff', 'admin']).default('admin'),
});

export const federationConfigSchema = z.object({
  activityRetentionDays: z.number().int().positive().default(90),
  deliveryBatchSize: z.number().int().positive().max(100).default(20),
  deliveryIntervalMs: z.number().int().positive().default(30_000),
  maxDeliveryRetries: z.number().int().positive().max(20).default(6),
  instanceFollowPolicy: z.enum(['auto-accept', 'manual']).default('auto-accept'),
  backfillOnMirrorAccept: z.boolean().default(false),
  mirrorMaxItems: z.number().int().positive().optional(),
  hubSyncIntervalMs: z.number().int().positive().default(3_600_000),
});

export const docsConfigSchema = z.object({
  searchLanguage: z.string().default('english'),
});

export const cookieDefinitionSchema = z.object({
  name: z.string().min(1),
  category: z.enum(['essential', 'functional', 'analytics']),
  description: z.string().min(1),
  duration: z.string().min(1),
  provider: z.string().optional(),
});

export const configSchema = z.object({
  instance: instanceConfigSchema,
  features: featureFlagsSchema.default(() => featureFlagsSchema.parse({})),
  auth: authConfigSchema.default(() => authConfigSchema.parse({})),
  federation: federationConfigSchema.optional(),
  docs: docsConfigSchema.default(() => docsConfigSchema.parse({})),
  cookies: z.array(cookieDefinitionSchema).optional(),
});
