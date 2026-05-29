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
    contentTypes: ['project', 'blog', 'explainer'],
  },
  features: {
    content: true,
    social: true,
    hubs: true,
    docs: true,
    video: true,
    contests: false,
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

All features are gated behind flags (CLAUDE.md rule #2). No feature code runs unless its flag is `true`. New flags MUST also be declared in `runtimeConfig.public.features` in `apps/reference/nuxt.config.ts` — env-var overrides only propagate to declared keys (`feedback-nuxt-env-only-declared-keys`).

| Flag                  | Default | Controls                                                                  |
| --------------------- | ------- | ------------------------------------------------------------------------- |
| `content`             | `true`  | Content CRUD, publishing, slugs                                           |
| `social`              | `true`  | Likes, comments, follows, bookmarks                                       |
| `hubs`                | `true`  | Hub system (community / product / company types)                          |
| `docs`                | `true`  | Documentation module (CodeMirror, versioning, search)                     |
| `video`               | `true`  | Video content type                                                        |
| `contests`            | `false` | Contest / competition system + judging workflow                           |
| `events`              | `false` | Events (listing, RSVP, calendar)                                          |
| `learning`            | `true`  | Learning paths, enrollment, progress, certificates                        |
| `explainers`          | `true`  | Interactive explainer modules                                             |
| `federation`          | `false` | ActivityPub federation (push + pull). Requires `CPUB_FED_TOKEN_KEY` env   |
| `seamlessFederation`  | `false` | Display mirrored content alongside local content in browse / search / feed |
| `federateHubs`        | `false` | Hub federation via AP Group actors                                        |
| `editorial`           | `false` | Editorial curation (staff picks, content categories, homepage editorial)  |
| `admin`               | `false` | Admin panel (user mgmt, reports, settings, theme editor, layouts)         |
| `emailNotifications`  | `false` | Email delivery for notifications (instant + digest)                       |
| `publicApi`           | `false` | Admin-provisioned public Read API at `/api/public/v1/*` (no keys created by flag flip; provision via `/admin/api-keys`) |
| `contentImport`       | `true`  | URL content import — operator off-switch for the remote-fetch surface     |
| `layoutEngine`        | `false` | Layout engine — `<LayoutSlot>` reads from `layouts`/`layout_rows`/`layout_sections` (migration 0005). Flip OFF if migration not applied — empty pages otherwise. Editor lives at `/admin/layouts` |

### `identity` sub-flags

Identity features ship behind a nested object so the rollout can ratchet phase-by-phase. `CPUB_FED_TOKEN_KEY` env var MUST be set before flipping any phase to `true` (otherwise the runtime guards on each surface refuse to deploy).

| Sub-flag           | Phase | Controls                                                              |
| ------------------ | ----- | --------------------------------------------------------------------- |
| `linkRemoteAccounts` | 1   | Users can link a remote Mastodon-API account (read-only)              |
| `signInWithRemote`   | 2   | New users can sign up by signing in via a remote instance             |
| `actingAs`           | 3   | "Acting as" identity-context switcher + banner                        |
| `remoteInteract`     | 4a  | Like / comment / follow via a linked identity (low blast radius)      |
| `remotePublish`      | 4b  | Publish via a linked identity (highest blast radius — last to flip)   |

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
pnpm test         # Run 23 tests
pnpm typecheck    # Type-check without emitting
```

## Dependencies

- `zod`: Schema validation
