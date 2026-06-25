/**
 * Tests for BlockEmbedView — the public render of a generic embed block. Locks
 * the rendered-width preset cap (`cpub-embed-size-{s|m|l|full}`, fallback 'l'),
 * the embed-url gate, and the 16:9 aspect-ratio CSS contract.
 *
 * `toEmbedUrl` is a Nuxt auto-import the layer test harness doesn't provide;
 * assign the REAL util on globalThis (the component calls it as a global).
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/vue';
import BlockEmbedView from '../BlockEmbedView.vue';
import { toEmbedUrl } from '../../../utils/embedUrl';

Object.assign(globalThis, { toEmbedUrl });

const URL = 'https://example.com/widget';

describe('BlockEmbedView — size cap', () => {
  it.each([
    ['s', 'cpub-embed-size-s'],
    ['m', 'cpub-embed-size-m'],
    ['l', 'cpub-embed-size-l'],
    ['full', 'cpub-embed-size-full'],
  ])('applies the %s size class', (size, cls) => {
    const { container } = render(BlockEmbedView, { props: { content: { url: URL, size } } });
    expect(container.querySelector('.cpub-block-embed')?.classList.contains(cls)).toBe(true);
  });

  it('falls back to the reading-width (l) preset for a missing or bogus size', () => {
    for (const size of [undefined, '', 'wide', 7]) {
      const { container } = render(BlockEmbedView, { props: { content: { url: URL, size } } });
      expect(container.querySelector('.cpub-block-embed')?.classList.contains('cpub-embed-size-l')).toBe(true);
    }
  });
});

describe('BlockEmbedView — rendering', () => {
  it('renders the embed iframe for an http(s) url', () => {
    const { container } = render(BlockEmbedView, { props: { content: { url: URL } } });
    const iframe = container.querySelector('iframe.cpub-embed-iframe') as HTMLIFrameElement;
    expect(iframe).toBeTruthy();
    expect(iframe.getAttribute('src')).toBe(URL);
  });

  it('renders nothing for an empty or rejected (data:) url', () => {
    const { container: empty } = render(BlockEmbedView, { props: { content: {} } });
    expect(empty.querySelector('.cpub-block-embed')).toBeNull();
    const { container: evil } = render(BlockEmbedView, { props: { content: { url: 'data:text/html,<h1>x</h1>' } } });
    expect(evil.querySelector('.cpub-block-embed')).toBeNull();
  });
});

describe('BlockEmbedView — 16:9 aspect ratio', () => {
  // The 16/9 ratio is a scoped-CSS rule bound to `.cpub-embed-iframe` (verified
  // visually); jsdom doesn't expose scoped styles, so lock the structural
  // contract the ratio depends on — the iframe class + the wrap it sits in.
  it('renders the ratio-bearing iframe inside the embed wrap', () => {
    const { container } = render(BlockEmbedView, { props: { content: { url: URL } } });
    expect(container.querySelector('.cpub-embed-wrap > iframe.cpub-embed-iframe')).toBeTruthy();
  });
});

describe('BlockEmbedView — accessibility', () => {
  // axe-core can't traverse into the iframe in jsdom, so assert the a11y
  // contract directly: the embedded frame carries a descriptive title.
  it('gives the iframe a non-empty descriptive title', () => {
    const { container } = render(BlockEmbedView, { props: { content: { url: URL } } });
    expect(container.querySelector('iframe.cpub-embed-iframe')?.getAttribute('title')).toBe('Embedded content');
  });
});
