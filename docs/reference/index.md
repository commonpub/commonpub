# CommonPub Reference Documentation

> Complete API reference, architecture guides, and implementation walkthroughs for the CommonPub federation protocol and package suite.

---

## Architecture

| Document | Description |
|----------|-------------|
| [Architecture & State Diagrams](./architecture.md) | Package dependency graph, request lifecycle, content data flow, and state machine diagrams |
| [Implementation Guide](./implementation-guide.md) | Step-by-step guide to building a CommonPub-powered site from scratch |

## Package API Reference

| Document | Package | Description |
|----------|---------|-------------|
| [Schema](./packages/schema.md) | `@commonpub/schema` | 63 Drizzle tables, 32 enums, 74 Zod validators |
| [Config](./packages/config.md) | `@commonpub/config` | `defineCommonPubConfig()` factory, 13 feature flags, validation schemas |
| [Protocol](./packages/protocol.md) | `@commonpub/protocol` | ActivityPub types, activity builders, WebFinger, NodeInfo, OAuth2, HTTP signatures |
| [Auth](./packages/auth.md) | `@commonpub/auth` | Better Auth wrapper, session management, guards, AP actor SSO |
| [UI](./packages/ui.md) | `@commonpub/ui` | Headless Vue 3 components, base theme (light/dark), CSS tokens |
| [Editor](./packages/editor.md) | `@commonpub/editor` | TipTap extensions, BlockTuple serialization, block registry |
| [Docs](./packages/docs-package.md) | `@commonpub/docs` | Markdown rendering, navigation trees, versioning, search adapters |
| [Explainer](./packages/explainer.md) | `@commonpub/explainer` | Interactive sections, quiz engine, progress tracking, HTML export |
| [Learning](./packages/learning.md) | `@commonpub/learning` | Learning path engine, progress calculation, certificates |
| [Infra](./packages/infra.md) | `@commonpub/infra` | S3/local storage adapter, image processing (sharp), email adapter, security utilities |
| [Test Utils](./packages/test-utils.md) | `@commonpub/test-utils` | 5 factories, mock config, shared test helpers |

## Server Module Reference

| Document | Module | Description |
|----------|--------|-------------|
| [Overview](./server/overview.md) | — | How server modules work, DB access patterns, feature flag gating |
| [Content](./server/content.md) | `content.ts` | Content CRUD, publishing, view counts, federation hooks |
| [Social](./server/social.md) | `social.ts` | Likes, comments, bookmarks, federation hooks |
| [Hubs](./server/community.md) | `hub.ts` | 30+ functions for hub CRUD (community/product/company types), membership, posts, moderation |
| [Learning](./server/learning-server.md) | `learning.ts` | Paths, modules, lessons, enrollment, certificates |
| [Docs](./server/docs-server.md) | `docs.ts` | Sites, versions, pages, navigation, search |
| [Federation](./server/federation-server.md) | `federation.ts` | Keypairs, actor resolution, follow management, content federation |
| [Admin](./server/admin.md) | `admin.ts` | Platform stats, user management, reports, instance settings |
| [Rate Limiting](./server/rate-limit.md) | `rateLimit.ts` | 6 tiers, sliding window algorithm |
| [Security](./server/security.md) | `security.ts` | Nonce-based CSP, HSTS, security headers |
| [OAuth Codes](./server/oauth-codes.md) | `oauthCodes.ts` | Authorization code store, single-use consumption, TTL cleanup |
| [Audit](./server/audit.md) | `audit.ts` | Audit log creation and listing |

## Cross-cutting Guides

| Document | Description |
|----------|-------------|
| [Federation](./guides/federation.md) | Federation capabilities, OAuth2 SSO flow, endpoint reference, cross-publishing FAQ |
| [Theming](./guides/theming.md) | Base theme (light/dark), CSS tokens by category, token overrides |
| [Routing](./guides/routing.md) | All routes — pages, API endpoints, federation endpoints |
| [Feature Flags](./guides/feature-flags.md) | All 13 flags: what each controls, defaults, dependencies |
| [Admin & Permissions](./guides/admin-and-permissions.md) | Admin panel, role hierarchy, permission model |
| [Known Limitations](./guides/v1-limitations.md) | Current limitations, deferred features, resolved issues, honest status |

---

## Also See

- [Deployment Guide](../deployment.md) — Docker, DigitalOcean, VPS deployment
- [Architecture Decision Records](../adr/) — ADRs 001–026
- [Master Plan](../plan-v2.md) — Current production-grade implementation plan
- [Accessibility Audit](../a11y-audit.md) — WCAG 2.1 AA compliance report
- [Contributing Guide](../contributing.md) — Development workflow, coding standards, and PR process
