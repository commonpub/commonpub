import { describe, it, expect } from 'vitest';
import { seedBodyBlocks } from '../contestBody';

describe('seedBodyBlocks', () => {
  it('passes through existing blocks unchanged', () => {
    const blocks = [['heading', { text: 'X' }]];
    expect(seedBodyBlocks(blocks, 'ignored markdown')).toBe(blocks);
  });

  it('converts legacy markdown into blocks (convert-on-edit)', () => {
    const out = seedBodyBlocks(null, '# Title\n\nBody text');
    expect(out.length).toBeGreaterThan(0);
    expect(JSON.stringify(out)).toContain('Title');
  });

  it('preserves legacy HTML verbatim in a single markdown block (lossless)', () => {
    const html = '<div style="color:#000">Hi</div>';
    // The markdown block's attr key is `source` (matches MarkdownBlock + BlockMarkdownView).
    expect(seedBodyBlocks([], html, 'html')).toEqual([['markdown', { source: html }]]);
  });

  it('returns [] when there are neither blocks nor legacy text', () => {
    expect(seedBodyBlocks(null, '')).toEqual([]);
    expect(seedBodyBlocks([], null)).toEqual([]);
    expect(seedBodyBlocks(undefined, '   ')).toEqual([]);
  });
});
