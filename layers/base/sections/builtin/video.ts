/**
 * Built-in section definition: video.
 *
 * Stage E.2 — reuses BlockVideoView (YouTube/Vimeo embed routing +
 * local file fallback).
 *
 * Schema (incl. URL_MEDIA_OR_EMPTY guard) lives in
 * `@commonpub/schema/sectionConfigs` (session 161 move).
 */
import type { SectionDefinition } from '@commonpub/ui';
import { videoConfigSchema, type VideoConfig } from '@commonpub/schema';
import BlockVideoView from '../../components/blocks/BlockVideoView.vue';

export const videoSection: SectionDefinition<VideoConfig> = {
  type: 'video',
  name: 'Video',
  description: 'YouTube / Vimeo / local file (uses BlockVideoView)',
  icon: 'fa-film',
  category: 'content',
  status: 'stable',
  configSchema: videoConfigSchema,
  defaultConfig: { url: '' },
  schemaVersion: 1,
  component: BlockVideoView,
  propMap: ({ config }) => ({ content: config }),
  minColSpan: 6,
  maxColSpan: 12,
  defaultColSpan: 12,
  resizable: true,
};
