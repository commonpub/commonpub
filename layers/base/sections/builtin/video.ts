/**
 * Built-in section definition: video.
 *
 * Stage E.2 — reuses BlockVideoView (`layers/base/components/blocks/
 * BlockVideoView.vue`) which handles YouTube/Vimeo embed routing
 * + local file fallback. Same video-rendering treatment as block-
 * embedded videos in articles/blogs.
 *
 * Config matches BlockVideoView's content contract: `{url}`.
 * Pre-Stage-E my SectionVideo had `{heading, src, title, aspectRatio,
 * autoplay}` — dropped to follow the Block contract.
 */
import { z } from 'zod';
import type { SectionDefinition } from '@commonpub/ui';
import BlockVideoView from '../../components/blocks/BlockVideoView.vue';

const SAFE_VIDEO_URL = /^(?:$|https?:\/\/|\/)/i;

const configSchema = z.object({
  url: z.string().max(2048).regex(SAFE_VIDEO_URL, {
    message: 'url must be http(s) (YouTube/Vimeo/etc) or relative (/) for local file',
  }).default(''),
});

export const videoSection: SectionDefinition<z.infer<typeof configSchema>> = {
  type: 'video',
  name: 'Video',
  description: 'YouTube / Vimeo / local file (uses BlockVideoView)',
  icon: 'fa-film',
  category: 'content',
  status: 'stable',
  configSchema,
  defaultConfig: { url: '' },
  schemaVersion: 1,
  component: BlockVideoView,
  propMap: ({ config }) => ({ content: config }),
  minColSpan: 6,
  maxColSpan: 12,
  defaultColSpan: 12,
  resizable: true,
};
