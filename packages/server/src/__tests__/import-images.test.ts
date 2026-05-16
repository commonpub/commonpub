import { describe, it, expect } from 'vitest';
import { parseHTML } from 'linkedom';
import { resolveContentImages } from '../import/images.js';

function imgs(html: string, base = 'https://example.com/post'): string[] {
  const { document } = parseHTML(html);
  resolveContentImages(document, base);
  return Array.from(document.querySelectorAll('img')).map((el) =>
    (el as unknown as { getAttribute(n: string): string | null }).getAttribute('src') ?? '',
  );
}

describe('resolveContentImages', () => {
  it('promotes data-src over a base64 placeholder src', () => {
    expect(
      imgs('<img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" data-src="https://cdn/real.jpg">'),
    ).toEqual(['https://cdn/real.jpg']);
  });

  it('picks the largest from data-srcset', () => {
    expect(
      imgs('<img src="data:," data-srcset="https://cdn/a-320.jpg 320w, https://cdn/b-1280.jpg 1280w, https://cdn/c-640.jpg 640w">'),
    ).toEqual(['https://cdn/b-1280.jpg']);
  });

  it('falls back to a real plain srcset when src is a placeholder', () => {
    expect(
      imgs('<img src="" srcset="https://cdn/s.jpg 1x, https://cdn/l.jpg 2x">'),
    ).toEqual(['https://cdn/l.jpg']);
  });

  it('keeps a good src untouched but absolutizes it', () => {
    expect(imgs('<img src="/uploads/photo.jpg">')).toEqual([
      'https://example.com/uploads/photo.jpg',
    ]);
  });

  it('absolutizes a relative data-src against the base url', () => {
    expect(
      imgs('<img src="data:image/gif;base64,x" data-src="../img/diagram.png">', 'https://hackster.io/u/proj/'),
    ).toEqual(['https://hackster.io/u/img/diagram.png']);
  });

  it('handles the Hackster lazy pattern (data-src + placeholder gif)', () => {
    const out = imgs(
      '<div itemprop="text"><p>Step 1</p>' +
        '<img class="lazy" src="https://hackster.imgix.net/spacer.gif" data-src="https://hackster.imgix.net/wiring.jpg?w=800"></div>',
      'https://www.hackster.io/alice/my-robot',
    );
    expect(out).toEqual(['https://hackster.imgix.net/wiring.jpg?w=800']);
  });

  it('leaves a node with no usable URL untouched (no crash)', () => {
    // src is a placeholder and there is no data-* / srcset to recover.
    const { document } = parseHTML('<img src="data:image/gif;base64,x" alt="broken">');
    expect(() => resolveContentImages(document, 'https://example.com')).not.toThrow();
  });

  it('strips lazy attributes after resolving (no duplicate/placeholder leakage)', () => {
    const { document } = parseHTML(
      '<img src="data:," data-src="https://cdn/real.jpg" data-srcset="https://cdn/x 1w" srcset="https://cdn/y 1w">',
    );
    resolveContentImages(document, 'https://example.com');
    const el = document.querySelector('img') as unknown as {
      getAttribute(n: string): string | null;
    };
    expect(el.getAttribute('src')).toBe('https://cdn/real.jpg');
    expect(el.getAttribute('data-src')).toBeNull();
    expect(el.getAttribute('data-srcset')).toBeNull();
    expect(el.getAttribute('srcset')).toBeNull();
  });

  it('returns the count of rewritten images', () => {
    const { document } = parseHTML(
      '<img src="data:," data-src="https://cdn/a.jpg">' +
        '<img src="https://cdn/already-absolute.jpg">' + // unchanged (already absolute & good)
        '<img src="data:," data-src="https://cdn/b.jpg">',
    );
    const n = resolveContentImages(document, 'https://example.com');
    expect(n).toBe(2);
  });
});
