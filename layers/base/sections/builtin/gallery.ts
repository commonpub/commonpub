/**
 * Built-in section definition: gallery.
 *
 * Stage E.2 — reuses BlockGalleryView (`layers/base/components/blocks/
 * BlockGalleryView.vue`). Same image-grid renderer used by block-system
 * content (articles/blogs with embedded galleries).
 *
 * Config matches BlockGalleryView's content contract: `{images: [...]}`.
 * Pre-Stage-E my SectionGallery had `{heading, columns, aspectRatio,
 * items}` — dropped to follow the Block contract. The visual treatment
 * + lightbox behavior come from BlockGalleryView.
 */
import { z } from 'zod';
import type { SectionDefinition } from '@commonpub/ui';
import BlockGalleryView from '../../components/blocks/BlockGalleryView.vue';

const SAFE_IMG_SRC = /^(?:$|https?:\/\/|\/)/i;

const imageSchema = z.object({
  src: z.string().max(2048).regex(SAFE_IMG_SRC, {
    message: 'src must be http(s) or relative (/)',
  }),
  alt: z.string().max(240).default(''),
  caption: z.string().max(240).default(''),
});

const configSchema = z.object({
  images: z.array(imageSchema).max(20).default([]),
});

export const gallerySection: SectionDefinition<z.infer<typeof configSchema>> = {
  type: 'gallery',
  name: 'Gallery',
  description: 'Image grid (uses BlockGalleryView)',
  icon: 'fa-images',
  category: 'content',
  status: 'stable',
  configSchema,
  defaultConfig: { images: [] },
  schemaVersion: 1,
  component: BlockGalleryView,
  propMap: ({ config }) => ({ content: config }),
  minColSpan: 6,
  maxColSpan: 12,
  defaultColSpan: 12,
  resizable: true,
};
