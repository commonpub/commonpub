# Docs Server Module

> Server-side functions for documentation sites, versioned pages, navigation, and full-text search.

**Source**: `packages/server/src/docs.ts`

---

## Exports

| Category | Functions |
|----------|-----------|
| Site CRUD | `listDocsSites`, `getDocsSiteBySlug`, `createDocsSite`, `updateDocsSite`, `deleteDocsSite` |
| Version Management | `createDocsVersion`, `setDefaultVersion`, `deleteDocsVersion` |
| Page Management | `listDocsPages`, `getDocsPage`, `createDocsPage`, `updateDocsPage`, `deleteDocsPage`, `reorderDocsPages` |
| Navigation | `getDocsNav`, `updateDocsNav` |
| Search | `searchDocsPages` |

All functions are async and accept `db: DB` as their first parameter.

---

## API Reference

### Site CRUD

#### `listDocsSites(db, filters?)`

List documentation sites with optional filtering.

| Param | Type | Description |
|-------|------|-------------|
| `db` | `DB` | Database connection |
| `filters` | `object?` | Optional filters |
| `filters.ownerId` | `string?` | Filter by site owner |

**Returns**: `{ items, total }`

---

#### `getDocsSiteBySlug(db, slug)`

Fetch a documentation site by its URL slug.

| Param | Type | Description |
|-------|------|-------------|
| `db` | `DB` | Database connection |
| `slug` | `string` | Site URL slug |

**Returns**: Site detail or `null`

---

#### `createDocsSite(db, ownerId, input)`

Create a new documentation site. Automatically creates an initial `v1.0.0` version.

| Param | Type | Description |
|-------|------|-------------|
| `db` | `DB` | Database connection |
| `ownerId` | `string` | Owner user ID |
| `input` | `object` | Site payload (title, slug, description, etc.) |

**Returns**: Site record

---

#### `updateDocsSite(db, siteId, ownerId, input)`

Update a documentation site. Only the owner may update.

| Param | Type | Description |
|-------|------|-------------|
| `db` | `DB` | Database connection |
| `siteId` | `string` | Site ID |
| `ownerId` | `string` | Requesting user ID |
| `input` | `object` | Fields to update |

**Returns**: Updated site record

---

#### `deleteDocsSite(db, siteId, ownerId)`

Delete a documentation site and all its versions and pages.

| Param | Type | Description |
|-------|------|-------------|
| `db` | `DB` | Database connection |
| `siteId` | `string` | Site ID |
| `ownerId` | `string` | Requesting user ID |

**Returns**: `boolean`

---

### Version Management

#### `createDocsVersion(db, siteId, ownerId, version, copyFromVersionId?)`

Create a new version for a documentation site. Optionally copies all pages from an existing version, allowing authors to branch documentation for a new release without starting from scratch.

| Param | Type | Description |
|-------|------|-------------|
| `db` | `DB` | Database connection |
| `siteId` | `string` | Site ID |
| `ownerId` | `string` | Requesting user ID |
| `version` | `string` | Version string (e.g. `"v2.0.0"`) |
| `copyFromVersionId` | `string?` | Source version ID to copy pages from |

**Returns**: Version record

---

#### `setDefaultVersion(db, versionId, ownerId)`

Set a version as the default for its site. Unsets the default flag on all other versions of the same site.

| Param | Type | Description |
|-------|------|-------------|
| `db` | `DB` | Database connection |
| `versionId` | `string` | Version ID to make default |
| `ownerId` | `string` | Requesting user ID |

**Returns**: `void`

---

#### `deleteDocsVersion(db, versionId, ownerId)`

Delete a version and all its pages.

| Param | Type | Description |
|-------|------|-------------|
| `db` | `DB` | Database connection |
| `versionId` | `string` | Version ID |
| `ownerId` | `string` | Requesting user ID |

**Returns**: `boolean`

---

### Page Management

#### `listDocsPages(db, versionId)`

List all pages in a version, ordered by `sortOrder`.

| Param | Type | Description |
|-------|------|-------------|
| `db` | `DB` | Database connection |
| `versionId` | `string` | Version ID |

**Returns**: Ordered page list

---

#### `getDocsPage(db, pageId)`

Fetch a single page by ID.

| Param | Type | Description |
|-------|------|-------------|
| `db` | `DB` | Database connection |
| `pageId` | `string` | Page ID |

**Returns**: Page detail

---

#### `createDocsPage(db, versionId, ownerId, input)`

Create a new page within a version.

| Param | Type | Description |
|-------|------|-------------|
| `db` | `DB` | Database connection |
| `versionId` | `string` | Parent version ID |
| `ownerId` | `string` | Requesting user ID |
| `input` | `object` | Page payload (title, slug, content, parentId, etc.) |

**Returns**: Page record

---

#### `updateDocsPage(db, pageId, ownerId, input)`

Update a page.

| Param | Type | Description |
|-------|------|-------------|
| `db` | `DB` | Database connection |
| `pageId` | `string` | Page ID |
| `ownerId` | `string` | Requesting user ID |
| `input` | `object` | Fields to update |

**Returns**: Updated page record

---

#### `deleteDocsPage(db, pageId, ownerId)`

Delete a page.

| Param | Type | Description |
|-------|------|-------------|
| `db` | `DB` | Database connection |
| `pageId` | `string` | Page ID |
| `ownerId` | `string` | Requesting user ID |

**Returns**: `boolean`

---

#### `reorderDocsPages(db, versionId, ownerId, orderedIds)`

Set the display order of pages within a version.

| Param | Type | Description |
|-------|------|-------------|
| `db` | `DB` | Database connection |
| `versionId` | `string` | Version ID |
| `ownerId` | `string` | Requesting user ID |
| `orderedIds` | `string[]` | Page IDs in desired order |

**Returns**: `void`

---

### Navigation

#### `getDocsNav(db, versionId)`

Get the navigation structure for a version. The structure is stored as JSONB and represents the sidebar tree.

| Param | Type | Description |
|-------|------|-------------|
| `db` | `DB` | Database connection |
| `versionId` | `string` | Version ID |

**Returns**: Navigation structure (JSONB)

---

#### `updateDocsNav(db, versionId, ownerId, structure)`

Replace the navigation structure for a version.

| Param | Type | Description |
|-------|------|-------------|
| `db` | `DB` | Database connection |
| `versionId` | `string` | Version ID |
| `ownerId` | `string` | Requesting user ID |
| `structure` | `object` | New navigation tree |

**Returns**: `void`

---

### Search

#### `searchDocsPages(db, query, siteSlug?)`

Full-text search across documentation pages. Uses the configured search adapter -- Meilisearch when available, falling back to Postgres FTS.

| Param | Type | Description |
|-------|------|-------------|
| `db` | `DB` | Database connection |
| `query` | `string` | Search query |
| `siteSlug` | `string?` | Optional site slug to scope results |

**Returns**: Search results
