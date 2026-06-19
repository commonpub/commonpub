import { z } from 'zod';

// --- Layout engine validators (session 155+) ----------------------------
// Spec: docs/plans/layout-and-pages.md §3.3. Invariants enforced here:
//   - colSpan 1-12 per breakpoint
//   - sum of colSpans in a row ≤ 12 (validated at the row level)
//   - position numbers unique within each parent
//   - PageMeta required for scope: custom-page; optional for others

const slug64 = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9_-]*$/i, 'Slug must be alphanumeric with - or _');

const colSpan = z.number().int().min(1).max(12);

/** Layout scope — one row per scope key. */
export const layoutScopeSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('route'),
    /** Existing file-routed page like '/', '/blog', '/hubs/[slug]'. */
    path: z.string().min(1).max(512),
  }),
  z.object({
    type: z.literal('virtual'),
    /** Pre-declared virtual surface: footer, 404, error. */
    key: z.enum(['__footer', '__not-found', '__error']),
  }),
  z.object({
    type: z.literal('custom-page'),
    /** Normalized path; conflict-checked against file routes at save. */
    path: z.string().min(1).max(512),
  }),
]);
export type LayoutScope = z.infer<typeof layoutScopeSchema>;

/** Per-page SEO + access metadata. Required for custom-page scope. */
export const pageMetaSchema = z.object({
  title: z.string().min(1).max(256),
  description: z.string().max(2000).optional(),
  // ogImage MUST be an http(s) URL. Zod's plain .url() accepts
  // javascript:, data:, blob:, file: etc — which would render into
  // the `<meta property="og:image">` content attribute and become a
  // downstream vector for social-media scrapers (the URL is also
  // sometimes fetched server-side by SSR proxies). Refining here
  // closes the entire surface at the validation layer. Session 160
  // audit P1. Protocol-relative `//` is rejected by Zod's url()
  // anyway (no scheme); document for clarity.
  ogImage: z.string().url().max(2048).refine(
    (v) => /^https?:\/\//i.test(v),
    { message: 'ogImage must be an http:// or https:// URL' },
  ).optional(),
  noindex: z.boolean().optional().default(false),
  ogType: z.enum(['website', 'article', 'profile']).optional().default('website'),
  /** Server-side render gate. 'public' = anyone, 'members' = authenticated, 'admin' = admin only. */
  access: z.enum(['public', 'members', 'admin']).optional().default('public'),
  /** Which page frame to use — declares the zones available. */
  frame: z
    .enum(['narrow', 'wide', 'two-column', 'three-column', 'sidebar-left', 'sidebar-right'])
    .optional()
    .default('wide'),
});
export type PageMetaInput = z.infer<typeof pageMetaSchema>;

/** Per-section conditional visibility. */
export const sectionVisibilitySchema = z.object({
  roles: z
    .array(z.enum(['anonymous', 'member', 'pro', 'verified', 'staff', 'admin']))
    .optional(),
  features: z.array(z.string().min(1).max(64)).optional(),
  /** Hide entirely below these breakpoints (orthogonal to responsive colSpan). */
  hideAt: z.array(z.enum(['sm', 'md', 'lg'])).optional(),
});
export type SectionVisibility = z.infer<typeof sectionVisibilitySchema>;

/** Responsive colSpan overrides — lg ↦ md ↦ sm ↦ base colSpan. */
export const sectionResponsiveSchema = z.object({
  sm: colSpan.optional(),
  md: colSpan.optional(),
  lg: colSpan.optional(),
});
export type SectionResponsive = z.infer<typeof sectionResponsiveSchema>;

/** A single section — placed in a row, occupies `colSpan` of 12. */
export const layoutSectionSchema = z.object({
  /** UUID. Server-generated on create; preserved across reorders. */
  id: z.string().uuid(),
  /** Order within row, 0-based; renumbered on save. */
  order: z.number().int().min(0),
  /** Registry slug — validated against SECTION_REGISTRY at the API layer. */
  type: slug64.max(128),
  /** Per-type config blob — validated against the section's own Zod schema at write. */
  config: z.record(z.string(), z.unknown()).default({}),
  colSpan: colSpan.default(12),
  responsive: sectionResponsiveSchema.optional(),
  enabled: z.boolean().default(true),
  visibility: sectionVisibilitySchema.optional(),
  /** Per-section-type config schema version; bumped when the type changes shape. */
  schemaVersion: z.number().int().min(1).default(1),
});
export type LayoutSectionInput = z.infer<typeof layoutSectionSchema>;

/** Row-level styling (gap, alignment, background, vertical padding). */
export const layoutRowConfigSchema = z.object({
  gap: z.enum(['none', 'sm', 'md', 'lg']).optional(),
  align: z.enum(['start', 'center', 'stretch']).optional(),
  /** Token reference like 'var(--surface2)'. No literal hex/rgb (rule #3). */
  background: z.string().max(256).optional(),
  paddingY: z.enum(['none', 'sm', 'md', 'lg', 'xl']).optional(),
});
export type LayoutRowConfig = z.infer<typeof layoutRowConfigSchema>;

/** A row groups sections horizontally; sum of colSpans must be ≤ 12. */
export const layoutRowSchema = z
  .object({
    id: z.string().uuid(),
    order: z.number().int().min(0),
    config: layoutRowConfigSchema.optional(),
    // Max 24 sections per row — comfortable headroom for the 12-col
    // grid (12 col / 1-col each = 12 sections natural max; 24 covers
    // multi-row stacking pre-row-split). Bounded to cap payload-bomb
    // DOS from a malicious admin sending 10k sections (audit P2).
    sections: z.array(layoutSectionSchema).max(24).default([]),
  })
  .refine(
    (row) => row.sections.reduce((sum, s) => sum + s.colSpan, 0) <= 12,
    { message: 'Sum of section colSpans in a row must be ≤ 12' },
  )
  .refine(
    (row) => new Set(row.sections.map((s) => s.order)).size === row.sections.length,
    { message: 'Section orders within a row must be unique' },
  );
export type LayoutRowInput = z.infer<typeof layoutRowSchema>;

/** A zone holds an ordered list of rows. */
export const layoutZoneSchema = z
  .object({
    zone: slug64,
    // Max 200 rows per zone — a complex marketing page rarely exceeds
    // 50; 200 is comfortable headroom. Caps payload-bomb DOS (audit P2).
    rows: z.array(layoutRowSchema).max(200).default([]),
  })
  .refine(
    (z) => new Set(z.rows.map((r) => r.order)).size === z.rows.length,
    { message: 'Row orders within a zone must be unique' },
  );
export type LayoutZoneInput = z.infer<typeof layoutZoneSchema>;

// Layout shape — base object kept .omit-able by deferring the cross-field
// refinements. Both `layoutSchema` and `layoutCreateSchema` inline the
// same two refines (kept short on purpose to avoid the Zod-v4 generics
// dance with a helper that the compiler can't infer through).
const layoutBaseObject = z.object({
  id: z.string().uuid().optional(),
  scope: layoutScopeSchema,
  name: z.string().min(1).max(256),
  pageMeta: pageMetaSchema.optional(),
  // Max 16 zones — covers narrow/wide/two-column/three-column/sidebar-*
  // frames + virtual zones (footer, not-found, error) + room for
  // operator-defined frames. Caps payload-bomb DOS (audit P2).
  zones: z.array(layoutZoneSchema).max(16).default([]),
  state: z.enum(['draft', 'published']).default('draft'),
  publishedVersionId: z.string().uuid().optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});

/** The full layout payload (read-side — includes server fields). */
export const layoutSchema = layoutBaseObject
  .refine(
    (l) => l.scope.type !== 'custom-page' || l.pageMeta !== undefined,
    { message: 'pageMeta is required for custom-page scope', path: ['pageMeta'] },
  )
  .refine(
    (l) => new Set(l.zones.map((z) => z.zone)).size === l.zones.length,
    { message: 'Zone slugs must be unique within a layout' },
  );
export type LayoutInput = z.infer<typeof layoutSchema>;

/** Body shape for POST/PUT — server generates UUIDs + renumbers positions + sets timestamps. */
export const layoutCreateSchema = layoutBaseObject
  .omit({ id: true, createdAt: true, updatedAt: true, publishedVersionId: true })
  .refine(
    (l) => l.scope.type !== 'custom-page' || l.pageMeta !== undefined,
    { message: 'pageMeta is required for custom-page scope', path: ['pageMeta'] },
  )
  .refine(
    (l) => new Set(l.zones.map((z) => z.zone)).size === l.zones.length,
    { message: 'Zone slugs must be unique within a layout' },
  );
export type LayoutCreateInput = z.infer<typeof layoutCreateSchema>;
