# Session 152 → 153 Handoff

Fresh Claude Code context. Session 152 (2026-05-21) shipped a single
layer patch (`@commonpub/layer@0.21.21`) fixing a universal CSS
`border-radius` leak that was visually mangling code blocks on deveco.io
specifically. Plus a deep audit pass that uncovered a few clarifications
worth carrying forward.

## TL;DR

- **Layer 0.21.20 → 0.21.21 live on all 3 instances.** Fixed a universal
  `*,::before,::after{border-radius:var(--radius)}` leak in
  `layers/base/theme/base.css` that produced "wedge gaps" between inner
  sections of 7 block components on themes with non-zero `--radius`.
- **All 3 instances healthy.** Federation state is unchanged (Phase 4
  still gated on identity flag flip).
- **Heatsync has 36 open Dependabot alerts** (26 axios transitive, 4
  nuxt, 2 esbuild, 2 ws, 2 @nuxt/nitro-server). Two dependabot
  auto-update runs have failed — investigate before manually bumping
  nuxt.
- **Session 151's "federation flag off on deveco/commonpub" framing was
  slightly stale.** The flag has been TRUE on deveco since 2026-03-28
  (commit `72bc80c`) and the seamlessFederation + federateHubs flags
  also TRUE since 2026-03-29. What's actually dormant is the AP actor
  provisioning + identity sub-flags.

## Orientation — read in order

1. `CLAUDE.md` — standing rules. Re-emphasize: no AI attribution to
   commits; `pnpm publish` not `npm publish` for layer; schema is the
   work.
2. **`docs/sessions/151-handoff-prompt.md`** — the prior handoff. Read
   it for full background on Stage 3 federation hardening, all the
   shipped primitives, and the existing priority list. Session 152's
   handoff (this file) is a delta on top of it.
3. `docs/sessions/152-universal-radius-leak.md` — session 152 work log.
4. `docs/plans/instance-self-update.md` — design doc for the admin
   self-update feature (P4, planning-only so far).

## Current state (2026-05-21, end of session 152)

| Site | Versions live | Migration count | Federation flag | Identity flags | `CPUB_FED_TOKEN_KEY` |
|---|---|---|---|---|---|
| commonpub.io | schema 0.16.0, server 2.55.0, **layer 0.21.21**, infra 0.8.0, protocol 0.12.0, auth 0.6.0, config 0.13.0, ui 0.8.5, editor 0.7.11, explainer 0.7.15, learning 0.5.2, docs 0.6.3, test-utils 0.5.6 | 5 | true (live-active, no AP actor) | all false | SET in `/opt/commonpub/.env` |
| deveco.io | (same) | 5 | true (live-active) | all false | SET in `/opt/deveco/.env` |
| heatsynclabs.io | (same) | 5 | **false** (config setting, but operator has uncommitted WIP to flip it on) | all false | SET in `/opt/commonpub/.env` |

Verified live via `/api/health` + `/api/features` on each site,
2026-05-21 22:46 UTC. WebFinger returns 404 on all 3 — no instance
actor provisioned even though `federation: true` in config. This is the
"flag-on, actor-not-wired" state; the dormancy is real but it's the
actor + identity sub-flags that are dormant, not the feature flag.

## What shipped in session 152

### `@commonpub/layer@0.21.21` — universal radius leak fix

**Bug**: `layers/base/theme/base.css:239-244` has a universal rule:

```css
*,
*::before,
*::after {
  box-sizing: border-box;
  border-radius: var(--radius);
}
```

On heatsync + commonpub.io (`--radius: 0`) this is a visual no-op. On
deveco (`--radius: 6px`) it rounds the corners of every element on the
page. Inside an outer container with `overflow: hidden + border + radius:6px`,
the **inner** sections (header bars, list items, table cells) curve
**away from each other**, leaving wedges of empty page-bg between them.
Deveco screenshots showed "floating bar with gap then code block."

**Fix**: explicit `border-radius: 0` on inner-section selectors of 7
block components. Specificity (0,2,0) on scoped selector beats `*`
universal (0,0,0); no `!important` needed.

| Component | Selectors reset |
|---|---|
| `BlockCodeView` | `.cpub-code-header`, `.cpub-code-body` |
| `BlockPartsListView` | `.cpub-parts-header`, `.cpub-parts-table th`, `.cpub-parts-table td` |
| `BlockVideoView` | `.cpub-video-label`, `.cpub-video-wrap` |
| `BlockEmbedView` | `.cpub-embed-label`, `.cpub-embed-wrap` |
| `BlockDownloadsView` | `.cpub-dl-header`, `.cpub-dl-item` |
| `BlockToolListView` | `.cpub-tools-header` |
| `BlockBuildStepView` | `.cpub-step-header` (not `.cpub-step-num` — auto-round on the number badge looks intentional) |

Live-verified on deveco: the netburner project page's 4 code-block
instances now use `data-v-54c9fcc2` with `border-radius:0` on both
header and body selectors.

**Why not remove the universal rule from `base.css`**: tempting (it's
the root cause) but the blast radius is hard to predict. Deveco's theme
likely depends on the implicit rounding for elements that don't set
`border-radius` explicitly (cards, buttons, dropdowns). The
per-component reset is targeted and reversible; the universal rule
survives as a documented pitfall. Memory:
`feedback_universal_radius_leak`.

### Stacking with the prose-style fix (0.21.20)

`BlockCodeView` + `BlockPartsListView` now carry **two** layered resets
on the same inner selectors — different leak sources:

```css
.cpub-code-body {
  border: 0 !important;       /* 0.21.20: defeat .cpub-prose pre */
  border-radius: 0;           /* 0.21.21: defeat universal *,::after,::before */
  /* ... */
}
```

Both are needed. The prose rule sets `border` (so we need `!important`
because the scoped CSS doesn't declare border by default). The universal
rule sets `border-radius` (so plain specificity wins).

## Audit findings worth carrying

### Federation framing correction

The session 151 handoff stated `CPUB_FED_TOKEN_KEY` was "set live
2026-05-20" but said "federation flag off (dormant)" in the live-state
table. This was inconsistent — `/api/features` shows:

| Site | `federation` | `seamlessFederation` | `federateHubs` | identity sub-flags |
|---|---|---|---|---|
| deveco.io | **true** (since 2026-03-28) | **true** (since 2026-03-28) | **true** (since 2026-03-29) | all false |
| commonpub.io | **true** | **true** | **true** | all false |
| heatsynclabs.io | false | false | false | all false |

So the "federation is off" framing was about **identity** sub-flags +
the fact that no AP **actor** has been provisioned. The feature flag
itself has been TRUE on 2 of 3 sites for nearly 2 months. WebFinger
returns 404 because there's no actor at `/actors/instance` or
`/users/{name}` to serve. Federation infrastructure is enabled, runtime
isn't wired.

P3 (signInWithRemote canary) is still the right next move — it's the
identity sub-flag flip that's actually load-bearing.

### Heatsync dependabot situation

36 open Dependabot alerts on heatsynclabs/heatsynclabs-io. Breakdown:

| Package | Count | Severities | Source |
|---|---|---|---|
| axios | 26 | high, medium, low | Transitive (heatsync doesn't list axios; pulled in via nuxt/build) |
| nuxt | 4 | medium, low | Direct dep (3.21.5) |
| esbuild | 2 | medium | Transitive |
| ws | 2 | medium | Transitive |
| @nuxt/nitro-server | 2 | low | Transitive (nuxt subpackage) |

Two consecutive automated Dependabot update runs **failed** (run IDs
26209190010 + 26210041xxxx, both "npm_and_yarn for nuxt"). The
dependabot-action ran setup but the actual update step's failure isn't
captured in the first 60 lines of log — needs deeper inspection. Manual
P0 bump of nuxt to 3.21.6 (already on P0 list) will likely clear most
of the alerts since axios is transitive.

**Commonpub + deveco repos have 0 Dependabot alerts** — clean.

### Heatsync uncommitted WIP

`commonpub.config.ts` is **modified** with a federation-flag flip:

```diff
-    federation: false,
+    federation: true,
+    federateHubs: true,
+    seamlessFederation: false,
   admin: true,
 },
+  federation: {
+    instanceFollowPolicy: 'auto-accept',
+  },
```

Plus an untracked `ONBOARDING.md`. This is the operator's in-progress
work, paused for some reason. Don't commit it. If the user wants to
land it, that's a separate decision (and it'd be the heatsync side of
P3).

### Class-collision / view-identity hygiene — still clean

No new collisions surfaced. The `cpub-project-grid` rename from session
150 is doing its job.

## Priority list — refreshed for session 153

Most priorities from the 151 handoff still stand. Updates:

### P0 — Security patches (Nuxt, better-auth, jose)

Unchanged. **Bump Nuxt 3.21.5 → 3.21.6 FIRST** — it's likely to clear
most of heatsync's 36 dependabot alerts (axios is transitive via nuxt's
build chain). Caveats from 151 still apply for better-auth (verify
cookie shape against `betterAuthCookie.ts`) and jose (verify against
`packages/protocol/src/sign.ts`).

### P0.5 — Investigate heatsync dependabot failure (NEW)

Two consecutive auto-update runs failed. Setup completed but the actual
update step crashed before reaching push-PR phase. Check the workflow
log past line 60 for the real error. Likely a pnpm-lockfile-mode
incompatibility or a package range that can't be auto-resolved by
dependabot-action. If the manual P0 nuxt bump goes smoothly, the
dependabot failures will fix themselves; if not, dig deeper.

### P1 — Two-instance interop test for federation

Unchanged. The Stage 3 SSRF + signature primitives are live but
deveco↔commonpub follow flow hasn't been exercised end-to-end. WebFinger
returns 404 today; the test would need to provision an actor + follow
flow.

### P2 — Inbox 401 monitoring

Unchanged. Add structured-log event in `inbox.ts` rejection path; wire
to log aggregator with rate alert.

### P3 — Flag flip: `signInWithRemote` canary on deveco.io

Unchanged. Keys are in place; cookie helper is dormant but verified.
Flip → commit → push → deploy auto-runs → Mastodon-login button appears
→ exercise with a real Mastodon account → watch the encrypted token
land in `federated_accounts`.

### P4 — Instance self-update admin feature

Design at `docs/plans/instance-self-update.md`. Plan-only so far; 4
decision points (approval flow default, GitHub App vs PAT, schema
migration UX, package scope) flagged for maintainer. Phase 1 MVP ~2-3
sessions of work.

### P5 — One-time cleanup tasks (deferred)

Unchanged from 151:
- `docker builder prune -af` on deveco — recover 18.87 GB
- Retry / dead-letter 10 stuck `failed` activities on deveco
- Delete or activate the dead-loop heatsync mirror config on deveco
- Rename `instance_mirrors.content_count` → `total_received_count`
- Add `dead_lettered` to `activity_status` enum (migration 0005)

### P6 — Routine dev-dep bumps

Unchanged. Batch after P0.

### P7 — Class-hygiene proactive renames (deferred)

Unchanged. No new collisions surfaced.

### P8 — `BlockMathView` prose-style + radius leaks (deferred)

Same as 151 plus the new `border-radius: 0` reset would be needed too
(same pattern as 0.21.21). Math blocks are rare, not user-reported.

### P9 — Phase 4 federation (delegated actions)

Unchanged. Natural completion of P3.

## What to watch for in session 153

All the gotchas from 151 still apply. Adding:

9. **The universal `*,::before,::after{border-radius:var(--radius)}`
   rule in `layers/base/theme/base.css`** is a latent footgun for any
   theme that overrides `--radius` to non-zero. New multi-section
   block components MUST add explicit `border-radius: 0` to inner
   sections. Memory: `feedback_universal_radius_leak`. The 7
   currently-patched components are listed in the table above.

10. **The session 151 framing of "federation flag off on prod"
    was slightly stale.** Always `curl /api/features` and `curl
    /.well-known/webfinger?resource=acct:test@<domain>` together to
    distinguish "flag on but actor not provisioned" from "flag off."
    Memory: `feedback_verify_flag_state` already covers the
    flag-snapshot drift; this audit just confirms it still happens.

11. **`tools/create-commonpub/src/template.rs` pin constants** —
    bump to `^0.21.21` (was `^0.21.20`). The cargo test
    `package_json_pins_current_commonpub_versions` will fail until
    bumped. Wasn't done in 152.

12. **`packages/ui` `--radius` token** is set to `0px` in the layer's
    `base.css` default. Themes that override (deveco's `theme/*.css`
    sets `--radius: 6px`) propagate through the universal rule.
    Operators who want sharp corners but pick a non-zero radius for
    SOME elements will hit the same wedge bug — point them at
    `feedback_universal_radius_leak` for the pattern.

## Where the new symbols live (delta from 151)

Nothing new in this session — only CSS changes to existing components.

## Test counts (locked, end of session 152)

Same as 151. No new tests added (CSS-only changes).

- `@commonpub/protocol` 419/419
- `@commonpub/infra` 305/305
- `@commonpub/server` 964/967 (3 expected PGlite skips)
- `@commonpub/editor` 230/230
- `@commonpub/layer` 85/85
- Cargo (scaffolder) 29/29 (pin assertion is now STALE for 0.21.21 —
  cargo test will fail until template.rs constants are bumped to
  `^0.21.21`; see watch-out #11 above)
- Workspace typecheck 26/26, lint 24/24

## Memory additions in session 152

- `feedback_universal_radius_leak.md` (new) — full pattern doc + the
  7 vulnerable components + the "why not remove the universal rule"
  decision + the `BlockBuildStepView .cpub-step-num` exception.

## Standing rule reminders

- Schema is the work. Migration count holds at 5; no schema change this
  session.
- No feature without a flag. No new flags this session.
- `var(--*)` only — no hardcoded colors/fonts (the radius leak fix
  uses `border-radius: 0` literal — that's intentional; the universal
  rule applies `var(--radius)` so the literal-0 is the override).
- WCAG 2.1 AA min.
- Sessions logged at `docs/sessions/NNN-*.md`.
- Squash merge to main.
