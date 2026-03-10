# ADR 009: Better Auth → Custom Drizzle Schema Mapping

## Status

Accepted

## Context

Better Auth expects specific table and column names (e.g., `user.name`, `user.image`). Our schema uses different conventions (`users.display_name`, `users.avatar_url`) established in Phase 1.

## Decision

Use Better Auth's Drizzle adapter with explicit schema mapping:

```ts
drizzleAdapter(db, {
  provider: 'pg',
  schema: {
    user: schema.users,
    session: schema.sessions,
    account: schema.accounts,
    verification: schema.verifications,
  },
})
```

Field mapping via `user.fields`:

```ts
user: {
  fields: {
    name: 'display_name',
    image: 'avatar_url',
  },
}
```

A `verifications` table was added to `@snaplify/schema` auth tables to support Better Auth's email verification and magic link tokens.

## Consequences

- Our schema conventions are preserved — no renaming tables/columns for library compatibility
- Better Auth's internal queries use our actual column names via the mapping layer
- The `verifications` table is the only schema addition required by Better Auth
- Database-generated UUIDs via `defaultRandom()` are used (no Better Auth ID generation)
