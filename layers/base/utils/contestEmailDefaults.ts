import type { BlockTuple } from '@commonpub/editor';

/**
 * Client-safe default email body blocks + seeding for the contest email block
 * editor (M3). MIRRORS the server's `defaultContestEmailBlocks`
 * (packages/server/src/contest/emailDefaults.ts) so the editor opens with the
 * SAME starter template that the send-time built-in default renders — keep the
 * copy in sync if either changes. (The server export can't be imported here: it
 * lives behind the heavy @commonpub/server barrel and would break the client
 * bundle. This is a pure layer util, like `contestBody.ts`.)
 *
 * Uses the block EDITOR content shapes: heading `{text,level}`, paragraph
 * `{html}` — the shapes HeadingBlock/TextBlock read, and that renderEmailBlocks
 * renders (heading via content.text; paragraph via stripped content.html).
 */
export type ContestEmailKind = 'confirmation' | 'reminder';

export function defaultEmailBlocks(kind: ContestEmailKind): BlockTuple[] {
  if (kind === 'reminder') {
    return [
      ['heading', { text: 'Hi {username},', level: 2 }],
      ['paragraph', { html: 'The submission deadline for {contestTitle} is in about {timeRemaining}. Make sure your entry is in before then.' }],
    ];
  }
  return [
    ['heading', { text: 'Hi {username},', level: 2 }],
    ['paragraph', { html: 'You are now registered for {contestTitle}. We will send you reminders as the submission deadline approaches.' }],
  ];
}

/**
 * Seed the email block editor for one template, precedence:
 *   1. stored `bodyBlocks` (non-empty) — use as-is
 *   2. legacy plain-text `intro` (set) — convert blank-line-separated paragraphs
 *      into paragraph blocks (convert-on-open, mirroring the contest-body pattern)
 *   3. the built-in starter template — so the editor never opens empty
 */
export function seedEmailBlocks(blocks: unknown, intro: string | undefined, kind: ContestEmailKind): BlockTuple[] {
  if (Array.isArray(blocks) && blocks.length) return blocks as BlockTuple[];
  const text = (intro ?? '').trim();
  if (text) {
    return text
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => ['paragraph', { html: escapeInline(p) }] as BlockTuple);
  }
  return defaultEmailBlocks(kind);
}

/** The legacy intro is PLAIN TEXT; escape it when placing into a paragraph block's
 *  html so stray `<`/`>`/`&` render literally rather than as markup. */
function escapeInline(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
