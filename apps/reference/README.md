# Reference App

The reference SvelteKit application for Snaplify. Full-featured maker community instance.

## Overview

Demonstrates every Snaplify feature integrated into a production-ready SvelteKit application. Serves as both the primary development target and the template that the `create-snaplify` CLI uses to scaffold new instances.

Uses `@sveltejs/adapter-node` for server-side rendering and dynamic routes.

## Getting Started

```bash
# From the monorepo root
pnpm install
docker compose -f deploy/docker-compose.yml up -d  # Start Postgres, Redis, Meilisearch
cp .env.example .env                                # Configure environment
pnpm build                                          # Build all packages first
pnpm dev                                            # Start dev server
```

Visit `http://localhost:5173`.

## Route Structure

### Public Routes

| Route                              | Description                    |
| ---------------------------------- | ------------------------------ |
| `/`                                | Homepage                       |
| `/auth/sign-in`                    | Sign in                        |
| `/auth/sign-up`                    | Sign up                        |
| `/auth/federated`                  | Federated SSO sign-in          |
| `/certificates/[code]`            | Public certificate verification|

### Content (`(app)` layout group)

| Route                              | Description                    |
| ---------------------------------- | ------------------------------ |
| `/projects`                        | Browse projects                |
| `/articles`                        | Browse articles                |
| `/blog`                            | Browse blog posts              |
| `/[type]/[slug]`                   | View content item              |
| `/[type]/[slug]/edit`              | Edit content item              |
| `/create`                          | Create new content             |

### Explainers

| Route                              | Description                    |
| ---------------------------------- | ------------------------------ |
| `/explainers`                      | Browse explainers              |
| `/explainers/[slug]`               | View/run explainer             |
| `/explainers/[slug]/edit`          | Edit explainer                 |
| `/explainers/create`               | Create new explainer           |

### Learning

| Route                              | Description                    |
| ---------------------------------- | ------------------------------ |
| `/learn`                           | Browse learning paths          |
| `/learn/[slug]`                    | View learning path             |
| `/learn/[slug]/[lessonSlug]`       | Take a lesson                  |
| `/learn/[slug]/edit`               | Edit learning path             |
| `/learn/create`                    | Create learning path           |

### Communities

| Route                              | Description                    |
| ---------------------------------- | ------------------------------ |
| `/communities`                     | Browse communities             |
| `/communities/[slug]`              | View community feed            |
| `/communities/[slug]/members`      | Community members              |
| `/communities/[slug]/settings`     | Community settings             |
| `/communities/create`              | Create community               |

### Documentation

| Route                              | Description                    |
| ---------------------------------- | ------------------------------ |
| `/docs`                            | Browse doc sites               |
| `/docs/[siteSlug]`                 | Doc site landing               |
| `/docs/[siteSlug]/[...pagePath]`   | Read doc page                  |
| `/docs/[siteSlug]/edit`            | Edit doc site                  |
| `/docs/[siteSlug]/edit/[pageId]`   | Edit doc page (CodeMirror)     |
| `/docs/[siteSlug]/edit/nav`        | Edit navigation structure      |
| `/docs/[siteSlug]/edit/versions`   | Manage versions                |
| `/docs/create`                     | Create doc site                |

### Admin

| Route                              | Description                    |
| ---------------------------------- | ------------------------------ |
| `/admin`                           | Admin dashboard                |
| `/admin/users`                     | User management                |
| `/admin/reports`                   | Content reports                |
| `/admin/audit`                     | Audit log                      |
| `/admin/settings`                  | Instance settings              |
| `/admin/settings/theme`            | Theme configuration            |

### Dashboard

| Route                              | Description                    |
| ---------------------------------- | ------------------------------ |
| `/dashboard`                       | User dashboard                 |
| `/dashboard/settings`              | User settings                  |
| `/dashboard/communities`           | My communities                 |
| `/dashboard/docs`                  | My doc sites                   |
| `/dashboard/learning`              | My learning progress           |
| `/dashboard/federation`            | Federation dashboard           |

## Features

- **Content system**: CRUD with block editor, slug generation, draft/publish workflow
- **Social features**: Likes, comments, follows, bookmarks
- **Communities**: Membership, roles, moderation, feeds
- **Learning paths**: Enrollment, progress, certificates
- **Explainers**: Interactive scroll-driven modules
- **Documentation**: CodeMirror editor, versioning, search
- **Federation**: ActivityPub inbox/outbox, 13 AP routes
- **Admin panel**: User management, reports, audit logs
- **Theming**: 4 themes with `data-theme` attribute, SSR flash prevention
- **SEO**: JSON-LD, OpenGraph meta, sitemap
- **Security**: CSP, HSTS, rate limiting, security headers

## Scripts

```bash
pnpm dev          # Start dev server
pnpm build        # Production build
pnpm preview      # Preview production build
pnpm test         # Unit tests
pnpm test:e2e     # E2E tests (Playwright)
pnpm typecheck    # Type-check with svelte-check
pnpm lint         # Lint with ESLint
```

## Dependencies

All `@snaplify/*` packages, plus:

- `drizzle-orm` + `pg`: Database access
- `@codemirror/*`: Docs editor
- `isomorphic-dompurify`: HTML sanitization
- `@sveltejs/adapter-node`: Node.js server adapter
