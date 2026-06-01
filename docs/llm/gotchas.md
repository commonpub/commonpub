# LLM Gotchas — CommonPub

Non-obvious pitfalls. Read before making changes that touch these areas.

Full version: [`codebase-analysis/09-gotchas-and-invariants.md`](../../codebase-analysis/09-gotchas-and-invariants.md).
This file is the short version.

## Build & publish

- **pnpm, not npm.** `npm publish` ships workspace:* literals that break installs.
- **Verify `dist/` exports before publishing.** `pnpm build` can silently drop exports — look inside `dist/index.d.ts` and confirm the public API you expect.
- **`pnpm update` touches lockfile too.** Commit both.
- **After local `pnpm build` of a package, consumer typecheck may see stale types.** Fix: `pnpm install --prefer-offline` in the consumer repo.

## Database

- **Schema changes go through committed migrations, not `drizzle-kit push`.** After editing `packages/schema/src/*.ts`, run `pnpm --filter=@commonpub/schema db:generate` locally (needs a TTY), commit the resulting `packages/schema/migrations/000N_*.sql` + `meta/` updates alongside the TS changes. CI deploy runs `scripts/db-migrate.mjs` which calls `drizzle-orm/node-postgres/migrator.migrate()` directly and records state in `drizzle.__drizzle_migrations`. No prompts in CI, no manual SQL.
- **Do not use `drizzle-kit push` in CI.** It blocks on interactive prompts (populated-table constraint changes, varchar→enum conversions, rename detection) and silently drops all queued DDL when it throws. The session-128 docs outage was caused by this — the push had been failing for weeks. `db-push.mjs` remains only for dev-time convenience against a local DB.
- **Do not call `drizzle-kit migrate` directly in CI either** — its `renderWithTask` spinner exits non-zero on success and swallows error output. `scripts/db-migrate.mjs` uses the underlying drizzle-orm function which is reliable.
- **Schema changes in packages/schema require bumping `@commonpub/schema`.** Consumers pin it. The `migrations/` folder ships in the npm package (declared in `files`), so deveco and other consumers get the SQL too.

## Nuxt / Nitro

- **`server/utils/config.ts` is the Nitro-side config resolver, not a proxy re-export.** It merges build-time `commonpub.config.ts` with env-var overrides (`FEATURE_*`) and DB overrides from `instanceSettings.features.overrides` (cached 60s). Server handlers import from `~/server/utils/config`, not directly from the config file. See `apps/reference/server/utils/config.ts` for the canonical implementation.
- **New imports into API routes can 404 in prod.** Nitro externalizes node_modules; if an import wasn't reachable before, Nitro may not bundle it. Add to `nitro.externals.inline` if needed.
- **`useLazyFetch` inside Suspense** instead of `useFetch` to avoid render races (session 124 fix).
- **`error.vue` must re-apply data-theme** via `useHead` — error pages render outside the layout tree on SSR.
- **`<component :is="'NuxtLink'">` (string name) can fail to resolve during SSR** → renders a literal `<nuxtlink>` element → "Hydration completed but contains mismatches" + a dead link. Use `const C = resolveComponent('NuxtLink')` and bind the component object, not the string. Caught session 177 in NotificationItem (whole-row click target).

## Federation

- **Don't enable `federation: true` without a peer to federate with.** The delivery worker polls forever.
- **`listContent`'s federated-merge path must paginate BOTH sources from 0.** It fetches local `[offset, offset+limit)` but federated `[0, offset+limit)`, merges by date, and slices. Slice `[offset, offset+limit)` — NOT `[0, limit)` — and fetch local from offset 0 too (window = `offset+limit`), or every "load more" re-shows the same federated head as duplicates. Local-only path (no seamless federation / author-filtered) keeps simple offset paging. Caught session 177.
- **`cpub:type`, `cpub:metadata`, `cpub:blocks`, `cpub:postType` are wire format.** `cpubType`/`cpubBlocks`/`cpubMetadata` are the local DB column names; the AP JSON fields use the colon-namespaced form. Changing the wire names breaks interop between CommonPub instances on different versions. Version the mapper if you must change.
- **AP Actor SSO = Model B only** (OAuth2 + WebFinger). Shared auth DB (Model C) is operator opt-in and strongly discouraged.
- **Signed backfill required for protected outboxes** (session 119). If backfill returns 401, verify your instance keypair is registered.

## Content & schema

- **`article` is legacy.** Use `blog`, `project`, or `explainer`. Schema still has `article` in `contentTypeEnum` but it normalizes to `blog` (session 116 merge).
- **`eventAttendees` has UNIQUE (eventId, userId)** as of migration 0002 (session 130 follow-up). `rsvpEvent` uses `ON CONFLICT DO NOTHING` to handle double-click races — no longer a 500 on race; the second attempt falls through to the "already registered" path.
- **`federatedContent.mirrorId` has an FK** to `instance_mirrors.id` with `ON DELETE SET NULL` as of migration 0002. Orphans that predated the FK (3 rows on commonpub.io) are nulled by the migration.
- **Always verify `/api/events` status whitelist** (session 125 security fix). Only `published`, `active`, `upcoming`, `past`, `featured`, `mine` are honored.
- **Quiz lessons are graded server-side** (session 129). `GET /api/learn/:slug/:lessonSlug` runs `redactQuizAnswers` for non-authors: `correctOptionId` + `explanation` are stripped from each question. The viewer CANNOT grade locally — it must POST answers to `/complete` and render `quiz.results` from the response (added session 133). Canonical shape: `{type:'quiz', passingScore, questions:[{id, options:[{id,text}], correctOptionId, explanation?}]}`. If you see someone reinstate a client-side `correctIndex` or local score computation, they've silently broken grading for every learner.

## UI / theming

- **No hardcoded colors or fonts.** Always `var(--*)`. Session 096 did a 698-replacement sweep to enforce this.
- **Federated content uses local components.** Don't create parallel federation-only component trees. Session 122 found several that had drifted.

## Git

- **Never add Claude as co-author.** No `Co-Authored-By`, `Signed-off-by`, AI attribution — in any commit, in any CommonPub repo.

## Testing

- **3 integration tests skipped for PGlite incompat** (advisory locks, certain extension types). Don't "fix" by rewriting — running against real Postgres passes them.
- **Stryker full-repo takes 30+ minutes.** Use per-package targets.

## Deployment

- **commonpub.io and deveco.io auto-deploy on push to main.** Deploy runs `scripts/db-migrate.mjs` (session 128 migration switch) which applies any new `.sql` migrations committed in `packages/schema/migrations/`. Deploy fails hard on migration errors rather than continuing past silent failures.
- **deveco.io uses DO managed Postgres.** `NUXT_DATABASE_URL` is from the managed DB connection string, not Docker.

## Session awareness

- **Session logs are the source of truth for recent changes.** When reference docs contradict session logs, trust the log.
- **CHANGELOG** has an Unreleased section covering sessions 108–125. Previous tagged release: v0.2.0 (2026-03-23).
- **Handoff prompts** in `docs/sessions/NNN-handoff-prompt.md` are context-reset notes. Load the most recent if continuing work.

## Build-time prerender

- **Never `prerender: true` on data-fetching routes.** Docker build has no DB; the prerenderer saves 500 HTML as the static output and ships it. Use `swr: 60` or `isr: true` (runtime + cache) instead. See `codebase-analysis/09-gotchas-and-invariants.md`.

## Security

- **Public API serializers are ALLOW-lists.** Every `/api/public/v1/*` response is built by an explicit `to*` helper in `packages/server/src/publicApi/serializers.ts` that names each field — never spread (`{ ...row }`) user/content/hub rows into responses. If a new private column lands in the DB, the serializer excludes it by default. Tests in `publicApi.test.ts` assert known-private names (email, passwordHash, role, ...) never appear in any response body.
- **Every `v-html` in `@commonpub/explainer` must wrap with `sanitizeHtml()`** from `packages/explainer/vue/utils/sanitize.ts` at the render site. `clickable-cards/Viewer.vue` and `toggle/Viewer.vue` missed this (session 127 fix) — stored XSS vector for any registered user, also reachable via federation. Don't rely on ingest-side sanitization alone; audit rule is `grep -rn 'v-html=' packages/explainer/` and require `sanitizeHtml(` in the same file.

## Nitro server/routes vs server/middleware

- **`server/routes/foo/[x].ts` returning `undefined` sends HTTP 204 — it does NOT fall through to a Nuxt page at the same path.** If you need "AP response for AP Accept, render the Nuxt page for browsers" at the same URL, it MUST live in `server/middleware/` not `server/routes/`. Only middleware lets undefined fall through. This bit `/hubs/:slug` and `/hubs/:slug/posts/:postId` (session 127) — every hub detail page returned 204 with an empty body on refresh. `server/middleware/content-ap.ts` has the canonical docstring spelling out this rule. Before adding a new AP endpoint at a URL that has a Nuxt page, check that it's middleware, not a route.

## useState key collisions

- **`useState(key, initializer)` only runs the initializer ONCE per request.** If two call sites use the same key with different initializers, whichever runs first wins — the other's initializer is silently ignored. Was the root cause of the session 126 SSR-500 bug on `/docs`, `/learn`, `/videos`, `/explainer`: `feature-gate.global.ts` initialized `useState('feature-flags', () => null)` before the layout's `useFeatures()` got to init with real defaults. Pattern: export ONE `getInitialFlags()` from `composables/useFeatures.ts` and use it in every `useState('feature-flags', ...)` call site.

## Session 135 — audit-fix invariants

- **Notification dedup uses try-INSERT-then-UPDATE-on-23505, NOT `ON CONFLICT DO UPDATE`.** PGlite's planner rejects `ON CONFLICT (cols)` against `uq_notif_user_type_actor_link` with `42P10 — no unique or exclusion constraint matching the ON CONFLICT specification`, even though a literal unique index exists matching the columns. Real Postgres handles it fine, but the codebase needs to work on both. The try/catch in `packages/server/src/notification/notification.ts:200-260` checks for unique-violation on `err.code`, `err.cause?.code`, AND a regex match on `err.message` because Drizzle wraps the underlying PG error and the layout depends on driver/version. Don't "clean it up" to ON CONFLICT — verified breaking.

- **Notification UNIQUE was declared as `uniqueIndex` not `unique('name').on(...)` (table constraint).** drizzle-kit's `pushSchema` API — used by the PGlite test harness in `packages/server/src/__tests__/helpers/testdb.ts` — emits `CREATE UNIQUE INDEX` statements but silently drops table-level `ADD CONSTRAINT … UNIQUE(...)` statements. Symptom: integration tests pass against migrations applied by `db-migrate.mjs` on real Postgres, but PGlite tests miss the constraint and dedup logic appears to no-op. The fix is to declare the constraint as `uniqueIndex` in the schema source — runtime behaviour is identical (Postgres backs both with a unique index). Other table-level UNIQUEs in the codebase still use `unique()` and won't be enforced in PGlite — be aware when writing tests that depend on them. Affected (incomplete list): `bookmarks_user_target`, `enrollments_user_path`, `event_attendees_event_user_unique`, `follow_relationships_pair`.

- **NULL is distinct in Postgres UNIQUE indexes.** The notifications dedup index covers `(user_id, type, actor_id, link)`. System notifications have `actor_id = NULL` and `link = NULL` — Postgres treats every NULL as a different value for UNIQUE purposes, so two system notifications with the same `(user_id, type)` both succeed. This is the desired behaviour (system notifs aren't dedup-able by design) but worth knowing: don't try to "fix" it with `COALESCE` or partial indexes.

- **`@commonpub/server` exports `safeFetch`, `safeFetchBinary`, `isPrivateUrl`, `SafeFetchOptions`** since 2.48.0 (session 135). Use these for any new server-side fetch of remote content — they re-validate redirects against the SSRF blocklist and stream the body with a hard size cap. `safeFetchBinary` returns `{ buffer, contentType, finalUrl }`.

- **`processImage` in `@commonpub/infra` uses `limitInputPixels: 100_000_000`** since session 135. Caps decoded bitmap memory at ~400 MB per image. If you ever construct a `sharp(...)` directly (not via `processImage`), pass the same option.

- **`/api/realtime/stream` caps each user at 10 concurrent SSE connections.** 11th gets 429. Multi-instance scale-out: each Nitro process has its own counter, so effective cap is `10 × N`. The cleanup decrement runs in the `cleanup()` function — if the close handler doesn't fire (request aborted before stream consumption begins), the counter could leak briefly. Acceptable trade-off vs. the abuse mitigation.

- **Modal a11y is provided by `useFocusTrap` from `layers/base/composables/useFocusTrap.ts`**, not by wrapping each modal in `<Dialog>` from `@commonpub/ui`. Wire it from a modal's `<script setup>` with `useFocusTrap(dialogRef, () => props.show, handleClose)`. The composable handles focus trap, Esc, body scroll lock, focus restoration. If a new modal-y component lands in `layers/base/components/`, use this composable — don't reimplement.

- **`isPrivateUrl` is hostname-based, not DNS-resolution-based.** A DNS A record on a public domain pointing at a private IP bypasses the check (DNS-rebind class). Bounded by current deployment topology — image-proxy enforces HTTPS-only, internal services aren't on standard ports — but flag if adding a new internal HTTP service or relaxing the proxy protocol filter.

- **Workspace pinning convention.** All in-monorepo `@commonpub/*` deps now use `workspace:*` (apps/reference, apps/shell, layers/base, all six published packages). The previous mixed pattern — `workspace:*` for some, `^x.y.z` for others — caused pnpm to prefer the previously-published npm version of a package even when the workspace had bumped a minor (verified breaking with server 2.47.4 → 2.48.0). At publish time, `pnpm publish` replaces `workspace:*` with the actual version, so external npm consumers see real ranges.

## Session 142 — deploy/import invariants

- **A "Load image and restart" deploy failure is often a transient SSH reset, not a code bug.** commonpub.io's deploy.yml SSHes into the droplet to load+restart the built image. Symptom: `ssh: handshake failed: read tcp …->***:22: read: connection reset by peer` then `exit code 1`, AFTER the Docker build succeeded. The image is already built — recover with `gh -R commonpub/commonpub run rerun <run-id> --failed` (retries just the SSH step, reuses the image). Before assuming a deploy failure is code: check the log for `ssh: handshake failed` and confirm deveco (builds the same published packages) and CI are green. commonpub.io keeps serving the old container during a failed deploy (no downtime).

- **Content import resolves lazy-loaded images via `import/images.ts` `resolveContentImages()`.** Run BEFORE extraction in `platforms/hackster.ts` (before `extractStoryHtml`) and `generic.ts` (before Readability). It rewrites `<img>` `src` from data-src / data-original / data-lazy-src / data-srcset / srcset (largest descriptor) / non-placeholder src, absolutized + lazy-attrs stripped. If you add a new platform handler that does its own HTML→markdown, call `resolveContentImages` on the document first or in-story images will be broken placeholders. NOT yet done: gallery/carousel extraction as an image set; downloading/re-hosting images into instance storage (only external URLs are kept).

## Session 141 — CLI scaffolder version drift

- **`tools/create-commonpub`'s `@commonpub/*` version pins go stale silently.** They're hardcoded Rust constants in `src/template.rs` (`COMMONPUB_LAYER_VERSION` etc.). CommonPub uses tight 0.x caret semantics (`^0.21.1` = `>=0.21.1 <0.22.0`), so a stale pin means a freshly-scaffolded instance installs an ancient layer that predates current migrations + the identity system. Found 18 minors stale in session 141. **RELEASE CHECKLIST: after `pnpm publish` of layer/server/schema/config, bump the matching constant in `template.rs` and rebuild the CLI (`cargo build`).** The constants carry a comment saying the same. Regression tests (`package_json_pins_current_commonpub_versions`) assert a floor but the floor itself needs manual bumping. Proper structural fix (deferred): a release hook that rewrites the constants, or fetching the `latest` dist-tag at scaffold time (needs network in the Rust CLI). Until that exists, treat the CLI as part of the release surface.

- **The scaffolder generates `scripts/db-migrate.mjs` + a Dockerfile CMD that runs it before the server.** Scaffolded instances apply committed `@commonpub/schema` migrations via drizzle-orm's `migrate()` on every boot (idempotent), NOT `drizzle-kit push`. `db:push` remains a dev-only script. This mirrors deveco.io. If you touch the scaffolder's Dockerfile or db-migrate templates, keep the migrate-before-serve CMD and the pinned pnpm — both are regression-tested in `tools/create-commonpub/tests/cli.rs`.

## Sessions 137 + 138 — cross-instance identity invariants

- **Action routing is config, not control flow.** Every user-facing action gets one `ActionRoute<TEvent, TIn, TOut>` declaration with `local` + optional `remote` halves. `run(event, ctx.active, action, input)` is the ONLY place that branches on `active.kind === 'linked'`. Never sprinkle `if (active.kind === 'linked')` through controllers — the abstraction breaks the moment that pattern starts. Adding a new proxiable action = one new file with an ActionRoute. (Phase 4 will add publish/like/follow/comment routes; until then, the `run()` codepath is unused.)

- **`@commonpub/server` is event-type-generic, not h3-specific.** `ActionRoute<TEvent, TIn, TOut>` parameterises the event type so `@commonpub/server` doesn't depend on `h3`. Layer-side controllers instantiate `ActionRoute<H3Event, ...>`; tests use `unknown`. Don't add `h3` as a `@commonpub/server` dep.

- **`getFediClient` uses factory registration, not a passed DB.** The Phase 1b runtime ships a Nitro plugin (`layers/base/server/plugins/identity-startup.ts`) that calls `setFediClientFactory(createMastodonFediClientFactory(useDB()))` once at app init. `getFediClient` then delegates to the registered factory. This keeps `run()`'s signature simple (no DB / token-key / audit-logger threading through every call site) and `@commonpub/server` framework-agnostic. Tests use `setFediClientFactory(null)` in `afterEach` to reset.

- **`CPUB_FED_TOKEN_KEY` is the load-bearing env var for token-storing flags.** Required when any of `features.identity.{linkRemoteAccounts,signInWithRemote,remoteInteract,remotePublish}` is enabled (`actingAs` is exempt — UI-only, no token I/O). 32-byte hex (64 chars), generated with `openssl rand -hex 32`. The Nitro plugin's `assertIdentityConfig(config)` refuses to boot if a token-using flag is on without the key — fail-fast beats 500-mid-OAuth. NOT currently set on prod; flags are off so the assertion is a no-op.

- **Tokens are stored as `text`-base64 ChaCha20-Poly1305 ciphertext, not BYTEA.** `federated_accounts.access_token_ciphertext` is `text` (base64 of `ct||tag`); `access_token_iv` is `text` (base64 of 12-byte nonce). Drizzle/PGlite portability is simpler than custom-typed BYTEA; the ~33% storage overhead is negligible for OAuth tokens. `@commonpub/infra/tokenCrypto` handles the encoding internally; callers see `string` plaintext only.

- **Auth-tag tampering: any mutation of ciphertext, IV, or tag causes `decryptToken` to throw.** Authenticated-encryption guarantee. Same for wrong-key — a key rotation needs to re-encrypt every row before swapping the env var. Documented in `tokenCrypto.ts` header.

- **Re-link clears `revoked_at`.** When `linkFederatedAccount` is called with a fresh grant on a previously-revoked row, `revokedAt` is set to `null` (lifts soft-revocation), the new ciphertext+iv replace the old, scopes/softwareKind refresh, `last_verified_at = now()`. The OLD ciphertext is gone from the DB (security-positive). Race between revoke + re-link is "later writer wins"; user can re-link again if the revoke wins.

- **`softwareKind` validated at the application layer, no DB CHECK.** `isSoftwareKind()` runs in `linkFederatedAccount`'s `buildGrantFields`; falls back to `'unknown'` on bad input. No `CHECK` constraint on the column (forward-compat for AT Proto, IndieAuth, Solid, etc.). `coerceScopes` likewise filters unknown scope strings at the boundary.

- **Megalodon's SNS enum is narrower than ours.** `SoftwareKind` includes `akkoma` and `cpub`; megalodon's `'mastodon' | 'pleroma' | 'friendica' | 'firefish' | 'gotosocial' | 'pixelfed'` doesn't. `toMegalodonSns()` in `mastodonFactory.ts` maps: akkoma → pleroma (Akkoma is a Pleroma fork); cpub/unknown → mastodon (CommonPub speaks the Mastodon API). When adding a new `SoftwareKind` value, also add the megalodon mapping or it'll fall through.

- **The `identity-startup` Nitro plugin is the registration point.** No other code should call `setFediClientFactory` outside of tests. If a future plugin needs to swap the factory (e.g., to add per-instance audit logging), do it inside this plugin, not as a separate plugin — Nitro's plugin order is alphabetical and silent overwriting is a debugging trap.

- **`useFeatures()` returns a flat object of per-flag refs PLUS a single `identity` ComputedRef** for the nested object. Existing nav iterations over `Object.entries(useFeatures())` see the boolean refs as truthy and the `identity` ref's value as a non-boolean object — they don't accidentally treat `identity` as a feature gate (no nav item declares `featureGate: 'identity'`). When adding new identity sub-flags, update both `@commonpub/config`'s schema AND the layer's local `IdentityFeatures` interface; the layer's type intentionally lags slightly but must not drift indefinitely.

- **Pin pnpm in EVERY repo's Dockerfile.** Both commonpub and deveco's deploy Dockerfiles run `pnpm install --frozen-lockfile` in a node:22-alpine container. As of 2026-05-13, deveco's was on `pnpm@latest`; pnpm ≥10.11 (or thereabouts) enforces `onlyBuiltDependencies` strictly and fails the install on packages with build scripts (`sharp`, `esbuild`, `@parcel/watcher`) that haven't been explicitly approved. Deveco's deploy failed mid-flight that day even though yesterday's build worked. The fix: pin a known-good pnpm version (`pnpm@10.10.0` matches commonpub). When bumping pnpm in either repo, do both repos and the local lockfile in lockstep — divergent pnpm versions can produce subtly different lockfiles. Symptom to watch for in build logs: `[ERR_PNPM_IGNORED_BUILDS] Ignored build scripts: ...` followed by a non-zero exit.

## Session 150 — federation-hardening Stage 3 wrap invariants

- **`@commonpub/server` exports `safeFetchResponse` + `safeFetchSigned`** since 2.55.0 (protocol 0.12.0). Use these — not raw `fetch` — for federation outbound. `safeFetchResponse(url, options)` returns the response shape (`{ ok, status, statusText, headers, body: Buffer, contentType, finalUrl }`) without throwing on non-2xx and with `followRedirects: false` by default. `safeFetchSigned(signedRequest)` forwards a pre-signed `Request` (from `signRequest`) through the SSRF-safe pinned dispatcher with the signature headers intact. Federation delivery needs the status code for circuit-breaker logic; signed AP requests MUST NOT replay to redirect targets (the signature covers the original target). **Do not add new raw `fetch(...)` in `packages/server/src/federation/`** — pre-flight every URL through `safeFetchResponse`/`safeFetchSigned`/`createSafeActorFetchFn`.

- **`createSafeActorFetchFn()`** in `packages/server/src/federation/safeFetchFn.ts` is the `FetchFn`-shaped wrapper for `resolveActor`/`resolveActorViaWebFinger`. Pass it instead of `globalThis.fetch` — those helpers do a per-hop string `isPrivateUrl` check but rely on the injected fetchFn for DNS-rebind protection (the pinned dispatcher closes the TOCTOU). Forward `init?.signal` through to honor caller timeouts.

- **`getClientIp(event, opts?)` in `@commonpub/infra/security`** reads the rightmost `X-Forwarded-For` token by default — that's the address appended by the last trusted proxy. The previous leftmost-token read was vulnerable to `X-Forwarded-For: <random>` rotation in multi-proxy setups. All 3 prod sites use Caddy with `header_up X-Forwarded-For {remote_host}` (overwrite) so depth=1 is correct without operator action; multi-proxy operators set `CPUB_TRUSTED_PROXY_DEPTH=N`. Use this for any new IP-based key (rate limit, dedup, audit) — don't re-parse XFF inline.

- **`setBetterAuthSessionCookie(event, token, expiresAt)`** in `layers/base/server/utils/betterAuthCookie.ts` is the only correct way to mint a Better Auth session cookie from a custom route. h3's `setCookie` calls cookie-es `serialize` which always does `encodeURIComponent(value)` exactly once — so the helper's `signBetterAuthCookieValue` returns the RAW `${token}.${signature}` string with NO pre-encoding. Pre-encoding gave double-encoded wire values that Better Auth's single-decode left as malformed signatures (length-44 + endsWith-`=` check failed) → null session → anonymous redirect. The negative regression test (`betterAuthCookie.test.ts:182`) is the guard. Same shape of bug as session 149's safeFetch P0: algorithm verified, framework integration broke it.

- **`getAuthSecret()` in `betterAuthCookie.ts` MUST stay in sync with `layers/base/server/middleware/auth.ts:27-33`.** Both resolve the auth-signing secret from `useRuntimeConfig().authSecret`. Dev fallback is `'dev-secret-change-me'` in BOTH places; prod throws if missing in BOTH places. If the two diverge, our helper signs cookies under a different key than Better Auth's `getSession` verifies — federated logins silent-fail. Comment in the helper says KEEP IN SYNC.

- **`clearBetterAuthSessionCookies(event)` clears BOTH cookies** — `__Secure-better-auth.session_token` (or bare in dev) AND `__Secure-better-auth.session_data` (Better Auth's SSR cookie cache). Single `deleteCookie('better-auth.session_token')` was the pre-fix bug — left the session_data cache for ~5 minutes of stale enriched-user data.

- **`signRequest` in `@commonpub/protocol/src/sign.ts` signs exactly `(request-target) host date digest`** (not content-type). The strict inbound coverage policy (`verifyHttpSignature`, session 149) requires those four headers and only those. Changing the outbound set would make our own signed activities fail at compliant receivers (including our own server). The coverage matrix is tested at `packages/protocol/src/__tests__/security/verifyHttpSignature.test.ts`.

- **All 3 prod instances use Caddy with `header_up X-Forwarded-For {remote_host}`** (overwrite, not append). XFF chain length is always 1 — leftmost === rightmost. The old leftmost-token rate-limit key was NOT live-exploitable in our setup; the rightmost-token rule is forward-compatible hardening for nginx-append or multi-proxy operators. `deploy/nginx.conf` uses `$proxy_add_x_forwarded_for` (append); depth=1 still works with one trusted proxy. Doc: `docs/deployment.md` "Reverse-proxy contract" subsection.

- **AbortSignal.any is used by `safeFetchResponse` to combine caller signal + internal deadline.** Node ≥20.3 (engines pin is ≥22). When forwarding a caller's signal through, the deadline still fires independently — whichever aborts first wins.

## Sessions 155–169 — layout engine + editor invariants

- **dnd-kit composables throw without a `<DnDProvider>` ancestor — gate them behind `editable`.** `@vue-dnd-kit/core`'s `makeDraggable`/`makeDroppable` call `inject('VueDnDKitProvider')` at setup and THROW `"DnD provider not found"` if no provider is mounted above. `disabled: true` does NOT suppress the inject. The public render path — the homepage layout-engine canary + custom pages render `<LayoutSlot editable=false>` with NO provider — so `LayoutSection.vue` (makeDraggable, ~line 166) and `LayoutRow.vue` (makeDroppable, ~line 529) call them ONLY inside `if (props.editable)`, with inert `computed(() => undefined/false)` fallbacks on the public path. `editable` is static per instance, so the conditional composable call is safe. **Do NOT hoist these calls out of the guard** — it crashed commonpub.io's homepage (500) the moment the editor code first deployed (session 169). The editor (`pages/admin/layouts/[id].vue`) wraps everything in `<DnDProvider>`, so `editable=true` is always safe. The unit tests `vi.mock` the whole dnd module, so they will NOT catch a regression here — the guard is locked by `not.toHaveBeenCalled()` assertions in `LayoutSection.test.ts`/`LayoutRow.test.ts`.

- **Layout section types point at EXISTING components via `propMap` — never write parallel `Section*.vue` renderers.** The 17-section registry (`layers/base/sections/`) sets `component:` to an existing `Block*`/`Homepage*` component and adapts props through `propMap`. Stage E deleted 16 duplicate `Section*.vue` files that re-implemented existing components (~2200 wasted lines, visible hero regression). Before writing a section renderer, check `components/blocks/` AND `components/homepage/` first.

- **The app's port 3000 is reachable ONLY from inside its container.** caddy fronts 80/443 on the droplet; the app container does NOT publish 3000 to the host. So a droplet-host `curl http://localhost:3000/...` never reaches the app (it just times out). `scripts/smoke.mjs` (the post-deploy smoke) MUST run via `docker compose exec -T app node scripts/smoke.mjs` — in-container, where localhost:3000 IS the app. The OLD smoke used the host endpoint but was `curl … || echo ::warning` (warn-only), so it silently "passed" a permanently-unreachable probe for a long time. Session 169 hardened it: in-container, checks `/` (not just `/api/health`), hard-fails on non-2xx. Health 200 ≠ site works — always smoke `/`.

- **`layoutEngine` is default OFF but ON live on commonpub.io** via a runtime override (env or DB `instance_settings.features.overrides`). The homepage there is a canary rendering through `<LayoutSlot>`. deveco.io + heatsynclabs.io keep it OFF (legacy renderer). Verify with `curl /api/features` — never assume from the build-time default.

## Session 171 — contest invariants

- **Contest judges live in the `contest_judges` table — the single source of truth.** The `contests.judges` jsonb column is fully deprecated as of session 172: no longer read OR written (kept only to avoid a destructive DROP, which would also choke heatsync's `db:push`). `createContest` seeds the TABLE from `input.judges`; `updateContest` never touches judges; `ContestDetail` no longer exposes `judges`. Authorization (`judgeContestEntry`), the public judges grid, `isJudge`, the "Judge Entries" link, and accept-invite all read the table. Scoring requires an *accepted*, non-`guest` judge record. Pre-171 the jsonb and the table were disconnected and judging was broken end-to-end through the UI — the integration test passed only because it populated BOTH by hand (memory `feedback-test-populates-both-sources`). Don't reintroduce jsonb-based judge reads/writes.

- **`contests` is OFF at build-time default but ON live on all three instances** (`apps/reference/commonpub.config.ts` sets `contests: true`; deveco + heatsync enable it too). `curl /api/features` for ground truth. Pre-171 live code leaked per-judge scores — this is a security-relevant feature, not dormant.

- **Per-judge scores + written feedback (`includeJudgeScores`) are privileged-only** (owner / admin / panel judge). Aggregate `score` exposure runs through the pure `shouldRevealScores(visibility, status, privileged)` helper honouring `judgingVisibility` (`public` always / `judges-only` after completion / `private` never to the public; ranks may still show). The endpoint `GET /api/contests/:slug/entries` wires both; a source-contract test (`layers/base/server/api/contests/__tests__/entries-score-gating.test.ts`) locks the wiring and the behaviour matrix is unit-tested on the helper. Never forward `includeJudgeScores` unconditionally.

- **`calculateContestRanks` uses `RANK()` over scored entries only** — tied scores share a rank; never-scored entries keep a NULL rank. Don't revert to `ROW_NUMBER()` (arbitrary tie-break + ranks unjudged entries).

- **`v-model.number` on an empty number input yields `''`, not `null`.** The contest create/edit forms coerce empty `place`/`weight` to `undefined` before POST (`typeof x === 'number' && Number.isFinite(x)`), else `z.number().positive()` rejects category-only prizes / weightless rubric criteria. Same trap for any future numeric-optional form field.

- **`judgeContestEntry` merges `judgeScores` inside a row-locked transaction (`SELECT … FOR UPDATE`) — do NOT "simplify" it back to a plain read-modify-write.** The jsonb array is read, the judge's record upserted, the average recomputed, and written back; without the lock two judges scoring the same entry concurrently lose one update (session 173 fix). When a contest has `judgingCriteria`, judges submit `criteriaScores` (per-criterion `{label,score,max}`) and the overall 0–100 is the normalized weighted sum; `judgeEntrySchema` accepts `score` OR `criteriaScores` (refine requires one). The per-criterion breakdown lives in `judgeScores[].criteriaScores` (jsonb $type change, no migration).

## Sessions 176–179 — feed pagination / keyset ordering invariants

- **Every feed ORDER BY must end with a unique `id` tiebreaker.** `ORDER BY <non-unique col> LIMIT/OFFSET` is unstable → tied rows reorder between page N and N+1 → load-more shows duplicates. `sort:'popular'` (`view_count DESC`, all 0 for most rows) dup'd the homepage; a bulk-imported `published_at` does the same. This cost a 5-release saga (server 2.68→2.70). Always `desc(id)` last. Verify disjointness on the LIVE API (`GET /api/content/feed` walked by cursor → OVERLAP must be 0); unit tests can pass by insertion-order coincidence.

- **The federated keyset-MERGE (`listContentKeyset`) rests on three byte-exact orderings — a mismatch is the dup/gap bug class.** (1) The local SQL, the federated SQL (`queryFederatedAsListItems`), and the JS comparator (`compareFeedOrder`) must ALL be `published_at DESC NULLS LAST, id DESC` — `desc()` alone is NULLS FIRST in Postgres, but the merge maps null→-Infinity (last), so the SQL needs an explicit `NULLS LAST` and NO extra secondary key. (2) Postgres `uuid DESC` == JS string-desc (a JS-built cursor is fed back into a SQL `WHERE id < :id`) — proven over 500 random uuids in `uuid-ordering-invariant.test.ts`; don't switch the feed id to a non-uuid/uppercase key without re-proving it. (3) Migration 0012's composite indexes must spell `id DESC NULLS FIRST` / `view_count DESC NULLS FIRST` — the planner matches NULLS placement SYNTACTICALLY (`ORDER BY id DESC` = NULLS FIRST), so `NULLS LAST` there makes Postgres silently ignore the index (full scan + Sort). Mutation-test any change to these (the suite catches a flipped tiebreaker or a dropped null-branch).

- **`published_at` must stay millisecond-aligned.** The pg driver returns ms-precision JS `Date`, but the column is microsecond `timestamptz`. A sub-millisecond `published_at` would let a ms-truncated cursor skip rows. All write paths go through JS `new Date()` (ms) today — `publishContent`, federation inbound — so the cursor round-trip is exact. A raw-SQL/migration write of sub-ms `published_at` would break it (add tolerance in `keysetWhere` or truncate on write).

- **`decodeCursor` must validate the cursor DOMAIN, not just its TS shape (security — fixed server 2.72.0).** A SHAPE-valid but DOMAIN-invalid cursor — string `v` that isn't a date, numeric `v`, non-uuid `id` — flows into the Drizzle bind and throws (`new Date('garbage').toISOString()` RangeError, or a uuid/timestamp cast error). There's no global Nitro error handler on these routes, so a crafted `?cursor=` returned an **unhandled 500 — a trivial unauthenticated DoS** (confirmed LIVE: 3 payloads each 500'd commonpub.io). `decodeCursor` now rejects semantically-invalid values (string `v` must parse to a finite Date) and `asDateUuidCursor()` narrows to the feed's column types (date-or-null `v` + uuid `id`) before SQL — invalid → null → page 1. `listContentKeyset` wraps `decodeCursor` in `asDateUuidCursor`. Test feeds the exact live-500 payloads and asserts page-1, not 500. Memory: `feedback_decode_untrusted_validate_domain_not_shape`.

- **The federated merge is suppressed for any filter the federated query can't honour — via the shared `canMergeFederated(filters)` (fixed server 2.72.0).** The old `willFederate` gate excluded `authorId/featured/editorial/categoryId` but NOT `followedBy/difficulty/tag/non-published-status` — so a "following" feed with `seamlessFederation` merged in remote posts from accounts the user never followed (and difficulty/tag/archived feeds leaked the federated stream). `queryFederatedAsListItems` only applies type/search/isHidden/deletedAt/allowedContentTypes/cursor; every OTHER local-only predicate must suppress the merge. `canMergeFederated` is shared by BOTH `listContent` (offset) and `listContentKeyset` (keyset) so the two can't drift — don't re-inline the gate.

- **`pushSchema` (the PGlite test harness, `__tests__/helpers/testdb.ts`) silently SKIPS partial `WHERE` indexes** — so migration 0012's feed indexes don't exist in the test DB. `feed-indexes.integration.test.ts` creates the exact migration DDL itself, then proves applicability via `EXPLAIN` under `SET enable_seqscan=off` + `ANALYZE` (no Sort node). This is the same class as the table-level-UNIQUE `pushSchema` gap noted above — pushSchema is not a faithful mirror of real Postgres for non-column-index DDL.

- **`@commonpub/layer` ships SOURCE composables/components — a stricter consumer tsconfig (deveco) can red-CI on layer code the reference app accepts.** layer 0.43.0's `useContentFeed` tripped `TS2589 "excessively deep"` under deveco's `nuxt typecheck` (parameterising `useFetch<…>` with a union endpoint + the recursive `Serialized<…>` type); the reference app tolerated it. Before publishing a layer TYPE change, repro the ACTUAL consumer's typecheck: `pnpm pack` the layer → `npm install` the tarball into deveco-io → run its `nuxt typecheck`. Reference-app typecheck is necessary, not sufficient. Fix used `@ts-ignore` on the one union-endpoint `useFetch` line (deveco @ts-ignores the same on its own calls).
