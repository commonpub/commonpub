/**
 * Built-in section definition: video.
 *
 * Phase 6b addition (session 159). Embeds a local video file OR a
 * YouTube/Vimeo player. URL routing happens in the renderer via
 * `utils/embedUrl.toEmbedUrl` (which already covers YouTube, Vimeo,
 * passthrough for unknown http(s) hosts).
 *
 * **Local files** (URLs ending in `.mp4`/`.webm`/`.ogg` or paths starting
 * with `/`): rendered as native `<video controls preload="metadata">`.
 * **Embedded providers**: rendered as `<iframe>` with sandbox restrictions.
 *
 * URL guard: http(s) or relative path only. javascript:/data:/vbscript:
 * rejected at write time.
 */
import { z } from 'zod';
import type { SectionDefinition } from '@commonpub/ui';
import SectionVideo from '../../components/sections/SectionVideo.vue';

const SAFE_VIDEO_URL = /^(https?:\/\/|\/)/i;

const configSchema = z.object({
  heading: z.string().max(120).default(''),
  // Empty allowed (defaultConfig + initial admin add). When non-empty,
  // must be http(s) or relative — javascript:, data:, vbscript: etc rejected.
  src: z.string().max(2048).refine((s) => s === '' || SAFE_VIDEO_URL.test(s), {
    message: 'src must be http(s) URL (YouTube/Vimeo/etc) or relative (/) for local file',
  }).default(''),
  title: z.string().max(240).default(''),
  aspectRatio: z.enum(['16/9', '4/3', '1/1', '9/16']).default('16/9'),
  autoplay: z.boolean().default(false),
});

export const videoSection: SectionDefinition<z.infer<typeof configSchema>> = {
  type: 'video',
  name: 'Video',
  description: 'YouTube / Vimeo embed OR local video file',
  icon: 'fa-film',
  category: 'content',
  status: 'stable',
  configSchema,
  defaultConfig: {
    heading: '',
    src: '',
    title: '',
    aspectRatio: '16/9',
    autoplay: false,
  },
  schemaVersion: 1,
  component: SectionVideo,
  minColSpan: 6,
  maxColSpan: 12,
  defaultColSpan: 12,
  resizable: true,
};
