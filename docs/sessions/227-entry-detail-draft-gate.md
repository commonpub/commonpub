# Session 227 — entry-detail draft gate (SHIPPED)

Carried out `docs/sessions/227-kickoff.md`'s top backlog item: the residual from
session 226's A2. The entries LISTING already hides draft-backed proposal entries
from non-privileged callers, but the **entry-detail route** had no content-status
filter, so a non-owner who guessed a draft `entryId` could open
`/contests/:slug/entries/:id` directly and read its title / artifacts. Closed the
direct-URL path and suppressed the dead "View the project" link.

## What shipped — server 2.95.0 + layer 0.86.8 (no schema/migration)

### Server 2.95.0
- **`getContestEntry`** (`packages/server/src/contest/entries.ts`) now selects the
  backing `contentItems.status` and returns it as **`contentStatus`** on the
  enriched entry. Added `contentStatus?: string` to `ContestEntryItem`
  (`contest/types.ts`) — present on `getContestEntry`, omitted by the public
  listing (which already filters drafts out via `onlyPublishedContent`).

### Layer 0.86.8
- **Route gate** (`server/api/contests/[slug]/entries/[entryId]/index.get.ts`):
  after computing `privileged` + `isEntrant`, a **404** if
  `entry.contentStatus !== 'published' && !privileged && !isEntrant`. Mirrors the
  listing's `onlyPublishedContent` semantics: a draft placeholder is openable only
  by the entrant or a privileged viewer (owner / `contest.manage` / panel judge).
  A 404 (not 403) so existence isn't confirmed.
- **Page** (`pages/contests/[slug]/entries/[entryId].vue`): the "View the project"
  link points at the public content page, which is **author-only** for non-published
  content (`getContentBySlug` returns null for a draft to a non-author — privileged
  viewers do NOT get a draft pass). So show the link only when the content is
  published OR the viewer is the entrant; otherwise it's a dead link for a
  privileged viewer looking at someone else's draft placeholder. Added `useAuth()`
  + `showProjectLink` computed.

## Tests
- **Server** (`contest-proposals.integration.test.ts`, +1): `getContestEntry`
  surfaces `contentStatus` — `'draft'` for a fresh proposal placeholder, `'published'`
  after the entrant develops + publishes it. Suite **1498**.
- **Layer**: new static contract test
  (`server/api/contests/__tests__/entry-detail-draft-gate.test.ts`, +3) locks the
  3-condition gate + the 404 (matching the `entries-score-gating.test.ts` pattern —
  a full nitro+auth harness for these handlers isn't wired). Component test
  (`contestEntryDetailPage.test.ts`, +2): the dead link is hidden for a non-entrant
  viewing a draft and kept for the entrant viewing their own draft (also fixed
  `makeEntry` to actually spread its `...overrides`, and stubbed `useAuth`). Suite
  **1410**. Full `pnpm typecheck` **28/28**.
- **Live** (docker pg :5433 + nuxt dev :3001, real proposal flow): seeded an active
  proposal contest, an entrant submitted a proposal (draft placeholder), then hit
  the detail route. **Draft entry** → anon **404**, entrant **200**, third-party
  (signed-in, non-priv) **404**, organizer (admin) **200**. After publishing the
  placeholder → **all 200** (no over-blocking). Bogus entryId → **404**.

## Release / roll
- Published **server 2.95.0** then **layer 0.86.8** (`pnpm run publish:layer`; the
  layer pins server 2.95.0). Both new test files live under non-bracketed `__tests__`
  dirs, so no pack leak (the `[slug]`/`[entryId]` bracketed-path trap doesn't apply).
- PR to main → commonpub.io deploys on push. deveco.io + heatsynclabs.io: bumped
  `@commonpub/{server,layer}` pins (`^2.95.0`/`^0.86.8`) + lockfiles, pushed main.
- No schema bump → no migration; latest stays **0034**.

## Decisions
- **404 not 403**: a 403 would confirm the entryId exists. The list-hide + detail-404
  give a uniform "not found" to anyone without a legitimate reason to see the draft.
- **Privileged viewers keep the detail but lose the project link**: an admin/judge
  legitimately reviews a draft placeholder's artifacts on the detail page, but the
  *public* content page is author-only, so the outbound link would 404 for them —
  hence the link is entrant-or-published only, while the detail itself stays open to
  privileged viewers.

## Open / next (unchanged backlog from 226/227 kickoff)
- Agreement-terms block editing; bulk PII review UI; judge-invite-resend trigger;
  stage-advance discoverability; wire a `pnpm pack` test-leak check into
  `publish:layer`; heatsync Dependabot `@types/hast`.
- Deferred a11y: `--accent` as small link/nav TEXT (~2.8:1, brand decision);
  `--green-border`-as-TEXT cases.
- P3s: maxEntries TOCTOU (count outside tx); eliminated entries still votable
  (by-design?); proposal-form SSR flash before lazy entries load.
