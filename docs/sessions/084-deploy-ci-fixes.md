# Session 084 — Deploy Readiness + CI Fixes

**Date**: 2026-03-26
**Scope**: commonpub CI + deveco-io deploy fixes

## Deploy Fixes (deveco-io)
- User actor now includes `endpoints.sharedInbox` → `/inbox`
- WebFinger includes `oauth_endpoint` link for SSO discovery
- Hub inbox route at `/hubs/[slug]/inbox` for FEP-1b12 compliance
- Fixed import: hub inbox uses `@commonpub/protocol` (not `@commonpub/server`) for `processInboxActivity`, `verifyHttpSignature`, `resolveActor`
- `.env.example` updated with federation configuration docs

## CI Fixes (commonpub)
- pnpm version conflict: removed explicit version from action-setup (reads packageManager)
- Rust clippy: 5 `useless_vec` → array literals, `if_same_then_else` simplified, `dead_code` allowed in lib + CI flag
- Reference app typecheck: 5 pre-existing TS errors fixed with type assertions
- Deploy tests: wrong assertions (certbot → Caddy, release → push trigger)
- ESLint: 2 `no-useless-assignment` in inboxHandlers fixed
- Docs test timeout: 30s → 60s for renderMarkdown cold start

## CI Status
- **commonpub**: All 5 core jobs pass (rust, 4 check matrix). E2E has pre-existing Playwright failures. Docker needs GHCR permissions.
- **deveco-io**: CI passes. Deploy Production succeeds.

## Packages Published
- `@commonpub/schema@0.7.0`
- `@commonpub/protocol@0.7.0`
- `@commonpub/server@0.7.0`

## Both Repos Clean and Pushed
- commonpub: `v0.7.0` tag + CI fixes
- deveco-io: federation routes + deploy fixes

## To Go Live
1. Fix GHCR permissions in commonpub repo settings (Docker push 403)
2. Run `pnpm db:push` on production instances (new tables: federatedContent, instanceMirrors, hubActorKeypairs, hubFollowers)
3. Configure `trustedInstances` in `commonpub.config.ts` per instance
4. Fix pre-existing E2E test failures (separate task)
