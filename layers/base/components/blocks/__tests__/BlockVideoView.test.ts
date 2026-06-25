/**
 * Tests for BlockVideoView — the public render of a video block. Locks the
 * rendered-width preset cap (`cpub-video-size-{s|m|l|full}`, fallback 'l'), the
 * platform label, the embed-url gate, and the 16:9 aspect-ratio CSS contract.
 *
 * `toEmbedUrl` is a Nuxt auto-import the layer test harness doesn't provide;
 * assign the REAL util on globalThis (the component calls it as a global).
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/vue';
import BlockVideoView from '../BlockVideoView.vue';
import { toEmbedUrl } from '../../../utils/embedUrl';

Object.assign(globalThis, { toEmbedUrl });

const YT = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

describe('BlockVideoView — size cap', () => {
  it.each([
    ['s', 'cpub-video-size-s'],
    ['m', 'cpub-video-size-m'],
    ['l', 'cpub-video-size-l'],
    ['full', 'cpub-video-size-full'],
  ])('applies the %s size class', (size, cls) => {
    const { container } = render(BlockVideoView, { props: { content: { url: YT, size } } });
    expect(container.querySelector('.cpub-block-video')?.classList.contains(cls)).toBe(true);
  });

  it('falls back to the reading-width (l) preset for a missing or bogus size', () => {
    for (const size of [undefined, '', 'xl', 'huge', 42]) {
      const { container } = render(BlockVideoView, { props: { content: { url: YT, size } } });
      expect(container.querySelector('.cpub-block-video')?.classList.contains('cpub-video-size-l')).toBe(true);
    }
  });
});

describe('BlockVideoView — rendering', () => {
  it('renders the embed iframe and the platform label', () => {
    const { container } = render(BlockVideoView, { props: { content: { url: YT } } });
    const iframe = container.querySelector('iframe.cpub-video-iframe') as HTMLIFrameElement;
    expect(iframe).toBeTruthy();
    expect(iframe.getAttribute('src')).toContain('youtube-nocookie.com/embed/dQw4w9WgXcQ');
    expect(container.querySelector('.cpub-video-label')?.textContent).toContain('YouTube');
  });

  it('labels Vimeo and unknown providers', () => {
    const { container: v } = render(BlockVideoView, { props: { content: { url: 'https://vimeo.com/12345' } } });
    expect(v.querySelector('.cpub-video-label')?.textContent).toContain('Vimeo');
    const { container: o } = render(BlockVideoView, { props: { content: { url: 'https://example.com/clip.mp4' } } });
    expect(o.querySelector('.cpub-video-label')?.textContent).toContain('Video');
  });

  it('renders nothing for an empty or rejected (javascript:) url', () => {
    const { container: empty } = render(BlockVideoView, { props: { content: {} } });
    expect(empty.querySelector('.cpub-block-video')).toBeNull();
    const { container: evil } = render(BlockVideoView, { props: { content: { url: 'javascript:alert(1)' } } });
    expect(evil.querySelector('.cpub-block-video')).toBeNull();
  });
});

describe('BlockVideoView — 16:9 aspect ratio', () => {
  // The 16/9 ratio is a scoped-CSS rule bound to `.cpub-video-iframe` (verified
  // visually); jsdom doesn't expose scoped styles, so lock the structural
  // contract the ratio depends on — the iframe class + the wrap it sits in.
  it('renders the ratio-bearing iframe inside the video wrap', () => {
    const { container } = render(BlockVideoView, { props: { content: { url: YT } } });
    expect(container.querySelector('.cpub-video-wrap > iframe.cpub-video-iframe')).toBeTruthy();
  });
});

describe('BlockVideoView — accessibility', () => {
  // axe-core can't traverse into the iframe in jsdom, so assert the a11y
  // contract directly: the embedded frame carries a descriptive title.
  it('gives the iframe a non-empty descriptive title', () => {
    const { container } = render(BlockVideoView, { props: { content: { url: YT } } });
    expect(container.querySelector('iframe.cpub-video-iframe')?.getAttribute('title')).toBe('YouTube video');
  });
});
