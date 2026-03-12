import { describe, it, expect } from 'vitest';
import { searchDocsPages } from '../docs';

describe('searchDocsPages', () => {
  it('returns empty array for empty query', async () => {
    const db = {} as any;
    const result = await searchDocsPages(db, 'site-1', 'ver-1', '');
    expect(result).toEqual([]);
  });

  it('returns empty array for whitespace-only query', async () => {
    const db = {} as any;
    const result = await searchDocsPages(db, 'site-1', 'ver-1', '   ');
    expect(result).toEqual([]);
  });
});
