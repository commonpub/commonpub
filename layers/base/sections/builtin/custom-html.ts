/**
 * Built-in section definition: custom-html.
 *
 * Phase 1c addition (session 159) — admin-only raw HTML escape hatch.
 *
 * **SECURITY POSTURE** — important. This section renders config.html via
 * `v-html` with NO runtime sanitization, intentionally matching the
 * legacy `CustomHtmlSection.vue` behavior (already shipped in
 * production for the configurable homepage path). The threat model:
 *   - Writes are gated on `requireAdmin(event)` in
 *     `/api/admin/layouts/*` — only trusted admin users can set HTML.
 *   - Even so, a compromised admin account → stored XSS on every
 *     visitor's homepage. Phase 6b will add server-side DOMPurify
 *     sanitization at admin-write time (matching the pattern in
 *     `packages/server/src/content/content.ts:sanitizeBlockContent`)
 *     and an `unsafeHtmlAllowed` instance setting that gates whether
 *     this section type can be saved at all.
 *   - For now: `status: 'beta'` flags the risk to admin-UI consumers.
 *     The 50KB cap is a sanity bound, not a security control.
 *   - Tracked in docs/plans/layout-and-pages.md §6.5 (custom-html
 *     sanitization roadmap).
 *
 * Use this only when no other section type fits.
 */
import { z } from 'zod';
import type { SectionDefinition } from '@commonpub/ui';
import SectionCustomHtml from '../../components/sections/SectionCustomHtml.vue';

const configSchema = z.object({
  heading: z.string().max(120).default(''),
  html: z.string().max(50_000).default(''),
});

export const customHtmlSection: SectionDefinition<z.infer<typeof configSchema>> = {
  type: 'custom-html',
  name: 'Custom HTML',
  description: 'Raw HTML escape hatch — admin-only; see security note in source',
  icon: 'fa-code',
  category: 'content',
  // Beta marks the unsanitised render path; admin UI shows a warning chip
  status: 'beta',
  configSchema,
  defaultConfig: { heading: '', html: '' },
  schemaVersion: 1,
  component: SectionCustomHtml,
  minColSpan: 3,
  maxColSpan: 12,
  defaultColSpan: 12,
  resizable: true,
};
