# Session 002: Auth + Protocol (Phase 2)

## What Was Done

### Schema

- Added `verifications` table to `@commonpub/schema` (required by Better Auth for email verification/magic link tokens)
- Added auth schema tests (10 tests covering all table exports and relations)

### @commonpub/test-utils

- Created `factories.ts` with `createTestUser()`, `createTestSession()`, `createTestFederatedAccount()`, `createTestOAuthClient()`, `resetFactoryCounter()`
- Created `mockConfig.ts` with `createTestConfig(overrides?)` for generating valid CommonPubConfig in tests
- 14 tests passing

### @commonpub/auth

- `createAuth()` — Better Auth factory with Drizzle adapter, schema mapping, social providers, username plugin
- `createAuthHook()` — SvelteKit handle hook that delegates auth routes and resolves sessions
- `authGuard()`, `adminGuard()`, `roleGuard(minRole)` — Route protection with role hierarchy (member < pro < verified < staff < admin)
- `createSSOProviderConfig()` — Generates OAuth2 endpoint config for federation
- `discoverOAuthEndpoint()` — WebFinger-based OAuth endpoint discovery
- `isTrustedInstance()` — Checks if a domain is in the trusted instances list
- Integration test: Full Model B SSO flow (WebFinger → authorize → token → federated account)
- 42 tests passing

### @commonpub/protocol (protocol)

- AP type interfaces: `CommonPubActor`, `WebFingerResponse`, `NodeInfoResponse`, `ParsedResource`
- `parseWebFingerResource()` / `buildWebFingerResponse()` — WebFinger JRD handling
- `buildNodeInfoResponse()` / `buildNodeInfoWellKnown()` — NodeInfo 2.1 generation
- `createFederation()` — Federation handler factory (returns null if federation disabled)
- `validateAuthorizeRequest()` / `validateTokenRequest()` — OAuth2 request validation
- 42 tests passing

### Documentation

- Research: `docs/research/better-auth-sveltekit.md`, `docs/research/ap-actor-sso-flow.md`
- ADR 009: Better Auth → custom Drizzle schema mapping
- ADR 010: AP Actor SSO via Better Auth plugins

## Decisions Made

1. **No `generateId: false`** — Removed from Better Auth config due to type incompatibility in v1.5.4. DB `defaultRandom()` handles UUID generation.
2. **Direct handler instead of svelteKitHandler** — Used `auth.handler(request)` in hooks to avoid SvelteKit type coupling in the library package.
3. **drizzle-orm bumped to ^0.41.0** — Required by better-auth@1.5.4 peer dependency.
4. **Test files excluded from tsc build** — Added `"exclude": ["src/__tests__"]` to tsconfig for auth and protocol packages.
5. **No @fedify/fedify dep yet** — Protocol package doesn't need Fedify for the pure-function implementations (WebFinger, NodeInfo, OAuth validators). Fedify integration deferred to when actual AP message handling is needed.

## Test Summary

| Package              | Tests           | Status |
| -------------------- | --------------- | ------ |
| @commonpub/schema     | 43 (34 + 9 new) | ✅     |
| @commonpub/config     | 17              | ✅     |
| @commonpub/auth       | 42              | ✅     |
| @commonpub/protocol   | 42              | ✅     |
| @commonpub/test-utils | 14              | ✅     |
| Other packages       | 7 (stubs)       | ✅     |
| **Total**            | **165**         | **✅** |

## Open Questions

- Should `createAuth()` support `generateId: false` once better-auth types are fixed upstream?
- When to introduce actual Fedify dependency for signed HTTP requests?
- Model C (shared auth DB) implementation — deferred, needs separate ADR

## Next Steps

- Phase 3: UI components + themes (headless Svelte 5 components, 4 CSS themes)
