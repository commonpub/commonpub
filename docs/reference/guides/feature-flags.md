# Feature Flags

> All 10 feature flags, what each controls, default values, and dependencies.

CommonPub uses feature flags (defined in `@commonpub/config`) to gate entire subsystems. Every server module, route, and API endpoint checks the relevant flag via `locals.config.features.*` before executing.

---

## Flag Reference

### `content` (default: `true`)

**Controls**: The entire content management system.

**Enables**:
- Content CRUD (`createContent`, `updateContent`, `deleteContent`, `publishContent`)
- Content routes: `/create`, `/[type]/[slug]`, `/[type]/[slug]/edit`
- Content listing pages: `/projects`, `/articles`, `/blog`, `/guides`
- Dashboard content management: `/dashboard`
- View count tracking
- Content forking
- Tag management
- SEO metadata and preview tokens

**Dependencies**: Required by `social` (likes/comments target content), `communities` (content sharing), `federation` (content federation).

---

### `social` (default: `true`)

**Controls**: Social interaction features.

**Enables**:
- Like/unlike: `POST /api/social/like`
- Comment CRUD: `GET/POST/DELETE /api/social/comments`
- Bookmark toggle: `POST /api/social/bookmark`
- Follow system: `follows` table
- Notification system: `notifications` table
- Report system: `reports` table
- Like/comment counts on content

**Dependencies**: Requires `content` for content-targeted interactions.

---

### `communities` (default: `true`)

**Controls**: Community system (local-only in v1).

**Enables**:
- Community CRUD and listing: `/communities`, `/communities/create`
- Community detail: `/communities/[slug]`
- Membership management: join, leave, roles
- Community posts and replies
- Member moderation: kick, ban, unban
- Invite system (token-based)
- Content sharing to communities
- Community settings: `/communities/[slug]/settings`
- Dashboard communities: `/dashboard/communities`

**v1 Limitation**: Communities are local-only. No AP Group support, no cross-instance community interaction.

---

### `docs` (default: `true`)

**Controls**: Documentation site module.

**Enables**:
- Docs site CRUD: `/docs/create`, `/docs/[siteSlug]/edit`
- Version management (create, set default, delete)
- Page management (create, edit, reorder, delete)
- Navigation tree editor
- Markdown rendering with CodeMirror editor
- Full-text search: `GET /api/docs/search`
- Public docs viewer: `/docs/[siteSlug]/[...pagePath]`
- Dashboard docs: `/dashboard/docs`

---

### `video` (default: `true`)

**Controls**: Video content type.

**Enables**:
- `videos` and `videoCategories` tables
- Video embed support (YouTube, Vimeo, other)
- Video metadata (duration, thumbnail, view counts)

---

### `contests` (default: `false`)

**Controls**: Contest/competition system.

**Enables**:
- `contests` and `contestEntries` tables
- Contest lifecycle: upcoming → active → judging → completed
- Entry submission (links content items to contests)
- Judge scoring and ranking
- Prize management

**Default off**: Contests are opt-in as most instances won't need them.

---

### `learning` (default: `true`)

**Controls**: Learning path engine.

**Enables**:
- Learning path CRUD: `/learn/create`, `/learn/[slug]/edit`
- Module and lesson management (with reordering)
- Enrollment and progress tracking
- Lesson completion tracking
- Certificate generation
- Public certificate verification: `/certificates/[code]`
- Dashboard learning: `/dashboard/learning`
- Learning path listing: `/learn`
- Lesson viewer: `/learn/[slug]/[lessonSlug]`

**Dependencies**: Works best with `explainers` enabled (explainers are a first-class lesson type).

---

### `explainers` (default: `true`)

**Controls**: Interactive explainer module system.

**Enables**:
- Explainer CRUD: `/explainers/create`, `/explainers/[slug]/edit`
- Explainer content type in `contentItems`
- Interactive section types: text, interactive, quiz, checkpoint
- Quiz engine with scoring
- Progress tracking
- HTML export: `GET /api/explainers/[slug]/export`
- Explainer listing: `/explainers`

**Dependencies**: `learning` can use explainers as lesson types.

---

### `federation` (default: `false`)

**Controls**: ActivityPub federation protocol.

**Enables**:
- WebFinger discovery: `/.well-known/webfinger`
- NodeInfo: `/.well-known/nodeinfo`, `/nodeinfo/2.1`
- Actor profiles: `/users/[username]` (content-negotiated)
- Inbox/outbox: `/users/[username]/inbox`, `/users/[username]/outbox`
- Shared inbox: `/inbox`
- Follow lifecycle (Follow/Accept/Reject/Undo)
- Content federation (Create/Update/Delete activities)
- Like federation
- OAuth2 SSO (Model B): `/api/auth/oauth2/*`
- Keypair generation per user
- Remote actor resolution and caching
- Federation dashboard: `/dashboard/federation`
- `remoteActors`, `activities`, `followRelationships`, `actorKeypairs` tables
- `federatedAccounts`, `oauthClients` tables

**Default off**: Federation requires trusted instances to be configured and is not needed for single-instance deployments.

**v1 Limitation**: Inbound Create/Update/Delete/Like/Announce are logged but not processed (stubs). No remote content persistence.

---

### `admin` (default: `false`)

**Controls**: Admin panel and platform management.

**Enables**:
- Admin dashboard: `/admin` (platform stats)
- User management: `/admin/users` (list, role changes, status changes)
- Report moderation: `/admin/reports` (review, resolve, dismiss)
- Audit logs: `/admin/audit`
- Instance settings: `/admin/settings/theme`
- Instance theme customization
- Content removal by admins
- User deletion by admins

**Access**: Requires `user.role === 'admin'` or `'staff'`.

---

## Flag Defaults Summary

| Flag | Default | Rationale |
|------|---------|-----------|
| `content` | `true` | Core feature, required by most other systems |
| `social` | `true` | Expected baseline for community sites |
| `communities` | `true` | Primary use case for CommonPub |
| `docs` | `true` | Documentation is a core maker need |
| `video` | `true` | Low overhead, commonly needed |
| `contests` | `false` | Niche feature, opt-in |
| `learning` | `true` | Key differentiator for maker communities |
| `explainers` | `true` | Key differentiator, works with learning |
| `federation` | `false` | Requires infrastructure setup |
| `admin` | `false` | Only needed for multi-user instances |

## Flag Checking Pattern

All feature flags are checked in server routes via `locals.config.features`:

```typescript
// In +page.server.ts load function
export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.config.features.communities) {
    throw error(404, 'Communities are disabled');
  }
  // ... proceed with community data loading
};
```

Server modules also check flags internally before federation hooks:

```typescript
// In server/content.ts
export async function publishContent(db, contentId, config) {
  // ... publish logic ...
  if (config.features.federation) {
    await federateContent(db, contentId, config);
  }
}
```
