/**
 * Built-in section definition: image.
 *
 * Stage E.1 — reuses BlockImageView (`<figure>` with size preset +
 * caption + lazy loading).
 *
 * Schema (incl. URL_MEDIA_OR_EMPTY guard on `src`) lives in
 * `@commonpub/schema/sectionConfigs` (session 161 move).
 */
import type { SectionDefinition } from '@commonpub/ui';
import { imageConfigSchema, type ImageConfig } from '@commonpub/schema';
import BlockImageView from '../../components/blocks/BlockImageView.vue';

export const imageSection: SectionDefinition<ImageConfig> = {
  type: 'image',
  name: 'Image',
  description: 'Single image with caption (uses BlockImageView)',
  icon: 'fa-image',
  category: 'content',
  status: 'stable',
  configSchema: imageConfigSchema,
  defaultConfig: { src: '', alt: '', caption: '', size: 'l' },
  schemaVersion: 1,
  component: BlockImageView,
  propMap: ({ config }) => ({ content: config }),
  minColSpan: 3,
  maxColSpan: 12,
  defaultColSpan: 12,
  resizable: true,
};
