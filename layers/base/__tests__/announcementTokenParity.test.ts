import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ANNOUNCEMENT_TOKEN_NAMES, ANNOUNCEMENT_TOKEN_HINTS } from '../utils/contestEmailTokens';

/**
 * The composer's token list is a CLIENT-SIDE MIRROR of `ANNOUNCEMENT_TOKENS` in
 * `@commonpub/server` (it cannot import the server barrel without dragging
 * Drizzle into the browser bundle). A mirror that drifts is worse than no
 * mirror: the composer would advertise a token the send does not resolve, and an
 * organizer would mail everyone a literal `{whatever}`.
 *
 * The first cut of this feature shipped a UI list missing `siteUrl`. This reads
 * the server's real source and fails on any difference, in either direction.
 */
const SERVER_SRC = resolve(
  __dirname, '..', '..', '..', 'packages', 'server', 'src', 'contest', 'announcements.ts',
);

function serverTokens(): string[] {
  const src = readFileSync(SERVER_SRC, 'utf8');
  const block = /export const ANNOUNCEMENT_TOKENS = \[([\s\S]*?)\] as const;/.exec(src);
  if (!block) throw new Error('ANNOUNCEMENT_TOKENS not found in the server source; did it move or get renamed?');
  return [...block[1]!.matchAll(/'([a-zA-Z]+)'/g)].map((m) => m[1]!);
}

describe('announcement token parity', () => {
  // A parity test that parses nothing passes vacuously.
  it('actually parsed a non-trivial list out of the server source', () => {
    expect(serverTokens().length).toBeGreaterThanOrEqual(6);
  });

  it('the composer offers exactly the tokens the server resolves, in the same order', () => {
    expect([...ANNOUNCEMENT_TOKEN_NAMES]).toEqual(serverTokens());
  });

  it('every offered token has a hint, and no hint describes a token that does not exist', () => {
    expect(Object.keys(ANNOUNCEMENT_TOKEN_HINTS).sort()).toEqual([...ANNOUNCEMENT_TOKEN_NAMES].sort());
  });
});
