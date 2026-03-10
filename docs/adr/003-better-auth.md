# ADR-003: Better Auth for Authentication

## Status
Accepted

## Context
Need authentication that supports email/password, OAuth, magic links, passkeys, and can be extended with AP Actor SSO.

## Decision
Better Auth as a library (not a service), wrapped in `@snaplify/auth`.

## Rationale
- Better Auth is a library, not a separate service — simplifies self-hosting
- Supports all needed auth methods out of the box
- Organization plugin available for multi-tenant scenarios
- Extensible enough for AP Actor SSO (Model B) and shared auth DB (Model C)
- deveco-io proved the Better Auth + Drizzle pattern works

## Consequences
- Auth tables co-located in @snaplify/schema
- @snaplify/auth wraps Better Auth with `createAuth()` factory
- Social providers degrade gracefully when credentials not configured
- AP SSO implemented as custom Better Auth provider
