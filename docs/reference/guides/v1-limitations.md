# v1 Limitations

> Known blockers, deferred features, federation stubs, and honest status. Last updated Session 065.

---

## Active Blockers

None. The better-auth/zod v4 blocker was resolved in Session 017 by upgrading all packages to zod v4.

---

## Federation Limitations

### Outbound Activity Delivery (Not Implemented)

Activities are logged to the `activities` table with status `'pending'` but are **never actually delivered** to remote inboxes. The HTTP POST to remote inbox endpoints with signed requests is not implemented. See [Federation Roadmap](./federation.md#federation-roadmap-post-v1) phase F2.

### Inbound Content Processing (Stubs Only)

Inbound Create, Update, Delete, Like, and Announce activities are handled by stub callbacks that **log only** — they do not persist remote content locally. This means:

- You cannot see content from people you follow in your feed
- Remote likes are not counted on local content
- Remote shares/boosts have no effect

See [Federation Roadmap](./federation.md#federation-roadmap-post-v1) phase F3.

### ~~HTTP Signature Signing~~ (Resolved — Session 065)

Moved to [Resolved Limitations](#resolved-limitations).

### Hubs Are Local-Only

No AP Group support. Hubs exist only on the instance that creates them. Users on other instances cannot discover, join, or interact with remote hubs. See [Federation Roadmap](./federation.md#federation-roadmap-post-v1) phase F5.

### No Remote Content Persistence

The `remoteActors` table caches actor profiles (24h TTL), but there is no equivalent for remote content. Received articles, notes, and likes are logged as activities but not stored as first-class content. See [Federation Roadmap](./federation.md#federation-roadmap-post-v1) phase F3.

---

## Resolved Limitations

### better-auth/zod v4 Compatibility (Resolved — Session 017)

`better-auth@1.5.4` required zod v4. All packages upgraded from zod v3 to v4.3.6. Reference app builds successfully.

### OAuth2 Authorization Codes In-Memory (Resolved — Session 017)

The `oauthCodes.ts` module previously used an in-memory `Map`. Now backed by the `oauth_codes` database table — safe for multi-process production deployments.

### HTTP Signature Verification Accepted Unsigned Requests (Resolved — Session 017)

`verifyHttpSignature()` now returns `false` when no Signature header is present.

### Federation Hooks Swallowed Errors (Resolved — Session 017)

All `.catch(() => {})` handlers replaced with `.catch((err) => { console.error('[federation]', err); })` for error visibility.

### `scoreQuiz()` Hardcoded `passed: false` (Resolved — Session 017)

Now computes `passed` via `isQuizPassed(score, passingScore)` with configurable threshold (default 70).

### `deletePost`/`deleteReply` Wrong Permission (Resolved — Session 017)

Now use proper `'deletePost'` permission instead of `'pinPost'` proxy.

### `listBans()` N+1 Query (Resolved — Session 017)

Replaced per-ID loop with single `inArray` query.

### Certificate `randomHex()` Used `Math.random()` (Resolved — Session 017)

Now uses `crypto.getRandomValues()` for cryptographic randomness.

### `checkBan()` Stale Expired Bans (Resolved — Session 017)

Expired ban rows are now deleted on access.

### HTTP Signature Signing (Resolved — Session 065)

Outbound HTTP requests are now signed with Ed25519 keypairs via the `signRequest()` function in `@commonpub/protocol`. Includes comprehensive test suite with interoperability tests for Mastodon, Lemmy, GoToSocial, and Misskey.

### Content HTML Sanitization (Resolved — Session 065)

Inbound federated content is now sanitized via `sanitizeHtml()` in `@commonpub/protocol` using isomorphic-dompurify. Includes 50 sanitization tests covering XSS prevention, allowed/blocked elements, and content-injection attack vectors.

### Federation Interoperability Testing (Resolved — Session 065)

388 new federation tests added covering HTTP signatures, content sanitization, activity types, and real-payload interoperability with Mastodon, Lemmy, GoToSocial, and Misskey. SSRF prevention tests also included.

---

## Deferred Features

### Phase 5b — GSAP Animations

Interactive explainer sections were designed to support GSAP-powered animations tied to interactive controls (sliders, toggles). The animation system is deferred:

- Section types and registry are complete
- Interactive controls work
- Visual feedback via GSAP is not implemented
- Explainers work without animations (static rendering only)

### Phase 9b — mermaid-isomorphic

Documentation sites were planned to support Mermaid diagram rendering during the markdown pipeline:

- Markdown rendering pipeline is complete
- Code blocks with `language: 'mermaid'` are rendered as plain code
- Server-side Mermaid SVG rendering is not implemented
- Client-side Mermaid.js could be added as a progressive enhancement

---

## TypeScript Status

**0 type errors** across all packages. TypeScript strict mode with `noUncheckedIndexedAccess` enabled.

---

## Lint Status

**0 lint errors** as of Session 065.

---

## Test Coverage

| Category | Count | Status |
|----------|-------|--------|
| Unit + integration tests | 1,433 | All passing |
| Component tests (a11y) | 214 | All passing (axe-core WCAG 2.1 AA) |
| Federation interop tests | 388 | All passing (Mastodon, Lemmy, GoToSocial, Misskey) |
| Build tasks | 14 | All passing (12 packages + reference app + worker) |
| E2E (Playwright) | 6 specs | Infrastructure in place, coverage expanding |

---

## Performance (Not Yet Measured)

Lighthouse scores require a running instance. Now unblocked by zod v4 fix. Target scores:

- Performance: 90+
- Accessibility: 95+
- Best Practices: 95+
- SEO: 95+

---

## Infrastructure Dependencies

| Service | Required | Purpose |
|---------|----------|---------|
| PostgreSQL 16 | Yes | Primary data store |
| Node.js 22+ | Yes | Runtime |
| Redis / Valkey | Optional | Rate limiting store, session cache (falls back to in-memory) |
| Meilisearch | Optional | Full-text search (falls back to Postgres FTS) |

---

## What's Needed Before v1.0.0 Tag

1. ~~Fix better-auth/zod v4 compatibility blocker~~ Done
2. Run Docker compose successfully
3. Run Lighthouse audit on deployed instance
4. Verify all launch checklist items
5. Tag v1.0.0
