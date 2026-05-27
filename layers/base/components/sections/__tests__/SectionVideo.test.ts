/**
 * Component-level tests for SectionVideo.
 * Asserts dispatch between <video> (local) + <iframe> (embed) +
 * empty-state behavior + sandbox attributes for security.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render } from '@testing-library/vue';
import SectionVideo from '../SectionVideo.vue';

const meta = {
  route: '/',
  zone: 'main',
  isPreview: false,
  effectiveColSpan: 12,
  sectionId: 'vid-1',
};

interface VideoConfigForTest extends Record<string, unknown> {
  heading: string;
  src: string;
  title: string;
  aspectRatio: '16/9' | '4/3' | '1/1' | '9/16';
  autoplay: boolean;
}

const baseConfig: VideoConfigForTest = {
  heading: '',
  src: '',
  title: '',
  aspectRatio: '16/9',
  autoplay: false,
};

afterEach(() => { document.body.innerHTML = ''; });

describe('SectionVideo — dispatch', () => {
  it('renders nothing when src is empty', () => {
    render(SectionVideo, { props: { meta, config: baseConfig } });
    expect(document.querySelector('.cpub-section-video')).toBeNull();
  });

  it('renders <video> for relative path (local file)', () => {
    render(SectionVideo, { props: { meta, config: { ...baseConfig, src: '/uploads/demo.mp4' } } });
    const v = document.querySelector('video');
    expect(v).not.toBeNull();
    expect(v?.getAttribute('src')).toBe('/uploads/demo.mp4');
    expect(v?.getAttribute('controls')).not.toBeNull();
    expect(v?.getAttribute('preload')).toBe('metadata');
    expect(document.querySelector('iframe')).toBeNull();
  });

  it('renders <video> for URL ending in .mp4/.webm/.ogg', () => {
    for (const url of [
      'https://cdn.example/v.mp4',
      'https://cdn.example/v.webm',
      'https://cdn.example/v.ogg',
      'https://cdn.example/v.mov',
    ]) {
      document.body.innerHTML = '';
      render(SectionVideo, { props: { meta, config: { ...baseConfig, src: url } } });
      const v = document.querySelector('video');
      expect(v, `${url} should render <video>`).not.toBeNull();
      expect(v?.getAttribute('src')).toBe(url);
    }
  });

  it('renders <iframe> for YouTube watch URL (rewritten to nocookie embed)', () => {
    render(SectionVideo, { props: { meta, config: {
      ...baseConfig, src: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    }}});
    const iframe = document.querySelector('iframe');
    expect(iframe).not.toBeNull();
    expect(iframe?.getAttribute('src')).toContain('youtube-nocookie.com/embed/dQw4w9WgXcQ');
    expect(document.querySelector('video')).toBeNull();
  });

  it('renders <iframe> for Vimeo URL', () => {
    render(SectionVideo, { props: { meta, config: {
      ...baseConfig, src: 'https://vimeo.com/12345678',
    }}});
    const iframe = document.querySelector('iframe');
    expect(iframe?.getAttribute('src')).toContain('player.vimeo.com/video/12345678');
  });

  it('renders error placeholder for unknown / empty embed (toEmbedUrl returns empty)', () => {
    render(SectionVideo, { props: { meta, config: {
      ...baseConfig, src: 'invalid://not-http',
    }}});
    // toEmbedUrl returns '' for non-http(s); local-file check returns false too
    expect(document.querySelector('.cpub-section-video-error')).not.toBeNull();
  });
});

describe('SectionVideo — security', () => {
  it('iframe has restrictive sandbox attributes', () => {
    render(SectionVideo, { props: { meta, config: {
      ...baseConfig, src: 'https://www.youtube.com/watch?v=abc123',
    }}});
    const iframe = document.querySelector('iframe');
    const sandbox = iframe?.getAttribute('sandbox') ?? '';
    expect(sandbox).toContain('allow-scripts');
    expect(sandbox).toContain('allow-same-origin');
    expect(sandbox).toContain('allow-presentation');
    // CRITICAL: no allow-top-navigation — embed cannot navigate parent
    expect(sandbox).not.toContain('allow-top-navigation');
    expect(iframe?.getAttribute('loading')).toBe('lazy');
  });

  it('iframe title is the section title when set, falls back to default', () => {
    render(SectionVideo, { props: { meta, config: {
      ...baseConfig, src: 'https://www.youtube.com/watch?v=abc', title: 'Build log',
    }}});
    expect(document.querySelector('iframe')?.getAttribute('title')).toBe('Build log');

    document.body.innerHTML = '';
    render(SectionVideo, { props: { meta, config: {
      ...baseConfig, src: 'https://www.youtube.com/watch?v=abc',
    }}});
    expect(document.querySelector('iframe')?.getAttribute('title')).toBe('Embedded video');
  });
});

describe('SectionVideo — aspect + autoplay', () => {
  it.each(['16/9', '4/3', '1/1', '9/16'] as const)(
    'sets data-aspect=%s on the frame',
    (ratio) => {
      render(SectionVideo, { props: { meta, config: {
        ...baseConfig, src: '/v.mp4', aspectRatio: ratio,
      }}});
      expect(document.querySelector('.cpub-section-video-frame')?.getAttribute('data-aspect')).toBe(ratio);
    },
  );

  it('sets muted + autoplay on <video> when autoplay=true', () => {
    render(SectionVideo, { props: { meta, config: {
      ...baseConfig, src: '/v.mp4', autoplay: true,
    }}});
    const v = document.querySelector('video') as HTMLVideoElement;
    // Vue 3 + jsdom: boolean attrs may be bound as DOM properties rather
    // than attributes — assert the .autoplay/.muted property is true,
    // which is what actually drives browser behavior.
    expect(v.autoplay).toBe(true);
    expect(v.muted).toBe(true);
  });

  it('does not set autoplay when autoplay=false', () => {
    render(SectionVideo, { props: { meta, config: { ...baseConfig, src: '/v.mp4' } } });
    const v = document.querySelector('video') as HTMLVideoElement;
    expect(v.autoplay).toBe(false);
  });
});
