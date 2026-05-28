/**
 * Tests for `sectionConfigs.ts` — the per-section Zod schemas that
 * power server-side validation of layout writes.
 *
 * Behavior reflects what's been "in production" since session 158 (the
 * schemas were inline in `layers/base/sections/builtin/*.ts`). Session
 * 161 moved them to this package so the dormant `validateSectionConfigs`
 * could be wired without dragging Vue components into the Nitro bundle.
 *
 * Focus:
 *   - Defaults: omitted fields produce the documented default
 *   - URL guards: known-bad schemes (javascript:, data:, file:) rejected
 *   - Bounds: `.max()` upper limits actually clamp
 *   - Enum walls: out-of-vocab values rejected
 *   - SECTION_CONFIG_SCHEMAS lookup map matches the 17 registered types
 */
import { describe, it, expect } from 'vitest';
import {
  SECTION_CONFIG_SCHEMAS,
  dividerConfigSchema,
  headingConfigSchema,
  paragraphConfigSchema,
  imageConfigSchema,
  galleryConfigSchema,
  videoConfigSchema,
  embedConfigSchema,
  markdownConfigSchema,
  customHtmlConfigSchema,
  heroConfigSchema,
  ctaConfigSchema,
  contentFeedConfigSchema,
  editorialConfigSchema,
  statsConfigSchema,
  hubsConfigSchema,
  contestsConfigSchema,
  learningConfigSchema,
} from '../sectionConfigs.js';

// ---------------------------------------------------------------------------
// SECTION_CONFIG_SCHEMAS map — surface area + completeness
// ---------------------------------------------------------------------------

describe('SECTION_CONFIG_SCHEMAS map', () => {
  it('exposes exactly the 17 registered section types', () => {
    expect(Object.keys(SECTION_CONFIG_SCHEMAS).sort()).toEqual([
      'content-feed', 'contests', 'cta', 'custom-html', 'divider',
      'editorial', 'embed', 'gallery', 'heading', 'hero',
      'hubs', 'image', 'learning', 'markdown', 'paragraph',
      'stats', 'video',
    ]);
  });

  it('every entry parses an empty object with defaults applied (except those requiring fields)', () => {
    // All but cta + heading + hero ctas accept `{}` and synthesize defaults
    // because every field has either a default or is optional.
    const lookups: Array<[string, unknown]> = [
      ['divider', {}], ['heading', {}], ['paragraph', {}],
      ['image', {}], ['gallery', {}], ['video', {}], ['embed', {}],
      ['markdown', {}], ['custom-html', {}], ['hero', {}], ['cta', {}],
      ['content-feed', {}], ['editorial', {}], ['stats', {}],
      ['hubs', {}], ['contests', {}], ['learning', {}],
    ];
    for (const [type, input] of lookups) {
      const schema = SECTION_CONFIG_SCHEMAS[type]!;
      const result = schema.safeParse(input);
      expect(result.success, `${type} should accept {} but: ${JSON.stringify(result.error?.issues)}`).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Layout primitives
// ---------------------------------------------------------------------------

describe('dividerConfigSchema', () => {
  it('defaults variant=solid + spacingY=md when omitted', () => {
    expect(dividerConfigSchema.parse({})).toEqual({ variant: 'solid', spacingY: 'md' });
  });
  it('rejects unknown variants', () => {
    expect(dividerConfigSchema.safeParse({ variant: 'glitter' }).success).toBe(false);
  });
});

describe('headingConfigSchema', () => {
  it('defaults level=2 + text="Section heading"', () => {
    expect(headingConfigSchema.parse({})).toEqual({ level: 2, text: 'Section heading' });
  });
  it('rejects level=7 (only h1–h6)', () => {
    expect(headingConfigSchema.safeParse({ level: 7 }).success).toBe(false);
  });
  it('rejects empty text (.min(1))', () => {
    expect(headingConfigSchema.safeParse({ text: '' }).success).toBe(false);
  });
  it('rejects text > 240 chars', () => {
    expect(headingConfigSchema.safeParse({ text: 'x'.repeat(241) }).success).toBe(false);
  });
});

describe('paragraphConfigSchema', () => {
  it('clamps html body to 8000 chars', () => {
    expect(paragraphConfigSchema.safeParse({ html: 'x'.repeat(8000) }).success).toBe(true);
    expect(paragraphConfigSchema.safeParse({ html: 'x'.repeat(8001) }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Content — URL guards (security)
// ---------------------------------------------------------------------------

describe('imageConfigSchema URL guard', () => {
  it.each([
    ['https://example.com/x.png', true],
    ['http://example.com/x.png', true],
    ['/uploads/x.png', true],
    ['', true],
  ])('accepts %s', (src, ok) => {
    expect(imageConfigSchema.safeParse({ src }).success).toBe(ok);
  });
  it.each([
    ['javascript:alert(1)'],
    ['data:image/png;base64,abc'],
    ['file:///etc/passwd'],
    ['vbscript:msg'],
    ['ftp://example.com/x.png'],
  ])('rejects %s', (src) => {
    expect(imageConfigSchema.safeParse({ src }).success).toBe(false);
  });
});

describe('galleryConfigSchema', () => {
  it('caps gallery at 20 images', () => {
    const ok = Array.from({ length: 20 }, () => ({ src: 'https://x/y.png' }));
    const tooMany = Array.from({ length: 21 }, () => ({ src: 'https://x/y.png' }));
    expect(galleryConfigSchema.safeParse({ images: ok }).success).toBe(true);
    expect(galleryConfigSchema.safeParse({ images: tooMany }).success).toBe(false);
  });
  it('rejects an image with a javascript: src', () => {
    expect(galleryConfigSchema.safeParse({ images: [{ src: 'javascript:alert(1)' }] }).success).toBe(false);
  });
});

describe('videoConfigSchema URL guard', () => {
  it('accepts https + path + empty', () => {
    expect(videoConfigSchema.safeParse({ url: 'https://youtube.com/embed/x' }).success).toBe(true);
    expect(videoConfigSchema.safeParse({ url: '/v/x.mp4' }).success).toBe(true);
    expect(videoConfigSchema.safeParse({ url: '' }).success).toBe(true);
  });
  it('rejects javascript: + data:', () => {
    expect(videoConfigSchema.safeParse({ url: 'javascript:void' }).success).toBe(false);
    expect(videoConfigSchema.safeParse({ url: 'data:video/mp4;base64,a' }).success).toBe(false);
  });
});

describe('embedConfigSchema URL guard (strict http(s) only)', () => {
  it('accepts https + empty', () => {
    expect(embedConfigSchema.safeParse({ url: 'https://twitter.com/x' }).success).toBe(true);
    expect(embedConfigSchema.safeParse({ url: '' }).success).toBe(true);
  });
  it('REJECTS root-relative path (unlike image/video — embeds must be remote)', () => {
    expect(embedConfigSchema.safeParse({ url: '/embed/x' }).success).toBe(false);
  });
  it('rejects javascript:', () => {
    expect(embedConfigSchema.safeParse({ url: 'javascript:alert(1)' }).success).toBe(false);
  });
});

describe('markdownConfigSchema', () => {
  it('clamps source to 100,000 chars', () => {
    expect(markdownConfigSchema.safeParse({ source: 'x'.repeat(100_000) }).success).toBe(true);
    expect(markdownConfigSchema.safeParse({ source: 'x'.repeat(100_001) }).success).toBe(false);
  });
});

describe('customHtmlConfigSchema', () => {
  it('clamps html to 50_000 chars + heading to 255', () => {
    expect(customHtmlConfigSchema.safeParse({ html: 'x'.repeat(50_000), heading: 'h'.repeat(255) }).success).toBe(true);
    expect(customHtmlConfigSchema.safeParse({ html: 'x'.repeat(50_001) }).success).toBe(false);
    expect(customHtmlConfigSchema.safeParse({ heading: 'h'.repeat(256) }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Interactive — hero, cta (button URL guards + array bounds)
// ---------------------------------------------------------------------------

describe('heroConfigSchema', () => {
  it('caps ctas at 2', () => {
    const cta = { label: 'Go', href: 'https://x' };
    expect(heroConfigSchema.safeParse({ ctas: [cta, cta] }).success).toBe(true);
    expect(heroConfigSchema.safeParse({ ctas: [cta, cta, cta] }).success).toBe(false);
  });
  it('rejects a cta with javascript: href', () => {
    expect(heroConfigSchema.safeParse({ ctas: [{ label: 'Go', href: 'javascript:void(0)' }] }).success).toBe(false);
  });
  it('rejects empty href on a cta', () => {
    expect(heroConfigSchema.safeParse({ ctas: [{ label: 'Go', href: '' }] }).success).toBe(false);
  });
  it('rejects empty label on a cta', () => {
    expect(heroConfigSchema.safeParse({ ctas: [{ label: '', href: 'https://x' }] }).success).toBe(false);
  });
  it('accepts mailto: and tel: hrefs', () => {
    expect(heroConfigSchema.safeParse({ ctas: [{ label: 'Email', href: 'mailto:hi@x' }] }).success).toBe(true);
    expect(heroConfigSchema.safeParse({ ctas: [{ label: 'Call', href: 'tel:+1234' }] }).success).toBe(true);
  });
  it('accepts anchor hrefs (#section)', () => {
    expect(heroConfigSchema.safeParse({ ctas: [{ label: 'Jump', href: '#about' }] }).success).toBe(true);
  });
});

describe('ctaConfigSchema', () => {
  it('caps buttons at 3', () => {
    const btn = { label: 'Go', href: 'https://x' };
    expect(ctaConfigSchema.safeParse({ buttons: [btn, btn, btn] }).success).toBe(true);
    expect(ctaConfigSchema.safeParse({ buttons: [btn, btn, btn, btn] }).success).toBe(false);
  });
  it('rejects a javascript: href in any button', () => {
    expect(ctaConfigSchema.safeParse({
      buttons: [
        { label: 'OK', href: 'https://safe.com' },
        { label: 'Bad', href: 'javascript:alert(1)' },
      ],
    }).success).toBe(false);
  });
  it('rejects empty heading (.min(1))', () => {
    expect(ctaConfigSchema.safeParse({ heading: '' }).success).toBe(false);
  });
  it('caps body at 800 chars', () => {
    expect(ctaConfigSchema.safeParse({ body: 'x'.repeat(800) }).success).toBe(true);
    expect(ctaConfigSchema.safeParse({ body: 'x'.repeat(801) }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Data — bounds + enum walls
// ---------------------------------------------------------------------------

describe('contentFeedConfigSchema', () => {
  it('caps limit at 24', () => {
    expect(contentFeedConfigSchema.safeParse({ limit: 24 }).success).toBe(true);
    expect(contentFeedConfigSchema.safeParse({ limit: 25 }).success).toBe(false);
  });
  it('rejects limit=0 + negative', () => {
    expect(contentFeedConfigSchema.safeParse({ limit: 0 }).success).toBe(false);
    expect(contentFeedConfigSchema.safeParse({ limit: -1 }).success).toBe(false);
  });
  it('rejects unknown sort', () => {
    expect(contentFeedConfigSchema.safeParse({ sort: 'random' }).success).toBe(false);
  });
  it('rejects columns=5 (only 2|3|4 allowed)', () => {
    expect(contentFeedConfigSchema.safeParse({ columns: 5 }).success).toBe(false);
  });
});

describe('editorialConfigSchema', () => {
  it('caps limit at 12', () => {
    expect(editorialConfigSchema.safeParse({ limit: 12 }).success).toBe(true);
    expect(editorialConfigSchema.safeParse({ limit: 13 }).success).toBe(false);
  });
});

describe('statsConfigSchema', () => {
  it('accepts an empty object — no per-instance config', () => {
    expect(statsConfigSchema.parse({})).toEqual({});
  });
});

describe('hubsConfigSchema', () => {
  it('caps limit at 20', () => {
    expect(hubsConfigSchema.safeParse({ limit: 21 }).success).toBe(false);
  });
});

describe('contestsConfigSchema', () => {
  it('caps limit at 10', () => {
    expect(contestsConfigSchema.safeParse({ limit: 11 }).success).toBe(false);
  });
});

describe('learningConfigSchema', () => {
  it('caps limit at 12', () => {
    expect(learningConfigSchema.safeParse({ limit: 13 }).success).toBe(false);
  });
  it('rejects columns=5 (only 1|2|3|4)', () => {
    expect(learningConfigSchema.safeParse({ columns: 5 }).success).toBe(false);
  });
  it('defaults heading="Learning Paths"', () => {
    expect(learningConfigSchema.parse({}).heading).toBe('Learning Paths');
  });
});
