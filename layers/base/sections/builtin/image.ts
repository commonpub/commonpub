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

/**
 * URL guards — separate for `src` (image fetch) vs `href` (click target).
 *
 * - `src`: http(s) or site-relative. data: rejected (large + tracking
 *   surface; ImageUpload should be the path for inline data). javascript:
 *   in <img src> doesn't execute in modern browsers, but disallow anyway
 *   for consistency.
 * - `href`: http(s), site-relative, hash, mailto:, tel:. javascript:
 *   would execute on click — admin-set fields render to ALL visitors so
 *   this is a stored XSS surface without the regex.
 *
 * Both allow EMPTY string (the section's "no image yet" / "no link"
 * state). The `^(?:$|…)` shape matches empty-string only when the
 * `$` end-of-string anchor immediately follows `^` — pinned by tests
 * because the obvious `^(?:|…)` would have an empty alternation
 * branch that matches ANY input (the empty match always succeeds at
 * position 0).
 */
const SAFE_IMAGE_URL = /^(?:$|https?:\/\/|\/)/i;
const SAFE_LINK_URL = /^(?:$|https?:\/\/|\/|#|mailto:|tel:)/i;

const configSchema = z.object({
  src: z.string().max(2048).regex(SAFE_IMAGE_URL, {
    message: 'src must be http(s) or relative (/)',
  }).default(''),
  alt: z.string().max(240).default(''),
  caption: z.string().max(480).default(''),
  href: z.string().max(2048).regex(SAFE_LINK_URL, {
    message: 'href must be http(s), relative (/), hash (#), mailto:, or tel:',
  }).default(''),
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
