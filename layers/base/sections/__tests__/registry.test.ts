/**
 * Layer-level section registry smoke tests.
 *
 * The class-level tests live in `packages/ui/src/__tests__/sections.test.ts`
 * (those cover register/get/list/byCategory/snapshot/colSpan-validation).
 *
 * This file pins the LAYER'S registration of built-in sections — the
 * single source of truth for "what sections does CommonPub ship with".
 * Phase 1c added 5 more entries (hero/heading/paragraph/image/content-feed)
 * to the proof-of-life `divider` from session 157.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { useSectionRegistry } from '../registry';

describe('layer section registry — built-in registrations', () => {
  it('exposes a singleton — repeated useSectionRegistry calls return the same instance', () => {
    const a = useSectionRegistry();
    const b = useSectionRegistry();
    expect(a).toBe(b);
  });

  it('registers the divider section (Phase 1 proof-of-life)', () => {
    const reg = useSectionRegistry();
    expect(reg.has('divider')).toBe(true);
    const def = reg.get('divider')!;
    expect(def.type).toBe('divider');
    expect(def.category).toBe('layout');
    expect(def.resizable).toBe(false);  // dividers are always full-width
    expect(def.minColSpan).toBe(12);
    expect(def.maxColSpan).toBe(12);
    expect(def.defaultColSpan).toBe(12);
  });

  it('divider.configSchema validates the default config without error', () => {
    const def = useSectionRegistry().get('divider')!;
    const result = def.configSchema.safeParse(def.defaultConfig);
    expect(result.success).toBe(true);
  });

  it('divider.configSchema rejects an unknown variant', () => {
    const def = useSectionRegistry().get('divider')!;
    const result = def.configSchema.safeParse({ variant: 'wavy', spacingY: 'md' });
    expect(result.success).toBe(false);
  });

  it('divider.configSchema fills defaults when partial', () => {
    const def = useSectionRegistry().get('divider')!;
    const result = def.configSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.variant).toBe('solid');
      expect(result.data.spacingY).toBe('md');
    }
  });

  // --- Phase 1c starter catalog -------------------------------------------

  it('Phase 1c starter sections (hero, heading, paragraph, image, content-feed) are registered', () => {
    const reg = useSectionRegistry();
    for (const type of ['hero', 'heading', 'paragraph', 'image', 'content-feed']) {
      expect(reg.has(type), `${type} should be registered`).toBe(true);
    }
  });

  // Stage E.4: hero now uses the existing HeroSection (homepage)
  it('hero section: layout category, full-width via HeroSection (contest-aware)', () => {
    const def = useSectionRegistry().get('hero')!;
    expect(def.category).toBe('layout');
    expect(def.minColSpan).toBe(12);  // hero is always full-width
    expect(def.maxColSpan).toBe(12);
    expect(def.defaultColSpan).toBe(12);
    expect(def.propMap).toBeTypeOf('function');
    expect(def.defaultConfig).toMatchObject({ variant: 'default' });
  });

  // --- Stage E.1: primitives now point at BlockX components via propMap

  it('heading section: content category, level enum 1-6 (matches BlockHeadingView contract)', () => {
    const def = useSectionRegistry().get('heading')!;
    expect(def.category).toBe('content');
    expect(def.minColSpan).toBe(3);
    expect(def.propMap).toBeTypeOf('function');  // ← Stage E adapter
    // BlockHeadingView supports h1-h6 (not just h1-h4 like my pre-Stage-E shape)
    for (const level of [1, 2, 3, 4, 5, 6]) {
      expect(def.configSchema.safeParse({ ...def.defaultConfig, level }).success).toBe(true);
    }
    expect(def.configSchema.safeParse({ ...def.defaultConfig, level: 7 }).success).toBe(false);
  });

  it('paragraph section: content category, default 6 col, html length cap (BlockTextView contract)', () => {
    const def = useSectionRegistry().get('paragraph')!;
    expect(def.category).toBe('content');
    expect(def.defaultColSpan).toBe(6);
    expect(def.propMap).toBeTypeOf('function');
    // BlockTextView takes { content: { html } }
    expect(def.configSchema.safeParse({ html: 'a'.repeat(8001) }).success).toBe(false);
    expect(def.configSchema.safeParse({ html: '<p>hi</p>' }).success).toBe(true);
  });

  it('image section: BlockImageView contract — src + alt + caption + size enum', () => {
    const def = useSectionRegistry().get('image')!;
    expect(def.propMap).toBeTypeOf('function');
    // Valid: size 's' | 'm' | 'l' | 'full'; src http(s) or relative or empty
    for (const size of ['s', 'm', 'l', 'full']) {
      expect(def.configSchema.safeParse({
        src: 'https://example.com/x.png', alt: '', caption: '', size,
      }).success).toBe(true);
    }
    expect(def.configSchema.safeParse({
      src: '', alt: '', caption: '', size: 'xl',  // bad size
    }).success).toBe(false);
    // SAFE_IMAGE_URL still guards: javascript: rejected
    expect(def.configSchema.safeParse({
      src: 'javascript:alert(1)', alt: '', caption: '', size: 'l',
    }).success).toBe(false);
  });

  it('divider section: variant + spacingY pass through propMap to BlockDividerView', () => {
    const def = useSectionRegistry().get('divider')!;
    expect(def.propMap).toBeTypeOf('function');
    const adapted = def.propMap!({
      config: { variant: 'accent', spacingY: 'xl' },
      meta: { route: '/', zone: 'main', isPreview: false, effectiveColSpan: 12, sectionId: 'd1' },
    });
    expect(adapted).toEqual({ content: { variant: 'accent', spacingY: 'xl' } });
  });

  // Stage E.4: content-feed unifies to ContentGridSection (which already has
  // tabs + pagination — my SectionContentFeed was a reimplementation).
  it('content-feed section: data category, limit 1-24, columns 2-4 (ContentGridSection contract)', () => {
    const def = useSectionRegistry().get('content-feed')!;
    expect(def.category).toBe('data');
    expect(def.propMap).toBeTypeOf('function');
    expect(def.configSchema.safeParse({ ...def.defaultConfig, limit: 0 }).success).toBe(false);
    expect(def.configSchema.safeParse({ ...def.defaultConfig, limit: 25 }).success).toBe(false);
    expect(def.configSchema.safeParse({ ...def.defaultConfig, limit: 12 }).success).toBe(true);
    // ContentGridSection's existing schema is columns 2-4 (not 1-4)
    expect(def.configSchema.safeParse({ ...def.defaultConfig, columns: 1 }).success).toBe(false);
    expect(def.configSchema.safeParse({ ...def.defaultConfig, columns: 5 }).success).toBe(false);
    expect(def.configSchema.safeParse({ ...def.defaultConfig, columns: 2 }).success).toBe(true);
  });

  // --- Session 159 — full legacy parity sections --------------------------

  it('session-159 sections (editorial, stats, hubs, contests, learning, custom-html) are registered', () => {
    const reg = useSectionRegistry();
    for (const type of ['editorial', 'stats', 'hubs', 'contests', 'learning', 'custom-html']) {
      expect(reg.has(type), `${type} should be registered`).toBe(true);
    }
  });

  // Stage E.4: editorial unifies to EditorialSection (which fixes its own
  // grid layout — no columns config). Config is just `limit`.
  it('editorial section: data category, limit only (EditorialSection contract)', () => {
    const def = useSectionRegistry().get('editorial')!;
    expect(def.category).toBe('data');
    expect(def.defaultColSpan).toBe(12);
    expect(def.minColSpan).toBe(6);
    expect(def.propMap).toBeTypeOf('function');
    expect(def.configSchema.safeParse({ limit: 0 }).success).toBe(false);
    expect(def.configSchema.safeParse({ limit: 13 }).success).toBe(false);
    expect(def.configSchema.safeParse({ limit: 12 }).success).toBe(true);
  });

  // Stage E.4: stats unifies to StatsSection (no config — fixes its own data)
  it('stats section: data category, default 4, config is empty (StatsSection takes no props)', () => {
    const def = useSectionRegistry().get('stats')!;
    expect(def.category).toBe('data');
    expect(def.defaultColSpan).toBe(4);
    expect(def.minColSpan).toBe(3);
    expect(def.propMap).toBeTypeOf('function');
    expect(def.configSchema.safeParse({}).success).toBe(true);
  });

  it('hubs section: data category, default 4 col, limit clamped 1-20', () => {
    const def = useSectionRegistry().get('hubs')!;
    expect(def.category).toBe('data');
    expect(def.defaultColSpan).toBe(4);
    expect(def.configSchema.safeParse({ ...def.defaultConfig, limit: 0 }).success).toBe(false);
    expect(def.configSchema.safeParse({ ...def.defaultConfig, limit: 21 }).success).toBe(false);
    expect(def.configSchema.safeParse({ ...def.defaultConfig, limit: 20 }).success).toBe(true);
  });

  it('contests section: data category, default 4 col, limit clamped 1-10', () => {
    const def = useSectionRegistry().get('contests')!;
    expect(def.category).toBe('data');
    expect(def.defaultColSpan).toBe(4);
    expect(def.configSchema.safeParse({ ...def.defaultConfig, limit: 0 }).success).toBe(false);
    expect(def.configSchema.safeParse({ ...def.defaultConfig, limit: 11 }).success).toBe(false);
    expect(def.configSchema.safeParse({ ...def.defaultConfig, limit: 10 }).success).toBe(true);
  });

  it('learning section: data category, full-width default, limit 1-12, columns 1-4', () => {
    const def = useSectionRegistry().get('learning')!;
    expect(def.category).toBe('data');
    expect(def.defaultColSpan).toBe(12);
    expect(def.configSchema.safeParse({ ...def.defaultConfig, limit: 0 }).success).toBe(false);
    expect(def.configSchema.safeParse({ ...def.defaultConfig, limit: 13 }).success).toBe(false);
    expect(def.configSchema.safeParse({ ...def.defaultConfig, columns: 5 }).success).toBe(false);
    expect(def.configSchema.safeParse({ ...def.defaultConfig, columns: 3 }).success).toBe(true);
  });

  it('custom-html section: content category, BETA status (uses CustomHtmlSection)', () => {
    const def = useSectionRegistry().get('custom-html')!;
    expect(def.category).toBe('content');
    expect(def.status).toBe('beta');
    expect(def.propMap).toBeTypeOf('function');
    // 50KB cap is a sanity bound, not a security control
    expect(def.configSchema.safeParse({ title: '', html: 'x'.repeat(50_001) }).success).toBe(false);
    expect(def.configSchema.safeParse({ title: '', html: 'x'.repeat(50_000) }).success).toBe(true);
  });

  // --- Session 159 Stage C — Phase 6b additions ---------------------------

  it('Phase 6b sections (cta, markdown, gallery, video, embed) are registered', () => {
    const reg = useSectionRegistry();
    for (const type of ['cta', 'markdown', 'gallery', 'video', 'embed']) {
      expect(reg.has(type), `${type} should be registered`).toBe(true);
    }
  });

  it('cta section: content category, button URL guard rejects javascript: hrefs', () => {
    const def = useSectionRegistry().get('cta')!;
    expect(def.category).toBe('content');
    expect(def.configSchema.safeParse({
      ...def.defaultConfig,
      buttons: [{ label: 'X', href: 'javascript:alert(1)', variant: 'primary' }],
    }).success).toBe(false);
    expect(def.configSchema.safeParse({
      ...def.defaultConfig,
      buttons: [{ label: 'X', href: '/safe', variant: 'primary' }],
    }).success).toBe(true);
    // Max 3 buttons
    const fourBtn = Array(4).fill({ label: 'X', href: '/x', variant: 'primary' });
    expect(def.configSchema.safeParse({ ...def.defaultConfig, buttons: fourBtn }).success).toBe(false);
  });

  // Stage E.2: markdown / gallery / video / embed unified onto BlockX components

  it('markdown section: BlockMarkdownView contract — source field, 100KB cap', () => {
    const def = useSectionRegistry().get('markdown')!;
    expect(def.category).toBe('content');
    expect(def.propMap).toBeTypeOf('function');
    expect(def.configSchema.safeParse({ source: 'x'.repeat(100_001) }).success).toBe(false);
    expect(def.configSchema.safeParse({ source: '# Hello' }).success).toBe(true);
  });

  it('gallery section: BlockGalleryView contract — images array, 20 cap, src URL guard', () => {
    const def = useSectionRegistry().get('gallery')!;
    expect(def.category).toBe('content');
    expect(def.propMap).toBeTypeOf('function');
    // src URL guard rejects javascript:
    expect(def.configSchema.safeParse({
      images: [{ src: 'javascript:alert(1)', alt: '', caption: '' }],
    }).success).toBe(false);
    // 20-item cap
    const twentyOne = Array(21).fill({ src: '/x.jpg', alt: '', caption: '' });
    expect(def.configSchema.safeParse({ images: twentyOne }).success).toBe(false);
    // Empty OK
    expect(def.configSchema.safeParse({ images: [] }).success).toBe(true);
  });

  it('video section: BlockVideoView contract — url field, URL guard rejects javascript:', () => {
    const def = useSectionRegistry().get('video')!;
    expect(def.propMap).toBeTypeOf('function');
    expect(def.configSchema.safeParse({ url: 'javascript:alert(1)' }).success).toBe(false);
    expect(def.configSchema.safeParse({ url: '/uploads/x.mp4' }).success).toBe(true);
    expect(def.configSchema.safeParse({ url: 'https://youtube.com/watch?v=x' }).success).toBe(true);
  });

  it('embed section: BlockEmbedView contract — url field, http(s) only', () => {
    const def = useSectionRegistry().get('embed')!;
    expect(def.category).toBe('content');
    expect(def.propMap).toBeTypeOf('function');
    expect(def.configSchema.safeParse({ url: 'not-a-url' }).success).toBe(false);
    expect(def.configSchema.safeParse({ url: 'https://twitter.com/x' }).success).toBe(true);
    expect(def.configSchema.safeParse({ url: '' }).success).toBe(true);  // empty OK
  });

  // --- URL scheme guards (session 158 audit-fix) -------------------------

  it('hero CTA href rejects dangerous URI schemes (stored-XSS surface)', () => {
    const def = useSectionRegistry().get('hero')!;
    const baseCta = { label: 'Click', variant: 'primary' as const };
    const baseConfig = { ...def.defaultConfig, ctas: [{ ...baseCta, href: '' }] };

    // Each known-bad scheme is independently rejected — admin-set fields
    // render to ALL visitors, so without this guard a malicious or
    // careless admin produces a clickable XSS payload.
    for (const badHref of [
      'javascript:alert(1)',
      'JAVASCRIPT:alert(1)',          // case-insensitive
      'data:text/html,<script>x</script>',
      'vbscript:msgbox(1)',
      'file:///etc/passwd',
      ' javascript:alert(1)',         // leading whitespace
    ]) {
      const result = def.configSchema.safeParse({
        ...baseConfig,
        ctas: [{ ...baseCta, href: badHref }],
      });
      expect(result.success, `expected reject of: ${JSON.stringify(badHref)}`).toBe(false);
    }

    // Each known-good URL is accepted (positive coverage so the regex
    // doesn't drift into over-restriction)
    for (const goodHref of [
      '/create',
      '/u/alice/projects/x',
      'https://example.com',
      'http://localhost:3000',
      '#section',
      'mailto:a@b.com',
      'tel:+15555555',
    ]) {
      const result = def.configSchema.safeParse({
        ...baseConfig,
        ctas: [{ ...baseCta, href: goodHref }],
      });
      expect(result.success, `expected accept of: ${JSON.stringify(goodHref)}`).toBe(true);
    }
  });

  it('image href + src reject dangerous URI schemes', () => {
    // Stage E.1: image now uses BlockImageView contract (src/alt/caption/size).
    // href + fit + aspectRatio dropped (BlockImageView uses size preset for
    // width capping; no link wrap in the Block contract).
    const def = useSectionRegistry().get('image')!;
    const base = { alt: 'x', caption: '', size: 'l' };

    // src: javascript:/data:/vbscript: rejected (admin-set; renders to all visitors)
    for (const badSrc of ['javascript:alert(1)', 'data:image/svg+xml,<svg/onload=x>', 'vbscript:m']) {
      const r = def.configSchema.safeParse({ ...base, src: badSrc });
      expect(r.success, `image.src rejects ${badSrc}`).toBe(false);
    }

    // Empty src allowed (the "no image yet" state)
    expect(def.configSchema.safeParse({ ...base, src: '' }).success).toBe(true);

    // Known-good
    expect(def.configSchema.safeParse({ ...base, src: 'https://cdn.example.com/x.png' }).success).toBe(true);
    expect(def.configSchema.safeParse({ ...base, src: '/images/local.jpg' }).success).toBe(true);
  });

  it('every registered section: defaultConfig passes configSchema (round-trip safe)', () => {
    const reg = useSectionRegistry();
    for (const def of reg.list()) {
      const result = def.configSchema.safeParse(def.defaultConfig);
      expect(result.success, `${def.type} defaultConfig should parse against its own schema`).toBe(true);
    }
  });

  // --- Token discipline ---------------------------------------------------

  it('no hardcoded colors in any registered section component (CLAUDE.md rule #3)', () => {
    // Read every Section*.vue file and scan its scoped <style> block for
    // literal colors. var(--*) is the only sanctioned form. Per memory
    // `feedback_prose_style_leak` + `feedback_universal_radius_leak`,
    // hardcoded colors are how non-zero --radius / dark-mode themes leak.
    const sectionsDir = resolve(__dirname, '../../components/sections');
    const files = readdirSync(sectionsDir).filter((f) => f.endsWith('.vue'));
    // Stage E (sessions 159+): primitives (heading/paragraph/image/divider)
    // unified onto BlockX components; their Section*.vue files deleted. Same
    // for content block-style sections (gallery/video/embed/markdown) in E.2
    // and homepage sections (hero/editorial/stats/etc) in E.4. Sweep count
    // drops as each unification phase completes. Sticky floor: 1 (Learning)
    // because no existing component renders learning paths as a section.
    expect(files.length).toBeGreaterThanOrEqual(1);

    const offenders: Array<{ file: string; match: string }> = [];
    for (const file of files) {
      const src = readFileSync(resolve(sectionsDir, file), 'utf8');
      const styleMatch = src.match(/<style[^>]*>([\s\S]*?)<\/style>/);
      if (!styleMatch) continue;
      const style = styleMatch[1];

      // hex literals (#fff, #ffffff, #ffffffaa)
      const hex = style.match(/#[0-9a-fA-F]{3,8}\b/g);
      if (hex) offenders.push(...hex.map((m) => ({ file, match: m })));

      // rgb/rgba/hsl/hsla literal calls (var(...) wrapping a token is fine)
      const fnLits = style.match(/\b(rgb|rgba|hsl|hsla|oklch)\s*\(/g);
      if (fnLits) offenders.push(...fnLits.map((m) => ({ file, match: m })));
    }
    expect(offenders, `Hardcoded colors leak in: ${JSON.stringify(offenders)}`).toEqual([]);
  });
});
