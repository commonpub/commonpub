# @commonpub/shell

Starter template for new CommonPub instances. This is the minimal app you need to run a fully-featured CommonPub site.

## What's Here

```
shell/
  nuxt.config.ts           # Extends @commonpub/layer
  commonpub.config.ts      # Full feature configuration
  server/utils/config.ts   # Server config with env var overrides
  components/SiteLogo.vue  # Custom logo (override example)
```

## How to Use

1. Copy this directory as a starting point for your own CommonPub instance
2. Edit `commonpub.config.ts` to set your instance name, domain, and feature flags
3. Replace `SiteLogo.vue` with your own branding
4. Add any custom pages or component overrides

## How It Differs from `apps/reference`

| | Shell | Reference |
|---|---|---|
| Purpose | Starter template | Development/demo app |
| Features | All enabled via config | All enabled + seed data |
| Custom pages | None | Custom homepage, demo content |
| Intended use | Copy and customize | Run the monorepo locally |

## Configuration

All features can be toggled via environment variables in `server/utils/config.ts`:

- `FEATURE_CONTENT`, `FEATURE_SOCIAL`, `FEATURE_HUBS`, etc.
- `INSTANCE_NAME`, `INSTANCE_DOMAIN`, `INSTANCE_DESCRIPTION`
- `AUTH_METHODS` (comma-separated: `email`, `github`, `google`)

See `server/utils/config.ts` for the full list of overrides.

## Running

```bash
# From the monorepo root:
pnpm dev:app --filter @commonpub/shell

# Or standalone (after publishing packages to npm):
pnpm install
pnpm dev
```
