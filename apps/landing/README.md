# Landing Page

Static marketing site for Snaplify, built with SvelteKit and `adapter-static`.

## Overview

Lightweight static site that introduces Snaplify to potential users and instance operators. Pre-rendered at build time with zero JavaScript runtime dependencies.

## Routes

| Route              | Description                                     |
| ------------------ | ----------------------------------------------- |
| `/`                | Hero, features overview, CTA                    |
| `/features`        | Detailed feature breakdown                      |
| `/getting-started` | Quick start guide for new instance operators     |

## Getting Started

```bash
# From the monorepo root
pnpm install
pnpm build
cd apps/landing && pnpm preview
```

## Features

- Pre-rendered to static HTML via `@sveltejs/adapter-static`
- Uses `@snaplify/ui` components and theme CSS
- OpenGraph meta tags on all pages
- Accessible (axe-core tested, WCAG 2.1 AA)
- No hardcoded colors, all CSS custom properties with fallbacks

## Scripts

```bash
pnpm dev          # Dev server with HMR
pnpm build        # Static build to build/
pnpm preview      # Preview the static build
pnpm test         # Unit tests
pnpm typecheck    # Type-check with svelte-check
pnpm lint         # Lint with ESLint
```

## Dependencies

- `@snaplify/ui`: Components and theme CSS
- `@sveltejs/adapter-static`: Static site generation
