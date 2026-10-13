/**
 * og:image must be an absolute URL, and a page without its own image falls back
 * to the instance's card (session 262: five pages emitted a relative URL to a
 * file no instance had).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

beforeAll(() => {
  (globalThis as Record<string, unknown>).useRuntimeConfig = () => ({ public: { siteUrl: 'https://example.org/' } });
});

describe('useOgImage', () => {
  it('falls back to the absolute default card', async () => {
    const { useOgImage } = await import('../useOgImage');
    const og = useOgImage();
    expect(og()).toBe('https://example.org/og-default.png');
    expect(og(null)).toBe('https://example.org/og-default.png');
    expect(og('')).toBe('https://example.org/og-default.png');
  });

  it('keeps an absolute image and absolutizes a relative one', async () => {
    const { useOgImage } = await import('../useOgImage');
    const og = useOgImage();
    expect(og('https://cdn.example.net/a.png')).toBe('https://cdn.example.net/a.png');
    expect(og('/api/files/a.png')).toBe('https://example.org/api/files/a.png');
    expect(og('api/files/a.png')).toBe('https://example.org/api/files/a.png');
  });

  it('the default card ships with the layer, and the package publishes it', () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
    expect(existsSync(join(root, 'public', 'og-default.png'))).toBe(true);
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { files: string[] };
    expect(pkg.files).toContain('public');
  });

  it('no page emits a relative og:image any more', () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'pages');
    for (const f of ['learn/[slug]/index.vue', 'u/[username]/index.vue', 'hubs/[slug]/index.vue', 'u/[username]/[type]/[slug]/index.vue', 'contests/[slug]/index.vue']) {
      expect(readFileSync(join(root, f), 'utf8'), f).not.toContain("'/og-default.png'");
    }
  });
});
