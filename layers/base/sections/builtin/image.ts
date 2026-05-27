/**
 * Built-in section definition: image.
 *
 * Stage E.1 — reuses BlockImageView (`layers/base/components/blocks/
 * BlockImageView.vue`) which renders `<figure>` with size preset +
 * caption + lazy loading. Same image-rendering treatment as block-
 * embedded images in articles/blogs.
 *
 * Config matches BlockImageView's content contract: `{src, alt,
 * caption, size}`. My pre-Stage-E section had `{src, alt, caption,
 * href, fit, aspectRatio}` — dropped `href`/`fit`/`aspectRatio` to
 * align with the Block contract (which uses a `size` preset
 * 's'/'m'/'l'/'full' for width capping instead).
 *
 * URL guard kept on `src` — admin-set fields render to ALL visitors
 * + javascript: in img src doesn't execute but disallowing is hygiene.
 */
import { z } from 'zod';
import type { SectionDefinition } from '@commonpub/ui';
import BlockImageView from '../../components/blocks/BlockImageView.vue';

const SAFE_IMAGE_URL = /^(?:$|https?:\/\/|\/)/i;

const configSchema = z.object({
  src: z.string().max(2048).regex(SAFE_IMAGE_URL, {
    message: 'src must be http(s) or relative (/)',
  }).default(''),
  alt: z.string().max(240).default(''),
  caption: z.string().max(480).default(''),
  size: z.enum(['s', 'm', 'l', 'full']).default('l'),
});

export const imageSection: SectionDefinition<z.infer<typeof configSchema>> = {
  type: 'image',
  name: 'Image',
  description: 'Single image with caption (uses BlockImageView)',
  icon: 'fa-image',
  category: 'content',
  status: 'stable',
  configSchema,
  defaultConfig: { src: '', alt: '', caption: '', size: 'l' },
  schemaVersion: 1,
  component: BlockImageView,
  propMap: ({ config }) => ({ content: config }),
  minColSpan: 3,
  maxColSpan: 12,
  defaultColSpan: 12,
  resizable: true,
};
