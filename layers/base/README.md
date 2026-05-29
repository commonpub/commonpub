# @commonpub/layer

Shared Nuxt 3 layer that provides the complete CommonPub application — pages, components, composables, server routes, plugins, and theme CSS. This is the primary way to build a CommonPub-powered site.

## Installation

```bash
npm install @commonpub/layer
```

In your `nuxt.config.ts`:

```ts
export default defineNuxtConfig({
  extends: ['@commonpub/layer'],
});
```

## Configuration

Create a `commonpub.config.ts` in your project root:

```ts
import { defineCommonPubConfig } from '@commonpub/config';

export default defineCommonPubConfig({
  instance: {
    name: 'My Community',
    domain: 'example.com',
    contentTypes: ['project', 'blog', 'explainer'],
  },
  features: {
    content: true,
    social: true,
    hubs: true,
    docs: true,
    learning: true,
    admin: true,
  },
  auth: {
    emailPassword: true,
  },
});
```

> `article` is a deprecated alias that normalises to `blog` on write (session 116); use `blog`, `project`, or `explainer` for new content (CLAUDE.md rule #6).

Create `server/utils/config.ts` to load the config on the server side. See `apps/reference/server/utils/config.ts` for a complete example with environment variable overrides.

## What's Included

### Pages (90 routes)

Content CRUD (projects/blogs/explainers), hub feeds (community/product/company), learning paths, docs sites, contests, events, messages, notifications, search, user profiles, federation, **admin panel** (users, content, reports, settings, theme editor at `/admin/theme/edit/[id]`, layout editor at `/admin/layouts/[id]`), and more.

### Components (123)

Content editor (`CpubEditor`), content cards, author rows, comment sections, engagement bars, federation UI, notification items, message threads, **17 block renderers** (`BlockHero`, `BlockHeading`, `BlockCallout`, `BlockEmbedView`, `BlockMarkdownView`, etc.), homepage section renderers, the **layout-editor admin chrome** (`AdminLayoutsToolbar`, `AdminLayoutsCanvas`, `AdminLayoutsPalette`, `AdminLayoutsInspector`, `AdminLayoutsConflictModal`), and the `<LayoutSlot>` renderer that arranges existing components per the layout engine.

### Composables (27)

| Composable | Purpose |
|---|---|
| `useAuth` | Better Auth session + identity |
| `useFeatures` | Reactive feature-flag lookup |
| `useBlockEditor` / `useContentSave` | TipTap block editor + save lifecycle |
| `useEngagement` | Likes, comments, bookmarks |
| `useFederation` / `useMirrorContent` | AP discovery + mirrored content |
| `useMessages` / `useNotifications` | Realtime SSE streams |
| `useTheme` | Dark/light + branded theme switch (cookie-persisted, no flash) |
| `useAdminSidebar` | Desktop sidebar collapse + mobile drawer (session 161) |
| `useEditorChrome` | Layout-editor palette + inspector visibility (session 161) |
| `useLayoutEditor` / `useLayoutAutoSave` | Layout draft state, single-flight save, conflict throttle, pagehide beacon, version-counter dirty (sessions 160-162) |
| `useLayout` | Public layout resolution via `<LayoutSlot>` |

### Server (90+ Nitro API routes)

API routes for all CommonPub features, auth middleware (`requireAdmin`, `requireFeature`), federation endpoints (Fedify-mounted), per-feature audit logging (`cpub.audit.*`), layout-engine CRUD at `/api/admin/layouts/*` (gated on `features.admin` + `features.layoutEngine`), and Nitro plugins for identity startup + feature-flag override.

### Layout engine + section registry

The layout engine ships a 12-column zone/row/section model with a section registry at `layers/base/sections/registry.ts`:

- **17 built-in sections** (`hero`, `heading`, `paragraph`, `image`, `content-feed`, `cta`, `learning`, `divider`, etc.). Each is a `SectionDefinition` pointing at an EXISTING `Block*` or `Homepage*` component via `propMap` — the engine ARRANGES, it doesn't render parallel renderers (see `feedback-reuse-existing-components`).
- **Per-section Zod schemas** in `@commonpub/schema/src/sectionConfigs.ts` (session 161) — enforced server-side at the layout API boundary with `cpub.audit.layout.config-rejected` audit logging.
- **Database tables** `layouts` / `layout_rows` / `layout_sections` / `layout_versions` (migration 0005). Layouts are instance-local — they NEVER federate via `@commonpub/protocol` per ADR 027.
- **Editor** at `/admin/layouts` (list) + `/admin/layouts/[id]` (3-column shell: palette / canvas / inspector). Auto-save 1.5s debounce + If-Match optimistic concurrency + 3-option conflict modal + cascade-throttle banner.

### Theme

CSS custom properties (`var(--*)` only — CLAUDE.md rule #3). Four user-selectable themes (`base`, `dark`, `agora`, `agora-dark`) plus structural CSS modules (`components.css`, `prose.css`, `editor-panels.css`, `forms.css`, `layouts.css`, `generics.css`). Admins can also create custom DB-stored themes via the theme editor at `/admin/theme` (session 154-156). Consumer apps override with their own `theme.css` and can shadow components for branding.

## Customization

The layer is designed to be extended:

- **Override components**: Place a component with the same name in your app's `components/` directory
- **Override pages**: Place a page at the same route path in your app's `pages/` directory
- **Custom theme**: Add CSS custom property overrides in your app's assets
- **Feature flags**: Enable/disable features via `commonpub.config.ts`

## Dependencies

This layer depends on all `@commonpub/*` packages:

- `@commonpub/schema` — Database tables and validators
- `@commonpub/config` — Configuration and feature flags
- `@commonpub/server` — Business logic
- `@commonpub/auth` — Authentication
- `@commonpub/protocol` — ActivityPub federation
- `@commonpub/ui` — Headless UI components
- `@commonpub/editor` — TipTap block editor
- `@commonpub/docs` — Documentation module
- `@commonpub/learning` — Learning path engine

## License

AGPL-3.0-or-later
