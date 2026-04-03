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
    contentTypes: ['project', 'article', 'blog', 'explainer'],
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
    methods: ['email'],
  },
});
```

Create `server/utils/config.ts` to load the config on the server side. See `apps/shell/server/utils/config.ts` for a complete example with environment variable overrides.

## What's Included

### Pages (20+ routes)

Content CRUD, hub feeds, learning paths, docs sites, admin panel, federation management, user profiles, messaging, notifications, search, and more.

### Components (30+)

Content editor (`CpubEditor`), content cards, author rows, comment sections, engagement bars, federation UI, notification items, message threads, and more.

### Composables (19)

`useAuth`, `useFeatures`, `useBlockEditor`, `useContentSave`, `useEngagement`, `useFederation`, `useMessages`, `useNotifications`, `useTheme`, and more.

### Server

API routes for all CommonPub features, auth middleware, federation endpoints, and Nitro plugins.

### Theme

CSS custom properties with 4 built-in themes (base, deepwood, hackbuild, deveco). Override with your own `theme.css`.

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
