# Reference App Architecture (Nuxt 3)

## Principle
Thin shell composing @commonpub/* libraries. Zero inline business logic in server routes, zero inline styling in pages.

## Directory Structure
```
apps/reference/
  nuxt.config.ts
  app.vue
  layouts/
    default.vue          — Sidebar + topbar
    auth.vue             — Minimal for auth pages
  pages/
    index.vue            — Homepage/feed
    feed.vue             — Activity feed
    search.vue           — Search + filters
    create.vue           — Content creation
    dashboard.vue        — User dashboard
    [type]/
      index.vue          — Content listings
      [slug].vue         — Content view
      [slug]/edit.vue    — Content editor
    communities/         — Community system
    docs/                — Documentation
    learn/               — Learning paths
    admin/               — Admin panel
    u/[username].vue     — User profiles
    auth/
      login.vue
      register.vue
      federated.vue
  server/
    middleware/
      auth.ts            — @commonpub/auth
      security.ts        — Rate limiting
    api/
      content/           — CRUD → @commonpub/server
      social/            — Likes, comments
      communities/       — Management
      admin/             — Admin endpoints
    routes/
      .well-known/
        webfinger.ts     — @commonpub/protocol
        nodeinfo.ts
      nodeinfo/2.1.ts
      users/[username].ts
      users/[username]/inbox.ts
      users/[username]/outbox.ts
      inbox.ts           — Shared inbox
  composables/
    useAuth.ts
    useTheme.ts
    useEditor.ts
  plugins/
    auth.ts
```

## Key Rules
- Server API handlers call @commonpub/server — no inline business logic
- Pages compose @commonpub/ui components — no inline styling
- useSeoMeta() on every page
- SSR by default, static for docs
- The app is a template users can clone and customize
