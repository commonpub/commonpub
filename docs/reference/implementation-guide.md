# Implementation Guide

> Step-by-step guide to building and running a CommonPub-powered site.

---

## 1. Prerequisites

| Requirement | Version | Purpose |
|-------------|---------|---------|
| Node.js | 22+ | Runtime |
| pnpm | 10+ | Package manager |
| PostgreSQL | 16+ | Primary database |
| Redis / Valkey | 7+ | Rate limiting, sessions (optional — falls back to in-memory) |
| Meilisearch | 1.6+ | Full-text search (optional — falls back to Postgres FTS) |

---

## 2. Clone & Install

```bash
git clone https://github.com/your-org/commonpub.git
cd commonpub
pnpm install
pnpm build
```

The monorepo builds all packages in dependency order via Turborepo.

---

## 3. Local Infrastructure (Docker Compose)

```bash
# From the repo root — uses root docker-compose.yml
docker compose up -d
# Or use the convenience script:
pnpm dev:infra
```

This starts PostgreSQL (port 5433), Redis (port 6380), and Meilisearch (port 7701) for local development.

---

## 4. Configuration

Create `commonpub.config.ts` in your app root:

```typescript
import { defineCommonPubConfig } from '@commonpub/config';

export const { config, warnings } = defineCommonPubConfig({
  instance: {
    domain: 'hack.build',           // Your public domain
    name: 'hack.build',             // Human-readable name
    description: 'A community for makers and hackers',
    contactEmail: 'admin@hack.build',
    maxUploadSize: 10 * 1024 * 1024, // 10MB (default)
    contentTypes: ['project', 'article', 'blog', 'explainer'],
  },

  features: {
    content: true,       // Content CRUD, publishing, slugs
    social: true,        // Likes, comments, bookmarks
    hubs: true,          // Hub system (community/product/company types)
    docs: true,          // Documentation sites with versioning
    video: true,         // Video content type
    contests: false,     // Contest system (opt-in)
    learning: true,      // Learning paths, enrollment, certificates
    explainers: true,    // Interactive explainer modules
    federation: false,   // ActivityPub federation (requires setup)
    admin: false,        // Admin panel (enable for multi-user instances)
  },

  auth: {
    emailPassword: true,   // Email/password login
    magicLink: false,      // Magic link login
    passkeys: false,       // WebAuthn passkeys
    // GitHub OAuth (optional):
    // github: {
    //   clientId: process.env.GITHUB_CLIENT_ID!,
    //   clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    // },
    // Trusted instances for AP SSO (optional):
    // trustedInstances: ['deveco.io'],
  },
});
```

### Environment Variables

```bash
# Required
DATABASE_URL=postgresql://user:pass@localhost:5432/commonpub
AUTH_SECRET=your-random-secret-at-least-32-chars

# Optional
REDIS_URL=redis://localhost:6379
MEILI_URL=http://localhost:7701
MEILI_MASTER_KEY=your-api-key

# OAuth (if enabled)
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# Production
PUBLIC_URL=https://hack.build
NODE_ENV=production
```

---

## 5. Database Setup

Run Drizzle migrations:

```bash
pnpm --filter @commonpub/schema db:push    # Apply schema to database
# or
pnpm --filter @commonpub/schema db:migrate  # Run migration files
```

The schema creates all 63 tables and 32 enums.

---

## 6. Feature Flags Explained

See [Feature Flags Guide](./guides/feature-flags.md) for complete details.

| Flag | Default | What It Controls |
|------|---------|-----------------|
| `content` | on | Content system — required by most other features |
| `social` | on | Likes, comments, bookmarks, follows, notifications |
| `hubs` | on | Hub system — community/product/company types, feeds, membership, moderation (local-only) |
| `docs` | on | Documentation sites with CodeMirror, versioning, search |
| `video` | on | Video content embedding |
| `contests` | off | Contest/competition system |
| `learning` | on | Learning paths, modules, lessons, enrollment, certificates |
| `explainers` | on | Interactive explainer modules with quizzes |
| `federation` | off | ActivityPub protocol — requires trusted instances config |
| `admin` | off | Admin panel — enable for multi-user instances |

---

## 7. Auth Configuration

### Email/Password (default)

Enabled by default. Users sign up with email, username, and password.

### GitHub OAuth

```typescript
auth: {
  github: {
    clientId: process.env.GITHUB_CLIENT_ID!,
    clientSecret: process.env.GITHUB_CLIENT_SECRET!,
  },
}
```

### Magic Link

```typescript
auth: { magicLink: true }
```

Requires email sending configuration (SMTP).

### Passkeys (WebAuthn)

```typescript
auth: { passkeys: true }
```

Requires HTTPS in production.

---

## 8. Content CRUD Flow

1. **Create**: User fills form at `/create` → validates with `createContentSchema` → calls `createContent()` → returns draft with auto-generated slug and preview token
2. **Edit**: Author visits `/[type]/[slug]/edit` → updates fields → calls `updateContent()`
3. **Publish**: Author clicks "Publish" → calls `publishContent()` → sets `publishedAt`, status to `'published'`
4. **Federation**: If enabled, `onContentPublished()` → `federateContent()` → logs Create activity
5. **View**: Public visits `/[type]/[slug]` → `getContentBySlug()` → `incrementViewCount()`
6. **Delete**: Author soft-deletes → `deleteContent()` → sets status to `'archived'`

Content is stored as `BlockTuple[]` in the `contentItems.content` jsonb column. The TipTap editor converts between its document format and BlockTuples via `blockTuplesToDoc()` / `docToBlockTuples()`.

---

## 9. Hub Setup

Hubs come in three types: community (maker groups), product (hardware/software), and company (organizations).

1. **Create**: `/hubs/create` → `createHub()` → creator becomes owner
2. **Hub Type**: Set `hubType` to `community`, `product`, or `company`
3. **Join Policy**: Set `joinPolicy` to `open` (anyone), `approval` (admin approves), or `invite` (token required)
4. **Invite**: Admins create invite tokens with optional max uses and expiry
5. **Posts**: Members create text/link/share/poll posts → moderators can pin/lock
6. **Moderation**: Moderators can kick members, admins can ban (with optional expiry)
7. **Roles**: `member` → `moderator` → `admin` → `owner` (hierarchical permissions)
8. **Content Sharing**: Share existing content items into a hub
9. **Products**: Company hubs can list products; product hubs auto-populate gallery via BOM

**v1 Limitation**: Hubs are local-only. No AP Group federation support.

---

## 10. Documentation Sites

1. **Create site**: `/docs/create` → auto-creates v1.0.0 version
2. **Add pages**: Use CodeMirror editor for raw markdown (standing rule #4)
3. **Organize**: Build navigation tree at `/docs/[siteSlug]/edit/nav`
4. **Version**: Create new versions, optionally copying pages from existing versions
5. **Search**: Full-text search via Postgres FTS (or Meilisearch if configured)
6. **View**: Public at `/docs/[siteSlug]/[...pagePath]` with rendered markdown, TOC, prev/next

---

## 11. Learning Paths

1. **Create path**: `/learn/create` → draft path with title, slug, description, difficulty
2. **Add modules**: Organize lessons into modules (sections)
3. **Add lessons**: 5 lesson types: article (BlockTuples), video, quiz, project, explainer
4. **Publish**: `/learn/[slug]/edit` → publish action
5. **Enrollment**: Users enroll at `/learn/[slug]` → `enroll()` creates enrollment record
6. **Progress**: `markLessonComplete()` recalculates progress → updates enrollment
7. **Certificate**: When progress = 100%, auto-issues certificate with unique verification code
8. **Verify**: Public at `/certificates/[code]`

---

## 12. Explainers

1. **Create**: `/explainers/create` → creates content item with type `'explainer'`
2. **Add sections**: 4 types — text, interactive (with controls), quiz, checkpoint
3. **Interactive controls**: Sliders, toggles, selects that modify visual output
4. **Quizzes**: Multiple-choice questions with configurable passing score
5. **Checkpoints**: Gate sections that require previous sections to be completed
6. **Progress**: Tracked per-user via `ExplainerProgressState`
7. **Export**: `GET /api/explainers/[slug]/export` → standalone HTML file

---

## 13. Federation

### Enable

```typescript
features: { federation: true },
auth: { trustedInstances: ['other-instance.com'] },
```

### Configure Trusted Instances

Each trusted instance needs:
1. A registered OAuth client (`oauthClients` table) on your instance
2. Their domain in your `trustedInstances[]` array

### What Happens When Enabled

- WebFinger, NodeInfo, and actor profile endpoints become active
- Users get RSA-2048 keypairs generated on first federation action
- Published content triggers outbound Create activities
- Users can send Follow requests to remote actors
- OAuth2 SSO allows cross-instance authentication

See [Federation Guide](./guides/federation.md) for full details.

---

## 14. Theming

### Built-in Themes

| ID | Description |
|----|-------------|
| `base` | Sharp corners, offset shadows, blue accent (light) |
| `dark` | Dark surfaces with the same offset aesthetic |
| `generics` | Dark minimal theme with soft glow |

### Token Overrides

Override any of the 136 CSS tokens via the admin panel or programmatically:

```typescript
import { applyThemeToElement, validateTokenOverrides } from '@commonpub/ui';

applyThemeToElement(document.documentElement, 'base', {
  'color-primary': '#ff6600',
  'font-heading': "'Playfair Display', serif",
});
```

See [Theming Guide](./guides/theming.md) for the full token reference.

---

## 15. Admin Panel

Enable with `features: { admin: true }`. Requires `user.role` of `admin` or `staff`.

| Page | Purpose |
|------|---------|
| `/admin` | Platform stats (users, content, hubs, reports) |
| `/admin/users` | List, search, change roles/status, delete users |
| `/admin/reports` | Review and resolve user reports |
| `/admin/audit` | View audit log of admin actions |
| `/admin/settings/theme` | Set instance theme and token overrides |

All admin actions create audit log entries with actor, action, target, and metadata.

---

## 16. Deployment

### Docker

```bash
docker build -f deploy/Dockerfile -t commonpub .
docker compose -f deploy/docker-compose.yml up -d
```

### DigitalOcean App Platform

Use the Docker image with environment variables configured in the App Platform dashboard.

### VPS (Manual)

1. Install Node.js 22+, PostgreSQL 16+
2. Clone repo, `pnpm install && pnpm build`
3. Set environment variables
4. Run migrations: `pnpm db:push`
5. Start with `node apps/reference/.output/server/index.mjs`
6. Reverse proxy with nginx + Certbot SSL

### Scaffolding New Instances

```bash
npx create-commonpub my-community
```

The Rust CLI scaffolds a new CommonPub instance with config file, Docker compose, and deployment templates.

See [Deployment Guide](../deployment.md) for full production setup.

---

## 17. Known Blockers & Limitations

- ~~**better-auth/zod v4**: Build fails due to Zod version mismatch.~~ Resolved — upgraded to zod v4.3.6.
- **Federation stubs**: Inbound activities logged but not processed
- **No activity delivery**: Outbound activities logged but not sent
- **Communities local-only**: No AP Group support
- **GSAP animations**: Deferred (Phase 5b)
- **Mermaid rendering**: Deferred (Phase 9b)

See [v1 Limitations](./guides/v1-limitations.md) for full details and [Federation Roadmap](./guides/federation.md#federation-roadmap-post-v1) for the federation development plan.
