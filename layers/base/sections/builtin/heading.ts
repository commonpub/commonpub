/**
 * Built-in section definition: heading.
 *
 * Stage E.1 (session 159) — reuses the existing `BlockHeadingView`
 * renderer (`layers/base/components/blocks/BlockHeadingView.vue`)
 * instead of a parallel `SectionHeading.vue`. BlockHeadingView already
 * handles h1-h6 + slug + the layer's typography tokens. propMap adapts
 * our `{config, meta}` shape to its `{content}` shape.
 *
 * Config matches BlockHeadingView's content contract: `{level, text}`.
 * My pre-Stage-E heading section had `align/eyebrow/subline` fields too,
 * but those weren't part of the established Block contract — dropping
 * them keeps a single canonical heading renderer across the block and
 * layout systems.
 *
 * See `feedback-reuse-existing-components` memory + Stage E plan
 * (`docs/plans/stage-e-unification.md`).
 */
import { z } from 'zod';
import type { SectionDefinition } from '@commonpub/ui';
import BlockHeadingView from '../../components/blocks/BlockHeadingView.vue';

const configSchema = z.object({
  level: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6)]).default(2),
  text: z.string().min(1).max(240).default('Section heading'),
});

export const headingSection: SectionDefinition<z.infer<typeof configSchema>> = {
  type: 'heading',
  name: 'Heading',
  description: 'Single h1–h6 heading (uses BlockHeadingView)',
  icon: 'fa-heading',
  category: 'content',
  status: 'stable',
  configSchema,
  defaultConfig: { level: 2, text: 'Section heading' },
  schemaVersion: 1,
  component: BlockHeadingView,
  // BlockHeadingView takes { content: { level, text } } — adapt
  propMap: ({ config }) => ({ content: config }),
  // Heading reads fine narrow; allow as small as quarter-width
  minColSpan: 3,
  maxColSpan: 12,
  defaultColSpan: 12,
  resizable: true,
};
