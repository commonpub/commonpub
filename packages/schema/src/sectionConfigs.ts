/**
 * Per-section Zod config schemas — the source-of-truth for what shapes
 * each registered section's `config` blob may take.
 *
 * Lives in `@commonpub/schema` rather than `layers/base/sections/builtin/`
 * so the server's Nitro bundle can import them WITHOUT pulling in the
 * registry, which transitively imports `.vue` component files. The
 * layer's section registry (see `layers/base/sections/registry.ts`)
 * imports from here too so there's exactly one source.
 *
 * Each section ships:
 *   - a named `{type}ConfigSchema` Zod schema (the wire contract)
 *   - a TS type alias inferred from it (consumer convenience)
 *
 * The `SECTION_CONFIG_SCHEMAS` map at the bottom is the canonical
 * type → schema lookup used by `validateSectionConfigs` server-side.
 *
 * Adding a new section:
 *   1. Define + export `{type}ConfigSchema` here
 *   2. Add it to `SECTION_CONFIG_SCHEMAS`
 *   3. Add the section definition in `layers/base/sections/builtin/{type}.ts`
 *      importing the schema from here
 *   4. Register in `layers/base/sections/registry.ts`
 *
 * Provenance: extracted from `layers/base/sections/builtin/*.ts` in
 * session 161 to close R2's deferred per-section validation. Behavior
 * preserved exactly — same `.max()`, `.min()`, `.regex()`, `.default()`
 * chains as the inline versions they replace.
 */
import { z, type ZodType } from 'zod';

// ---------------------------------------------------------------------------
// Shared URL regex constants
//
// Empty-string variants use the explicit `$` branch (NOT empty-alternation
// like `(?:|...|...)`) — empty alternation matches ANY string at position 0,
// which caught a XSS payload accepting `javascript:` in session 158.
// See `feedback-regex-empty-alternation` memory.
// ---------------------------------------------------------------------------

/** Anchor-style link: http(s), root-relative, fragment, mailto, tel. Must be non-empty (paired with .min(1)). */
export const URL_LINK_STRICT = /^(https?:\/\/|\/|#|mailto:|tel:)/i;

/** Anchor-style link OR empty string. */
export const URL_LINK_OR_EMPTY = /^(?:$|https?:\/\/|\/|#|mailto:|tel:)/i;

/** Media src: http(s) or root-relative path or empty. */
export const URL_MEDIA_OR_EMPTY = /^(?:$|https?:\/\/|\/)/i;

/** Strict http(s) only or empty — for embeds where loose paths shouldn't apply. */
export const URL_HTTPS_OR_EMPTY = /^(?:$|https?:\/\/)/i;

// ---------------------------------------------------------------------------
// Layout — divider, heading, paragraph
// ---------------------------------------------------------------------------

export const dividerConfigSchema = z.object({
  variant: z.enum(['solid', 'dashed', 'dotted', 'accent']).default('solid'),
  spacingY: z.enum(['sm', 'md', 'lg', 'xl']).default('md'),
});
export type DividerConfig = z.infer<typeof dividerConfigSchema>;

export const headingConfigSchema = z.object({
  level: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6)]).default(2),
  text: z.string().min(1).max(240).default('Section heading'),
});
export type HeadingConfig = z.infer<typeof headingConfigSchema>;

export const paragraphConfigSchema = z.object({
  html: z.string().max(8000).default('<p>Paragraph body.</p>'),
});
export type ParagraphConfig = z.infer<typeof paragraphConfigSchema>;

// ---------------------------------------------------------------------------
// Content — image, gallery, video, embed, markdown, custom-html
// ---------------------------------------------------------------------------

export const imageConfigSchema = z.object({
  src: z.string().max(2048).regex(URL_MEDIA_OR_EMPTY, { message: 'src must be an http(s) URL, root path, or empty' }).default(''),
  alt: z.string().max(240).default(''),
  caption: z.string().max(480).default(''),
  size: z.enum(['s', 'm', 'l', 'full']).default('l'),
});
export type ImageConfig = z.infer<typeof imageConfigSchema>;

export const galleryImageSchema = z.object({
  src: z.string().max(2048).regex(URL_MEDIA_OR_EMPTY, { message: 'src must be an http(s) URL, root path, or empty' }),
  alt: z.string().max(240).default(''),
  caption: z.string().max(240).default(''),
});
export type GalleryImage = z.infer<typeof galleryImageSchema>;

export const galleryConfigSchema = z.object({
  images: z.array(galleryImageSchema).max(20).default([]),
});
export type GalleryConfig = z.infer<typeof galleryConfigSchema>;

export const videoConfigSchema = z.object({
  url: z.string().max(2048).regex(URL_MEDIA_OR_EMPTY, { message: 'url must be an http(s) URL, root path, or empty' }).default(''),
});
export type VideoConfig = z.infer<typeof videoConfigSchema>;

export const embedConfigSchema = z.object({
  url: z.string().max(2048).regex(URL_HTTPS_OR_EMPTY, { message: 'url must be an http(s) URL or empty' }).default(''),
});
export type EmbedConfig = z.infer<typeof embedConfigSchema>;

export const markdownConfigSchema = z.object({
  source: z.string().max(100_000).default(''),
});
export type MarkdownConfig = z.infer<typeof markdownConfigSchema>;

export const customHtmlConfigSchema = z.object({
  heading: z.string().max(255).default(''),
  html: z.string().max(50_000).default(''),
});
export type CustomHtmlConfig = z.infer<typeof customHtmlConfigSchema>;

// ---------------------------------------------------------------------------
// Interactive — hero, cta
// ---------------------------------------------------------------------------

export const heroCtaSchema = z.object({
  label: z.string().min(1).max(80),
  href: z.string().min(1).max(2048).regex(URL_LINK_STRICT, { message: 'href must be an http(s) URL, root path, anchor, mailto:, or tel:' }),
  variant: z.enum(['primary', 'secondary']).default('primary'),
});
export type HeroCta = z.infer<typeof heroCtaSchema>;

export const heroConfigSchema = z.object({
  variant: z.enum(['default', 'compact', 'centered']).default('default'),
  customTitle: z.string().max(255).default(''),
  customSubtitle: z.string().max(500).default(''),
  ctas: z.array(heroCtaSchema).max(2).default([]),
});
export type HeroConfig = z.infer<typeof heroConfigSchema>;

export const ctaButtonSchema = z.object({
  label: z.string().min(1).max(80),
  href: z.string().min(1).max(2048).regex(URL_LINK_STRICT, { message: 'href must be an http(s) URL, root path, anchor, mailto:, or tel:' }),
  variant: z.enum(['primary', 'secondary', 'ghost']).default('primary'),
});
export type CtaButton = z.infer<typeof ctaButtonSchema>;

export const ctaConfigSchema = z.object({
  variant: z.enum(['default', 'contrast', 'minimal']).default('default'),
  heading: z.string().min(1).max(240).default('Take the next step'),
  body: z.string().max(800).default(''),
  buttons: z.array(ctaButtonSchema).max(3).default([]),
  align: z.enum(['left', 'center']).default('left'),
});
export type CtaConfig = z.infer<typeof ctaConfigSchema>;

// ---------------------------------------------------------------------------
// Data — content-feed, editorial, stats, hubs, contests, learning
// ---------------------------------------------------------------------------

export const contentFeedConfigSchema = z.object({
  heading: z.string().max(120).default(''),
  contentType: z.string().max(64).default(''),
  sort: z.enum(['recent', 'popular', 'featured', 'editorial']).default('recent'),
  limit: z.number().int().min(1).max(24).default(12),
  columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(2),
  categorySlug: z.string().max(64).default(''),
});
export type ContentFeedConfig = z.infer<typeof contentFeedConfigSchema>;

export const editorialConfigSchema = z.object({
  limit: z.number().int().min(1).max(12).default(3),
});
export type EditorialConfig = z.infer<typeof editorialConfigSchema>;

/** Stats has no per-instance config (the section pulls its data from API). */
export const statsConfigSchema = z.object({});
export type StatsConfig = z.infer<typeof statsConfigSchema>;

export const hubsConfigSchema = z.object({
  limit: z.number().int().min(1).max(20).default(4),
});
export type HubsConfig = z.infer<typeof hubsConfigSchema>;

export const contestsConfigSchema = z.object({
  limit: z.number().int().min(1).max(10).default(3),
});
export type ContestsConfig = z.infer<typeof contestsConfigSchema>;

export const learningConfigSchema = z.object({
  heading: z.string().max(120).default('Learning Paths'),
  limit: z.number().int().min(1).max(12).default(6),
  columns: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).default(3),
});
export type LearningConfig = z.infer<typeof learningConfigSchema>;

// ---------------------------------------------------------------------------
// Lookup map — the canonical type → schema map used by
// `validateSectionConfigs` to enforce per-type validation server-side.
// Keep this in sync with the per-section files in
// `layers/base/sections/builtin/*.ts` and the registrations in
// `layers/base/sections/registry.ts`.
// ---------------------------------------------------------------------------

export const SECTION_CONFIG_SCHEMAS: Record<string, ZodType> = {
  // Layout
  divider: dividerConfigSchema,
  heading: headingConfigSchema,
  paragraph: paragraphConfigSchema,
  // Content
  image: imageConfigSchema,
  gallery: galleryConfigSchema,
  video: videoConfigSchema,
  embed: embedConfigSchema,
  markdown: markdownConfigSchema,
  'custom-html': customHtmlConfigSchema,
  // Interactive
  hero: heroConfigSchema,
  cta: ctaConfigSchema,
  // Data
  'content-feed': contentFeedConfigSchema,
  editorial: editorialConfigSchema,
  stats: statsConfigSchema,
  hubs: hubsConfigSchema,
  contests: contestsConfigSchema,
  learning: learningConfigSchema,
};
