/**
 * Built-in section definition: embed.
 *
 * Stage E.2 — reuses BlockEmbedView (generic-iframe renderer). Host
 * allowlist + sandbox policy live in BlockEmbedView.
 *
 * Schema (incl. URL_HTTPS_OR_EMPTY guard — strict http(s) only, no
 * relative-path branch unlike image/video/gallery) lives in
 * `@commonpub/schema/sectionConfigs` (session 161 move).
 */
import type { SectionDefinition } from '@commonpub/ui';
import { embedConfigSchema, type EmbedConfig } from '@commonpub/schema';
import BlockEmbedView from '../../components/blocks/BlockEmbedView.vue';

export const embedSection: SectionDefinition<EmbedConfig> = {
  type: 'embed',
  name: 'Embed',
  description: 'Tweets, gists, CodePen, Loom, etc (uses BlockEmbedView)',
  icon: 'fa-square-arrow-up-right',
  category: 'content',
  status: 'stable',
  configSchema: embedConfigSchema,
  defaultConfig: { url: '' },
  schemaVersion: 1,
  component: BlockEmbedView,
  propMap: ({ config }) => ({ content: config }),
  minColSpan: 6,
  maxColSpan: 12,
  defaultColSpan: 12,
  resizable: true,
};
