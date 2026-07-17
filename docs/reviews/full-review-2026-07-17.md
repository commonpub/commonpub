# CommonPub Full-Codebase Review — Findings Register (2026-07-17)

Session 241. Read-only review of the entire tree; findings adversarially verified
before recording. **Nothing was rolled, published, or deployed.** The one code
change this session (contest mobile responsiveness) is described in §0 and is
awaiting go-ahead to ship.

## Method

- 52-agent workflow (`wf_7630f9aa-c6b`, 2.6M tokens): 6 inventory agents +
  14 subsystem reviewers, **each finding passed to an independent skeptic prompted
  to _refute_ it** (default = not-a-bug). Only survivors are recorded.
- **25 confirmed**, 2 uncertain, 5 refuted.
- The reviewer's cwd was the repo; every finding cites real `file:line`.
- I then **independently re-verified the headline items by reading the actual code**:
  both P1s, the P2 SSO takeover, and the P2 ordered-list data-loss (see notes).
- Verified baseline (2026-07-17, matches session-240 handoff — no drift):
  server 2.113 / schema 0.59 / config 0.33 / infra 0.17 / ui 0.13.2 / editor 0.11 /
  protocol 0.14 / auth 0.10 / layer 0.106; **37 flags** live on all 3 instances;
  latest migration **0042**; all 3 instances health ok.

Severity scale: **P0** data-loss/security/crash affecting live prod · **P1**
security/data-loss (may be latent behind a flag) · **P2** correctness/security with
real but bounded impact · **P3** minor / defense-in-depth / latent.

---

## §0 — Contest page mobile responsiveness (FIXED locally, verified, not shipped)

**Problem (confirmed at 390px with real theme CSS + a real seeded contest):**
arbitrary author HTML rendered by the contest page had no overflow containment, so a
wide `<table>`, a long `<pre>`, or a long unbroken URL forced the **entire page to
scroll sideways** on mobile (measured scrollWidth 871 vs viewport 390).

Three render containers were exposed:
- `.cpub-md-html` — custom **HTML blocks** + full-HTML descriptions (`BlockHtmlView`, `CpubMarkdown`)
- `.cpub-block-text` — **every paragraph** + raw-HTML-in-markdown (`BlockTextView`)
- `.cpub-prose` — federated pre-rendered HTML

**Fix (additive CSS only, 2 source files + synced generated theme copy):**
- `packages/ui/theme/prose.css`: `.cpub-prose` word-wrap; `.cpub-md-html` gets
  `overflow-wrap`, self-scrolling `pre`/`table` (`display:block`+`nowrap` cells so the
  grid scrolls in place instead of collapsing into one-letter columns), media `max-width` caps.
- `layers/base/components/blocks/BlockTextView.vue`: same containment for the text path.
- Re-ran `bundle-theme.mjs` to sync the gitignored `layers/base/theme/prose.css`.

**Verified end-to-end:** seeded a contest with a nasty custom-HTML block on the local
app, viewed at true 390px → **no page overflow (390=390)**; table scrolls in place, URL
wraps, `<pre>` scrolls. Theme-contrast + both HTML-block test suites pass (10/10). The
rest of the contest render tree (hero, tabs, sidebar, and all ~20 structured block
renderers) was already responsive.

**To ship:** republish `@commonpub/layer` (theme is bundled at publish; `0.106` → next).
Structured blocks and articles are unaffected (fix scoped to the three prose classes).

---

## §1 — Confirmed findings

### P1

**1. AP inbox: foreign `object.id` host not bound to the authenticated actor**
`packages/server/src/federation/inboxHandlers.ts:679` · security · **live federation path**
`assertActorMatchesSigner` binds only the top-level `activity.actor` host to the HTTP-signature
signer; the inner `object.id`/`attributedTo` host is never checked. A signed peer at `evil.com`
POSTs `Create{actor: evil.com/actor, object:{id: victim.com/u/x/blog/fake, …}}`. Signature and
actor/signer host match (evil.com); `objectUri` host = victim.com so it isn't loop-skipped;
`originDomain = victim.com`; `matchMirrorForContent(db, victim.com)` stamps the operator's pull
mirror for victim.com. The row is upserted keyed on `objectUri` (UNIQUE) with `actorUri = evil.com`,
so an attacker (a) **injects forged content into a feed the operator trusts from victim** and (b)
**squats victim's `objectUri`** — victim can never `Update`/`Delete` it (both require `actorUri` match)
and, via `onConflictDoUpdate`, an attacker can **overwrite** victim's legitimate mirrored content.
_Independently verified: lines 682 (originDomain from objectUri), 762–800 (upsert keyed on objectUri, no host binding)._
**Fix:** in `onCreate` (and the onUpdate missed-Create path) require
`new URL(object.id).hostname === new URL(actorUri).hostname` (and the same for `attributedTo`);
reject/skip otherwise. Cross-instance re-broadcast must use `Announce`, not a raw `Create` with a foreign `object.id`.

**2. Mastodon-login callback trusts remote-supplied actor URI → account takeover** *(latent: flag OFF on all 3)*
`layers/base/server/api/auth/mastodon/callback.get.ts:100` · security
`mastodonLogin.ts:304` sets `actorUri = account.url` verbatim from the remote's
`verifyAccountCredentials`, and the callback matches it globally via
`findUserByFederatedAccount(actorUri)` — which queries `WHERE actorUri = $1` with **no host binding**.
An attacker stands up a throwaway Mastodon-API server `evil.example`, runs the login flow against it,
and has it return `url = https://mastodon.social/@victim`. If the victim previously linked that
fediverse account, the callback finds the victim's row and mints a session **as the victim**.
_Independently verified: `mastodonLogin.ts:304` (unbound actorUri), `oauth.ts:373` (actorUri-only match).
`signInWithRemote` is **false** on commonpub.io/deveco.io/heatsynclabs.io → endpoint 404s today, so this
is a real but **latent** P1 that must be fixed before the flag is ever enabled._
**Fix:** reject unless `new URL(actorUri).hostname === loginState.host`; centralize in `exchangeCodeAndVerify`.

### P2

**3. CommonPub federated SSO callback: same unbound-actor-host takeover across trusted instances**
`layers/base/server/api/auth/federated/callback.get.ts:47` · security
`exchangeCodeForToken` (`oauth.ts:599`) returns `actorUri` straight from the remote instance's token
response; the callback matches it globally with no `host === oauthState.instanceDomain` assertion. A
compromised/malicious **trusted** instance B can return `actorUri = https://A/users/victim` and take over
victim's A-linked account. Lower than #2 (requires an operator-added trusted instance) but still full takeover.
**Fix:** validate `new URL(actorUri).hostname === oauthState.instanceDomain` before lookup/link; share one
enforcement point with #2.

**4. `forkFederatedContent` can fork hidden/tombstoned federated content**
`packages/server/src/content/content.ts:1250` · security
The feed filters `isNull(deletedAt) + isHidden=false`, but `forkFederatedContent` selects by `id` only.
A user holding a mirror uuid can fork a moderator-hidden or remotely-deleted item into a local draft and
republish it. The local twin `forkContent` (line 1163) correctly gates via `visibleContentWhere()`.
**Fix:** add `isNull(deletedAt)` + `isHidden=false` to the source select.

**5. Markdown serializer drops all ordered-list item text (data loss)**
`packages/editor/src/markdown/serializer.ts:112` · correctness
The `<ol>` handler's `<li>` callback returns `` `${++i}. ` `` with **no `$1`**, discarding item text (the
`<ul>` branch correctly uses `- $1`). `<ol><li>First</li><li>Second</li></ol>` → `1. 2.`. Runs live in
`ContestStageTemplateEditor.vue` (`blockTuplesToMarkdown`): opening a stage whose stored instructions contain
an ordered list shows the text vanish, and saving persists the loss.
_Independently verified at serializer.ts:112–115._
**Fix:** `inner.replace(/<li>(.*?)<\/li>/gi, (_m, item) => \`${++i}. ${item}\`)`.

**6. Reminder ledger claim commits before email enqueue → whole batch silently dropped on enqueue failure**
`packages/server/src/contest/reminders.ts:191` · correctness
The `contest_reminder_sends` claim (`ON CONFLICT DO NOTHING`) auto-commits, then `enqueueEmails` runs as a
separate statement. If enqueue throws, the claim is already committed, so the next sweep suppresses re-claiming
and every recipient in that batch **never** gets that reminder — "exactly-once" degrades to "at-most-once, zero on failure."
**Fix:** wrap claim + enqueue in one `db.transaction` so a failed enqueue rolls back the claim.

**7. `toggleFederatedBuildMark` — bare INSERT races to a 500 on double-click**
`packages/server/src/content/content.ts:1316` · concurrency
Two concurrent "I built this" POSTs both read `existing.length===0` and both INSERT, violating the unique
`(userId, federatedContentId)`; the second aborts → 500. The local `toggleBuildMark` already fixed this with
`.onConflictDoNothing()` (lines 1089–1092); the federated twin wasn't hardened.
**Fix:** mirror the local fix with `.onConflictDoNothing().returning()`.

**8. `upload-from-url` swaps `generateStorageKey` args → keys with no extension**
`layers/base/server/api/files/upload-from-url.post.ts:43` · correctness
Called as `generateStorageKey(purpose, ext)` instead of `(originalName, purpose)`. A remote PNG lands at
`png/<uuid>` (folder = MIME subtype, **no extension**). On the LocalStorageAdapter (prod Docker sets
`UPLOAD_DIR`), an extension-less object with the global `X-Content-Type-Options:nosniff` can be mis-served →
broken images. Sibling `upload.post.ts:72` does it correctly.
**Fix:** `generateStorageKey(\`image.${ext}\`, purpose)`.

**9. HTTP Signature `(request-target)` drops the URL query string**
`packages/protocol/src/sign.ts:56` (and `keypairs.ts:106`) · correctness
Signing line is `${method} ${url.pathname}` — omits `url.search`. Self-to-self verify passes (both sides drop
it), so tests miss it. But backfill/hub-mirroring signed GETs to paginated remote collections
(`…/outbox?page=true&min_id=123`) fail on authorized-fetch servers that canonicalize path+query per
draft-cavage §2.3 → 401 → paginated backfill/mirroring silently fails.
**Fix:** emit `${method} ${url.pathname}${url.search}` in both places; add a query-bearing test.

**10. Markdown block preview renders parser HTML via `v-html` with no sanitizer**
`packages/editor/vue/components/blocks/MarkdownBlock.vue:92` · security
The preview binds `v-html` to `markdownToBlockTuples` output, whose parser uses `allowDangerousHtml:true` and
passes raw HTML verbatim; the public `BlockMarkdownView.vue` wraps the same value in `sanitizeBlockHtml`, this
editor preview does not. `<img src=x onerror=…>` runs in the editing user's session when a reviewer/admin opens
a markdown block from a less-trusted source.
**Fix:** wrap every html binding in `sanitizeBlockHtml`.

### P3

**11. Undo(Like) decrements counters without verifying a prior Like** — `inboxHandlers.ts:388` · correctness.
A remote Undo(Like) for content it never Liked decrements `likeCount`/`remoteLikeCount`; repeated distinct-id
Undos walk it to the GREATEST floor, zeroing legitimate local likes. **Fix:** delete the inbound Like row with
`returning()` first; decrement only if a row was removed.

**12. `roleGuard` fails OPEN on an unknown role name** — `packages/auth/src/guards.ts:33` · security.
`getRoleLevel(minRole)` returns `-1` for an unknown role; `userLevel < -1` is always false → authorizes **all**
logged-in users. The package README example `roleGuard('moderator')` (not a valid role) reproduces it. Unused in
the app today (layer uses `requirePermission`), but it's exported public API. **Fix:** fail closed when
`getRoleLevel(minRole) < 0`; fix the README to `roleGuard('staff')`.

**13. `maxEntriesPerUser` cap is non-atomic count-then-insert** — `packages/server/src/contest/entries.ts:263` ·
concurrency. Concurrent submits of distinct content both read count=0 and both insert (unique key is
`(contestId,userId,contentId)`, no per-user count), exceeding the cap; `submitContestProposal` is worse (each call
mints a new contentId). **Fix:** re-count under a per-`(contestId,userId)` lock inside the insert tx, or a DB constraint.

**14. `listContent` recomputes `COUNT(*)` on every page under federated merge** — `content.ts:415` · perf.
`willFederate` forces `localOffset=0` every page, and the count guard keys on `localOffset===0`, so deep
"load more" pages each run a full count — contradicting the documented optimization. **Fix:** gate the count on the
client-requested `offset`, not internal `localOffset`.

**15. Sanitizer allows `data:image/svg+xml` in `<a href>`** — `packages/protocol/src/sanitize.ts:52` · security.
SVG data-URIs (which can carry script) are allowed for `href` as well as `src`. Browsers block top-level
data: navigation, so defense-in-depth. **Fix:** allow SVG data-URI for `img src` only.

**16. Digest verification is case-sensitive on the algorithm token** — `keypairs.ts:99` · correctness.
Exact `SHA-256=…` match rejects a spec-conformant `sha-256=…` sender (RFC 3230 token is case-insensitive).
Fail-closed, small real-world impact. **Fix:** case-insensitive algorithm compare, then base64 compare.

**17. `apps/shell` inlines a stale `ENV_FLAG_MAP` missing 17 flags** — `apps/shell/server/utils/config.ts:19` ·
doc-drift. No parity test; those flags can't be env-toggled on the shell app. `apps/shell` is `private:true`
and not one of the 3 deployed instances (impact limited). **Fix:** import the canonical map + parity test.

**18. Config schema accepts `contentTypes:['article']` but never normalizes it to `blog`** —
`packages/config/src/schema.ts:166` · correctness. Comments claim normalization; there is no `.transform`. An
operator using the deprecated alias silently filters ALL federated `blog` content out of feeds/public API. **Fix:**
add `.transform('article'→'blog')` (making the comments true) or reject `article`.

**19. `federated_hub_post_replies.parent_id` self-pointer has NO FK** — `packages/schema/src/federation.ts:413` ·
data-model. Unlike every other self-referential column, it lacks `.references(… onDelete:'set null')`; latent
(no delete-reply path exists yet). **Fix:** add the self-FK + migration (guard pre-existing orphans).

**20. `conversations.participants` (jsonb) has no FK to users** — `packages/schema/src/social.ts:166` · data-model.
A deleted user leaves a ghost DM shell with stale preview. Instance-local, no data loss. **Fix:** sweep on user delete
or normalize to a join table.

**21. Broadcast audience doesn't exclude suspended/soft-deleted users** — `packages/server/src/comms/broadcast.ts:27`
· data-model. `audienceWhere()` filters only `emailVerified` + unsubscribed, not `status`/`deletedAt` (which
metrics/profile treat as authoritative). Latent (no soft-delete path writes those today). **Fix:** add
`isNull(deletedAt)` / `ne(status,'suspended')`.

**22. `createComment` doesn't validate `parentId` target/existence** — `packages/server/src/social/social.ts:350` ·
data-model. A reply can claim a `parentId` from a different target; it's invisible in threading but still increments
counts (count > displayed). No privacy leak. **Fix:** require `parent.targetType/targetId` match before insert.

**23. Callout/Quote block editors seed unsanitized stored HTML into `innerHTML`** —
`packages/editor/vue/components/blocks/CalloutBlock.vue:28` (and QuoteBlock.vue) · security. Writes are sanitized on
`@input` but the initial/external value isn't sanitized on display; markdown-import tuples from the
`allowDangerousHtml` parser fire `<img onerror>` when opened for editing. **Fix:** `sanitizeBlockHtml(html.value)`
in `onMounted` + watcher.

**24. Parser emits a `table` block the core registry never registers** — `packages/editor/src/blocks/registry.ts:65`
· data-model. `mapTable` emits `['table', …]` and the layer renders it, but `registerCoreBlocks` has no `table`, so
`validateBlock(['table',…])` fails and MarkdownBlock's preview shows the unknown fallback. No caller runs
`validateBlock` on import today. **Fix:** register a `tableContentSchema` + add a preview case.

**25. LocalStorageAdapter path-traversal guard uses prefix match without trailing separator** —
`packages/infra/src/storage.ts:42` (and `:70`) · security. `startsWith('/app/uploads')` also matches
`/app/uploads-evil/…`. Not reachable today (callers constrain `purpose` to an enum, id is a sanitized UUID).
Defense-in-depth. **Fix:** compare with `resolve()` + trailing `sep`.

---

## §2 — Uncertain (recorded, not actioned)

- **CodeBlock.vue:81 hardcoded editor-chrome colors** — the hardcoded values are real, but the verifier found the
  stated failure mechanism inverted (they're `--code-fg*` local fallbacks, not a live theming break). Low priority;
  worth a var(--*) cleanup pass but not a bug.
- **SVG uploads on LocalStorageAdapter lack `ContentDisposition:attachment`** (`storage.ts:37`) — structurally
  confirmed (S3 adapter sets it, local doesn't). Minor stored-XSS hardening gap (P3-ish); SVG isn't in
  `ALLOWED_IMAGE_TYPES` so it isn't reprocessed but is in `ALLOWED_MIME_TYPES`.

## §3 — Refuted (verified NOT bugs)

The reminder legacy-key dedup concern (deploy-straddling stages), a claimed reference-app client-flag drift, and 3
agent probe/placeholder items were refuted on inspection. The prior audit's "already resolved" debts hold: hooks bus
live, transactional counters, keyset pagination, per-request fresh role read (`enrichUser`).

## §4 — Coverage gaps (NOT reviewed to depth — do next)

Three review units returned placeholder/empty output and are **not** trustworthy as "clean":
- **Hub mirroring + backfill** (`hubMirroring.ts` ~1600, `hubFederation.ts`) — the known open items §2a actor-fetch
  amplification, §2b unbounded mirror-storage, §2c backfill attribution forgery, §2e public→private orphaning were
  **not** substantively confirmed or refuted. Highest-priority follow-up (adjacent to confirmed inbox P1 #1).
- **PII / GDPR / consent** — no substantive findings produced; needs a dedicated pass (draft-visibility gates, PII
  default-off in emails, export completeness, consent enforcement).
- **Layer build gaps + big untested Vue views** — the agent under-performed; but I independently confirmed the
  build-gap facts (see codebase-analysis.md §build-pipeline). The a11y/test-gap review of ProjectView (~1535 LOC)
  and other 1000+ line pages remains open.

---

## §5 — Recommended fix order

1. **#1 inbox object.id host binding** (P1, live federation) — forged/overwritten mirror content on the live path.
   Pair with a fresh **hub-mirroring deep review** (§4) since they share the ingest boundary.
2. **#2 + #3 SSO actor-host binding** (P1/P2) — fix before `signInWithRemote`/new trusted instances are ever enabled;
   centralize the `host === authenticating-instance` check so both callbacks share it.
3. **#5 ordered-list data loss** + **#6 reminder drop** + **#4 fork-hidden** (P2, low-risk, high-value) — small,
   contained, one commit each.
4. **#7 build-mark race**, **#8 storage-key swap**, **#9 signature query string**, **#10 editor preview XSS** (P2).
5. **Dedicated PII/GDPR pass** (§4) before the P3 batch.
6. P3 batch (#11–#25) as capacity allows; **#12 roleGuard fail-open** first (security primitive, cheap fix).
7. **Add `typecheck` + `lint` scripts to `layers/base`** and `lint` to `packages/infra` (build-pipeline gap).

All fixes above are **proposed only** — awaiting go-ahead before any implementation or roll.

---

## Update 2026-07-17 — fixes ROLLED (`@commonpub/server@2.114.0` / `@commonpub/layer@0.106.2`)

Rolled + verified live on all 3 instances (health ok, deploys green):
- **#1 (P1)** `onCreate` object.id host-binding — DONE + tested (regression test added).
- **§2c (hub-mirroring)** Announce→ingest `note.attributedTo`→note-origin host binding — DONE + isolated test.
- **§2b(i)** `mirrorMaxItems` cap now enforced in `matchMirrorForContent` (was dead code) — DONE + test.
- **§2e** federated-hub child routes (`posts`/`members`/`post-detail`/`replies`) gated on parent-hub visibility — DONE.
- Full `@commonpub/server` suite: 1728 tests pass; typecheck clean.

**Deferred — needs a product decision (§2b ii):** gating `federatedContent` storage on an existing
follow/mirror relationship (subscribed-only) vs. current open-discovery. Changes observable
federation behavior + breaks the current test contract; awaiting the operator's call.

Still open from the main register (not yet actioned): the Mastodon/federated SSO actor-host binding
(#2/#3 — latent behind the off `signInWithRemote` flag), plus the P2/P3 batch (#4–#25).

---

## Update 2026-07-17 (2) — adversarial audit of the shipped hardening + remediation ROLLED (`server 2.114.1` / `layer 0.106.3`)

An 18-agent adversarial audit of the 2.114.0 changes confirmed the P1 `onCreate` binding, §2c
Announce binding, and §2e read-gating are **sound** (userinfo/IDN/trailing-dot spoofs neutralized;
no legit-flow regression). It found real gaps in the session's own work, all now fixed + tested
(1732 server tests green) and live:

- **§2b cap was a no-op** — `federationConfig` was never threaded into `createInboxHandlers`, so
  `mirrorMaxItems` was always `undefined`. Wired `config.federation` into all 3 live inbox routes.
  (The unit test passed only because it called the leaf function with a literal cap; the *wiring*
  was untested — always exercise the real call path.)
- **Backfill/outbox-crawl bypassed the P1 guard** — `backfill.ts`/`hubMirroring.ts` feed `onCreate`
  with attacker-controlled `actor` (no HTTP-signature pinning), so a forged `actor==object.id`
  slipped through. Now reject any crawled item whose `actor` host ≠ the outbox owner's host
  (new end-to-end crawl test).
- **#2/#3 SSO actor-host binding** — `exchangeCodeForToken` + `exchangeCodeAndVerify` reject a
  remote-supplied `actorUri` whose host ≠ the authenticating instance (account-takeover class). Tested.
  (The Mastodon path remains latent behind the off `signInWithRemote` flag; the CommonPub-federated
  path is reachable when trusted instances are configured.)
- **§2e siblings** — `hub-post-like` gated on parent-hub visibility; `replies.get.ts` gains `requireFeature('federateHubs')`.
- **Mobile-overflow siblings** — `CustomHtmlSection` + `BlockMarkdownView` get the same containment as the contest fix.

**Still open (product decision):** §2b(ii) federated-content storage policy (subscribed-only vs open discovery).
Remaining register items #2/#3 SSO now DONE; the rest of the P2/P3 batch (#4 fork-hidden, #5 ordered-list
data-loss, #6 reminder-drop, #7 build-mark race, #12 roleGuard fail-open, …) remain for a future session.
