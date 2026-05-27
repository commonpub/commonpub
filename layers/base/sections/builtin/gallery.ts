/**
 * Built-in section definition: gallery.
 *
 * Phase 6b addition (session 159). Responsive image grid, 2-5 columns.
 *
 * No lightbox in v1 — that's tracked for Phase 10 polish (the OSS
 * lightbox libs vary in a11y quality + bundle size; we'll pick + ship
 * separately once the section is in use). For now, images are plain
 * `<img>` tags with optional click-to-enlarge via the lightbox-data-
 * attribute hook (`data-lightbox-id` on each img + a future global
 * lightbox composable).
 *
 * URL guards: src + href validated at write time same as the image
 * section pattern. javascript:/data:/vbscript:/file: rejected.
 */
import { z } from 'zod';
import type { SectionDefinition } from '@commonpub/ui';
import SectionGallery from '../../components/sections/SectionGallery.vue';

// Match image.ts's SAFE_SRC + SAFE_HREF (defence in depth)
const SAFE_IMG_SRC = /^(https?:\/\/|\/)/i;
const SAFE_LINK_URL = /^(https?:\/\/|\/|#|mailto:|tel:|$)/i;

const itemSchema = z.object({
  src: z.string().min(1).max(2048).regex(SAFE_IMG_SRC, {
    message: 'src must be http(s) or relative (/)',
  }),
  alt: z.string().max(240).default(''),
  caption: z.string().max(240).default(''),
  href: z.string().max(2048).regex(SAFE_LINK_URL, {
    message: 'href must be http(s), relative, hash, mailto:, tel: or empty',
  }).default(''),
});

const configSchema = z.object({
  heading: z.string().max(120).default(''),
  columns: z.union([z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).default(3),
  aspectRatio: z.enum(['square', '4/3', '16/9', '3/4', 'auto']).default('square'),
  // Capped at 20 — beyond that, paginate or use content-feed
  items: z.array(itemSchema).max(20).default([]),
});

export const gallerySection: SectionDefinition<z.infer<typeof configSchema>> = {
  type: 'gallery',
  name: 'Gallery',
  description: 'Image grid with 2-5 responsive columns',
  icon: 'fa-images',
  category: 'content',
  status: 'stable',
  configSchema,
  defaultConfig: {
    heading: '',
    columns: 3,
    aspectRatio: 'square',
    items: [],
  },
  schemaVersion: 1,
  component: SectionGallery,
  minColSpan: 6,
  maxColSpan: 12,
  defaultColSpan: 12,
  resizable: true,
};
