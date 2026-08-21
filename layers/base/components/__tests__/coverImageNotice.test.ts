/**
 * Coverage guard for the cover-image AI notice.
 *
 * Cover images are uploaded from four separate surfaces that share no component:
 * the shared `ImageUpload` (used by the content starter form and both event
 * forms), and the two editors' hand-rolled inline covers. A notice added to one
 * of them looks exactly like a notice that shipped — this session has already
 * shipped two half-fixes of precisely that shape.
 *
 * Source-level on purpose: rendering `ImageUpload` proves nothing about the
 * editors, and the editors are heavy client-only shells.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { COVER_IMAGE_AI_NOTICE } from '../../utils/coverImageNotice';

const read = (rel: string): string => readFileSync(resolve(__dirname, '..', rel), 'utf8');

const COVER_SURFACES = [
  'ImageUpload.vue',
  'editors/ProjectEditor.vue',
  'editors/ArticleEditor.vue',
] as const;

describe('the cover-image notice reaches every cover upload surface', () => {
  it.each(COVER_SURFACES)('%s renders the notice', (file) => {
    const src = read(file);
    expect(src).toContain('COVER_IMAGE_AI_NOTICE');
    // Imported explicitly, not left to an auto-import: Vue compiles an unknown
    // template identifier to `_ctx.X`, which does not fall back to globalThis.
    expect(src).toMatch(/import \{ COVER_IMAGE_AI_NOTICE \} from '[^']*coverImageNotice'/);
  });

  it('is scoped to the cover purpose, not every image upload', () => {
    // Avatars and hub banners are a separate decision.
    expect(read('ImageUpload.vue')).toMatch(/v-if="purpose === 'cover'"[^>]*>\{\{ COVER_IMAGE_AI_NOTICE \}\}/);
  });

  it('reads as one sentence pair, correctly punctuated', () => {
    expect(COVER_IMAGE_AI_NOTICE).toBe("Please do not use generative AI for your cover image. It's tacky and lame.");
    // House rule: no em dashes in user-facing copy.
    expect(COVER_IMAGE_AI_NOTICE).not.toMatch(/—/);
  });

  // Positive control: if these files move, fail loudly rather than pass on three
  // regexes that match nothing.
  it('read the components it claims to check', () => {
    for (const f of COVER_SURFACES) expect(read(f).length).toBeGreaterThan(2000);
  });
});
