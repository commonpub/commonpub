# Known Limitations

> Honest status of what's implemented, what's deferred, and what's been resolved. Last updated 2026-04-02.

---

## Active Blockers

None.

---

## Current Limitations

### Federation — Interoperability Scope

Federation is fully implemented between CommonPub instances. Interoperability with non-CommonPub fediverse software (Mastodon, Lemmy, etc.) works for standard AP types but has limitations:

- CommonPub-specific extensions (`cpub:type`, BOM data, learning paths) are only understood by other CommonPub instances
- Non-CommonPub instances see all content as generic Article
- Hub federation (AP Group) follows the Lemmy/FEP-1b12 pattern but hasn't been tested against live Lemmy instances

### GSAP Animations (Deferred)

Interactive explainer sections were designed to support GSAP-powered animations tied to interactive controls (sliders, toggles):

- Section types and registry are complete
- Interactive controls work
- Visual feedback via GSAP is not implemented
- Explainers work without animations (static rendering only)

### Mermaid Diagram Rendering (Deferred)

Documentation sites were planned to support Mermaid diagram rendering during the markdown pipeline:

- Markdown rendering pipeline is complete
- Code blocks with `language: 'mermaid'` are rendered as plain code
- Server-side Mermaid SVG rendering is not implemented
- Client-side Mermaid.js could be added as a progressive enhancement

### SEO — JSON-LD Partial

`useHead()` and `useSeoMeta()` are used throughout. JSON-LD structured data is partially implemented. Full structured data coverage for all content types is in progress.

---

## Resolved Limitations

### Federation — Full Implementation (Resolved — Sessions 074-088)

All 7 federation phases are now complete:

- **Outbound delivery**: Activities are signed and delivered to remote inboxes with HTTP Signatures
- **Inbound processing**: Create, Update, Delete, Like, and Announce activities are processed and persisted
- **Remote content**: Federated content is stored locally with `canonicalUrl` pointing to origin
- **Hub federation**: Hubs federate as AP Group actors (behind `features.federateHubs` flag)
- **Content mirroring**: Instance admins can mirror content from other instances with per-content-type filtering
- **Cross-instance SSO**: OAuth2 login across trusted instances
- **Search & polish**: Federated content appears in search, timeline, and feeds

### better-auth/zod v4 Compatibility (Resolved — Session 017)

`better-auth@1.5.4` required zod v4. All packages upgraded from zod v3 to v4.3.6.

### OAuth2 Authorization Codes In-Memory (Resolved — Session 017)

The `oauthCodes.ts` module previously used an in-memory `Map`. Now backed by the `oauth_codes` database table — safe for multi-process production deployments.

### HTTP Signature Verification (Resolved — Session 017)

`verifyHttpSignature()` now correctly returns `false` when no Signature header is present.

### HTTP Signature Signing (Resolved — Session 065)

Outbound HTTP requests are now signed with Ed25519 keypairs via `signRequest()` in `@commonpub/protocol`. Includes interoperability tests for Mastodon, Lemmy, GoToSocial, and Misskey.

### Content HTML Sanitization (Resolved — Session 065)

Inbound federated content is sanitized via `sanitizeHtml()` using isomorphic-dompurify. 50 sanitization tests covering XSS prevention and content-injection attack vectors.

### IPv6 SSRF Protection (Resolved — Session 070)

Node's URL parser returns IPv6 hostnames with brackets (`[::1]`). Fixed by stripping brackets before pattern matching. All IPv6 private ranges now blocked.

### Various Bug Fixes (Resolved — Session 017)

- `scoreQuiz()` hardcoded `passed: false` — now uses `isQuizPassed()` with configurable threshold
- `deletePost`/`deleteReply` wrong permission — now uses proper `'deletePost'` permission
- `listBans()` N+1 query — replaced with single `inArray` query
- Certificate `randomHex()` used `Math.random()` — now uses `crypto.getRandomValues()`
- `checkBan()` stale expired bans — expired rows deleted on access

---

## TypeScript Status

**0 type errors** across all packages. TypeScript strict mode with `noUncheckedIndexedAccess` enabled.

---

## Lint Status

**0 lint errors** across all packages.

---

## Test Coverage

| Category | Count | Status |
|----------|-------|--------|
| Unit + integration tests | 1,939+ | All passing |
| Component tests (a11y) | 214 | All passing (axe-core WCAG 2.1 AA) |
| Federation interop tests | 388 | All passing (Mastodon, Lemmy, GoToSocial, Misskey) |
| Build tasks | 14 | All passing (12 packages + reference app + worker) |
| E2E (Playwright) | 6 specs | Infrastructure in place, coverage expanding |

---

## Infrastructure Dependencies

| Service | Required | Purpose |
|---------|----------|---------|
| PostgreSQL 16 | Yes | Primary data store |
| Node.js 22+ | Yes | Runtime |
| Redis / Valkey | Optional | Rate limiting store, session cache (falls back to in-memory) |
| Meilisearch | Optional | Full-text search (falls back to Postgres FTS) |
