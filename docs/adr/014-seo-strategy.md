# ADR-014: SEO Strategy

## Status

Accepted

## Context

Published content needs proper SEO for discoverability — Open Graph, Twitter Cards, JSON-LD, canonical URLs, and sitemaps.

## Decision

### Reusable SeoHead Component

- `SeoHead.svelte` renders `<svelte:head>` with title, description, OG meta, Twitter Cards, and JSON-LD
- Accepts props: `title`, `description`, `type`, `url`, `image`, `author`, `publishedAt`, `updatedAt`
- Used on all content detail pages and listing pages

### JSON-LD Types

- **Article**: for blog, article, and explainer content types
- **HowTo**: for project content type (includes estimated cost, build time)
- Embedded as `<script type="application/ld+json">` in `<head>` via `useHead()`

### Canonical URLs

- Pattern: `https://{domain}/{type}/{slug}`
- Set via `<link rel="canonical">` in SeoHead
- Type maps to URL segment: project→projects, article→articles, guide→guides, blog→blog

### Sitemap

- Generated at `/sitemap.xml` by querying all published content
- Includes `<lastmod>` from `updatedAt`
- Referenced from `/robots.txt`

## Consequences

- All published content has proper Open Graph previews for social sharing
- Search engines get structured data (Article/HowTo) for rich results
- Canonical URLs prevent duplicate content issues
- Sitemap enables efficient crawling
