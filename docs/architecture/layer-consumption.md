# CommonPub Layer Consumption Architecture

## How It Works Today

The monorepo has:
```
commonpub/
  layers/base/         # Shared Nuxt layer (165 pages, 100+ components, composables, server routes)
  packages/ui/theme/   # CSS design tokens (base.css, dark.css, components.css, etc.)
  packages/server/     # Business logic (video, contest, messaging, federation, etc.)
  apps/reference/      # Thin shell that extends layers/base
```

The reference app consumes the layer via `extends: ['../../layers/base']`. deveco-io currently has its own full copy of everything.

## Target State

```
commonpub/
  layers/base/         # → published as @commonpub/layer (npm)
  packages/ui/         # → bundled INTO the layer (not separate npm package)
  packages/server/     # → stays as @commonpub/server (npm, used by layer internally)

deveco-io/             # → thin app that extends @commonpub/layer
  nuxt.config.ts       # extends: ['@commonpub/layer']
  commonpub.config.ts  # feature flags, site name, content types
  server/utils/config.ts  # reads commonpub.config
  components/SiteLogo.vue # branded logo
  assets/theme.css     # CSS variable overrides
  pages/index.vue      # custom homepage (optional)
  pages/about.vue      # custom about page (optional)
```

## What @commonpub/layer Contains

The published npm package includes:
- `nuxt.config.ts` — loads CSS from bundled theme, sets default runtimeConfig
- `components/` — all 100+ components (auto-imported by Nuxt)
- `composables/` — all 17 composables (auto-imported)
- `pages/` — all 65+ pages (file-based routing, Nuxt merges with app)
- `layouts/` — default, admin, auth, editor
- `server/` — all Nitro server routes + utils
- `middleware/` — auth middleware
- `plugins/` — auth plugin
- `types/` — shared TypeScript types
- CSS theme files (bundled)

## What an Instance Provides (Minimum Viable)

```
my-instance/
  nuxt.config.ts          # extends + runtimeConfig
  commonpub.config.ts     # feature flags
  server/utils/config.ts  # reads config (required — Nitro dedup issue)
  components/SiteLogo.vue # your branded logo
  .env                    # secrets (DB, auth, email, storage)
```

That's it — 4 files + env = a working instance.

## Customization Tiers

### Tier 1: Config Only (no code)
Set feature flags and env vars. Get the full platform with your name on it.

```ts
// commonpub.config.ts
export default {
  siteName: 'My Community',
  siteUrl: 'https://my-community.com',
  features: {
    hubs: true,
    learning: false,
    video: true,
    contests: false,
    federation: true,
  },
  contentTypes: ['project', 'blog'],
};
```

### Tier 2: Branding (CSS variables)
Override design tokens for colors, typography, shape.

```css
/* assets/theme.css */
:root {
  --accent: #00e7ad;
  --font-sans: 'Poppins', system-ui, sans-serif;
  --radius: 6px;
  --border-width-default: 1px;
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
}
```

This single file controls the visual feel of ALL 163 components and pages. Sharp corners + 2px offset shadows (commonpub) vs rounded + soft shadows (deveco) — just by changing 4 CSS variables.

### Tier 3: Component Override (replace specific components)
Nuxt's layer system merges by path. To override a component, place a file at the same path:

```
my-instance/
  components/ContentCard.vue  # your custom card replaces the layer's
```

### Tier 4: Page Override (replace specific pages)
Same principle:

```
my-instance/
  pages/index.vue   # custom homepage
  pages/about.vue   # custom about page
```

Layer pages are still available for non-overridden routes.

## The UI Package Question

**Decision: Bundle theme CSS into the layer. Do NOT publish @commonpub/ui separately.**

Why:
- The theme CSS is tightly coupled to the layer's components (class names, variable usage)
- Versioning them separately creates a combinatorial compatibility matrix
- Instances don't need to import theme CSS manually — the layer handles it
- The layer's `nuxt.config.ts` imports all theme files; instances just add their override CSS

The `packages/ui/` directory continues to exist in the monorepo for organization, but it's consumed by the layer at build time, not published independently.

## CLI: `create-commonpub`

```bash
npx create-commonpub my-community
```

### What it does:

1. **Scaffold** — creates project directory with:
   - `package.json` (with `@commonpub/layer` dependency)
   - `nuxt.config.ts` (extends layer, default runtimeConfig)
   - `commonpub.config.ts` (feature flags with interactive prompts)
   - `server/utils/config.ts` (reads config)
   - `components/SiteLogo.vue` (placeholder)
   - `assets/theme.css` (empty, with commented examples)
   - `.env.example` (all required vars)
   - `Dockerfile` + `docker-compose.yml` (production-ready)
   - `.github/workflows/deploy.yml` (CI/CD template)
   - `tsconfig.json`

2. **Interactive prompts**:
   - Site name?
   - Site URL?
   - Which features? (checkboxes: hubs, learning, video, contests, docs, federation)
   - Which content types? (checkboxes: project, article, blog, explainer)
   - Database? (local postgres / managed DO / other)
   - Storage? (local filesystem / S3 / DO Spaces)
   - Email? (console / SMTP / Resend)

3. **Post-scaffold**:
   - `pnpm install`
   - Print getting-started instructions

### Update path:
```bash
pnpm update @commonpub/layer
```
That's it. All pages, components, server routes update. Custom overrides are preserved because they're in the app, not the layer.

## Migration: deveco-io → layer consumer

1. Delete all files that are identical to the layer (55 IDENTICAL + 53 BORDER/SHADOW files that now auto-theme)
2. Keep: DevEcoLogo, deveco-theme.css, branded pages (index, about, create), branded layouts (auth, default)
3. Keep: commonpub.config.ts, server/utils/config.ts, Docker/deploy files
4. Add: `extends: ['@commonpub/layer']` to nuxt.config
5. Delete: all composables, all server routes (inherited from layer)
6. Delete: all hub components, all editor components, all block components (inherited)
7. Result: ~20 files instead of ~200

## Border-Width Theming (completed session 096)

All 698 hardcoded `border: 2px solid` declarations across 163 files have been replaced with `border: var(--border-width-default) solid`. The base theme defines `--border-width-default: 2px`. deveco's theme overrides it to `1px`. This means:

- commonpub.io: sharp 2px borders (unchanged visual)
- deveco.io: soft 1px borders (automatic when consuming layer)
- Any new instance: choose your border width in theme.css

Same principle applies to `--radius` (0px vs 6px) and `--shadow-*` (offset vs blur).
