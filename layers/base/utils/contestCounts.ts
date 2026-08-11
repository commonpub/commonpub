/**
 * Display rules for the public contest counts (session 253).
 *
 * Background. There are three numbers and they do not mean what their labels
 * used to claim:
 *
 * - `followerCount` is every row in `contest_registrations`, any tier. Everyone
 *   in that table registered for the contest; `tier` only records whether they
 *   registered to enter (`full`) or for reminders. So "N registered" over all
 *   rows is accurate, and it is the number this module treats as the public
 *   social-proof figure. It is on both `ContestDetail` and `ContestListItem`,
 *   and — unlike the per-viewer registration fetch — it is server-rendered, so
 *   binding to it is also what stops the contest page shipping
 *   "0 makers registered" in its SSR HTML.
 * - `entryCount` counts entry ROWS including the draft placeholders that
 *   `maybeCreateCombinedEntry` inserts at registration time in `combined` mode
 *   (packages/server/src/contest/submissions.ts:497-500,549). It is therefore
 *   larger than the entries a visitor can actually see, and it is the wrong
 *   number to headline while a contest is still open.
 * - `full` (registrants who registered to enter) is organiser information. The
 *   owner-only ContestRegistrantsPanel already shows the split; the public
 *   surfaces deliberately do not, because showing both invites the reader to
 *   add two overlapping numbers.
 *
 * The rules are pure functions rather than inline template conditions because
 * five surfaces render these counts — the /contests tile, the homepage widget,
 * the homepage hero, the contest hero, and deveco's forked homepage — and they
 * had already drifted into four different guards and two different labels.
 */

/** Minimum shape any contest-ish object needs for these rules. */
export interface ContestCountSource {
  status?: string | null;
  entryCount?: number | null;
  followerCount?: number | null;
}

/**
 * Entry counts only become meaningful once submissions have closed. Before
 * that, "0 entries" on a week-old contest is noise (and, thanks to the draft
 * placeholders above, not even a count of visible entries). After judging
 * begins the number is final and worth showing.
 */
export function showsEntryCount(c: ContestCountSource): boolean {
  const n = c.entryCount ?? 0;
  if (n <= 0) return false;
  return c.status === 'judging' || c.status === 'completed';
}

/** `12 entries` / `1 entry`. Callers should gate on `showsEntryCount` first. */
export function entryCountLabel(c: ContestCountSource): string {
  const n = c.entryCount ?? 0;
  return `${n} ${n === 1 ? 'entry' : 'entries'}`;
}

/**
 * Whether to show the registered figure at all. Suppressed at zero: an empty
 * count is not information a reader can act on, and every `followerCount` site
 * in the app already guarded this way, so this only makes the existing
 * convention explicit and shared.
 */
export function showsRegisteredCount(c: ContestCountSource): boolean {
  return (c.followerCount ?? 0) > 0;
}

/** `12 registered` / `1 registered`. Gate on `showsRegisteredCount` first. */
export function registeredCountLabel(c: ContestCountSource): string {
  return `${c.followerCount ?? 0} registered`;
}
