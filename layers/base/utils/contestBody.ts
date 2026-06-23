import { markdownToBlockTuples, type BlockTuple } from '@commonpub/editor';

/**
 * Seed the contest body block editor (overview/rules): prefer existing
 * `BlockTuple[]`; otherwise convert the legacy markdown/html body — the
 * convert-on-edit pattern (CLAUDE rule #4), so editing a legacy contest doesn't
 * lose its content. Legacy HTML is preserved VERBATIM in a single markdown block
 * (lossless) rather than lossily re-parsed; markdown is parsed into real blocks.
 */
export function seedBodyBlocks(
  blocks: unknown[] | null | undefined,
  legacy?: string | null,
  legacyFormat?: 'markdown' | 'html' | null,
): BlockTuple[] {
  if (Array.isArray(blocks) && blocks.length) return blocks as BlockTuple[];
  const text = (legacy ?? '').trim();
  if (!text) return [];
  if (legacyFormat === 'html') return [['markdown', { content: text }]];
  try {
    const parsed = markdownToBlockTuples(text);
    return parsed.length ? parsed : [['markdown', { content: text }]];
  } catch {
    return [['markdown', { content: text }]];
  }
}
