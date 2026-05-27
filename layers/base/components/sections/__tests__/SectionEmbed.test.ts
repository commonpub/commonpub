/**
 * Component-level tests for SectionEmbed.
 * Asserts allowlist enforcement, sandbox attributes, and the error
 * placeholder for blocked hosts.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render } from '@testing-library/vue';
import SectionEmbed from '../SectionEmbed.vue';

const meta = {
  route: '/',
  zone: 'main',
  isPreview: false,
  effectiveColSpan: 12,
  sectionId: 'emb-1',
};

interface EmbedConfigForTest extends Record<string, unknown> {
  heading: string;
  src: string;
  title: string;
  height: number;
}

const baseConfig: EmbedConfigForTest = {
  heading: '',
  src: '',
  title: '',
  height: 450,
};

afterEach(() => { document.body.innerHTML = ''; });

describe('SectionEmbed — allowlist', () => {
  it.each([
    'https://twitter.com/x/status/1',
    'https://x.com/x/status/1',
    'https://gist.github.com/x/abc',
    'https://codepen.io/x/pen/abc',
    'https://www.loom.com/embed/abc',
    'https://figma.com/embed?abc',
    'https://www.youtube-nocookie.com/embed/x',
    'https://player.vimeo.com/video/1',
  ])('allows %s', (src) => {
    render(SectionEmbed, { props: { meta, config: { ...baseConfig, src } } });
    expect(document.querySelector('iframe')?.getAttribute('src')).toBe(src);
    expect(document.querySelector('.cpub-section-embed-error')).toBeNull();
  });

  it.each([
    'https://evil.example.com/x',
    'https://attacker.io/iframe',
    'https://random-blog.io/post',
  ])('rejects %s with error placeholder showing the blocked host', (src) => {
    render(SectionEmbed, { props: { meta, config: { ...baseConfig, src } } });
    expect(document.querySelector('iframe')).toBeNull();
    const err = document.querySelector('.cpub-section-embed-error');
    expect(err).not.toBeNull();
    // Show the host name to the admin
    const u = new URL(src);
    expect(err?.textContent).toContain(u.host);
  });

  it('rejects malformed URL with parse-failed message', () => {
    render(SectionEmbed, { props: { meta, config: { ...baseConfig, src: 'not-a-url' } } });
    // SAFE_URL regex would catch this at Zod, but the renderer is defensive
    expect(document.querySelector('iframe')).toBeNull();
    expect(document.querySelector('.cpub-section-embed-error')?.textContent).toContain('could not be parsed');
  });

  it('renders nothing when src is empty', () => {
    render(SectionEmbed, { props: { meta, config: baseConfig } });
    expect(document.querySelector('.cpub-section-embed')).toBeNull();
  });
});

describe('SectionEmbed — security', () => {
  it('iframe has restrictive sandbox (NO allow-top-navigation)', () => {
    render(SectionEmbed, { props: { meta, config: {
      ...baseConfig, src: 'https://codepen.io/x/pen/abc',
    }}});
    const sandbox = document.querySelector('iframe')?.getAttribute('sandbox') ?? '';
    expect(sandbox).toContain('allow-scripts');
    expect(sandbox).toContain('allow-same-origin');
    expect(sandbox).toContain('allow-presentation');
    expect(sandbox).toContain('allow-popups');
    // CRITICAL: blocked
    expect(sandbox).not.toContain('allow-top-navigation');
    expect(sandbox).not.toContain('allow-pointer-lock');
  });

  it('iframe is lazy-loaded', () => {
    render(SectionEmbed, { props: { meta, config: {
      ...baseConfig, src: 'https://codepen.io/x/pen/abc',
    }}});
    expect(document.querySelector('iframe')?.getAttribute('loading')).toBe('lazy');
  });

  it('iframe title falls back when section title not set', () => {
    render(SectionEmbed, { props: { meta, config: {
      ...baseConfig, src: 'https://codepen.io/x/pen/abc',
    }}});
    expect(document.querySelector('iframe')?.getAttribute('title')).toBe('Embedded content');

    document.body.innerHTML = '';
    render(SectionEmbed, { props: { meta, config: {
      ...baseConfig, src: 'https://codepen.io/x/pen/abc', title: 'Project demo',
    }}});
    expect(document.querySelector('iframe')?.getAttribute('title')).toBe('Project demo');
  });
});

describe('SectionEmbed — height', () => {
  it('applies config.height as inline style on the frame', () => {
    render(SectionEmbed, { props: { meta, config: {
      ...baseConfig, src: 'https://codepen.io/x/pen/abc', height: 600,
    }}});
    const frame = document.querySelector('.cpub-section-embed-frame') as HTMLElement;
    expect(frame.style.height).toBe('600px');
  });
});
