# Session 234 — post-233 backlog remediation (ultracode: design → adversarial-verify → build)

Date: 2026-07-13. Branch **`session-234-remediation`** (NOT merged/rolled). Built on `main` after the
231/232/233 roll. Method: a read-only Workflow ran, per backlog item, a Plan-agent design pass (deep code
read, cite file:line, reuse existing helpers, CLAUDE.md rules, DEFER if not provably correct) + an
independent adversarial verify pass (re-read the code, check over-block, rules, test adequacy → BUILD/
DEFER). Then each double-approved item was implemented TDD in the main loop, verified per change. Full
`pnpm test` (33/33) + `pnpm typecheck` (28/28) green, isolated.

## Built + committed (7)

1. **fix(security): comment-write access gate** (`a12132f8`) — HIGH. `createComment` had no read-access
   check, so a non-member could inject a comment + author notification into a private hub's post or onto
   members/private/draft content by id (the write-side counterpart to the session-233 read leaks, deferred
   there). Extracted the `listComments` gate into one shared `canAccessCommentTarget` predicate applied on
   both read + write paths (route 404s to avoid existence disclosure). Fixed 2 existing tests that
   commented on draft content as a non-author.
2. **fix(federation): outbox negative-page clamp** (`1ba7445a`) — P2. Negative/zero `?page=` → negative
   OFFSET → unauth 500 on all 3 outbox surfaces (user route ungated). Clamp page>=1 at the read choke point.
3. **fix(federation): id-less reply dedup** (`d166acc0`) — P2. Id-less `Create{Note,inReplyTo}` bumped
   comment counts with no dedup → unbounded inflation by a signed peer. Gate the reply side-effects on a
   per-reply-id claim via the existing `recordActivitySeen`/`processed_activities` ledger (no migration).
4. **chore(cli): re-pin create-commonpub 0.5.22** (`10fa3ce4`) — new scaffolds pin the rolled versions.
   crates.io tag is a separate operator step.
5. **fix(config): ENV_FLAG_MAP completeness + parity guard** (`b2135ac6`) — 8 of 33 boolean flags were
   env-unmappable (incl. the new contest flags). Filled all 33, extracted to a zero-import module, added a
   parity test that fails on future drift.
6. **fix(a11y): WCAG AA contrast** (`62da730b`) — StatBar label + kbd keycap used `--text-faint`
   (2.3:1/2.1:1 light, below AA). → `--text-dim` / `--text`. Guard test reads the token from the actual
   rule + theme hexes and computes real contrast (revert-proof).
7. **test(layer): P-3 content-read CI tripwire** (`be60321b`) — a new file reading `contentItems` without
   the shared visibility predicate now trips a test (34-file allowlist). Verified red on a probe, green
   after. Backstop against the session-204 leak class.

## Deliberately DEFERRED (2 — reported, not skipped)

- **Federation mirror-storage gate (§2b, P1)** — DEFERRED by *both* design and verify. `onCreate` stores
  federatedContent for any signed peer with no matching-mirror gate (unbounded growth), but the naive
  mirror-only gate demonstrably OVER-BLOCKS: a local user following a remote actor with zero pull-mirrors
  would have that content wrongly dropped. The correct "wanted content" gate (follow-status + mirror +
  size/rate policy) needs a product/design decision — building it blind would break legitimate federation.
- **profileVisibility enforcement** — design+verify said BUILD, but deferred at the orchestration level:
  the field is currently **non-writable** (zero writers → every profile is `public`, no live exposure) and
  the design's gate covers only 1 of 6 profile-read routes. Shipping a partial, inert security gate is a
  half-measure against the "100% certain" bar. The correct fix is a small dedicated feature (add the writer
  + enforce consistently across all profile reads via a shared helper) — track it as such.

## Not verified live
Batch is on-branch, not rolled. Live browser verification of the comment gate + a11y contrast is
recommended at roll time (prior-session doctrine). If rolled: publishes are NOT required for most items
(server/layer/config source), but the CLI re-pin needs a crates.io tag and a11y needs the theme rebundle
at layer publish.
