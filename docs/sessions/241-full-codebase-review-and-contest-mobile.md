# Session 241 — Full-codebase review + contest page mobile responsiveness

Date: 2026-07-17. Mode: review-and-document + one prioritized fix (contest mobile).
**Nothing rolled, published, or deployed.** All changes local, awaiting go-ahead.

## What was done

### Priority: contest page mobile-first responsive (DONE, verified, not shipped)
- Audited the whole contest render tree (`/contests/[slug]`): hero, section tabs,
  sidebar, submit dialog, and all ~20 structured block renderers — **already responsive**.
- Found + fixed the real gap: arbitrary author HTML had no overflow containment, so a wide
  `<table>` / long `<pre>` / long URL forced the whole page to scroll sideways on mobile
  (measured scrollWidth 871 vs 390 at true mobile viewport).
- Fix (additive CSS only): `packages/ui/theme/prose.css` (`.cpub-prose` word-wrap;
  `.cpub-md-html` overflow-wrap + self-scrolling `pre`/`table` + media caps) and
  `layers/base/components/blocks/BlockTextView.vue` (same for the text path). Re-ran
  `bundle-theme.mjs` to sync the gitignored `layers/base/theme/prose.css`.
- **Verified end-to-end in the real running app**: local docker + nuxt dev + a seeded
  contest with a nasty custom-HTML block, viewed at 390px via Playwright → no page overflow;
  table scrolls in place, URL wraps, `<pre>` scrolls. Theme + HTML-block tests pass (10/10).
- Details in `docs/reviews/full-review-2026-07-17.md` §0.

### Full-codebase review
- Ran a 52-agent read-only review workflow (`wf_7630f9aa-c6b`, 2.6M tokens): inventory +
  14 subsystem reviewers, each finding adversarially verified by an independent skeptic.
- **25 confirmed findings** (2 P1, 8 P2, 15 P3), 2 uncertain, 5 refuted.
- Independently re-verified the headline items by reading the actual code (both P1s, the
  P2 SSO takeover, the P2 ordered-list data-loss) — all hold.
- Wrote the two canonical docs: `docs/reference/codebase-analysis.md` (inventory +
  architecture + build-pipeline + test-coverage map) and
  `docs/reviews/full-review-2026-07-17.md` (findings register with fix order).

## Confirmed baseline (re-verified, no drift)
server 2.113 / schema 0.59 / config 0.33 / infra 0.17 / ui 0.13.2 / editor 0.11 /
protocol 0.14 / auth 0.10 / layer 0.106; CLI 0.5.29. 37 flags live on all 3; migration 0042.
Build-gap confirmed: `layers/base` has no typecheck/lint/build script; `infra` has no lint.

## Top confirmed issues (see review doc for full detail + fixes)
1. **P1** inbox `object.id` host not bound to authenticated actor → forged/overwritten
   mirror content on the **live** federation path (`inboxHandlers.ts:679`).
2. **P1 (latent, flag off)** Mastodon-login callback trusts remote actor URI → account
   takeover (`auth/mastodon/callback.get.ts:100`; `signInWithRemote` false on all 3).
3. **P2** CommonPub federated SSO callback — same unbound-actor-host takeover across
   trusted instances (`auth/federated/callback.get.ts:47`).
4. **P2** `forkFederatedContent` can fork hidden/tombstoned content (`content.ts:1250`).
5. **P2** markdown serializer drops all ordered-list item text — data loss (`serializer.ts:112`).

## Not fully reviewed (do next — treated as coverage gaps, NOT "clean")
- **Hub mirroring + backfill** (`hubMirroring.ts` ~1600) — §2a/2b/2c/2e not substantiated.
- **PII / GDPR / consent** — no substantive findings produced; needs a dedicated pass.
- **Layer a11y + big untested Vue views** (ProjectView 1535, etc.) — build-gap facts
  confirmed independently, but the a11y/test-gap review is open.

## Next steps
1. Await go-ahead to **roll the contest mobile fix** (needs a `@commonpub/layer` republish).
2. On approval, fix in order: inbox host-binding (P1) + dedicated hub-mirroring review;
   SSO actor-host binding (P1/P2, centralized); then the low-risk P2 batch (ordered-list
   data loss, reminder drop, fork-hidden).
3. Dedicated PII/GDPR pass.
4. Add `typecheck` + `lint` scripts to `layers/base`; `lint` to `packages/infra`.

## Open questions
- Whether to enforce the inbox host-binding as reject vs. skip (Announce is the correct
  cross-instance path — needs a call on backward compat with any current re-broadcast usage).
- Whether `signInWithRemote` is on any near-term roadmap (raises P1 #2's urgency if so).
