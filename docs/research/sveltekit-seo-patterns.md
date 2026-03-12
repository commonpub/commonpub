# SvelteKit SEO Patterns

## Open Graph + Twitter Cards

Use `<svelte:head>` in page components or a reusable `SeoHead.svelte`:

```svelte
<svelte:head>
  <title>{title} — CommonPub</title>
  <meta name="description" content={description} />
  <meta property="og:title" content={title} />
  <meta property="og:description" content={description} />
  <meta property="og:type" content="article" />
  <meta property="og:url" content={canonicalUrl} />
  <meta property="og:image" content={coverImageUrl} />
  <meta name="twitter:card" content="summary_large_image" />
</svelte:head>
```

## JSON-LD Structured Data

### Article (for blog, article, guide content types)

```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "...",
  "author": { "@type": "Person", "name": "..." },
  "datePublished": "...",
  "dateModified": "...",
  "description": "...",
  "image": "..."
}
```

### HowTo (for project content type)

```json
{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "...",
  "description": "...",
  "estimatedCost": "...",
  "totalTime": "..."
}
```

## Canonical URLs

Pattern: `https://{domain}/{type}/{slug}`

Examples:

- `https://hack.build/projects/led-matrix-display`
- `https://hack.build/blog/getting-started-with-esp32`

## Sitemap Generation

`/sitemap.xml` route queries published content and generates XML:

```typescript
// src/routes/sitemap.xml/+server.ts
export async function GET({ locals }) {
  const items = await db
    .select({ slug, type, updatedAt })
    .from(contentItems)
    .where(eq(status, 'published'));
  const xml = generateSitemapXml(items);
  return new Response(xml, { headers: { 'Content-Type': 'application/xml' } });
}
```

## Conclusion

- Reusable `SeoHead.svelte` component with props for all meta
- JSON-LD for Article (blog/article/guide) and HowTo (project)
- Canonical URLs at `/{type}/{slug}`
- Sitemap at `/sitemap.xml` with all published content
