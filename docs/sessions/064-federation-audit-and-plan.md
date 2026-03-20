# Session 064 — Federation Audit, Plan, Testing & Implementation (2026-03-20)

## What Was Done

### 1. Full Codebase Audit
- Read all 63 prior session logs, all ADRs, all reference docs, all research docs
- Read all archived sessions (001–020 from SvelteKit era)
- Read all archived restructure files (24 route handlers, extracted server modules)
- Read current schema, protocol, server, and reference app federation code
- Confirmed: nothing valuable was lost in the SvelteKit → Nuxt migration

### 2. Web Research (Extensive)
- W3C ActivityPub spec, Fedify 2.0, HTTP Signatures (draft-cavage-12 + RFC 9421)
- Mastodon, Lemmy, PeerTube, BookWyrm, Funkwhale, Misskey, GoToSocial, Manyfold, Hollo
- FEPs: 1b12 (Groups), 400e, 8b32, 044f, 5624
- Content mirroring patterns, relay protocols, nomadic identity

### 3. Federation Plan (10 phases)
Created `docs/federation-plan.md` — comprehensive 10-phase plan covering:
- Outbound delivery, inbound persistence, cross-instance interaction, OAuth2 consumer
- CommonPub namespace (`cpub:`), hub federation (FEP-1b12), content mirroring
- BOM federation, selective federation, relay & discovery
- Full schema SQL, implementation details, dependency graph, risks

### 4. Documentation
- `docs/federation.md` — Public-facing guide with ASCII diagrams explaining all federation capabilities
- `docs/federation-notes.md` — Research notes, 7 decisions with rationale, 6 open questions
- `docs/federation-testing-plan.md` — 7-layer testing strategy
- `docs/reference/fedify-research.md` — Fedify 2.0 technical reference
- `docs/research/federation-content-mirroring.md` — Content mirroring research
- Updated `docs/reference/guides/federation.md` — Replaced F1–F8 with 10-phase summary
- Updated `README.md` — Added federation overview section with diagram

### 5. Production Code Implemented
| File | What |
|------|------|
| `packages/protocol/src/sign.ts` | HTTP Signature signing for outbound requests (Phase 1 core crypto) |
| `packages/protocol/src/sanitize.ts` | HTML sanitizer for inbound federated content (Phase 2 security boundary) |
| `packages/protocol/src/keypairs.ts` | Added digest verification to `verifyHttpSignature()` — prevents body tampering |

### 6. Tests Implemented (388 new tests, 881 → 1,269)

| Test File | Tests | What |
|-----------|-------|------|
| `server/federation.integration.test.ts` | 27 | PGlite: keypairs, follow lifecycle (send/accept/reject/undo + error paths), content federation, query filtering/pagination |
| `server/federation-hooks.integration.test.ts` | 8 | Feature flag gating, error swallowing, AP payload structure |
| `server/federation-resolve.integration.test.ts` | 6 | Actor cache hit/miss, 24h expiry, fetch failure, upsert, minimal actor |
| `protocol/signRequest.test.ts` | 11 | Sign→verify roundtrip, body tamper detection, digest verification, Host header, GET vs POST |
| `protocol/sanitize.test.ts` | 43 | Allowed elements, XSS payloads, dangerous URLs, Mastodon HTML |
| `protocol/contentMapper.roundtrip.test.ts` | 12 | Content→AP→content fidelity, unicode, edge cases |
| `protocol/security/ssrf.test.ts` | 19 | All RFC 1918 ranges, localhost, metadata endpoints, WebFinger SSRF |
| `protocol/security/content-injection.test.ts` | 20 | Polyglot XSS, mutation XSS, actor profile injection |
| `protocol/interop/mastodon.test.ts` | 12 | Real Mastodon payloads, all activity types, Article→content mapping |
| `protocol/interop/lemmy.test.ts` | 12 | Group actor, Page type, Announce wrapping, audience field |
| `protocol/interop/gotosocial.test.ts` | 9 | Person, Document attachments, ULID IDs, path-based keyId |
| `protocol/interop/misskey.test.ts` | 12 | Emoji reactions, MFM source, quote notes, namespace extensions |

### 7. QA Audit & Fixes
Audited all tests for false positives and weak assertions. Found and fixed:
- `acceptFollow`/`rejectFollow` tests only checked activity log, not DB state — fixed to verify relationship status
- `unfollowRemote` test didn't verify row deletion — fixed
- `getFollowers`/`getFollowing` tested empty arrays — fixed to verify accepted/rejected/deleted filtering
- `resolveRemoteActor` had 0% coverage — added 6 integration tests with mocked fetch
- `federateLike` no-op path untested — added
- `verifyHttpSignature` digest bypass untested — added
- Pre-existing flaky timeout in `keypairs.test.ts` — added timeout

## Key Decisions

1. **Fedify 2.0 for delivery** — `ctx.sendActivity()` handles signing, fan-out, retry, shared inbox dedup
2. **Separate `federated_content` table** — Remote content in its own table, not in `contentItems`
3. **FEP-1b12 Announce pattern for hubs** — Lemmy's battle-tested approach
4. **CommonPub namespace (`cpub:`)** — JSON-LD context extension with AS2 fallback (BookWyrm pattern)
5. **PostgresMessageQueue** — Fedify's `@fedify/postgres` instead of Redis for delivery
6. **Per-hub keypairs** — Hubs sign their own Announce activities

## Next Steps

1. Phase 1 (Outbound Delivery) — integrate Fedify 2.0 `@fedify/h3` middleware
2. Phase 2 (Inbound Persistence) — implement `federated_content` table and inbox handlers
3. Phase 5 (Namespace) — define `cpub:` JSON-LD context, update content mapper
4. Standing rule #5 remains — hubs local-only until Phase 6
5. Standing rule #10 remains — no federation until two instances exist with real content
