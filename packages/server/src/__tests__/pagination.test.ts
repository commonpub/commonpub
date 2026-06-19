import { describe, it, expect } from 'vitest';
import { normalizePagination } from '../query.js';

// Audit session 203: routes pass Number(query.limit), so `?limit=abc` reaches here as NaN.
// `??` does not catch NaN, which previously produced `LIMIT NaN` → unauthenticated 500.
describe('normalizePagination', () => {
  it('defaults when limit/offset are undefined', () => {
    expect(normalizePagination({})).toEqual({ limit: 20, offset: 0 });
  });

  it('falls back to defaults for NaN (the ?limit=abc / ?offset=abc DoS)', () => {
    expect(normalizePagination({ limit: NaN, offset: NaN })).toEqual({ limit: 20, offset: 0 });
  });

  it('falls back to defaults for non-finite values', () => {
    expect(normalizePagination({ limit: Infinity, offset: -Infinity })).toEqual({ limit: 20, offset: 0 });
  });

  it('clamps limit to [1, 100] and offset to >= 0', () => {
    expect(normalizePagination({ limit: 500, offset: -5 })).toEqual({ limit: 100, offset: 0 });
    expect(normalizePagination({ limit: 0, offset: 10 })).toEqual({ limit: 1, offset: 10 });
  });

  it('truncates fractional values', () => {
    expect(normalizePagination({ limit: 12.9, offset: 3.7 })).toEqual({ limit: 12, offset: 3 });
  });

  it('passes through valid values', () => {
    expect(normalizePagination({ limit: 50, offset: 25 })).toEqual({ limit: 50, offset: 25 });
  });
});
