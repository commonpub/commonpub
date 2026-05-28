/**
 * Built-in section definition: gallery.
 *
 * Stage E.2 — reuses BlockGalleryView (image grid + lightbox).
 *
 * Schema (incl. per-image URL_MEDIA_OR_EMPTY guard + max-20 array bound)
 * lives in `@commonpub/schema/sectionConfigs` (session 161 move).
 */
import type { SectionDefinition } from '@commonpub/ui';
import { galleryConfigSchema, type GalleryConfig } from '@commonpub/schema';
import BlockGalleryView from '../../components/blocks/BlockGalleryView.vue';

export const gallerySection: SectionDefinition<GalleryConfig> = {
  type: 'gallery',
  name: 'Gallery',
  description: 'Image grid (uses BlockGalleryView)',
  icon: 'fa-images',
  category: 'content',
  status: 'stable',
  configSchema: galleryConfigSchema,
  defaultConfig: { images: [] },
  schemaVersion: 1,
  component: BlockGalleryView,
  propMap: ({ config }) => ({ content: config }),
  minColSpan: 6,
  maxColSpan: 12,
  defaultColSpan: 12,
  resizable: true,
};
