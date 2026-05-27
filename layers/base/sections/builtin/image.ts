/**
 * Built-in section definition: image.
 *
 * Phase 1c starter. Stores raw URL + alt + optional caption + optional
 * href. The Phase 3e auto-form will swap `src` for an ImageUpload picker
 * via `.describe('image')` — current Zod is a plain URL string so the
 * form generator still produces a usable text input today.
 *
 * Security note: `src` is rendered as-is via `<img>` — sanitisation is
 * caller responsibility (the URL is never reflected into a script
 * context). Custom-HTML / iframe sections are the XSS surface and gate
 * differently (admin-only addRoles in Phase 6b).
 */
import { z } from 'zod';
import type { SectionDefinition } from '@commonpub/ui';
import SectionImage from '../../components/sections/SectionImage.vue';

const configSchema = z.object({
  src: z.string().max(2048).default(''),
  alt: z.string().max(240).default(''),
  caption: z.string().max(480).default(''),
  href: z.string().max(2048).default(''),
  fit: z.enum(['contain', 'cover']).default('contain'),
  aspectRatio: z.enum(['16/9', '4/3', '1/1', 'auto']).default('auto'),
});

export const imageSection: SectionDefinition<z.infer<typeof configSchema>> = {
  type: 'image',
  name: 'Image',
  description: 'Single image with optional caption + link',
  icon: 'fa-image',
  category: 'content',
  status: 'stable',
  configSchema,
  defaultConfig: { src: '', alt: '', caption: '', href: '', fit: 'contain', aspectRatio: 'auto' },
  schemaVersion: 1,
  component: SectionImage,
  minColSpan: 3,
  maxColSpan: 12,
  defaultColSpan: 12,
  resizable: true,
};
