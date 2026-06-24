import { describe, it, expect } from 'vitest';
import { imageFramingStyle, defaultImageMeta } from '../contestImage';

describe('imageFramingStyle', () => {
  it('null/absent keeps the legacy cover fit with no transform (back-compat)', () => {
    expect(imageFramingStyle(null)).toEqual({ objectFit: 'cover' });
    expect(imageFramingStyle(undefined)).toEqual({ objectFit: 'cover' });
  });

  it('zoom 0 means contain (perfect fit)', () => {
    expect(imageFramingStyle({ zoom: 0, x: 50, y: 50 })).toEqual({ objectFit: 'contain', objectPosition: '50% 50%' });
  });

  it('zoom > 0 scales over cover with object-position', () => {
    const s = imageFramingStyle({ zoom: 0.5, x: 20, y: 80 });
    expect(s.objectFit).toBe('cover');
    expect(s.transform).toBe('scale(1.5)');
    expect(s.objectPosition).toBe('20% 80%');
  });

  it('clamps x/y to 0..100 and zoom to <= 4', () => {
    const s = imageFramingStyle({ zoom: 99, x: -10, y: 250 });
    expect(s.transform).toBe('scale(5)'); // 1 + min(4, 99)
    expect(s.objectPosition).toBe('0% 100%');
  });

  it('defaultImageMeta is a centered contain', () => {
    expect(defaultImageMeta()).toEqual({ zoom: 0, x: 50, y: 50 });
  });
});
