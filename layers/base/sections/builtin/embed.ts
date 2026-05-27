/**
 * Built-in section definition: embed.
 *
 * Stage E.2 — reuses BlockEmbedView (`layers/base/components/blocks/
 * BlockEmbedView.vue`). Same generic-iframe renderer used by block-
 * system content for tweets, gists, CodePen, etc.
 *
 * Config matches BlockEmbedView's content contract: `{url}`.
 * Pre-Stage-E my SectionEmbed had `{heading, src, title, height}` +
 * a hardcoded host allowlist — dropped to follow the Block contract.
 * The host allowlist + sandbox policy live in BlockEmbedView.
 */
import { z } from 'zod';
import type { SectionDefinition } from '@commonpub/ui';
import BlockEmbedView from '../../components/blocks/BlockEmbedView.vue';

const SAFE_URL = /^(?:$|https?:\/\/)/i;

const configSchema = z.object({
  url: z.string().max(2048).regex(SAFE_URL, {
    message: 'url must be an http(s) URL or empty',
  }).default(''),
});

export const embedSection: SectionDefinition<z.infer<typeof configSchema>> = {
  type: 'embed',
  name: 'Embed',
  description: 'Tweets, gists, CodePen, Loom, etc (uses BlockEmbedView)',
  icon: 'fa-square-arrow-up-right',
  category: 'content',
  status: 'stable',
  configSchema,
  defaultConfig: { url: '' },
  schemaVersion: 1,
  component: BlockEmbedView,
  propMap: ({ config }) => ({ content: config }),
  minColSpan: 6,
  maxColSpan: 12,
  defaultColSpan: 12,
  resizable: true,
};
