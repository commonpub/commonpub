# @commonpub/config

> Configuration factory and validation for CommonPub instances.

**npm**: `@commonpub/config`
**Source**: `packages/config/src/`
**Entry**: `packages/config/src/index.ts`

---

## Exports

| Export | Kind | Description |
|--------|------|-------------|
| `defineCommonPubConfig` | Function | Main factory — validates and returns config with defaults |
| `configSchema` | Zod Schema | Top-level config validator |
| `featureFlagsSchema` | Zod Schema | Feature flags validator with defaults |
| `authConfigSchema` | Zod Schema | Auth configuration validator |
| `instanceConfigSchema` | Zod Schema | Instance metadata validator |
| `CommonPubConfig` | Type | Full config shape |
| `FeatureFlags` | Type | 10 boolean feature flags |
| `AuthConfig` | Type | Authentication providers and SSO |
| `InstanceConfig` | Type | Domain, name, limits |

---

## API Reference

### `defineCommonPubConfig(input): ConfigResult`

Define and validate a CommonPub instance configuration. Returns the validated config with defaults applied and any warnings.

**Throws**: `ZodError` if the config is invalid.

**Parameters**:

```typescript
input: {
  instance: {
    domain: string;           // Required. Public domain (e.g., "hack.build")
    name: string;             // Required. Human-readable name (1–128 chars)
    description: string;      // Required. Short description (1–500 chars)
    contactEmail?: string;    // Optional. Must be valid email
    maxUploadSize?: number;   // Optional. Bytes, default: 10MB (10_485_760)
    contentTypes?: Array<'project' | 'article' | 'guide' | 'blog' | 'explainer'>;
                              // Optional. Default: ['project', 'article', 'guide', 'blog']
  };
  features?: Partial<FeatureFlags>;  // Optional. All flags have defaults
  auth?: Partial<AuthConfig>;        // Optional. All fields have defaults
}
```

**Returns**:

```typescript
interface ConfigResult {
  config: CommonPubConfig;      // Fully resolved config with all defaults
  warnings: ConfigWarning[];   // Non-fatal warnings about the configuration
}

interface ConfigWarning {
  field: string;    // Dot-path to the field (e.g., "auth.sharedAuthDb")
  message: string;  // Human-readable warning
}
```

**Warnings emitted**:

| Condition | Field | Message |
|-----------|-------|---------|
| `auth.sharedAuthDb` is set | `auth.sharedAuthDb` | Shared auth DB (Model C) couples instances at the database level |
| `features.federation` enabled but `auth.trustedInstances` empty | `features.federation` | AP Actor SSO (Model B) requires at least one trusted instance |
| `features.learning` enabled but `features.explainers` disabled | `features.explainers` | Explainers are a first-class lesson type in learning paths |

**Example**:

```typescript
import { defineCommonPubConfig } from '@commonpub/config';

const { config, warnings } = defineCommonPubConfig({
  instance: {
    domain: 'hack.build',
    name: 'hack.build',
    description: 'A community for makers and hackers',
    contactEmail: 'admin@hack.build',
    maxUploadSize: 20 * 1024 * 1024, // 20MB
    contentTypes: ['project', 'article', 'guide', 'blog'],
  },
  features: {
    content: true,
    social: true,
    communities: true,
    docs: true,
    video: true,
    contests: false,
    learning: true,
    explainers: true,
    federation: true,
    admin: true,
  },
  auth: {
    emailPassword: true,
    magicLink: false,
    passkeys: false,
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
    trustedInstances: ['deveco.io'],
  },
});

if (warnings.length > 0) {
  console.warn('Config warnings:', warnings);
}
```

---

## Types

### `CommonPubConfig`

```typescript
interface CommonPubConfig {
  instance: InstanceConfig;
  features: FeatureFlags;
  auth: AuthConfig;
}
```

### `InstanceConfig`

```typescript
interface InstanceConfig {
  domain: string;              // Public domain of this instance
  name: string;                // Human-readable instance name
  description: string;         // Short description for NodeInfo and meta tags
  contactEmail?: string;       // Contact email for the instance operator
  maxUploadSize?: number;      // Maximum upload size in bytes (default: 10MB)
  contentTypes?: Array<'project' | 'article' | 'guide' | 'blog' | 'explainer'>;
}
```

### `FeatureFlags`

All flags are boolean. Default values shown.

| Flag | Default | Description |
|------|---------|-------------|
| `content` | `true` | Content system (CRUD, publishing, slugs) |
| `social` | `true` | Social features (likes, comments, bookmarks) |
| `communities` | `true` | Community system (feeds, membership, moderation) |
| `docs` | `true` | Docs module (CodeMirror editor, versioning, search) |
| `video` | `true` | Video content type |
| `contests` | `false` | Contest system |
| `learning` | `true` | Learning paths (enrollment, progress, certificates) |
| `explainers` | `true` | Explainer system (interactive modules) |
| `federation` | `false` | ActivityPub federation |
| `admin` | `false` | Admin panel (user management, reports, settings) |

### `AuthConfig`

```typescript
interface AuthConfig {
  emailPassword: boolean;      // Default: true
  magicLink: boolean;          // Default: false
  passkeys: boolean;           // Default: false
  github?: {                   // Omit to disable GitHub OAuth
    clientId: string;
    clientSecret: string;
  };
  google?: {                   // Omit to disable Google OAuth
    clientId: string;
    clientSecret: string;
  };
  sharedAuthDb?: string;       // URL for shared auth DB (Model C). WARNING: couples instances
  trustedInstances?: string[]; // Domains for AP Actor SSO (Model B)
}
```

---

## Zod Schemas

### `configSchema`

Top-level schema. Wraps `instanceConfigSchema`, `featureFlagsSchema`, and `authConfigSchema`.

```typescript
const configSchema = z.object({
  instance: instanceConfigSchema,
  features: featureFlagsSchema.default({}),
  auth: authConfigSchema.default({}),
});
```

### `instanceConfigSchema`

```typescript
const instanceConfigSchema = z.object({
  domain: z.string().min(1),
  name: z.string().min(1).max(128),
  description: z.string().min(1).max(500),
  contactEmail: z.string().email().optional(),
  maxUploadSize: z.number().int().positive().default(10 * 1024 * 1024),
  contentTypes: z.array(
    z.enum(['project', 'article', 'guide', 'blog', 'explainer'])
  ).default(['project', 'article', 'guide', 'blog']),
});
```

### `featureFlagsSchema`

```typescript
const featureFlagsSchema = z.object({
  content: z.boolean().default(true),
  social: z.boolean().default(true),
  communities: z.boolean().default(true),
  docs: z.boolean().default(true),
  video: z.boolean().default(true),
  contests: z.boolean().default(false),
  learning: z.boolean().default(true),
  explainers: z.boolean().default(true),
  federation: z.boolean().default(false),
  admin: z.boolean().default(false),
});
```

### `authConfigSchema`

```typescript
const authConfigSchema = z.object({
  emailPassword: z.boolean().default(true),
  magicLink: z.boolean().default(false),
  passkeys: z.boolean().default(false),
  github: z.object({
    clientId: z.string().min(1),
    clientSecret: z.string().min(1),
  }).optional(),
  google: z.object({
    clientId: z.string().min(1),
    clientSecret: z.string().min(1),
  }).optional(),
  sharedAuthDb: z.string().url().optional(),
  trustedInstances: z.array(z.string().min(1)).optional(),
});
```

---

## Internal Architecture

```
packages/config/src/
├── index.ts    → Re-exports: defineCommonPubConfig, types, schemas
├── config.ts   → defineCommonPubConfig() implementation + ConfigWarning/ConfigResult
├── types.ts    → FeatureFlags, AuthConfig, InstanceConfig, CommonPubConfig interfaces
└── schema.ts   → Zod schemas: configSchema, featureFlagsSchema, authConfigSchema, instanceConfigSchema
```

The config package has zero runtime dependencies beyond Zod. It is imported by nearly every other package to access feature flags and instance configuration.
