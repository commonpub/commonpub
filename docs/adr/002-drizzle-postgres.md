# ADR-002: PostgreSQL 16 + Drizzle ORM

## Status

Accepted

## Context

Need a database and ORM for the schema package. Previous implementations used Convex (hack-build, not self-hostable) and Drizzle + PostgreSQL (deveco-io).

## Decision

PostgreSQL 16 with Drizzle ORM. Schema defined in `@commonpub/schema` as the single source of truth.

## Rationale

- PostgreSQL is the industry standard for self-hosted applications
- Drizzle provides type-safe queries with minimal overhead
- Drizzle's schema-as-code approach aligns with "the schema is the work"
- deveco-io already proved the Drizzle + Postgres pattern works
- PostgreSQL FTS provides search fallback when Meilisearch unavailable
- Fedify has @fedify/postgres adapter for AP key/state storage

## Consequences

- All tables defined as Drizzle pgTable in @commonpub/schema
- Zod validators generated alongside schema for runtime validation
- Migrations managed by Drizzle Kit
- Self-hosters must run PostgreSQL (acceptable — it's the standard)
