# @commonpub/shell

A minimal **in-monorepo** app that extends the local `layers/base` directly.
It exists as a lightweight smoke/harness target (the smallest possible app
that boots the full layer) — it is **not** a copy-out starter.

> To create a real standalone CommonPub instance, use the scaffolder:
> `npx create-commonpub` (or `tools/create-commonpub`). That generates a
> thin app that extends the **published** `@commonpub/layer` npm package,
> with a pinned Dockerfile, migration runner, and one-click deploy — none
> of which this directory provides.

## What's Here

```
shell/
  nuxt.config.ts           # extends ['../../layers/base'] (monorepo-local path)
  commonpub.config.ts      # Full feature configuration
  server/utils/config.ts   # Server config with env var overrides
  components/SiteLogo.vue  # Custom logo (override example)
```

Because `nuxt.config.ts` extends the layer via a relative path, this
directory only works **inside the monorepo**. Copying it elsewhere will not
build — use `create-commonpub` instead.

## How It Differs from `apps/reference`

| | Shell | Reference |
|---|---|---|
| Purpose | Minimal layer-boot harness | Development/demo app |
| Features | All enabled via config | All enabled + seed data |
| Custom pages | None | Custom homepage, demo content |
| Layer source | Local `../../layers/base` | Local `../../layers/base` |

## Configuration

Features toggle via environment variables in `server/utils/config.ts`:

- `FEATURE_CONTENT`, `FEATURE_SOCIAL`, `FEATURE_HUBS`, etc.
- `INSTANCE_NAME`, `INSTANCE_DOMAIN`, `INSTANCE_DESCRIPTION`
- `AUTH_METHODS` (comma-separated: `email`, `github`, `google`)

## Running

```bash
# From the monorepo root (only supported mode):
pnpm dev:app --filter @commonpub/shell
```
