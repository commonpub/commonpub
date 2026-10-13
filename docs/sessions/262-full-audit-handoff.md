# Session 262 — full audit of all instances and `main`, handoff (2026-10-13)

## What was done

A read-only audit; no code, config or production state changed.

- Probed commonpub.io, deveco.io and heatsynclabs.io (GET/HEAD only): health, versions,
  flags, headers, compression, privacy, SSR, RSS/sitemap, og images.
- Re-verified all 47 P1s from the 08-23 and 08-30 audits against `main` code: 6 fixed,
  6 partial, 35 open.
- Checked all 43 plans in `docs/plans/` against code: 13 done, 17 partial, 6 not started,
  7 superseded or abandoned.
- Architecture review: monoliths, release model, fork contract, route policy, tests, CSS,
  data layer, federation, flags.
- Rewrote the `docs/STATUS.md` header (it contradicted itself: it said profile
  visibility was enforced and, 40 lines later, that it did not work).

Report: `docs/reviews/2026-10-13-instances-and-codebase-audit.md`.

## Decisions

None taken. Everything below needs an owner's call or a go-ahead.

## Open questions for the owner

1. deveco bot signups: bulk-suspend the random-username accounts now, and which
   friction to add (disposable-domain block, Turnstile, verified-email gate on
   register/enter)?
2. PR #92: merge (8-package cascade) or close?
3. Layout engine: finish it (phases 3e-10, homepage consolidation) or freeze it on
   commonpub.io?
4. Release model: fold the small packages into server/layer and move to a single fixed
   version, or keep the cascade?
5. Persona: keep in the base layer or split into an optional layer?
6. `identity.*` flags and `auth.magicLink` / `auth.passkeys`: build or delete?

## Next steps, suggested order

1. Quick operational wins (S each): Caddy `encode` on two instances; ship an
   `og-default.png` and emit it absolute; 404 status on missing pages; delete `authprobe*`
   test users; `set -o pipefail` and a failing health check in deveco's deploy; gate the
   monorepo deploy on tests; rotate the crates.io token.
2. Privacy and data-loss fixes (one release): creator FKs to `set null` plus a
   self-delete guard; fix the self-delete audit FK; `status = 'active'` in the profile
   gate; apply `profileVisibleTo` to hub rosters, event attendees, contest entrants and
   WebFinger, and widen the sweep guard to every `users` read.
3. Federation correctness: mark seen after success and return 202 (durable inbound
   queue); sanitise `cpub:blocks` on ingest and fork; bind the activity id host to the
   signer; store the real remote sender on DMs.
4. Dependencies: sharp to `^0.35.5`, undici `>=7.29.1`, collapse the vue 3.5.32 copy in
   the workspace lockfile, republish `@commonpub/docs` without its old pins.
5. Then the rearchitecture list in the report, starting with `useConfig()` in the layer
   and one fork pipeline.
