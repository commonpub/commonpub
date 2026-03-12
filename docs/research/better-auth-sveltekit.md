# Better Auth + SvelteKit Integration Research

## Official SvelteKit Integration

Better Auth provides `svelteKitHandler` from `better-auth/svelte-kit` for request handling in hooks.

```ts
import { svelteKitHandler } from 'better-auth/svelte-kit';
```

The handler intercepts `/api/auth/*` routes in the SvelteKit `handle` hook.

## Drizzle Adapter

Better Auth supports Drizzle ORM via `drizzleAdapter`:

```ts
import { drizzleAdapter } from 'better-auth/adapters/drizzle';

drizzleAdapter(db, {
  provider: 'pg',
  schema: {
    user: schema.users,
    session: schema.sessions,
    account: schema.accounts,
    verification: schema.verifications,
  },
});
```

## Field Mapping

Better Auth expects specific field names on the `user` model:

- `name` → maps to our `display_name` column
- `image` → maps to our `avatar_url` column

Field mapping is configured in the `user.fields` option:

```ts
user: {
  fields: {
    name: 'display_name',
    image: 'avatar_url',
  },
}
```

## Missing Table: `verifications`

Better Auth requires a `verification` table for:

- Email verification tokens
- Magic link tokens
- Password reset tokens

Schema: `id` (uuid PK), `identifier` (varchar 255), `value` (text), `expiresAt`, `createdAt`, `updatedAt`

This must be added to `@commonpub/schema` auth tables.

## Username Plugin

Better Auth has a `username` plugin for username-based auth alongside email:

```ts
import { username } from 'better-auth/plugins';
```

Our schema already has a `username` column on users, so we always enable this plugin.

## UUID Generation

Use `advanced: { generateId: false }` to let the database generate UUIDs via `defaultRandom()` rather than having Better Auth generate IDs. This matches our schema pattern and the deveco-io reference implementation.

## Session Configuration

- Default expiry: 7 days (`expiresIn: 60 * 60 * 24 * 7`)
- Refresh window: 1 day (`updateAge: 60 * 60 * 24`)

## Plugins Used

1. `username` — Always (our schema has username)
2. `magicLink` — Conditional on `config.auth.magicLink`
3. `oauthProvider` — Conditional on `config.features.federation` (serves as OAuth provider for AP SSO)
4. `genericOAuth` — Conditional on federation + trustedInstances (consumes SSO from other instances)
