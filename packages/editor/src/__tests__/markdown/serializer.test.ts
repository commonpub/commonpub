import { describe, it, expect } from 'vitest';
import { blockTuplesToMarkdown } from '../../markdown/serializer';
import type { BlockTuple } from '../../blocks/types';

describe('blockTuplesToMarkdown ordered lists', () => {
  it('preserves ordered-list item text one-per-line (regression: callback dropped $1)', () => {
    const blocks: BlockTuple[] = [['text', { html: '<ol><li>First</li><li>Second</li></ol>' }]];
    const md = blockTuplesToMarkdown(blocks);
    expect(md).toContain('1. First');
    expect(md).toContain('2. Second');
    // Each item on its own line — not the bare-number data-loss output, and not
    // the run-together "1. First2. Second".
    expect(md).toMatch(/1\. First\n2\. Second/);
  });

  it('renders unordered list items one-per-line', () => {
    const ul: BlockTuple[] = [['text', { html: '<ul><li>Alpha</li><li>Beta</li></ul>' }]];
    expect(blockTuplesToMarkdown(ul)).toMatch(/- Alpha\n- Beta/);
  });
});
