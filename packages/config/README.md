# @commonpub/config

Configuration factory and validation for CommonPub instances.

## Overview

Every CommonPub instance has a `commonpub.config.ts` file that defines its identity, feature flags, and auth settings. `defineCommonPubConfig()` validates configuration at startup, applies defaults, and surfaces warnings about risky combinations.

## Installation

```bash
pnpm add @commonpub/config
```

## Usage

```ts
// commonpub.config.ts
import { defineCommonPubConfig } from '@commonpub/config';

const { config, warnings } = defineCommonPubConfig({
  instance: {
    domain: 'hack.build',
    name: 'hack.build',
    description: 'A maker community for hardware hackers',
    contactEmail: 'admin@hack.build',
    maxUploadSize: 10 * 1024 * 1024, // 10MB
    contentTypes: ['project', 'article', 'guide', 'blog'],
  },
  features: {
    content: true,
    social: true,
    communities: true,
    docs: true,
    learning: true,
    explainers: true,
    federation: false,
    admin: false,
  },
  auth: {
    emailPassword: true,
    magicLink: false,
    passkeys: false,
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
  },
});
```

## Feature Flags

All features are gated behind flags. No feature code runs unless its flag is `true`.

| Flag           | Default | Controls                                       |
| -------------- | ------- | ---------------------------------------------- |
| `content`      | `true`  | Content CRUD, publishing, slugs                |
| `social`       | `true`  | Likes, comments, follows, bookmarks            |
| `communities`  | `true`  | Community spaces, membership, moderation       |
| `docs`         | `true`  | Documentation module (CodeMirror, versioning)  |
| `video`        | `false` | Video content type                             |
| `contests`     | `false` | Contest/competition system                     |
| `learning`     | `true`  | Learning paths, enrollment, certificates       |
| `explainers`   | `true`  | Interactive explainer modules                  |
| `federation`   | `false` | ActivityPub federation                         |
| `admin`        | `false` | Admin panel (user mgmt, reports, settings)     |

## Auth Configuration

| Option            | Type      | Description                                    |
| ----------------- | --------- | ---------------------------------------------- |
| `emailPassword`   | `boolean` | Email/password sign-up and sign-in             |
| `magicLink`       | `boolean` | Passwordless magic link auth                   |
| `passkeys`        | `boolean` | WebAuthn/passkey support                       |
| `github`          | `object?` | GitHub OAuth `{ clientId, clientSecret }`      |
| `google`          | `object?` | Google OAuth `{ clientId, clientSecret }`      |
| `sharedAuthDb`    | `string?` | Shared auth DB connection string (Model C)     |
| `trustedInstances`| `string[]?`| Trusted instance domains for AP Actor SSO     |

## Warnings

`defineCommonPubConfig()` returns warnings for risky configurations:

- **Shared auth DB**: warns about database-level coupling between instances
- **Federation without trusted instances**: AP Actor SSO requires at least one
- **Learning without explainers**: explainers are a first-class lesson type

## Exports

```ts
// Factory
export { defineCommonPubConfig } from './config';

// Types
export type { CommonPubConfig, FeatureFlags, AuthConfig, InstanceConfig } from './types';

// Zod schemas (for custom validation)
export { configSchema, featureFlagsSchema, authConfigSchema, instanceConfigSchema } from './schema';
```

## Development

```bash
pnpm build        # Compile TypeScript
pnpm test         # Run 17 tests
pnpm typecheck    # Type-check without emitting
```

## Dependencies

- `zod`: Schema validation
