# URL Structure Reference

> Definitive guide to content URL patterns in CommonPub. Updated session 108 (2026-04-06).

## Content URLs

Content items (projects, articles, blogs, explainers) use user-scoped URLs:

```
/u/{username}/{type}/{slug}
```

| Component | Description | Example |
|-----------|-------------|---------|
| `username` | Author's username | `alice` |
| `type` | Content type: `project`, `article`, `blog`, `explainer` | `project` |
| `slug` | URL-safe title slug, unique per (author, type) | `robot-arm` |

### Examples

| URL | What it shows |
|-----|---------------|
| `/u/alice/project/robot-arm` | Alice's project "Robot Arm" |
| `/u/alice/project/robot-arm/edit` | Editor for that project |
| `/u/alice/article/new/edit` | Create a new article as Alice |
| `/u/bob/blog/weekly-update` | Bob's blog post |

### Legacy Redirects

Old-format URLs (pre-session 108) redirect with 301:

| Old URL | Redirects to |
|---------|-------------|
| `/project/robot-arm` | `/u/alice/project/robot-arm` (looks up author) |
| `/project/robot-arm/edit` | `/u/alice/project/robot-arm/edit` |
| `/article/new/edit` | `/u/{current-user}/article/new/edit` |

### Slug Uniqueness

Slugs are unique per `(authorId, type)`. Two users can have the same slug for the same content type:
- `/u/alice/project/robot-arm` and `/u/bob/project/robot-arm` can both exist.

---

## URL Builder Functions

### Server-Side (`@commonpub/server`)

```ts
import { buildContentPath, buildContentUrl, buildContentEditPath, buildContentNewPath } from '@commonpub/server';

buildContentPath('alice', 'project', 'robot-arm')
// → '/u/alice/project/robot-arm'

buildContentUrl('hack.build', 'alice', 'project', 'robot-arm')
// → 'https://hack.build/u/alice/project/robot-arm'

buildContentEditPath('alice', 'project', 'robot-arm')
// → '/u/alice/project/robot-arm/edit'

buildContentNewPath('alice', 'project')
// → '/u/alice/project/new/edit'
```

### Client-Side (Vue Composable)

```ts
const { contentPath, contentEditPath, contentNewPath, contentUrl, contentLink } = useContentUrl();

// For items with full data (ContentListItem, ContentDetail):
contentLink(item)  // handles federated content, missing author, etc.

// For manual construction:
contentPath('alice', 'project', 'robot-arm')     // '/u/alice/project/robot-arm'
contentEditPath('alice', 'project', 'robot-arm')  // '/u/alice/project/robot-arm/edit'
contentNewPath('alice', 'project')                 // '/u/alice/project/new/edit'
contentUrl('alice', 'project', 'robot-arm')        // 'https://domain/u/alice/project/robot-arm'
```

---

## API Endpoints

### Content Detail

```
GET /api/content/{slug}?author={username}
```

The `author` query parameter disambiguates when multiple users have the same slug. Without it, returns the first match.

### Content CRUD

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/content/{slug}?author={username}` | Fetch content by slug |
| `POST` | `/api/content` | Create new content (draft) |
| `PUT` | `/api/content/{id}` | Update content |
| `DELETE` | `/api/content/{id}` | Delete content |
| `POST` | `/api/content/{id}/publish` | Publish content |
| `POST` | `/api/content/{id}/view` | Record view |
| `POST` | `/api/content/{id}/fork` | Fork content |
| `GET` | `/api/content/{id}/versions` | Version history |
| `GET` | `/api/content/{id}/products` | Associated products |

---

## ActivityPub URIs

### Content AP Object ID

New content published after session 108 uses:
```
https://{domain}/u/{username}/{type}/{slug}
```

Stored in `contentItems.apObjectId` on first publish (immutable after that).

### Legacy AP Object ID

Content published before session 108 retains:
```
https://{domain}/content/{slug}
```

The old `/content/{slug}` AP dereference route still works for backwards compatibility with remote instances.

### AP Dereference Endpoints

| Endpoint | When Used |
|----------|-----------|
| `GET /u/{username}/{type}/{slug}` | New format — returns Article JSON-LD for AP clients |
| `GET /content/{slug}` | Legacy format — returns Article JSON-LD for AP clients |

Both endpoints use content negotiation: AP clients (Accept: `application/activity+json`) get JSON-LD, browsers get the Nuxt page.

### Federation Functions

```ts
// Resolve the canonical AP URI for a content item (reads stored apObjectId)
const uri = await resolveContentObjectUri(db, contentId, domain);
// → 'https://hack.build/u/alice/project/robot-arm'

// Deprecated — use resolveContentObjectUri instead
const uri = buildContentUri(domain, slug);
// → 'https://hack.build/content/robot-arm'
```

---

## Other URL Patterns (Not Changed)

These URL patterns are **not user-scoped** and remain unchanged:

| Pattern | Description |
|---------|-------------|
| `/hubs/{slug}` | Hub (community/product/company) |
| `/docs/{siteSlug}` | Documentation site |
| `/learn/{slug}` | Learning path |
| `/contests/{slug}` | Contest |
| `/products/{slug}` | Product |
| `/u/{username}` | User profile |
| `/mirror/{id}` | Federated content mirror |
| `/tags/{slug}` | Content by tag |

---

## Schema

### contentItems Table

```sql
-- Composite unique constraint (replaces old global UNIQUE on slug)
UNIQUE (author_id, type, slug)

-- AP object URI (set on first publish, immutable)
ap_object_id TEXT
```

### Slug Generation

`ensureUniqueSlugFor()` scopes uniqueness by `(authorId, type)` for content items. Other tables (hubs, docs, products, learning) retain global slug uniqueness.
