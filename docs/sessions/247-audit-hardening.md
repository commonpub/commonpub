# Session 247 — deep-audit hardening pass (ROLLED)

After rolling the contest changeset + 4 P1 blockers (schema 0.62 / server 2.120 / layer 0.114), a deep
adversarial audit (4 parallel agents: URL/render sinks, ban/PII, markdown parser, contest flow/consent)
confirmed the four fixes correct and no allowlist bypass, but surfaced same-class gaps in paths the fix
didn't reach. **Hardening roll: schema 0.63 / server 2.121 / layer 0.115** (NO migration, NO auth change).

## Fixed

- **Federated-content `url` stored-XSS (HIGH, reachable):** `inboxHandlers.ts` stored a remote `object.url`
  unguarded (create + update paths); rendered clickable in `FederatedContentCard.vue` + `mirror/[id].vue`.
  Extracted `hubMirroring`'s guard into shared `federation/urlGuard.ts#safeRemoteUrl`, applied to inbox
  ingestion, and added render guards (`safeHref` / origin-url scheme check) for pre-fix rows.
- **Events + admin-nav URL schemas:** `events` `locationUrl`/`onlineUrl` and admin nav `href` used bare
  `z.string().url()` (accepts `javascript:`/`data:`) → `optionalUrl`. `optionalUrl`/`httpUrl` are now
  exported from `@commonpub/schema`. (Events feature is currently OFF; nav is admin-gated.)
- **Ban/suspend at the SSO mint site:** `createFederatedSession` now throws for a non-active user. The
  native `/api/auth/sign-in/email` endpoint (not used by the app UI — the UI uses the 403-gated
  `sign-in-username` proxy) still relies on the `enrichUser` next-request backstop; a Better-Auth
  `session.create.before` hook was considered but skipped (breaking all logins on a wrong contract is a
  worse risk than a defense-in-depth gap on an unused endpoint).
- **Markdown parser:** an unterminated `<!--` silently dropped the rest of the form → now a blocking error;
  a leading inline comment (`<!-- x --> ## Section`) poisoned the indent and dropped the line → indent is
  now computed from the pre-strip line.
- **Consent count accuracy:** counted ALL acceptance rows vs the CURRENT template's agreement count, so a
  removed/renamed agreement rendered `3/2` + a false-complete check. Now filtered to the live agreement
  keys (threaded through `listContestRegistrants` + `buildRegistrantsExport`); query skipped when none.
- **CI red:** `registrationMarkdownJinger.test.ts` read the fixture via `process.cwd()`; the layer suite
  runs from `layers/base` in CI → ENOENT. Now walks up from cwd to find the repo file.
- **UX:** short-form signup modal reads "Save details" when an already-registered participant edits.

## Not changed (deliberate)

- `enrichUser` fail-open on a DB error (F2): failing closed would log everyone out on a blip; the window
  (suspended user + valid session + DB error mid-request) is negligible.
- Suspended-vs-nonexistent login enumeration (403 vs 401): kept for legit-user UX; low-value leak.
- `federation.ts` `actorUri` bare `.url()`: an actorUri must be a resolvable fetch URL to be cached;
  impractical to inject a script scheme. Noted, not changed.

## Verify

New tests: `url-guard.test.ts` (3), parser comment/indent cases, schema URL-scheme (already). Gates green:
schema 527 / server 1764 (+ admin integration 32) / layer 5736 / reference typecheck 0. Browser-verified
`javascript:`/`data:` → 400 on profile website + admin nav; consent panel + CSV still correct.

## Landmine

If Docker Desktop stops mid-session the dev Postgres disappears and every query 500s (looks like a code
bug — it isn't). `open -a Docker`, `docker compose up -d`, wait for `pg_isready`, restart the dev server.
