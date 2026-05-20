import { describe, expect, it } from 'vitest';
import { extractStartSeconds, toEmbedUrl } from '../embedUrl';

describe('toEmbedUrl — YouTube', () => {
  it('rewrites watch URL to nocookie embed', () => {
    expect(toEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ'))
      .toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
  });

  it('rewrites youtu.be short URL', () => {
    expect(toEmbedUrl('https://youtu.be/dQw4w9WgXcQ'))
      .toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
  });

  it('rewrites /embed/ URL (idempotent)', () => {
    expect(toEmbedUrl('https://www.youtube.com/embed/dQw4w9WgXcQ'))
      .toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
  });

  it('rewrites /shorts/ URL', () => {
    expect(toEmbedUrl('https://www.youtube.com/shorts/abcDEF12345'))
      .toBe('https://www.youtube-nocookie.com/embed/abcDEF12345');
  });

  it('rewrites mobile m.youtube.com', () => {
    expect(toEmbedUrl('https://m.youtube.com/watch?v=dQw4w9WgXcQ'))
      .toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
  });

  it('preserves ?t= integer seconds as ?start=', () => {
    expect(toEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=120'))
      .toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=120');
  });

  it('preserves ?t=120s (s-suffixed seconds)', () => {
    expect(toEmbedUrl('https://youtu.be/dQw4w9WgXcQ?t=120s'))
      .toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=120');
  });

  it('preserves ?t=2m30s as 150 seconds', () => {
    expect(toEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=2m30s'))
      .toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=150');
  });

  it('preserves ?t=1h30m45s as 5445 seconds', () => {
    expect(toEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1h30m45s'))
      .toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=5445');
  });

  it('ignores other query params like &list=', () => {
    expect(toEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLABC'))
      .toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
  });
});

describe('toEmbedUrl — Vimeo', () => {
  it('rewrites public vimeo.com/ID to player URL', () => {
    expect(toEmbedUrl('https://vimeo.com/123456789'))
      .toBe('https://player.vimeo.com/video/123456789');
  });

  it('preserves private-video hash as ?h=', () => {
    expect(toEmbedUrl('https://vimeo.com/123456789/abcdef12'))
      .toBe('https://player.vimeo.com/video/123456789?h=abcdef12');
  });
});

describe('toEmbedUrl — fallbacks + safety', () => {
  it('returns empty for empty / nullish input', () => {
    expect(toEmbedUrl('')).toBe('');
    expect(toEmbedUrl(null)).toBe('');
    expect(toEmbedUrl(undefined)).toBe('');
  });

  it('passes unknown https URLs through unchanged', () => {
    expect(toEmbedUrl('https://example.com/video.mp4'))
      .toBe('https://example.com/video.mp4');
  });

  it('passes unknown http URLs through unchanged', () => {
    expect(toEmbedUrl('http://example.com/x')).toBe('http://example.com/x');
  });

  it('rejects javascript: scheme', () => {
    expect(toEmbedUrl('javascript:alert(1)')).toBe('');
  });

  it('rejects data: scheme', () => {
    expect(toEmbedUrl('data:text/html,<script>alert(1)</script>')).toBe('');
  });

  it('rejects file: scheme', () => {
    expect(toEmbedUrl('file:///etc/passwd')).toBe('');
  });
});

describe('extractStartSeconds', () => {
  it('returns 0 when no t/start param present', () => {
    expect(extractStartSeconds('https://example.com/x')).toBe(0);
  });

  it('parses ?t=120 (bare integer)', () => {
    expect(extractStartSeconds('?t=120')).toBe(120);
  });

  it('parses ?start=300', () => {
    expect(extractStartSeconds('?start=300')).toBe(300);
  });

  it('parses ?t=120s (s-suffixed)', () => {
    expect(extractStartSeconds('?t=120s')).toBe(120);
  });

  it('parses #t=2m30s (fragment)', () => {
    expect(extractStartSeconds('https://example.com/x#t=2m30s')).toBe(150);
  });

  it('parses &t=1h2m3s (h+m+s)', () => {
    expect(extractStartSeconds('https://example.com/x?v=A&t=1h2m3s')).toBe(3723);
  });

  it('returns 0 for malformed param', () => {
    expect(extractStartSeconds('?t=garbage')).toBe(0);
  });
});
