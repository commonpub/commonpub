# Session 152 → 153 Handoff

Fresh Claude Code context. Session 152 (2026-05-21) shipped a focused
visual-bug fix for deveco.io across two layer patches (`0.21.21` +
`0.21.22`), then ran a deep audit pass that surfaced one new actionable
item and corrected two stale framings carried in from the session 151
handoff.

## TL;DR

- **Layer 0.21.20 → 0.21.22 live on all 3 instances.** Two patches in
  one session, both closing out the same universal CSS `border-radius`
  leak — first across 7 block components (`0.21.21`), then on
  ProjectView's own `.cpub-code-snippet` renderer (`0.21.22`) caught
  in the post-ship audit sweep.
- **Heatsync "dependabot failure" mystery solved.** Not a failure —
  PR #3 (nuxt 3.21.5 → 3.21.6) is sitting open + MERGEABLE since
  2026-05-19. Subsequent dependabot runs error with
  `pull_request_exists_for_security_update`, which surfaces as a red
  workflow status but means "the PR already exists, merge it." Merging
  PR #3 will clear 30 of heatsync's 36 alerts.
- **Federation flag framing in 151 was stale.** `federation: true` has
  been live on deveco + commonpub.io since `72bc80c` (2026-03-28). What
  was actually dormant: AP actor provisioning (WebFinger returns 404
  on all 3) + identity sub-flags (all `false`). P3 (signInWithRemote
  canary) is still the right next move.

## Orientation — read in order

1. `CLAUDE.md` — standing rules. No AI attribution to commits; `pnpm
   publish` not `npm publish` for layer; schema is the work.
2. **`docs/sessions/151-handoff-prompt.md`** — the prior handoff. Read
   it for full background on Stage 3 federation hardening, all the
   shipped primitives, and the existing priority list. This file is
   a delta on top of it — most priorities stand.
3. `docs/sessions/152-universal-radius-leak.md` — session 152 work log
   (covers 0.21.21 only; 0.21.22 is documented here as a direct
   continuation in the same audit pass).
4. `docs/plans/instance-self-update.md` — P4 admin self-update plan,
   awaiting maintainer decisions on 4 points.

## Current state (2026-05-21, end of session 152)

| Site | Versions live | Migration count | Federation flag | Identity flags | `CPUB_FED_TOKEN_KEY` | Dependabot |
|---|---|---|---|---|---|---|
| commonpub.io | schema 0.16.0, server 2.55.0, **layer 0.21.22**, infra 0.8.0, protocol 0.12.0, auth 0.6.0, config 0.13.0, ui 0.8.5, editor 0.7.11, explainer 0.7.15, learning 0.5.2, docs 0.6.3, test-utils 0.5.6 | 5 | true (live-flag, no actor) | all false | SET | 0 alerts |
| deveco.io | (same) | 5 | true (live-flag, no actor) | all false | SET | 0 alerts |
| heatsynclabs.io | (same) | 5 | **false** (flag) — but operator has uncommitted WIP to flip it on | all false | SET | **36 open** (1 open PR #3 awaiting merge) |

Health checks at 22:46 UTC: all 3 `/api/health` 200. WebFinger
`acct:moheeb@deveco.io` returns 404 — no instance actor provisioned
even with `federation: true`. The dormancy is in the actor + identity
layers, not the feature flag.

## What shipped in session 152

Two layer patches addressing one root cause: the universal
`*,::before,::after{border-radius:var(--radius)}` rule in
`layers/base/theme/base.css:239-244` applying the theme's `--radius` to
every element on the page. Invisible on `--radius:0` themes
(heatsync/commonpub.io); on `--radius:6px` themes (deveco) it rounds
inner sections of multi-section containers, leaving visible wedge gaps
inside `overflow:hidden` parents.

| Patch | Components | Trigger |
|---|---|---|
| `0.21.21` | BlockCodeView, BlockPartsListView, BlockVideoView, BlockEmbedView, BlockDownloadsView, BlockToolListView, BlockBuildStepView | User-reported "weird codeblocks" on deveco |
| `0.21.22` | ProjectView's `.cpub-code-snippet-header` + `.cpub-code-body` (the project sidebar Code tab) | Post-ship audit caught identical pattern outside `blocks/` |

Fix pattern: explicit `border-radius: 0` on each inner-section
selector. Specificity `(0,2,0)` on scoped selectors beats `*` universal
`(0,0,0)` cleanly — no `!important` needed.

**Stacked resets** on `BlockCodeView`'s `.cpub-code-body` (and
`BlockPartsListView`'s `<th>`): `border: 0 !important` from 0.21.20
defeats the `.cpub-prose pre` leak; `border-radius: 0` from 0.21.21
defeats the universal-radius leak. Different leak sources, both needed.

**`.cpub-step-num` (BlockBuildStepView)** was NOT reset — auto-rounding
to 6px on deveco looks intentional for a number badge. Don't reset
border-radius on bullet/icon/avatar elements.

**Why not remove the universal rule from base.css**: tempting but the
blast radius across deveco's theme is unpredictable. Deveco's design
likely depends on implicit rounding for elements that don't set
`border-radius` explicitly (cards, buttons, badges). The per-component
reset is targeted and reversible. Documented pitfall:
`feedback_universal_radius_leak.md`.

## Audit findings — corrections + new

### Federation framing — corrected

The session 151 handoff implied federation was off in prod. Empirical
state via `/api/features` on 2026-05-21:

| Site | `federation` | `seamlessFederation` | `federateHubs` | identity sub-flags | WebFinger | Outcome |
|---|---|---|---|---|---|---|
| deveco.io | **true** (since 2026-03-28) | **true** | **true** (since 2026-03-29) | all false | 404 | Flag-on, no actor |
| commonpub.io | **true** | **true** | **true** | all false | 404 | Flag-on, no actor |
| heatsynclabs.io | false | false | false | all false | 404 | Flag-off |

So the "federation flag off" framing in 151 was wrong; what was
genuinely dormant: (a) AP actor provisioning, (b) identity sub-flags,
(c) the `signCookieValue` codepath that flips live the moment any
identity flag is true. P3 (signInWithRemote canary) is still the right
next move because IT is the genuine flag flip needed to activate
identity flows. Memory `feedback_verify_flag_state` already covers
this pattern; this audit just confirmed it still happens.

### Heatsync "dependabot failure" — resolved

Two consecutive `Dependabot Updates` workflow runs (26209190010 +
26210041xxxx) show RED status on heatsync. Full log inspection
(`gh run view 26209190010 --log-failed`) reveals the actual error:

```
| pull_request_exists_for_security_update |
|   "dependency-name": "nuxt",            |
|   "dependency-version": "3.21.6"        |
```

Dependabot opened PR #3 (`chore(deps): bump nuxt from 3.21.5 to
3.21.6`) on 2026-05-19. It's been MERGEABLE + CLEAN since. Subsequent
dependabot runs detect the PR already exists and exit with this
"error" — which is really a notification, not a failure. The workflow
status is misleadingly red.

**Action**: merge PR #3 on heatsynclabs/heatsynclabs-io. That will
auto-bump nuxt + regenerate the lockfile (dependabot did the work
already). Merging will close ~30 of the 36 open alerts (axios is
transitive via nuxt's build chain; ws + esbuild are deep transitive
and may persist).

### Latent leak — ProjectView Parts tab (deferred)

ProjectView also has its own `.cpub-parts-table` styling (the Parts
tab, separate from `BlockPartsListView`). The cells (`<th>`, `<td>`)
get universal `border-radius:6px` on deveco. The wrap is `overflow-x:
auto`, NOT `overflow: hidden`, so there's no outer rounded clip → no
dramatic wedge-gap. With `border-collapse: collapse`, each cell's
auto-rounded corners produce subtle visual artifacts (cells with
`background: var(--surface2)` headers don't quite tile flush). Not
user-reported; left for next session as part of P8.

### Stacked resets table (for future block-component authors)

| Component | `border: 0 !important` (prose-pre leak) | `border-radius: 0` (universal leak) | Notes |
|---|---|---|---|
| BlockCodeView body | ✓ 0.21.20 | ✓ 0.21.21 | Both leaks confirmed live; both fixes confirmed on wire |
| BlockPartsListView `<th>` | ✓ 0.21.20 | ✓ 0.21.21 | Same |
| BlockMathView `<pre>` | ✗ (latent) | ✗ (latent) | P8 — math rare, not user-reported |
| BlockQuoteView `<blockquote>` | n/a (only color leaks — desirable) | n/a (no bg) | Acceptable |

## Priority list — refreshed for session 153

Inherits all P0-P9 from 151 except where noted. Item numbering held
stable for easy cross-reference.

### P0 — Security patches (Nuxt, better-auth, jose)

Unchanged from 151. **Two specific actions:**

1. **Merge heatsync PR #3** (chore(deps): bump nuxt from 3.21.5 to
   3.21.6). The lockfile is already regenerated by dependabot; merging
   triggers the existing Deploy Production workflow + clears most
   alerts. ~1 minute of work. (See "Heatsync dependabot failure
   resolved" above.)
2. Apply the same nuxt 3.21.6 bump on deveco + commonpub (no
   dependabot PR open there; manual `pnpm up nuxt`). Then better-auth
   1.6.4 → 1.6.11 (re-verify `betterAuthCookie.ts` against the cited
   lines first) and jose 6.2.2 → 6.2.3.

### P1 — Two-instance interop test for federation

Unchanged. With the layer fix shipped, focus shifts to federation
testing. WebFinger 404 says the AP actor isn't provisioned — that's a
prerequisite to follow + Create round-trip testing.

### P2 — Inbox 401 monitoring

Unchanged.

### P3 — Flag flip: `signInWithRemote` canary on deveco.io

Unchanged. Keys are in place; the actor situation (WebFinger 404)
might need investigation first.

### P4 — Instance self-update admin feature

Unchanged. Design at `docs/plans/instance-self-update.md`. 4 maintainer
decisions still pending. Phase 1 MVP estimate ~2-3 sessions.

### P5 — One-time cleanup tasks

Unchanged from 151 list:
- `docker builder prune -af` on deveco (recover 18.87 GB)
- Retry/dead-letter 10 stuck `failed` activities on deveco
- Delete or activate dead-loop heatsync mirror config on deveco
- Rename `instance_mirrors.content_count` → `total_received_count`
- Add `dead_lettered` to `activity_status` enum (migration 0005)

### P6 — Routine dev-dep bumps

Unchanged. Batch after P0.

### P7 — Class-hygiene proactive renames

Unchanged. No new collisions surfaced.

### P8 — Remaining latent radius/prose leaks

Combine the previously-deferred `BlockMathView` leak with the new
finding:

- `BlockMathView` `<pre class="cpub-math-expression">` — leaks `border
  + bg #0d1117 + padding` from `.cpub-prose pre`. Fix:
  `border: 0 !important; background: transparent; border-radius: 0`.
- `ProjectView.cpub-parts-table th/td` — universal-radius leak on
  Parts-tab cells. Subtle (no outer overflow:hidden clip), not
  user-reported. Fix: `border-radius: 0` on `th` + `td`.

Both rare, both deferred. Batch into a future layer patch when one
becomes user-visible.

### P9 — Phase 4 federation (delegated actions)

Unchanged.

## What to watch for in session 153

All gotchas from 151 still apply (1-8). Adding:

9. **Universal `border-radius` rule in `base.css`** is the latent
   footgun for any theme that overrides `--radius` to non-zero. New
   multi-section block components MUST add explicit `border-radius: 0`
   to inner sections. Memory: `feedback_universal_radius_leak`. The
   8 currently-patched components (7 from 0.21.21 + ProjectView code-
   snippet from 0.21.22) are documented.

10. **Empirical federation state check.** Always run BOTH:
    - `curl /api/features | jq '.federation, .seamlessFederation, .identity'`
    - `curl '/.well-known/webfinger?resource=acct:test@<domain>'`

    The flag can be `true` while the actor isn't provisioned, and vice
    versa. Don't conflate them.

11. **Dependabot red status ≠ failure.** Check for already-open
    dependabot PRs before debugging "failures." `gh pr list --label
    dependencies` shows them. The
    `pull_request_exists_for_security_update` error code means "merge
    the existing PR."

12. **Heatsync WIP federation config** is still uncommitted
    (`commonpub.config.ts` M, `ONBOARDING.md` untracked). Don't commit
    it; it's the operator's in-progress P3-canary work that needs the
    actor-provisioning prerequisite worked out first.

13. **`tools/create-commonpub/src/template.rs` pins** are now at
    `^0.21.22` (matches latest publish). The cargo test
    `package_json_pins_current_commonpub_versions` is the regression
    guard — bump pin + test assertion together after any future
    publish.

## What did NOT change in session 152

- Test counts identical to 151 (no new tests; only CSS-only changes).
  Cargo green at 29/29 after pin bump.
- Schema migration count holds at 5.
- No new feature flags.
- No new symbols / no new public exports.
- Memory files: added `feedback_universal_radius_leak.md` (new); no
  others touched.

## Commits this session

| Repo | Commit | Subject |
|---|---|---|
| commonpub | `c798344` | fix(layer): reset border-radius:0 on inner block sections (0.21.21) |
| commonpub | `7e27da7` | docs(sessions): 152 — universal border-radius leak on deveco code blocks |
| commonpub | `c07e8e4` | docs(sessions): 153 handoff + bump scaffolder pin to ^0.21.21 |
| commonpub | `5e89d30` | fix(layer): reset border-radius:0 on ProjectView code-snippet (0.21.22) |
| commonpub | _(this commit)_ | docs(sessions): rewrite 153 handoff post-audit |
| deveco-io | `9a13e5d` | chore: bump @commonpub/layer 0.21.20 → 0.21.21 |
| deveco-io | `75791c2` | chore: bump @commonpub/layer 0.21.21 → 0.21.22 |
| heatsynclabs-io | `e8a4270` | chore: bump @commonpub/layer 0.21.20 → 0.21.21 |
| heatsynclabs-io | `3ed6e15` | chore: bump @commonpub/layer 0.21.21 → 0.21.22 |

## Standing rule reminders

- Schema is the work. Migration count: 5. No change this session.
- No feature without a flag. No new flags this session.
- `var(--*)` only — except for `border-radius: 0` literal resets that
  intentionally override the universal `var(--radius)` rule. The
  literal-0 IS the override semantic; nothing wrong with it.
- WCAG 2.1 AA min.
- Sessions logged at `docs/sessions/NNN-*.md`.
- Squash merge to main.
