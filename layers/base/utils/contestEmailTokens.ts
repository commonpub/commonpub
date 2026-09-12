/**
 * The `{token}` names the announcement composer offers an organizer.
 *
 * MIRRORS `ANNOUNCEMENT_TOKENS` in `packages/server/src/contest/announcements.ts`,
 * which is the source of truth the send, the preview and the test send all build
 * their values from. The server export cannot be imported here: it lives behind
 * the heavy `@commonpub/server` barrel and would drag Drizzle into the client
 * bundle. Same arrangement, and the same reason, as `contestEmailDefaults.ts`
 * mirroring `emailDefaults.ts`.
 *
 * Drift is not left to discipline: `__tests__/announcementTokenParity.test.ts`
 * reads both lists and fails if they differ. The first version of this feature
 * shipped a UI list missing `siteUrl`, which is exactly the failure that test
 * now catches.
 */
export const ANNOUNCEMENT_TOKEN_NAMES: readonly string[] = [
  'username',
  'displayName',
  'contestTitle',
  'contestUrl',
  'deadline',
  'timeRemaining',
  'siteName',
  'siteUrl',
];

/** One-line hint per token, shown beside the name so an organizer knows what
 *  each resolves to without sending a test. */
export const ANNOUNCEMENT_TOKEN_HINTS: Record<string, string> = {
  username: 'their @handle',
  displayName: 'their name, or handle if unset',
  contestTitle: 'this contest',
  contestUrl: 'a link to this contest',
  deadline: 'the next deadline, blank once it passes',
  timeRemaining: 'time left until it, blank once it passes',
  siteName: 'this site',
  siteUrl: 'a link to this site',
};
