# Full-repository audit — 2026-08-23

Scope: every package, the Nuxt layer, both apps, the CI and deploy workflows, the
docs tree, both production forks, and the three live instances.

Method: nothing in `docs/STATUS.md`, the session logs, the previous audit reports
or the code comments was taken as fact. Every claim here is backed by a command
that was run and its output, a file and line, or a measurement against a live
instance or a real browser. Findings are **CONFIRMED** (independently reproduced)
or **SUSPECTED** (reads wrong, not proven). Claims from prior sessions that turned
out to be *right* are recorded too — that is the other half of an audit.

The audit ran as a lead pass plus a 28-agent fan-out across thirteen dimensions,
each dimension's findings then re-derived by an adversarial verifier instructed to
refute rather than confirm. Everything below survived that pass.

**Provenance, stated precisely.** Findings marked **[hand-verified]** I reproduced
myself, from the file or against a live instance, after the verifier. The rest
survived the finder-plus-adversarial-verifier pass but I did not personally re-run
them; they are as good as that process and no better. Treat a hand-verified finding
as settled and an unmarked one as very likely but worth a five-minute check before
you act on it.

**Three defects were fixed in this session** — each unambiguous, live, and now
covered by a test that is proven to fail without the fix. **Nothing was published
or deployed. Nothing was deleted.** Two of the three need a release to reach
production; see "Release required".

---

## The shape of it

Roughly 150 findings survived verification. But the useful result is not the count — it is
that the repo keeps reproducing one failure mode:

> **An audit finds an instance. The fix lands on that instance. A guard is written
> that pins that instance. The rest of the class ships.**

Four independent examples, all confirmed this session:

| session 256 found | it fixed | the class actually was |
| --- | --- | --- |
| `escapeXml` missing a control-char strip in 2 files | those 2, + a guard over those 2 | **5 copies**; the 3 unlisted are live RSS routes |
| a pg pool with no `'error'` listener crashing a test run | the 4 pools in the **test helper** | the **production** pool still had none |
| `profileVisibility` ignored by `sitemap.xml` | the sitemap, + a guard over the sitemap | **7 sites enforce it; ~13 public read paths do not** |
| a ContentCard date mismatching across timezones | ContentCard | **45 files** render un-gated locale dates; 32 of 85 live items show the wrong day |

The same shape appears in the gates themselves: fifteen workspaces run `lint`, and
the layer — the largest tree and the one that ships — is not one of them; two tests
pin the reference app's env-flag map and nothing pins the starter template's, which
is missing 27 of 46 flags; both forks' CI verifies a dependency tree that is not
the one their Dockerfile builds.

**The single recommendation that would retire most of this class:** when a
predicate, an escaper or a guard is fixed, make the test *discover* its targets by
scanning rather than listing them. Both guards written this session do that, and
both catch a sixth copy added tomorrow.

| | count |
| --- | --- |
| Fixed this session | 3 |
| P1 — reachable in production: security, privacy, correctness, release integrity | 28 |
| P2 — real defect, bounded blast radius | 68 |
| P3 — cruft, staleness, maintainability | ~50, grouped rather than enumerated |
| SUSPECTED | 3 |
| Verified correct (claims that checked out) | 15 |

Counts are of the entries in this document. The fan-out produced more raw findings
than this; what is here is what survived adversarial verification and, for the P1s,
a second check by hand.

---

## Fixed in this session

### F-1 — Stored XSS in the live explainer render path — **FIXED (needs release)**

**CONFIRMED P1.** `packages/explainer/vue/utils/sanitize.ts:24`

The full chain, each link verified by hand:

1. `createContentSchema` types the content field as `z.unknown()`
   (`packages/schema/src/validators/content.ts:27`) — arbitrary JSON, no shape
   validation.
2. The write-path sanitizer `sanitizeExplainerDocument`
   (`packages/server/src/content/content.ts:85-115`) **enumerates fields by hand**:
   `hero.subtitle`, `section.body`, `section.bridge`, `section.insight`,
   `section.aside.text`, `conclusion.body`. It never touches `section.module` —
   a declared field (`packages/explainer/src/types.ts:239`) whose config is
   "passed as props to the module viewer".
3. `layers/base/components/views/ExplainerView.vue:6` renders `ScrollViewer` →
   `ScrollViewer.vue:10,92` renders `SectionRenderer` → `SectionRenderer.vue:40-41`
   renders `section.module` through `InteractiveContainer` → the module registry →
   e.g. `packages/explainer/modules/toggle/Viewer.vue:9-10`, which v-htmls
   `content.descriptionA` after passing it through `sanitizeHtml`.
4. That `sanitizeHtml` neutralised dangerous URLs with
   `.replace(/javascript\s*:/gi, '')`. **A single-pass string replace cannot do
   this job.** Tested against a real browser DOM parser, 8 of 12 vectors produced a
   live `javascript:` / `data:` / `vbscript:` protocol on the parsed element:

```
*** BYPASS *** nested reassembly   <a href="javasjavascript:cript:alert(1)">
                                   -> A.href = javascript:
   (the replace removes the INNER occurrence; the halves close up)
*** BYPASS *** tab in scheme       java<TAB>script:      -> javascript:
*** BYPASS *** newline in scheme   java<LF>script:       -> javascript:
*** BYPASS *** entity colon        javascript&#58;       -> javascript:
*** BYPASS *** entity colon hex    javascript&#x3a;      -> javascript:
*** BYPASS *** data html in href   data:text/html;base64,…  -> data:
*** BYPASS *** vbscript            vbscript:msgbox(1)    -> vbscript:
*** BYPASS *** img src javascript  <img src="javasjavascript:cript:…">  -> javascript:
```

So for module content there is **no write-time barrier and a defeated render-time
barrier**. `explainers` is ON on all three instances and all three report
`openRegistrations: true`, so the author is any registered user.

Ten `v-html` sites in `@commonpub/explainer/vue` share this one function:
SectionRenderer (body, bridge), ConclusionRenderer, BlockRenderer, TextBlock,
CalloutBlock, QuoteBlock, and the toggle and clickable-cards module viewers.

**Fix applied.** `sanitizeHtml` now default-denies on the URL **scheme** after
decoding, instead of denylisting a string: HTML entities (decimal, hex, named) are
decoded, the characters a browser discards while reading a scheme are stripped, and
only `http`, `https`, `mailto` and relative URLs survive. `src` is scheme-checked as
well as `href`, which it previously never was. All 12 vectors now fail closed, and
legitimate URLs — absolute, root-relative, relative, fragment, query, `mailto`,
protocol-relative, a path containing the word "javascript", an encoded colon in the
*path* — all still pass.

New test: `packages/explainer/vue/utils/__tests__/sanitize.test.ts`, 34 tests.
Proven non-vacuous by mutation: removing the decode step fails exactly the 6
encoding-dependent cases by name; restoring passes 34/34.

**Extended after a self-audit (see the last section).** Re-testing every sanitizer in
the repo against the *union* of all vectors showed the package's OTHER exported
sanitizer — `packages/explainer/src/render/sectionRenderer.ts` — failing **12 of 24**,
not the 2-3 first reported. Rather than fix that one too and leave a third copy to be
written later, the scheme gate now lives in one module,
`packages/explainer/src/urlSafety.ts`, and both sanitizers import it. All five
sanitizers in the repo now pass all 24 vectors.

`packages/explainer/src/__tests__/urlSafety.test.ts` (67 tests) pins the gate itself
and then **scans the package for sanitizers** and asserts each one imports `isSafeUrl`
rather than rolling its own — so a third copy fails the test instead of shipping.

**This needs a release to reach production** — see "Release required".

### F-2 — The production Postgres pool could crash the whole server — **FIXED (needs release)**

**CONFIRMED P1.** `layers/base/server/utils/db.ts:25-30`

The production `pg.Pool` was created with **no `'error'` listener**
(`grep -c "on('error'" layers/base/server/utils/db.ts` → `0`).

In Node an `'error'` event with no listener is re-thrown as an uncaught exception.
`pg.Pool` emits `'error'` on behalf of an **idle** client whenever the backend
closes the connection underneath it — a Postgres restart, a failover, an
administrative `pg_terminate_backend`, an idle-connection reaper, a network blip.
Any of those took the whole Nitro process down, mid-request, for every visitor.

This is the same mechanism session 256 diagnosed when it made a run of **2,138
passing** server tests exit 1. That session fixed it in **four** pools — all of them
in the *test* helper (`packages/server/src/__tests__/helpers/realpgdb.ts:47,90,110,122`).
The one pool that serves production was not part of the fix.

**Fix applied.** The pool now attaches a listener that logs and lets the pool
recover (it discards the client and opens a new one on next checkout), with the
reasoning recorded inline so a future edit does not remove it as noise.

New test: `layers/base/server/utils/__tests__/db-pool-error.test.ts`, 7 tests. It
proves the mechanism with a bare `EventEmitter` (throws) versus a guarded one (does
not), then **scans every non-test `.ts` under `layers/base/server/`** for a
`new Pool(` and asserts each attaches a listener *before* handing the pool to
drizzle — so a second pool added later is caught. Proven non-vacuous by mutation:
deleting the listener fails 2 tests by name; restoring passes 7/7.

### F-3 — Three live RSS routes emitted XML that readers reject — **FIXED (needs release)**

**CONFIRMED P1.** `api/users/[username]/feed.xml.get.ts`,
`api/hubs/[slug]/feed.xml.get.ts`, `api/federated-hubs/[id]/feed.xml.get.ts`

Session 256's write-up says "`sitemap.xml` and `feed.xml` each carry their own copy
of `escapeXml`". A scan for duplicate function definitions — 987 non-test `.ts`
files, 1,695 distinct function names, 56 defined in more than one file — put
`escapeXml` at **five**. None of the three unlisted copies stripped C0 control
characters. All three return 200 on all three instances.

XML 1.0 permits only #x9, #xA, #xD and #x20 upward, and a C0 character is illegal
**even written as a numeric reference** — there is no escape that legalises it. So
one stray character in a title makes the whole document malformed and a reader
rejects the entire feed rather than skipping that item. Proven with libxml2 via
Chromium's `DOMParser`, on a two-item feed whose first title carries U+000B:

```
UNFIXED (the 3 live routes)  parse error: "PCDATA invalid Char value 11"
                             items a reader would see: 1   <- truncated at the error
FIXED   (the 2 routes)       parse error: none
                             items a reader would see: 2
```

The federated-hub feed is the worst case: its content arrives from remote instances,
so a hostile or merely careless remote can break that feed for every subscriber.

**Fix applied.** All five bodies are byte-identical (md5
`6149a9aa0032941646fe78cd03c66a51`). `layers/base/server/routes/__tests__/xml-escape.test.ts`
was rewritten to **discover** its targets by walking `layers/base/server/` instead
of hand-listing them, and now evaluates the real function and asserts behaviour —
each illegal C0 codepoint stripped, #x9/#xA/#xD/#x20 preserved, entities still
escaped. 31 tests. Proven non-vacuous by mutation: reverting one copy fails 2 tests
naming that exact file. The change also clears the 5 `no-control-regex` lint errors
session 256 shipped (see P1-13 for why nothing caught them).

---

## Release required

F-1, F-2 and F-3 are on `main`'s working tree only. Reaching production needs:

```
@commonpub/explainer   F-1  — new src/urlSafety.ts (a NEW exported module, so this
                              is an additive minor, not a patch), both sanitizers
                              rewired onto it
                              (then server, layer — exact-pin cascade)
@commonpub/layer       F-2, F-3
```

F-1 adds two exports (`isSafeUrl`, `decodeForSchemeCheck`) to `@commonpub/explainer`'s
public surface, so it wants a **minor** bump rather than a patch.

Per the exact-pin rule, bumping `explainer` requires republishing everything above
it or consumers resolve two copies. **I have not published or deployed anything.**

**Gates, run uncached after the fixes AND after the self-audit's corrections:**

```
pnpm turbo run typecheck lint test --force   68 successful, 68 total, exit 0
                                             8m31s, zero cached, no failure marker
                                             anywhere in the log
pnpm --filter @commonpub/layer test          2938 passed
eslint on every changed and new file         0 problems
```

Each guard was mutation-tested — the fix reverted, the named tests seen to fail, the
fix restored:

```
xml-escape              31 passed   revert one escapeXml copy       -> 2 named failures
explainer/vue sanitize  34 passed   remove the decode step          -> 6 named failures
db-pool-error            7 passed   delete the listener             -> 2 named failures
                                    plant a pool OUTSIDE the layer  -> 1 named failure
urlSafety (shared gate) 73 passed   revert sectionRenderer to the
                                    denylist                        -> 6 named failures
                                    remove the decode step          -> 14 failures
                                    restore the whole-document pass -> 3 named failures
```

Final uncached run, after all three audit rounds AND the local-instance work,
at `--concurrency=2` to avoid the contention documented in L-12:

```
pnpm turbo run typecheck lint test --force --concurrency=2
  Tasks: 68 successful, 68 total · 0 cached · 12m9s
  0 "Failed:" lines · 0 "run failed" · 0 "Tests N failed" · 0 ELIFECYCLE
  7,898 tests across 520 test files, every package green:
    layer 202 files · server 143 · ui 28 · protocol 27 · editor 27
    reference 11 · explainer 11 · persona 8 · auth 7 · learning 5 · others 61
```

At the default fan-out this same suite failed twice (once SIGTERM, once timeouts) —
see L-12. Dropping to `--concurrency=2` makes it reliably green, which is the evidence
that those failures were contention and not defects.

A guard that has not been seen to fail is not yet a guard. The `db-pool-error` row is
the reason: it passed its first mutation test and still had the wrong scan root, which
only the *plant a pool outside the layer* mutation exposed.

*One detail worth keeping.* The first version of the explainer fix embedded a
**literal NUL byte** in a character class (`/[<NUL>-<SP>]/`). It behaved correctly
and every test passed, but git reclassified the file as **binary** — no diff, no
blame — and the `no-control-regex` rule fired. Rewritten as `/[\u0000-\u0020]/`
with an explicit disable comment. `packages/explainer` has a `lint` script, so the
error surfaced within seconds; the identical construct in the layer's `escapeXml`
copies shipped to production silently, because the layer has none. That contrast is
P1-13 in one line.

---

## P1 — reachable in production

### Privacy

**P1-1 — `profileVisibility` is enforced on 7 sites and absent from ~13 public
user-identity read paths.** CONFIRMED **[hand-verified]** — reproduced by three
separate dimension agents, and the predicate and DTO then read directly.

`packages/server/src/profile/profile.ts:35-39` — the WHERE is exactly
`and(eq(users.username, username), isNull(users.deletedAt))`. No `profileVisibility`,
no `status`. And the DTO it returns (`profile.ts:87-113`) contains neither field, so
**no caller could gate on it even if it wanted to.**

The setting is real and the UI promises it means something —
`layers/base/pages/settings/privacy.vue:499-502` reads verbatim: *members: "Only
people signed in to this site can see your profile."* / *private: "Only you can see
your profile."*

Enforcement exists in exactly 7 places: `routes/sitemap.xml.ts:60` (fixed session
256), `api/public/v1/users/index.get.ts:41`, `api/public/v1/users/[username].get.ts:25`
via `serializers.ts:75 isPublicUser`, `api/users/[username]/persona.get.ts:215,235`,
`persona/directory.ts:463`, `persona/metrics.ts:468`, `publicApi/metrics.ts:285`.

It is absent from, among others: `routes/users/[username].ts:15` (the ActivityPub
actor), `routes/.well-known/webfinger.ts:53`, `api/users/index.get.ts:22` (which
filters `deletedAt` alone), `api/search/index.get.ts:57-60` (people search), the
outbox, the follower/following collections, and `api/users/[username].get.ts` — the
profile page's own API.

Two aggravating details found in the same pass:
- `packages/server/src/social/social.ts:789` (`listFollowers`) and
  `packages/server/src/hub/members.ts:359` (`listMembers`) inner-join `users` with
  **no users predicate at all** — not even `isNull(deletedAt)` — so a soft-deleted
  account still appears in follower lists and hub rosters.
- `packages/server/src/admin/admin.ts:387-416` sets
  `deletedAt: newStatus === 'deleted' ? new Date() : null`, so **suspending** an
  account explicitly writes `deletedAt = null`. Suspension deletes sessions and
  nothing else; the profile, actor and WebFinger record stay public.

*Honest limit:* no live instance currently has a row with
`profileVisibility != 'public'` or `status = 'suspended'` (deveco's `byStatus` is
`{active: 147}`), and the audit was read-only, so this is confirmed by reading the
predicates and by the unauthenticated 200s on every listed path — not by observing a
hidden profile leak.

**Fix:** return `profileVisibility` and `status` from `getUserByUsername`, add a
shared `isVisibleToViewer(user, viewer)` predicate next to `isPublicUser`, and — the
part that matters — write the guard as a **scan** that enumerates every
`getUserByUsername` caller and fails on any that does not apply it.

**P1-2 — Unauthenticated callers receive another member's private
email-notification preferences.** CONFIRMED **[hand-verified]** live, with real data.

`packages/server/src/profile/profile.ts:100` puts `emailNotifications` in the
`UserProfile` DTO, and `api/users/[username].get.ts` serves that DTO with no auth.

```
$ curl -s https://deveco.io/api/users/moheeb_deveco     # no credentials
"emailNotifications": {"likes":false,"digest":"daily","follows":false,
                       "comments":false,"mentions":false}
```

Verified across a sample of real deveco members: the field is present in the
response envelope for every user, and populated for anyone who has configured
notification preferences. Same envelope on commonpub.io and heatsynclabs.io.

**Fix:** drop `emailNotifications` from `UserProfile`; it belongs to the
authenticated `/api/me` shape only.

**P1-3 — Inbound federated DMs are stored with `senderId` = the *recipient*.**
CONFIRMED. `packages/server/src/federation/inboxHandlers.ts:565-580`

The real author survives only as an attacker-controlled text prefix inside the
message body. Any remote actor can therefore cause a message to appear in a local
user's conversation attributed to that local user.

**P1-4 — `getPlatformStats` — the *admin dashboard* aggregate, unfiltered by
status, visibility or `deletedAt` — is served on three public surfaces.**
CONFIRMED **[hand-verified]**, measured. `layers/base/server/api/stats.get.ts:4` (no guard of any kind),
`routes/nodeinfo/2.1.ts:13-26`, and the homepage stat tiles.

`packages/server/src/admin/admin.ts:191-246` groups `users` with no `deletedAt` or
`status` filter and sums `contentItems` by type with no `status` or `visibility`
filter. NodeInfo additionally hardcodes `activeMonthCount: userCount` (line 24) and
`version: '0.0.1'` (line 22).

Measured against each instance's own sitemap and feed:

| instance | NodeInfo `localPosts` | actually published+public | users total / activeMonth |
| --- | --- | --- | --- |
| commonpub.io | 25 | **0** | 8 / 8 |
| heatsynclabs.io | 10 | 9 | 10 / 10 |
| deveco.io | **130** | **37** | 147 / 147 |

deveco's public post count is inflated 3.5×; commonpub.io advertises 25 posts and
publishes none, which also discloses how many unpublished items it holds. Every
instance reports 100% monthly-active, and fediverse aggregators consume that as real.

**P1-5 — Self-serve account deletion always 500s on an `audit_logs` FK violation,
and the private-PII byte purge never runs.** CONFIRMED.
`packages/server/src/admin/admin.ts:697-706`, `api/auth/delete-user.post.ts:57-68`.
A GDPR erasure request cannot currently be completed through the product.

### Security

**P1-6 — Federated `cpub:blocks` is the only federated field ingested without
sanitisation**, is copied into local content unsanitised on fork, and reaches a
`v-html` sink with no client-side barrier. CONFIRMED.
`packages/server/src/federation/inboxHandlers.ts:802,1109`;
`packages/server/src/content/content.ts:1279`.

**P1-7 — Server-side explainer sanitisation misses `section.module` and
`section.blocks`**, which `content: z.unknown()` accepts as arbitrary JSON.
CONFIRMED — this is the write-path half of F-1 and is **not fixed**: F-1 hardened
the render-time barrier, which closes the exploit, but the correct write-path fix is
a generic recursive walk rather than a hand-enumerated field list.
`packages/server/src/content/content.ts:72-115`.

**P1-8 — A live crates.io publish token enters the Docker build context.**
CONFIRMED **[hand-verified]**, with the blast radius narrowed from the original
finding.

`.secrets/cargo-registry-token` exists locally, 35 bytes, mode 0600. `.dockerignore`
lists `node_modules .git .svelte-kit dist *.test.ts docs/ deploy/ .env* !.env.example
*.md !package.json .turbo` — **no `.secrets` pattern** — and `Dockerfile:13` is
`COPY . .` in the build stage.

**Narrower than reported:** the token IS gitignored (`.gitignore:64: *.secrets`), so
it is not committed, and the production image is built in GitHub Actions from a fresh
checkout where the file does not exist. So this is **not** a production-image leak.
It is a leak on any **local** `docker build`, into a build-stage layer and the local
build cache — which matters if that cache is ever exported or an intermediate image
pushed.

**Fix:** add `.secrets` to `.dockerignore`. Rotating the token is cheap and worth
doing regardless, since you cannot easily prove no local build ever left the machine.

**P1-9 — Three unauthenticated 500s from domain-invalid input.** CONFIRMED (routes
and binds read directly; not fired against a live instance), the
"validate DOMAIN not SHAPE" class:
`api/users/index.get.ts:9,23-26` (comma-split id list → uuid bind),
`api/search/index.get.ts:14-15` (Invalid Date → timestamp bind),
`api/registry/instances.get.ts:29` (bare `zod.parse()` on untrusted query turns a
400 into a 500).

### Release integrity

**P1-10 — deveco.io's post-deploy health check cannot pass and cannot fail — every
production deploy is a green lie.** CONFIRMED **[hand-verified]**.
`deveco-io/.github/workflows/deploy-prod.yml:74-84`:

```
for i in 1 2 3 4 5; do
  if curl -sf http://localhost:3000/ > /dev/null 2>&1; then echo "✅ Health check passed"; break; fi
  echo "⏳ Waiting for app to start... ($i/5)"; sleep 5
done
curl -sf http://localhost:3000/ || echo "::warning::Health check failed — app may not have started correctly"
```

Two independent reasons it is inert. **It cannot pass:** `deploy/docker-compose.prod.yml`
gives the `app` service `expose: - "3000"`, and `expose` does *not* publish to the
host — only `caddy` publishes (80/443). A host-level `curl localhost:3000` can never
reach the app. **It cannot fail:** the final check is `|| echo ::warning::`.

So every deveco deploy prints the waiting message five times, emits a warning, prints
"Deployed <sha>" and exits 0, regardless of whether the app came up. This is exactly
the bug the monorepo's own `deploy.yml:114-123` documents having fixed for itself —
"which is why the old `curl … || ::warning` check silently never worked" — and the
replacement (`scripts/smoke.mjs`, run *inside* the container, exiting non-zero) was
never carried to the fork.

**P1-11 — deveco's deploy is missing `set -o pipefail`, so a failed database
migration reports success.** CONFIRMED **[hand-verified]**. `deploy-prod.yml:47` is
`set -e` and nothing more; line 71 is
`… node scripts/db-migrate.mjs 2>&1 | tee /tmp/dbmigrate.log || { …; exit 1; }`.
Without `pipefail` a pipeline's exit status is the LAST command's — `tee`, which
returns 0 — so a failed migration never reaches the `||` branch. The monorepo's
`deploy.yml:78-80` has `set -o pipefail` with a comment naming this exact hazard.

**P1-12 — CI never executes the migration path production uses.** CONFIRMED
**[hand-verified]** — but the risk is **PROCESS, not a live divergence**, and the
original entry overstated it. Corrected 2026-08-25 by actually running both paths.

I replayed all 49 committed migrations into an empty database via the production
script: **succeeded in 1,064ms, 49 migrations recorded, 110 public tables**. I then
built a second database with `drizzle-kit push --force` (what CI does) and compared
the two **semantically** — sets of columns/types/nullability/defaults, indexes,
constraints and enum labels, ignoring physical column order:

```
COLS   IDENTICAL  (1004 rows)
IDX    IDENTICAL  ( 342 rows)
CONS   IDENTICAL  (1104 rows)
ENUMS  IDENTICAL  ( 205 rows)
```

(A raw `pg_dump` diff shows 86 differing lines, but every one is column ORDER —
`push` creates tables whole while `migrate` adds columns by `ALTER` in migration
order. Nothing depends on it. My first attempt at this comparison compared two empty
strings because the local `pg_dump` is v14 against a v16 server and silently aborted;
that "IDENTICAL" was vacuous and is exactly the trap this report warns about.)

So the migration chain is sound today and the two paths agree. What remains true, and
is still worth fixing: **no CI job exercises the chain**, so a future migration that
is broken, mis-ordered or non-idempotent reaches the production droplet untested —
and `deploy.yml:103` restarts the container BEFORE the migration at line 111, so it
would fail with the new image already serving. Severity as a live defect: none found.
Severity as a gap in the safety net: real.
`ci.yml:174` applies the schema with `drizzle-kit push --force`; `deploy.yml:111`
uses `drizzle-kit migrate` over the 49 committed `.sql` files. No CI job ever runs
`migrate` — those files are executed for the first time on the production droplet.
Compounding: `deploy.yml:103` restarts the container **before** the migration at
line 111, on all three pipelines, so a failing migration leaves new code live against
an old schema.

**P1-13 — The Nuxt layer is never linted, and no `.vue` file anywhere is linted.**
CONFIRMED **[hand-verified]**. Fifteen workspaces define a `lint` script; `@commonpub/layer` and
`@commonpub/shell` do not. So `pnpm lint` — the CI "Lint" step (`ci.yml:65`) *and*
the "Lint (deploy gate)" step (`deploy.yml:43`) — never touches `layers/base/`: 306
`.vue`, 778 `.ts`, 474 server route files, the artifact that runs all three
instances. Running eslint over it directly: **12 errors, 40 warnings**, including the
5 `no-control-regex` that F-3 has now cleared, 2 `ban-ts-comment`, 1 `no-undef`, and
3 files eslint could not parse.

And `eslint.config.js:9` scopes to `['**/*.ts','**/*.tsx']`, the word "vue" does not
appear in the config, and `eslint-plugin-vue` is not installed — so **no `.vue` file
in the repo is linted at all.** The consequence is false assurance on exactly the XSS
surface: six `eslint-disable vue/no-v-html` directives exist, each reading as a
considered suppression, for a rule that could never fire.

**P1-14 — Production deploys are not gated on tests; three commits shipped with a
red CI at the same SHA.** CONFIRMED **[hand-verified]**, measured over the last 20 runs — `ef242425`,
`ec512bbd`, and `dc9f6192`, which is the session-256 feature merge itself.

**P1-15 — deveco's CI verifies a different dependency tree than production ships.**
CONFIRMED **[hand-verified]**. `deveco-io/.github/workflows/ci.yml:27` installs with
`pnpm install --frozen-lockfile`; `deveco-io/Dockerfile:27` builds with
`npm install`. **151 packages resolve to different versions** on deveco (29 on
heatsync), including drizzle-orm (0.45.2 vs 0.45.1), zod (4.4.3 vs 4.3.6), nuxt
(3.21.5 vs 3.21.2), vue (3.5.34 vs 3.5.30) and a whole major of vite. This is
structurally the gap that let better-auth 1.7.1 reach both forks while the monorepo
stayed fine; that incident was closed by pinning one package, not by closing the gap.

**P1-16 — heatsynclabs.io has no CI at all, and deveco's deploy is decoupled from
its CI.** CONFIRMED **[hand-verified]**. `heatsynclabs-io/.github/workflows/` contains only `deploy.yml`.
deveco's `deploy-prod.yml` has no `needs:`, no typecheck, no lint, no tests, and
starts at the same timestamp as its CI on every main push. deveco.io is the instance
with 147 users and a live contest.

**P1-17 — Both forks' `server/utils/config.ts` is a drifted copy of the reference
app's**: the admin-set instance name/description never reaches SSR, and **31 of 46
feature flags cannot be env-overridden.** CONFIRMED.
`deveco-io/server/utils/config.ts:19`, same in heatsync.

**P1-18 — The documented "fastest path" for a new self-hoster scaffolds an instance
31 layer minors stale and 6 migrations behind**, and `cargo test` actively asserts
the staleness. CONFIRMED. `tools/create-commonpub/src/template.rs:48-51`,
`tools/create-commonpub/tests/cli.rs:249-252`, `README.md:112-125`. Caret ranges on
`0.x` cannot self-heal across a minor, so it cannot recover on its own.

**P1-19 — `docs/STATUS.md`, the canonical operator runbook, is wrong on 27 of 38
present-tense state claims and contradicts itself in its own header.** CONFIRMED **[hand-verified]**.
Lines 5-7 (layer 0.137.0 — 0.137.3 is live), 21 ("CI is RED on main" — the last four
runs are green including e2e), 42 and 45-46 (a "current LIVE" snapshot that is two
releases and one flag behind). Corrected in this session's STATUS rewrite.

### Performance and correctness

**P1-20 — HTTP responses are served uncompressed on 2 of 3 production instances.**
CONFIRMED **[hand-verified]**, measured, and the root cause is one missing line in two files.

```
$ curl -sI -H 'Accept-Encoding: gzip, br, zstd' https://commonpub.io/
  (no content-encoding)                 230,805 bytes
$ curl -sI -H 'Accept-Encoding: gzip, br, zstd' https://deveco.io/
  (no content-encoding)                 235,115 bytes
$ curl -sI -H 'Accept-Encoding: gzip, br, zstd' https://heatsynclabs.io/
  content-encoding: zstd                 37,677 bytes  (from 203,376)
```

`grep -c encode` → `deploy/Caddyfile` **0**, `deveco-io/deploy/Caddyfile` **0**,
`heatsynclabs-io/deploy/Caddyfile` **1**.

Measured wire savings if enabled:

| page | today | gzip -9 | factor |
| --- | --- | --- | --- |
| deveco contest page | 514,165 | 101,945 | 5.0× |
| deveco homepage | 235,115 | 41,742 | 5.6× |
| commonpub homepage | 230,805 | 40,929 | 5.6× |

The contest page is the one a maker on a phone is asked to submit an entry from.

**P1-21 — `/api/search` runs a sequential scan of `content_items` on every request
on all three instances.** CONFIRMED. Meilisearch is not serving search anywhere, and
the code comment claiming a `to_tsvector` fallback is false.
`packages/server/src/search/contentSearch.ts:5` (the false comment), `:199-207`
(`ILIKE '%…%'`), `:262-269` (a second full scan).

**P1-22 — `GET /api/messages/[conversationId]` returns every message in the
conversation** — no LIMIT, no pagination, no cap. CONFIRMED **[hand-verified]** by reading
`packages/server/src/messaging/messaging.ts:77-92`.

**P1-23 — Federation fan-out is fully serial and unbounded, and worst-case delivery
exceeds the 5-minute claim lock, so a popular post is delivered twice.** CONFIRMED.
`packages/server/src/federation/delivery.ts:17` (`LOCK_EXPIRY_MS`), `:106` (serial
activity loop), `:153` (serial inbox loop). Separately, one failing inbox makes the
whole activity re-fan-out to every healthy inbox on all six retries
(`delivery.ts:150-224`).

### Accessibility

**P1-24 — The keyboard focus indicator fails WCAG 1.4.11 (3:1) on 2 of 3 live
instances — 1.54:1 on deveco.io.** CONFIRMED, measured.
`packages/ui/theme/base.css:434-437` outlines with `var(--accent)`, which is not
required to contrast with the surface it sits on.

**P1-25 — `--text-faint` is below 4.5:1 in 6 of 7 built-in themes and in both live
generated themes; theme-studio never floors it.** CONFIRMED, and the live half
**[hand-verified]**.
`packages/ui/theme/base.css:36`. My own independent axe run corroborates: 42/45/32/26/32
failing nodes on the deveco, commonpub and heatsync homepages, worst ratio 1.26:1
(deveco's logo in dark mode, effectively invisible). CLAUDE.md's own accent `#5b9cf6`
measures 2.66:1 and 2.78:1 for small text on near-white — the brand colour itself
fails at its documented size. heatsynclabs.io's dark theme scores **0**, so it is
achievable.

**P1-26 — 73 form controls (26 of them `<select>`) ship with no accessible name**, at
least one live and unauthenticated on two instances
(`layers/base/pages/videos/index.vue:99`). CONFIRMED.

**P1-27 — deveco.io fails WCAG 1.4.10 Reflow at 320px** — the hamburger, the only
mobile nav, renders entirely off-screen. CONFIRMED **[hand-verified]** — I measured
the mechanism independently: `.de-topbar-inner` 8px padding + `.de-topbar-logo` 126px +
`.de-topbar-actions` 238px = 372px of minimum content, so
`scrollWidth 372 / clientWidth 320` at 320px and `373 / 360` at 360px. Every page,
because it is the topbar. commonpub.io and heatsynclabs.io measure 360/360.

**P1-28 — Explainer `InteractiveContainer` remaps `--surface`/`--bg` without
remapping `color`, producing 1.05:1 (invisible) text live.** CONFIRMED.
`packages/explainer/vue/components/viewer/InteractiveContainer.vue:40-63`.

---

## P2 — real defects, bounded blast radius

Grouped; every row carries its evidence pointer.

### Privacy, security, federation

| # | finding | location |
| --- | --- | --- |
| P2-1 | Admin content removal sets `status='archived'` without `deletedAt`, and `archived` is in the unauthenticated allow-list, so removed content stays listable | `admin.ts:725-728`, `contentQuery.ts:7` |
| P2-2 | Two route regexes reject usernames containing `.`, which Better Auth permits: the persona section 400s, the AP dereference silently returns HTML | `persona.get.ts:149`, `middleware/content-ap.ts:23` |
| P2-3 | Every `cpub:` extension term is emitted under an `@context` that never declares the `cpub` prefix, so JSON-LD processors drop the entire extension | `activityTypes.ts:2`; `contentMapper.ts:212,221,270,277` |
| P2-4 | The federated timeline and federated search ignore `config.instance.contentTypes` — types the instance excluded are shown in its own UI | `timeline.get.ts:19`, `federation/timeline.ts:68` |
| P2-5 | Every outbox advertises `last: ?page=last`; `parseInt` yields NaN and the route answers with the OrderedCollection again | `protocol/outbox.ts:23`, `routes/users/[username]/outbox.ts:23,29-31` |
| P2-6 | Federated article HTML double-wraps paragraphs, shipping invalid nested `<p><p>` to every peer — 36 of 37 mirrored Articles affected | `contentMapper.ts:62-65` |
| P2-7 | WebFinger resolution accepts a `self` link on any host and never checks `preferredUsername`, so a hostile instance can make any handle resolve to a third party's actor | `actorResolver.ts:140-177` |
| P2-8 | WebFinger, the actor document, outbox and follower collections are served even when `features.federation` is off — only the three inboxes are gated | `routes/users/[username].ts`, `webfinger.ts:34-56` |
| P2-9 | The CSRF middleware exempts `/api/auth/*` wholesale, covering custom cookie-authenticated routes Better Auth never sees — including irreversible account deletion with no re-authentication | `middleware/csrf.ts:53`, `delete-user.post.ts:6` |
| P2-10 | ~~`@commonpub/explainer`'s other exported sanitizer is bypassed by entity encoding~~ — **understated and now FIXED.** The real figure was **12 of 24 vectors**, not 2-3. Both explainer sanitizers now share `src/urlSafety.ts`. See F-1 | `src/render/sectionRenderer.ts` |
| P2-11 | `/api/federation/hub-post-likes` 500s on a repeated or non-uuid `postIds` | `hub-post-likes.get.ts:10` |
| P2-12 | `/api/public/v1/metrics/timeseries` validates the SHAPE of `to` and crashes with a RangeError on an impossible date | `timeseries.get.ts:4,11,36` |
| P2-13 | One `v-html` site has no render-time sanitizer at all; its route passes `data.html` through raw. Not live-exploitable — the write path uses DOMPurify and fails closed — but it is the one missing second barrier, and `learning` is ON everywhere | `pages/learn/[slug]/[lessonSlug]/index.vue:296`, `index.get.ts:5-38` |

### Release, deployment, forks

| # | finding | location |
| --- | --- | --- |
| P2-14 | `e2e` is silently skipped whenever `check` goes red — it did not run on 5 of the last 20 CI runs | `ci.yml:104-106` |
| P2-15 | `Dependency Audit` is `continue-on-error` and prints `##[error]` on every green run; 76 high and 5 critical advisories unreviewed | `ci.yml:57-59` |
| P2-16 | CI e2e runs `nuxt dev`, never the production build — the build step's output is discarded, so production-only failures are structurally invisible to all 182 e2e tests | `playwright.config.ts:35-39`, `ci.yml:170-180` |
| P2-17 | e2e covers no login, no upload, no editor publish and no admin journey; editor.spec's 6 authenticated tests are permanently dead | `e2e/editor.spec.ts:103-201`, `e2e/helpers/account.ts:99-115` |
| P2-18 | Published `@commonpub/docs@0.6.3` carries phantom exact pins to schema 0.16.0 and config 0.12.0, installing ~2.5 MB of ancient duplicates into both production images. Root cause traced: `cf23d00e` released 0.6.3, the later `a6281c25` removed the deps **without bumping the version** — registry artifact and source disagree at the same version number | `packages/docs/package.json` vs `npm view @commonpub/docs@0.6.3 dependencies` |
| P2-19 | `docs/deployment.md` points third-party operators at a ghcr `:latest` image 5 months stale, and a green test guards the workflow that stopped producing it | `docs/deployment.md:148-151`, `deploy/__tests__/ci.test.ts:14-20` |
| P2-20 | The production runtime image installs `drizzle-orm`, `pg` and `zod` unpinned, contradicting the comment claiming they are pinned | `Dockerfile:36-37`, `deveco-io/Dockerfile:40` |
| P2-21 | `/admin/homepage` is a no-op on deveco (forked `index.vue` never reads the section config); the hero is a no-op on heatsync (forked `HeroSection` ignores its config prop) | both forks' `pages/index.vue` |
| P2-22 | deveco's forked `layouts/default.vue` drops three layer behaviours: the unread-messages badge and its SSE connection, Esc-to-close + focus return on the user menu, and outside-click closing of nav dropdowns | `deveco-io/layouts/default.vue:7,58,141-152` |
| P2-23 | Every error page on all three live instances renders in the base theme instead of the instance theme | `layers/base/error.vue:10-31` vs the forks' `error.vue` |
| P2-24 | `features.analytics` is a dead admin toggle on heatsynclabs.io — the fork never wires the analytics block into `runtimeConfig.public` | `heatsynclabs-io/nuxt.config.ts` |
| P2-25 | The production compose file, Caddyfile and TLS cert exist only on the droplets; neither deploy workflow ships them, and deveco's `docker compose up` has no `-f`, so it resolves a filename the repo also uses for its dev stack | `deveco-io/.github/workflows/deploy-prod.yml:65` |
| P2-26 | better-auth is pinned exactly at 1.6.29 in both forks, blocking patch releases and diverging from the 1.6.30 the monorepo tests against | both forks' `package.json:30,34` |
| P2-27 | A live hydration mismatch on heatsynclabs.io, root-caused: `plugins/footer-credit.client.ts:59-61` calls `patch()` synchronously at plugin setup, before Vue hydrates, so Vue hydrates against a DOM that no longer matches SSR. Isolated with a document-start `MutationObserver` stopped at the warning. Cosmetic today; the same mechanism froze deveco's contest CTA in session 256 | `heatsynclabs-io/plugins/footer-credit.client.ts` |

### Frontend correctness

| # | finding | location |
| --- | --- | --- |
| P2-28 | Un-gated `toLocaleDateString` ships a server-timezone date; the ContentCard fix was correct and never generalised. Extent **checked and adjusted**: the agent said 45 files; I measure **54 files** using locale date formatting in `layers/base`, of which **40 have no mount gate anywhere in the file**. So 40-45 depending on how you count a file that gates one call site and not another — right order, and the direction is not in doubt. The "32 of 85 live items show a different day" figure is the agent's and I did not reproduce it | `views/ProjectView.vue:118-122`, `ArticleView.vue`, +38 more |
| P2-29 | A local ref seeded from a lazy fetch inside `watch(…, {immediate:true})` keeps its seed through SSR: the live learn page ships a collapsed module with the lesson list absent from the HTML | `pages/learn/[slug]/index.vue:61-68`, +10 sites |
| P2-30 | `useCan()` is false in the SSR'd HTML and on first paint for every non-admin RBAC grantee — the auth plugin never copies the permissions the server already resolved | `plugins/auth.ts:14-19` vs `middleware/auth.ts:122-132` |
| P2-31 | Contest page: `registrationTier` is `server:false`, so SSR renders the "you must register first" branch to an already-registered viewer. *Nuance:* `ContestActionBar.vue:22-26` documents this as deliberate (per-viewer state must not be cached) with a fixed-height bar so no layout shift — the harm came from the frozen subtree, not the pending state | `pages/contests/[slug]/index.vue:24,354,408-409` |
| P2-32 | Nested `<main>` on every page of all three instances — the layout's `<main id="main-content">` wraps a slot into which 9 files render 13 more `<main>` elements | `layouts/default.vue:231` + 9 files |
| P2-33 | Admin email-branding form: pressing Save before the client-only fetch lands PUTs an empty payload and resets every branding field to its default | `pages/admin/email-templates.vue:10,17-33,63` |

### Scaling

| # | finding | location |
| --- | --- | --- |
| P2-34 | Both purpose-built content-feed indexes are unreachable — no query the code issues matches their ORDER BY | `schema/src/content.ts:118-124` |
| P2-35 | Three composite indexes are built with `.desc()` (DESC NULLS LAST) but queried with `desc()` (DESC NULLS FIRST), so Postgres sorts instead of using them | `schema/src/social.ts:117`, `referral.ts:39` |
| P2-36 | Upload OOM guard exists but the pipeline buffers whole files with no concurrency bound, and heatsynclabs.io has no proxy body cap, so the documented fallback does not exist there | `infra/src/image.ts:57-59,83-88` |
| P2-37 | The contest list endpoint ships each contest's full long-form body — 27.8 KB of never-rendered HTML in the homepage SSR payload | `contest/read.ts:101,71-81` |
| P2-38 | 7 of 11 interval workers have no re-entrancy guard, so a slow tick stacks overlapping runs | `layers/base/server/plugins/*` |
| P2-39 | 16 of 30 list helpers run `COUNT(*)` on every request including deep pages, and the offset has no upper bound | `packages/server/src/query.ts:145-155` |
| P2-40 | `/sitemap.xml` issues two unbounded full-table queries and builds the whole document in memory, with no paging or sitemap-index split | `routes/sitemap.xml.ts:29-40,50-62` |
| P2-41 | ~30 KB of non-active theme CSS is inlined into every page document on every instance, plus a render-blocking third-party `@import` chain | `layers/base/nuxt.config.ts:44-62` |
| P2-42 | The deveco contest page SSRs **514,078 bytes**, of which **211,136** is a single inline JSON payload (41% of the document) and 130,905 is markup. TTFB 0.62 s | measured live |
| P2-43 | Seven paginated queries end without a unique tiebreaker, so LIMIT/OFFSET pages can overlap or drop rows on ties | `hubMirroring.ts:58,687,955`, `hub/posts.ts:609` |
| P2-44 | Federated-merge pagination reports `total` = local count + the window size, so `hasMore` goes false on page 1 — commonpub.io's search shows 18 of 37 results and renders no pager | `content.ts:455` |
| P2-45 | One transient DB error during the background config refresh silently reverts **every** feature-flag override to the build-time default for a full 60 seconds, and the retry the code documents can never fire | `apps/reference/server/utils/config.ts:106-136` |
| P2-46 | Every admin settings save opens a window in which all 218 `requireFeature()` sites evaluate against build-time defaults, because `invalidateConfigCache()` nulls the merged config and the refill is async | `config.ts:142-146,102-118` |
| P2-47 | Six of nine background workers latch their feature flag once at startup and never re-check: turning federation off in the admin UI does not stop outbound delivery or the registry heartbeat | `plugins/federation-delivery.ts:17-21`, +5 |

### Accessibility, CSS, docs, tests

| # | finding | location |
| --- | --- | --- |
| P2-48 | 23 of 35 modal/overlay components have no focus trap, no Escape and no focus restore — including a blocking `aria-modal="true"` gate | `TermsReacceptanceGate.vue:53` +22 |
| P2-49 | 12 icon-only buttons have no accessible name, including four modal close buttons and two pagination controls | `MarkdownImportDialog.vue:67`, `CommentSection.vue:154` |
| P2-50 | 22 controls built from `div`/`span` with `@click` and no keyboard path, 3 of them on public pages | `pages/videos/index.vue:199` |
| P2-51 | Scroll containers (code blocks, tables) are not keyboard-operable — WCAG 2.1.1 | `BlockTableView.vue:20,40` |
| P2-52 | Cookie consent renders two adjacent links with no separator — "What we collectSharing choices" — at 1.6:1, and the banner has no focus management | `CookieConsent.vue:41-42` |
| P2-53 | 13 design tokens are referenced with no fallback but defined nowhere — 91 call sites, live on all three instances | `FederatedContentCard.vue:144,167,168,179`, `pages/search.vue:821,882` |
| P2-54 | The user-selectable "Generics" theme is a no-op: it sets 46 alias tokens essentially nothing reads, and none of the core palette, so selecting it renders the light Classic palette | `packages/ui/theme/generics.css:3-72` |
| P2-55 | **Google Fonts loads on every page of every instance and is disclosed nowhere.** `nuxt.config.ts:14-45` hardcodes a Fraunces/Newsreader/Work Sans stylesheet — the **Agora** theme's stack, which two of three instances do not use. `pages/privacy.vue:335` explicitly discloses the Cloudflare/Font Awesome request; "Google" appears **zero** times in that file and "google fonts" zero times in the live `/privacy` on all three | `nuxt.config.ts:40`, `privacy.vue:335` |
| P2-56 | Two `sanitizeHtml` implementations have drifted badly; the weaker was on the live explainer path (now F-1) | `explainer/vue/utils/sanitize.ts:24` vs `protocol/sanitize.ts:101` |
| P2-57 | Six `slugify` implementations with four different truncation caps; a test that copies one asserts the wrong cap and still passes | `apps/reference/__tests__/contest-slug.test.ts:4-11` vs `contests/index.post.ts:5` |
| P2-58 | `megalodon` (5.9 MB) is a production dependency of `@commonpub/server` whose only importer is unreachable dead code | `packages/server/package.json` |
| P2-59 | The only tests for several security-critical routes are source-string greps that cannot see ordering, arguments or reachability — one asserts on a code comment | `files/__tests__/private-files-route.test.ts:66` + 39 siblings |
| P2-60 | Two `apps/reference` tests assert behaviour production does not have, because they test a hand-copied duplicate that has since diverged | `contest-slug.test.ts:3-12,39-41` |
| P2-61 | The member-directory and persona e2e walks skip or run vacuously in CI, and deveco.io — the only instance with the feature ON — is the untested configuration | `e2e/member-directory.spec.ts:245-415` |
| P2-62 | README.md's every headline count and 13 of 14 package versions are wrong; persona is absent and theme-studio is labelled unpublished at 0.1.0 while npm serves 0.7.0 | `README.md:6,7,78,153,171-215` |
| P2-63 | `docs/federation.md` documents seven `cpub:` properties the code never emits and an `@context` it never produces — the doc aimed at other implementers | `docs/federation.md:68-77,202-214` |
| P2-64 | The contributor guide's "add a feature end-to-end" recipe teaches three APIs that exist nowhere in the codebase, and the DB-accessor error has spread to a second doc | `docs/guides/developers.md:346,347,482,484,589`, `docs/llm/conventions.md:90` |
| P2-65 | Package README code examples import six validators/helpers that do not exist in their own package | `packages/schema/README.md:19,69,71`, `packages/docs/README.md:62,63,73,150,151` |
| P2-66 | Five `docs/plans` declare a status that live flags disprove; 20 of 41 have no status line; ROADMAP audited 24 plans when there are 41 | `docs/plans/*` |
| P2-67 | `codebase-analysis/`, which README calls the exhaustive inventory, was last verified 53 sessions ago; its flag list is missing 20 of 46 flags and it publishes a defect claim (`social` gates nothing) that **is no longer true** — `requireFeature('social')` now guards 10+ routes | `codebase-analysis/08-feature-flags-inventory.md:7` |
| P2-68 | Hardcoded white on an accent fill — the class session 253's contrast test flagged as "still open" — fails AA at 4.16:1 and 4.24:1 | `packages/ui/theme/agora.css:352` |

---

## P3 — cruft, staleness, maintainability

Condensed. Full evidence is in each cited file.

**Duplicated logic.** 56 function names are defined in more than one file across 987
non-test `.ts` files. Seven are HTML/URL escaping or sanitising — the category where
a drifted copy is a security bug, and F-1, F-3 and P2-56 are all instances:
`escapeXml` ×5 (three had drifted), `escapeHtml` ×5 (four different implementations
— checked every call site, all text-content positions, so **not** a vulnerability),
`isSafeUrl` ×3, `escapeAttrValue` ×3, `sanitizeRichHtml` ×2, `sanitizeHtml` ×2,
`sanitizeBlockHtml` ×2, `escapeAttr` ×2, `httpUrl`/`optionalUrl` ×2,
`stripHtml` ×2. Plus per-file copies across the layer: 10 `stripHtml`, 3 `safeHref`
(two shadowing the shared auto-imported one), 7 `formatDate`, and a **sixth**
block-to-HTML renderer at `api/learn/[slug]/[lessonSlug]/index.get.ts:5`. *The
highest-value refactor in the repo is one protocol-owned escaping/sanitising module.*

**Dead code.** `@commonpub/ui` exports 22 Vue components (2,082 LOC) nothing imports;
`packages/explainer` has 1,564 LOC of export/render/progress/quiz engines with zero
production callers, its quiz engine duplicating `@commonpub/learning`'s live one;
`packages/docs` ships a dead 438-LOC search subsystem that drifted from the live one;
`@commonpub/auth`'s `authGuard`/`adminGuard`/`roleGuard` encode the pre-RBAC role
model; six orphaned layer components (432 LOC) flagged by two prior audits are still
in the tree; `tools/worker` is dead and its stale `^0.13.0` pin drags a five-month-old
`@commonpub/schema` from npm alongside the workspace copy; the nonce CSP branch in
`packages/infra/src/security.ts:17-25` is exercised only by two tests and has no
production caller; `lighthouserc.js` is referenced by nothing; five route families are
shipped and reachable with no way to invoke them from the product.

**Dependencies.** `layers/base` declares 17 dependencies it never imports and imports
one (`meilisearch`) it never declares — the latter breaks the published package for
npm consumers even though the pnpm workspace hoists it.

**Tests.** Mutation testing is dead infrastructure: 6 configs, 5 scripts, one run 153
days ago at 63.2%, wired into no CI and gitignored. "Integration tests" are
PGlite + `pushSchema` for 107 of 143 server suites — the committed migration chain is
executed by only 3 suites and **46 of 49 migration files are never run by any test**.
Session 256's claim that `PERSONA_SNAPSHOT_MAX_AGE_DAYS` is the only staleness window
is false — there are at least six, and the 48h instance-online one has its stale
branch untested. `turbo.json` declares no `globalDependencies`, so root
tsconfig/eslint/vitest changes never invalidate any cached task. `publish:check` is
not wired to `publish:all`, and no guard verifies which packages changed before
publishing.

**Docs.** 11 broken relative links across 453 files — including
`docs/quickstart.md` → `reference/implementation-guide.md` (dead; the first doc a
self-hoster reads) and three links from `docs/reference/guides/theme-editor.md` into a
**private local AI-agent memory directory**, which can never resolve for any reader
and publishes internal tooling paths in a user-facing guide. 11 completed plans still
sit in `docs/plans` as active; 62 path references there point at files that do not
exist. Eight em-dash violations in user-facing strings. Session 256's own handoff
contradicts its body on three versions — the same defect that rotted STATUS.md.

**Database.** 30 foreign keys have no supporting index, 22 of them pointing at
`users`, so every account deletion sequentially scans `sessions`, `accounts`,
`email_outbox` and 19 more tables. The `users` table has no index able to serve
`ORDER BY created_at DESC`, so every member directory, people search and public-v1
users page is a full scan plus sort followed by an unconditional `COUNT(*)`.
`deleteUser` issues one UPDATE per like, per comment, per hub membership and per
enrollment inside its transaction. Hot filter+sort pairs have no composite index.

**API surface.** The public OpenAPI document omits 23 accepted query parameters and
almost every error status the routes return; the parity test only checks that a path
key exists.

**CSS.** `prose.css` hardcodes 9 colours duplicating existing `--code-*`/`--hljs-*`
tokens, creating two parallel code palettes that will drift. `agora-dark` is missing
10 of `agora`'s component overrides, so those elements lose the theme's treatment in
dark mode.

**CLAUDE.md rule 3 is fully upheld where it applies** — `packages/ui` and
`packages/docs` have **zero** hardcoded colours or fonts as CSS values.

Three CSS claims that did NOT survive scrutiny are recorded here because getting them
wrong is instructive, and because two of them appeared in earlier drafts of this
report:

- **"36 rule-level hardcoded colours across 27 layer files" — WRONG. The real figure
  is 8 across 6 files.** Three different numbers were produced before this settled:
  a crude grep gave 51/16, a dimension agent gave 36/27, and a careful scan gives
  **8/6**. The difference is entirely methodology: `var(--x, #fff)` is a *token
  fallback*, not a hardcoded colour, and `--x: #fff` is a token *definition*, which is
  where colours belong. Masking both, and excluding the gitignored generated
  `layers/base/theme/`, the complete list is ImageCropperModal ×2 (styling a
  third-party cropper's `:deep()` internals, with a comment explaining why),
  HubHero ×2 (`rgba(255,255,255,0.04)` texture overlays), TermsReacceptanceGate
  (an `rgba(0,0,0,0.7)` scrim), AdminThemeSceneGallery, ContestEmailEditor and
  admin/email-templates (`#fff` each). Of those eight, roughly three are genuine.
  **Not a finding.**
- **The universal `* { border-radius: var(--radius) }` is not a defect.**
  `packages/ui/theme/base.css:385-390` documents the design directly above the rule
  and states the escape hatch — "an explicit class-level border-radius outranks these
  resets" — which is true, since `*` has specificity 0. It behaves correctly on all
  three instances (0px, 0px, and 6px on deveco by brand choice).
- **1,910 hardcoded pixel font-sizes across 223 layer `.vue` files is accurate**
  (the recorded 1,907/223 re-measures as 1,910/223 — the claim was honest), but it is
  an already-recorded, explicitly accepted house convention, not a new defect. Keep it
  recorded; nothing is broken.

**Other.** `markMessagesRead` runs for a **non-participant**: `GET /api/messages/<any
conversation uuid>` correctly returns `[]`, but still writes `message_reads` rows on
the caller's behalf, because the function carries no participant predicate
(`packages/server/src/messaging/messaging.ts:320-348`, called unconditionally by the
route). `/api/openapi` is a static, unauthenticated, instance-blind spec — byte-identical
on all three instances despite 29/43/21 flags being ON — so it advertises paths the
serving instance 404s (`layers/base/server/api/openapi.get.ts`, 5 lines, no feature
check, no auth). Both forks fork `useConfig()` and dropped the DB instance-identity
merge, so the layer's site-identity-prime plugin is a no-op and an **admin rebrand
silently never applies** on either instance
(`deveco-io/server/utils/config.ts:71-76`). 15 boolean flags render on
`/admin/features` with a raw camelCase key and a
blank description. `apps/shell`'s private `ENV_FLAG_MAP` is missing 27 of 46 flags and
the parity test guards only `apps/reference`'s copy. The `list` block type round-trips
through the editor serializer but is neither registered nor renderable, so a bulleted
list would vanish from the public view. 28 of 36 `<time>` elements carry no `datetime`.
The app's own HSTS (`max-age=31536000`) is weaker than the `63072000; preload` Caddy
actually serves. deveco's `.dockerignore` excludes no env pattern. The per-user SSE
cap was added to one of two streaming routes; the messages stream has neither it nor
an abort-before-start cleanup, and each connection runs an unbounded 3-second DB poll.
83 remote branches, 0 open PRs. `CLAUDE.md`'s locked stack lists "Queue: Redis/Valkey"
but no queue exists — all background work is in-process `setInterval`.
**19** production test accounts are in the sitemaps, WebFinger-resolvable and counted
in NodeInfo — see the box below.

---

### The test-account count, and how I got it wrong twice

Session 256's handoff recorded **6** test accounts left on production. I grepped the
sitemaps for `authprobe` — the string the handoff named — and reported **14**. That
was still wrong, because grepping the known string is not deriving the class. Scanning
for test-shaped usernames generally (`authprobe|sectest|test|probe|e2e|qa`) gives:

| instance | test accounts | of public profiles | |
| --- | --- | --- | --- |
| commonpub.io | **5** | 8 | `sectest…`×2, `authprobe…`×3 — **62% of that instance's entire membership** |
| deveco.io | **10** | 147 | `authprobe…`×7, `sectest…`, `probe2acct`, `test.fixer` |
| heatsynclabs.io | **4** | 10 | `authprobe…`×4 — 40% |

**19 in total**, not 6 and not 14. Every one is published to crawlers in
`sitemap.xml`, resolvable over WebFinger and therefore visible to the fediverse, and
counted in NodeInfo's `usage.users.total` — which is what makes commonpub.io's
"8 users" mostly fictional.

I am recording my own error rather than quietly fixing the number, because it is the
report's central thesis happening to the report: **the fix that greps the string you
were told about will always find exactly the instances you were told about.** The
first pass missed `sectest`, `probe2acct` and `test.fixer` for the same reason
session 256 missed three `escapeXml` copies.

Not removed: deleting rows is destructive and these are the operator's instances.

---

## SUSPECTED

- **Outbound federation can emit a `javascript:` href.**
  `packages/protocol/src/contentMapper.ts:96,99` build `<a href="${escapeAttr(url)}">`
  from a video/embed block's URL. `escapeAttr` prevents attribute breakout but is not
  scheme validation. Not proven because I did not verify whether the block write path
  validates those fields, and a correct remote sanitises on receipt.
- **`personaMetrics.integration.test.ts:280`** computes `DAY_TWO` at module load while
  the code under test calls `utcDayKey()` at assert time; a run straddling 00:00 UTC
  would see them disagree. CI runs take ~23 min, so ~1.6% of days. Not reproduced.
- **`escapeXml` extraction risk**: the (now scanning) guard enforces byte-identity of
  five copies, which blocks the real fix — one shared module. When that extraction
  happens, replace the identity assertion with an import assertion rather than
  deleting it.

---

## Checked and correct

Recorded so they are not re-audited; several are prior-session claims that held up.

- **`sitemap.xml`'s privacy predicate** (`:51-63`) matches `isPublicUser`, and no
  non-public profile leaks live. **`feed.xml`** filters `published` + `public`.
- **The layer's own two sanitizers are strong — re-confirmed against a wider set.**
  My first pass used 29 vectors that did NOT include `javasjavascript:cript:`, the
  reassembly case that broke the explainer's. Re-tested against the union of every
  vector any sanitizer in the repo has failed (24 URL-scheme cases including named
  entities, zero-padded and semicolon-less numeric entities, and embedded TAB/LF/CR/NUL),
  `layer.sanitizeBlockHtml`, `layer.sanitizeRichHtml` and `protocol.sanitizeHtml` each
  score **0 failures**. They are immune structurally, not by luck: they parse with
  `new URL()` against a scheme allowlist and re-escape `&`, so there is no string
  replace for a payload to reassemble around. Against the original 29 vectors,
  `sanitizeBlockHtml` and `sanitizeRichHtml` both reject entity-encoded `javascript:`
  (they re-escape `&`, and `isSafeUrl` parses with `new URL()` against a scheme
  allowlist), inline handlers, `<script>`, `<iframe>`, `<form>`, `<base>`, `<meta>`,
  `expression()`, `url()` and unquoted `on*`, and both balance unclosed tags. Two
  allowances (`position: fixed` in a style attribute; `data:image/svg+xml` in
  `href`/`src`) are documented at `useSanitize.ts:222-234` and sit inside the stated
  staff/admin trust boundary. `packages/protocol/src/sanitize.ts` survived all 29 too.
- **The SSRF guard is genuinely thorough.** `packages/protocol/src/ssrf.ts` uses a
  pinned-lookup dispatcher that closes DNS rebinding, plus v4/v6/IPv4-mapped
  classification, `::1`, `fc00::/7`, `fe80::/10`, the obfuscated literal forms
  (dotless decimal, hex, octal-leading), and anchored patterns so `127.0.0.1.evil.com`
  is blocked. `image-proxy.get.ts:59` requires `https:` and `:84` sets the
  neutralizing CSP.
- **Contest PII gating is one predicate, consistently applied** — conclusion holds,
  but the first enumeration that produced it was wrong. I grepped for `includePii`,
  which found 3 routes. Re-deriving from the *tables* (`contestRegistrationPrivateFields`,
  `contestEntryPrivateFields`) finds **four** server functions, not three. The two extra
  are both correct: `profile/export.ts` is the GDPR export and scopes every private read
  with `.where(eq(...userId, userId))` behind `requireAuth`, which is what a subject
  access request is *for*; and `contest/submissions.ts` is a WRITE path
  (`.for('update')` then merge), not a disclosure. So exactly three routes emit contest
  PII to a viewer and all three gate identically on `requireAuth` →
  owner/`contest.manage`/editor → `hasPermission('contest.pii')`, with the private table
  never queried unless `includePii` is set. `isFormFieldPii` and `isRequiredFormField`
  live once (`schema/src/contest.ts:200,216`) and every consumer imports them.
- **The write-path content sanitizer is good.** `content.ts:22-68` runs
  `isomorphic-dompurify` with a tight allowlist and **fails closed** — it strips all
  tags if DOMPurify cannot be imported.
- **WebFinger** on all three: correct subject and links, 404 on unknown, 400 on a
  malformed or missing `resource`. `/@username` 301s to `/u/username`, which carries
  the correct canonical.
- **CLAUDE.md's federation scope table holds.** Grepping `packages/protocol/src` for
  each instance-local table returns 0 for all of them, except one `contests` hit that
  is a NodeInfo feature-flag advertisement. No federation serialiser exists outside
  the protocol package.
- **The published `@commonpub/layer@0.137.3` tarball is complete and current.** 896
  entries; 258 bracketed-path files present (the npm-pack glob hazard is absent);
  diffing against the repo's shippable list leaves only three correctly-excluded
  files; its `theme/base.css` matches source byte-for-byte in size and
  `layouts/default.vue:470` carries the mobile-menu fix.
- **Session 256's mobile-menu fix works in production.** Driven live at 375×667,
  390×844 and 360×640 on all three: `overflow-y: auto` present, panel scrollable
  wherever content exceeds the viewport, last row reachable in all nine cases.
- **Security headers** on all three: CSP, HSTS with `preload`, `X-Frame-Options: DENY`,
  `nosniff`, `Referrer-Policy`, `Permissions-Policy`; Font Awesome carries a correct
  SRI hash; `robots.txt` disallows the right paths.
- **Flag counts are consistent.** `schema.ts` declares exactly 47, `MIN_FLAGS = 47`,
  all three instances report 47 and their key lists are identical to the schema's.
- **The persona date-fixture fix is real** — day keys now derive from `utcDayKey()`,
  and the one remaining literal pins the arithmetic itself.
- **The prior sessions' measurements checked out**: 1,907/223 hardcoded font-sizes
  re-measures as 1,910/223, and CLAUDE.md rule 3 is fully upheld in the two packages
  it names.
- **The monorepo's `deploy.yml` is well built** — `set -o pipefail`, a real
  in-container smoke test that checks critical routes and exits non-zero, and
  `concurrency: deploy-production`. deveco's Dockerfile HEALTHCHECK also behaves
  correctly (ECONNREFUSED → 1, HTTP 500 → 1, HTTP 200 → 0).
- **Housekeeping**: both forks' env backups contain live secrets but are gitignored and
  untracked; no `.DS_Store` tracked; `create-commonpub` 0.5.29 matches crates.io; all
  14 published `@commonpub/*` versions match the tree; `.nvmrc` matches the CI matrix;
  49 journal entries for 49 `.sql` files.

---

## Local instance drive — 2026-08-25

- **L-1** — The signup submit button is disabled, looks enabled, and says nothing
- **L-1b** — PROVEN: a "private" profile is fully readable by anyone
- **L-1c** — Two unguarded dereferences take an explainer page down
- **L-1d** — `section.module` is stored completely unsanitised
- **L-2** — `pnpm seed` is broken: an undeclared dependency
- **L-4** — A non-admin gets HTTP 200, a blank page, and no `<title>` on every admin route
- **L-5** — `POST /api/content` silently ignores `status: 'published'`
- **L-6** — Every page of the default theme fails colour contrast
- **L-7** — Missing `<h1>` is a pattern, not a one-off
- **L-8** — Two skip links, same target
- **L-3** — `scripts/db-migrate.mjs` cannot run outside the container
- **L-11** — The Turborepo cache grew to 20 GB, unbounded
- **L-12** — Three layer tests are timeout-fragile under load
- **L-13** — Feature lifecycle: driven end to end, and it works
- **L-14** — Nothing in the codebase responds to the OS dark-mode preference
- **L-15** — The cookie consent banner is `role="dialog"` with no dialog behaviour
- **L-9** — Checked and clean on the local instance
- **L-10** — A method error of my own, caught here

(The L- numbers were assigned as findings arrived, so they are not in numeric order
below; the list above is document order.)

The report's biggest stated gap was that everything signed-in had been read in source
and never driven. A fresh instance was built to close it: a new database, the 49
migrations replayed the production way, a production build of `apps/reference`, and a
browser driving it. Findings that only a running instance could produce.

### L-1 — The signup submit button is disabled, looks enabled, and says nothing

**CONFIRMED, measured.** `/auth/register`

The "Create account" button is `disabled` until the terms checkbox is ticked. Measured
computed styles in both states:

```
             disabled                enabled
bg           rgb(60, 130, 98)        rgb(60, 130, 98)     IDENTICAL
color        rgb(255, 255, 255)      rgb(255, 255, 255)   IDENTICAL
borderColor  rgb(60, 130, 98)        rgb(60, 130, 98)     IDENTICAL
opacity      0.7                     1                    differs
cursor       not-allowed             pointer              differs
aria-disabled      null              aria-describedby  null       title  null
```

The only visual difference is `opacity: 0.7` on a solid green fill — the two states are
near-indistinguishable side by side, and I was looking for the difference. `cursor:
not-allowed` appears on hover only, so it does not exist on a phone at all. There is no
`aria-disabled`, no `aria-describedby`, and no text near the button saying why it is
inert.

So a user fills the form, taps Create account, and **nothing happens, with no
explanation and no visible cue** — on the very first step of the funnel.

This is the same defect session 256 diagnosed and fixed on the *contest registration*
form, where the write-up reads: *"a greyed button that does not say why is what people
report as 'it does nothing'."* It was fixed there and left here. Another instance of
the report's central pattern, found by driving the app rather than reading it.

**Fix:** keep the button enabled and validate on submit (what the contest form now
does), or at minimum add `aria-describedby` pointing at the terms label and a visible
"Accept the terms to continue" message.

### L-1b — PROVEN: a "private" profile is fully readable by anyone

**CONFIRMED by observation.** This was the report's biggest "could not be exercised"
gap: no live instance had a row with `profileVisibility != 'public'`, so P1-1 rested on
reading predicates. On a local instance I created one.

Two accounts, then `UPDATE users SET profile_visibility='private'` for bob and
`'members'` for alice. Then, with **no cookies and no authentication**:

```
200  LEAKS  /api/users/{bob}                     full profile DTO
200  LEAKS  /u/{bob}                             profile page renders in full
302  LEAKS  /users/{bob}                         ActivityPub actor
200  LEAKS  /.well-known/webfinger?resource=…    resolves — visible to the fediverse
200  LEAKS  /api/search?type=people&q=…          appears in people search
200  LEAKS  /api/users?limit=50                  appears in the member list
200  hidden /sitemap.xml                         (the session-256 fix — the one that works)
401  hidden /api/public/v1/users                 (API key required)
```

`members` visibility leaks identically to an anonymous caller.

The rendered profile page carries **Follow** and **Message** buttons and gives no
indication the profile is meant to be private. The settings UI for this control reads,
verbatim: *"Only you can see your profile."*

So the setting is inert on every path except the one enumeration session 256 happened to
fix. P1-1 moves from *confirmed by reading* to *confirmed by observing the leak*.

### L-1c — Two unguarded dereferences take an explainer page down

**CONFIRMED, both reproduced.** `createContentSchema` types `content` as
`z.unknown()` (`packages/schema/src/validators/content.ts:27`) — no shape validation at
all — so the API accepts any document shape. Two of them crash the viewer.

**(a) Missing `theme` → the page renders, then blanks to a full-page 500.**
`packages/explainer/src/types.ts:204-206`:

```ts
export function resolveThemePreset(theme: ExplainerThemeRef): ExplainerThemePreset {
  return typeof theme === 'string' ? theme : theme.preset;   // undefined.preset throws
}
```

`ScrollViewer.vue:4` calls it. Traced through a real page load:

```
SSR html contains the content:  true
at ~150ms          anchors=36  toggleEls=10  body=27,173 bytes
domcontentloaded   anchors=38  toggleEls=10  body=28,031 bytes
+2s (hydrated)     anchors=3   toggleEls=0   body=10,881 bytes   <-- content destroyed
after scrolling    anchors=3   toggleEls=0   body=10,881 bytes   <-- never recovers
```

The visible result is *"500 Something went wrong — Cannot read properties of undefined
(reading 'preset')"*. **A crawler sees the full article; a human sees an error page.**
Three unguarded call sites: `types.ts:205`, `htmlExporter.ts:93`,
`ExplainerSectionEditor.vue:327`.

**(b) A `section.module` without `props` → HTTP 500 server-side.**
`InteractiveContainer.vue:30` passes `:content="module.props"`; when that is absent the
viewer receives `undefined` and dereferences it. **Five of the module viewers do this
with no guard** — measured across `packages/explainer/modules/*/Viewer.vue`:

```
clickable-cards  derefs props.content.X = 1   guarded = 0
compare                                   4              0
custom-html                               4              0
reveal-cards                              2              0
toggle                                    5              0
```

Reproduced: `curl` on such a page returns **HTTP 500** with
`Cannot read properties of undefined (reading 'defaultMode')`.

**Fix:** default `theme` in `resolveThemePreset` (`if (!theme) return DEFAULT`), give
every module viewer `withDefaults(defineProps<…>(), { content: () => ({}) })`, and
replace `content: z.unknown()` with a real discriminated schema — the unknown is what
makes both reachable.

### L-1d — `section.module` is stored completely unsanitised

**CONFIRMED against the database row**, not by reading code. This is the write-path half
of F-1 (P1-7). I posted an explainer whose `section.module.props.descriptionA` carried
ten XSS payloads and read back `content_items.content`:

```json
"module": { "type": "toggle", "props": { "descriptionA":
  "<a href=\"javasjavascript:cript:alert(1)\">reassembly</a> …
   <img src=x onerror=alert(1) alt=\"onerror\"> …" } }
```

Every payload stored verbatim, including a raw `onerror=` handler.
`sanitizeExplainerDocument` enumerates `hero.subtitle`, `section.body`,
`section.bridge`, `section.insight`, `section.aside.text` and `conclusion.body` by hand
and never walks `section.module`. The render-time barrier (fixed in F-1) is the **only**
thing standing between that row and a viewer.

*Honest limit:* I could **not** complete the end-to-end render assertion, because the
page 500s on L-1c(a) before the module mounts. The sanitizer fix itself is verified
three other ways — 73 unit tests, the 24-vector cross-check, and a bundle built from a
real `npm install` — but "payload stored, rendered, and neutralised in a live DOM" is
one link I did not close. Fix L-1c first, then close it.

### L-2 — `pnpm seed` is broken: an undeclared dependency

**CONFIRMED.** `apps/reference/scripts/seed.ts` imports `pg`; `apps/reference/package.json`
does not declare it. Under pnpm's strict isolated `node_modules` an undeclared
dependency does not resolve, so the documented seed script fails outright:

```
$ pnpm seed
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'pg' imported from
  /apps/reference/scripts/seed.ts
```

Same class as the `layers/base` → `meilisearch` case already in this report (imported,
never declared). That one is masked in the monorepo by hoisting and only breaks npm
consumers; this one is broken for everyone, right now.

### L-4 — A non-admin gets HTTP 200, a blank page, and no `<title>` on every admin route

**CONFIRMED.** Signed in as an ordinary user, all eight admin routes return **HTTP 200
with an empty body** — 293 bytes, `document.body.innerText` empty, `<title>` absent:

```
200  /admin            len=293  title=null   axe: document-title (serious)
200  /admin/features   len=293  title=null   axe: document-title
200  /admin/users      …  /admin/content  …  /admin/settings  …
200  /admin/theme      …  /admin/persona  …  /admin/layouts   …
```

Promoting the same account to `role='admin'` renders every one correctly
(`/admin/persona` has 387 controls, `/admin/features` 76), so the pages are fine — the
**unauthorised** case is the defect. A blank white page with no title is not a
permission denial: there is no 403, no redirect to login, and nothing telling the user
what happened. It also fails WCAG 2.4.2 (Page Titled), which axe flags as serious.

**Fix:** return 403 with the standard error page, or redirect to login. At minimum set
a title.

### L-5 — `POST /api/content` silently ignores `status: 'published'`

**CONFIRMED.** Posting `{ type:'explainer', status:'published', visibility:'public', … }`
returns 200 with `"status":"draft"`. The requested status is dropped without comment —
no 400, no warning field in the response. An API client following the documented shape
believes it published something that is still a draft. (I had to `UPDATE content_items`
directly to get a published row for the render tests.)

Whether publishing-on-create *should* be allowed is a design call; silently returning a
different status than requested is not.

### L-6 — Every page of the default theme fails colour contrast

**CONFIRMED, measured on the local production build.** axe `color-contrast` (serious)
on all 26 pages that render, with the shipped default theme and no fork CSS involved:

```
/                12 nodes      /search?q=a      19      /privacy         17
/dashboard       12            /settings        12      /settings/profile 12
/notifications    7            /videos           7      /learn            7
/hubs             5            /contests         5      /events           5
/create           5            /messages         5      /docs             4
```

This is the reference app, not deveco — so P1-25 (`--text-faint` below 4.5:1 in 6 of 7
themes) is not a fork problem or a theme-studio problem. It is the default.

`/privacy` additionally fails `link-in-text-block` on **12** nodes, and `/videos` fails
`select-name` — a `<select>` with no accessible name, matching P1-26.

### L-7 — Missing `<h1>` is a pattern, not a one-off

**CONFIRMED.** P3-10 recorded deveco's `/contests` having no `h1`. On the reference app
the same is true of `/contests`, `/events`, `/search`, `/settings/privacy`,
`/settings/account` and `/settings/appearance` — six pages, all shipping zero `<h1>`.

### L-8 — Two skip links, same target

**CONFIRMED.** Every page renders both *"Skip to main content"* and *"SKIP TO CONTENT"*,
both pointing at `#main-content`. A keyboard user tabs past two identical controls
before reaching the page. Matches the a11y dimension's "duplicate skip links" note, now
seen live. The nested `<main>` of P2-6 is also visible here: `/` reports `main=2`.

### L-3 — `scripts/db-migrate.mjs` cannot run outside the container

**CONFIRMED, low severity, worth knowing.** ESM resolves from the importing *file's*
location, so `scripts/db-migrate.mjs` resolves `drizzle-orm` and `pg` from `scripts/`,
which has no `node_modules`. It works in production because the container puts it at
`/app/scripts` next to `/app/node_modules`. Locally it fails with
`ERR_MODULE_NOT_FOUND` no matter the cwd, and `pnpm exec` does not help. To replay the
migrations for this audit I had to place an equivalent runner inside
`packages/schema/`. That friction is part of why P1-12's gap persisted: the production
migration path is genuinely awkward to exercise by hand.

### L-11 — The Turborepo cache grew to 20 GB, unbounded

**CONFIRMED, measured, and cleaned (with the operator's approval).** The working copy
had reached **21 GB**. It was not test output or logs:

| path | size | status |
| --- | --- | --- |
| `.turbo/cache` | **20 GB** | gitignored, **0 tracked files**, 16,795 entries, oldest 14 Apr |
| `test-site/node_modules` | 240 M | gitignored scratch app, not in the workspace or CI |
| 7 screenshot/report dirs | ~31 M | gitignored, untracked |
| everything else | ~1 GB | `.git` 154M, `node_modules` 689M, source 213M |

Growth by month, and the shape of it:

```
2026-04   10.6 GB   1,565 entries    ~7 MB average
2026-05    3.1 GB   4,105
2026-06    2.1 GB   5,502
2026-07    1.4 GB   1,972
2026-08    2.5 GB   3,651
115 entries are >50 MB and account for 12.3 GB on their own
```

Cause: `turbo.json`'s `build` task declares
`outputs: ["dist/**", ".output/**", ".nuxt/**", "build/**"]`. For the two Nuxt apps
that means every build stores its entire `.output` **and** `.nuxt` — one sampled entry
held **8,636 files** across `apps/shell/.output` (6,991) and `apps/shell/.nuxt` (1,644),
~110 MB compressed. That is correct turbo behaviour; the defect is that **nothing ever
prunes it**, and turbo has no built-in size cap or TTL on the local filesystem cache.

Removing `.turbo/cache` took the repo from **21 GB to 1.1 GB** (free disk 6.8 → 27 GB)
with `git status` showing only the audit's own edits. Nothing tracked was touched, and
no backup files exist anywhere in the repo (searched for `*.bak`, `*backup*`, `*.dump`,
`*.sql.gz`, `*~`, `*.orig` — zero hits outside a library path).

**Worth deciding, not just cleaning:** both apps are `private` and never published, so
caching a ~110 MB `.output` per build to save a couple of minutes is a poor trade at
this accumulation rate. Options: drop `apps/*` from the cached build outputs, or add a
scheduled prune. Related to the existing P3 finding that `turbo.json` declares no
`globalDependencies`.

### L-12 — Three layer tests are timeout-fragile under load

**CONFIRMED, reproduced twice.** Run alone, `@commonpub/layer` passes: **202 files,
2,945 tests, exit 0**. Run inside `turbo run typecheck lint test --concurrency=50%`
alongside 29 other workspaces, it fails — and the failures are **timeouts, never
assertions**:

```
FAIL server/__tests__/persona-rollup.test.ts            Hook timed out in 60000ms (beforeAll)
FAIL server/api/admin/persona/__tests__/persona-admin-routes.test.ts
   × ContestEmailEditor > passes an axe scan             Test timed out in 5000ms (took 5228ms)
Test Files  3 failed | 199 passed (202)
Tests       1 failed | 2880 passed | 64 skipped (2945)
```

The log shows `@commonpub/server:test` pulling a database schema concurrently. Two
consecutive full-gate runs failed this way — once as exit **143** (SIGTERM) and once as
exit **1** (timeouts).

This is the hazard `ci.yml:71-77` already documents in its own comment — *"Unbounded
(default 10) it starts a vitest instance for every package at once on 2-4 cores; the
CPU-bound suites then stall long enough for vitest's worker RPC to time out and fail
the run even though every test passed"* — reproduced at `--concurrency=50%`, which is
the setting CI itself uses. The mitigation in CI is not sufficient on a loaded machine.

**Fix:** raise `hookTimeout`/`testTimeout` for the three DB- and axe-heavy suites, or
mark them serial. An axe scan budgeted at 5,000ms that takes 5,228ms under load is a
flake waiting for a slow runner.

### L-13 — Feature lifecycle: driven end to end, and it works

**CONFIRMED working**, through the real API with the real contracts, signed in:

```
POST /api/content (project)         200  status=draft
PUT  /api/content/{id} published    200  status=published
GET  /u/{user}/project/{slug} (anon) 200  h1 correct, <strong> rendered
POST /api/social/like               200  {"liked":true}
POST /api/social/bookmark           200
POST /api/social/comments           200  created
POST /api/messages {participants}   200  conversation created
POST /api/messages/{id} {body}      200  message sent
POST /api/hubs                      200  slug created
POST /api/contests                  200  page renders, CTAs present
GET  /api/search?q=…                200  finds the newly published project
```

The contest page renders with *"Register for this contest"* and *"Follow this
contest"* CTAs — note it shows **"Register for this contest" twice**, which is the
duplicate-CTA shape session 256's action-bar work was about.

**A methodological warning attached to this result.** My first pass at the same
lifecycle produced **four 400s** — comments, like, bookmark and messages — and I very
nearly wrote them up as defects. Every one was my own wrong payload:
`/api/social/*` takes `{targetType, targetId}` not `{contentId}`; comments take
`content` not `body`; messages take `{participants: [uuid]}` not
`{recipientUsername, body}`; and content updates go to `/api/content/{id}` not
`{slug}`. Reading the four route handlers turned four "findings" into zero. **A 400
from an endpoint is evidence about your request until you have read its schema.**

### L-14 — Nothing in the codebase responds to the OS dark-mode preference

**CONFIRMED.** `grep -rl "prefers-color-scheme"` across `packages/ui/theme`,
`layers/base` and every `packages/*/src` returns **0 files**.

Measured live with `emulateMedia({ colorScheme: 'dark' })`:

```
light   bodyBg=rgb(247,243,234)  data-theme=stoa  colorScheme=light  --surface=#fffdf6
dark    bodyBg=rgb(247,243,234)  data-theme=stoa  colorScheme=light  --surface=#fffdf6
```

Identical. `/settings/appearance` offers exactly **"Light"** and **"Dark"** and never
mentions system/auto/follow.

This is a **design choice, not a bug** — the theme is explicitly chosen per instance
and per user, and light/dark pairs exist (`base`/`dark`, `agora`/`agora-dark`,
`stoa`/`stoa-dark`). Recorded because it has two consequences worth knowing: a visitor
on a dark-mode device gets a light page until they find the setting, and the
`<html>` element advertises `color-scheme: light` regardless, so form controls and
scrollbars stay light-rendered too. Adding a "System" option is a small change if it
is wanted; if it is not, this entry is just documentation.

*Correction to my own earlier method:* the live contrast measurements in P2-11 forced
`data-theme` directly as well as `colorScheme`, and `data-theme` is what the app
actually reads — so those dark-theme numbers are valid. But the row I labelled
"light" set `data-theme="light"`, which is **not a valid theme id** (the ids are
`base`, `dark`, `agora`, `agora-dark`, `generics`, `stoa`, `stoa-dark`); it fell back
to the `:root` default palette, which is light. The measurement was right by accident,
not by design.

### L-15 — The cookie consent banner is `role="dialog"` with no dialog behaviour

**CONFIRMED.** The banner renders as
`<div class="cpub-consent cpub-overlay-surface" role="dialog">` with **no
`aria-modal`**, 4 focusable controls, focus not trapped, and Escape does not dismiss
it. A `role="dialog"` that is not modal, does not manage focus and cannot be escaped is
mislabelled: assistive technology announces a dialog and then behaves like ordinary
page content.

**Fix:** either make it a real non-modal dialog (keep `role="dialog"`, add an
accessible name and Escape-to-dismiss) or drop to `role="region"` with an
`aria-label`, which is what a persistent consent bar usually wants.

**Two of my own leads died here, and both were measurement errors.** I first reported
"focus escaped the dialog" and "Escape does not close it" from a Cmd+K test — but the
element my selector matched was this consent banner, not the search. Re-run with the
banner dismissed: the Cmd+K search input lives in `HEADER.cpub-topbar`, has no
`role="dialog"`, and is an inline expanding search rather than an overlay. Focus
leaving it is correct and there is nothing to trap. The only genuine residue is minor:
**Escape does not dismiss the Cmd+K search.**

### L-9 — Checked and clean on the local instance

- **No horizontal overflow at any mobile width.** 9 routes × 320/360/375/390px, real
  iPhone UA, `isMobile`: **0 overflowing routes at every size**, including 320px. This
  confirms P2-4 (deveco overflowing at ≤374px) is genuinely **fork-only** — the layer
  and the reference app are clean, and the 372px minimum content width comes from
  deveco's own `.de-topbar-actions`.
- **No hydration mismatch** on 14 signed-out routes or 12 signed-in ones (including
  `/admin`, `/dashboard`, `/create`, `/settings/privacy`), measured with a
  document-start `MutationObserver` stopped at the warning. The reference app is clean;
  the mismatch recorded in P2-27 remains specific to heatsynclabs.io's client plugin.
- **The 49 migrations replay cleanly and agree with `push`** — see the corrected P1-12.
- **`Cmd+K` opens a `role="dialog"` and moves focus into the search input**, so that
  overlay's focus management is correct.
- **Admin pages render correctly for an actual admin** — every one has a title, an `h1`
  and its controls. The defect in L-4 is strictly the unauthorised case.

### L-10 — A method error of my own, caught here

Worth recording because it is the same class as "a green test count is not a green run".

I ran the full suite as a backgrounded `pnpm turbo run test … 2>&1 | tail -6`. The task
reported **`exited with code 0`** — but that is the exit code of `tail`, not of turbo.
Reading the log rather than the summary line:

```
Tasks:    30 successful, 34 total
Failed:   @commonpub/layer#test
ERROR  run failed: command exited (143)
```

143 = 128 + 15 = **SIGTERM**: the layer suite was killed by resource contention (three
Nuxt dev servers plus a full test fan-out on one machine), not failed on assertions.
Re-running it alone: **202 files, 2,945 tests, exit 0.**

I then re-checked every gate run I had previously reported as green for the same
masking. All four print turbo's own `N successful, N total` with zero `Failed:` lines,
so those claims stand. But I would not have known that without looking, and I had been
quoting a pipeline's exit code as if it were the command's.

## Audit of this audit

This report was re-audited against its own standard, twice — the second pass auditing
the first pass's own fixes. Nine things it got wrong, and one it got right for the
wrong reason. They are here rather than silently patched,
because a report that claims 150 findings and no errors of its own is not credible.

**1. A guard I wrote had the exact defect it was written to catch.**
`db-pool-error.test.ts` scanned only `layers/base/server/` — the tree where I had
found the defect. It would not have caught a long-lived pool added to
`packages/server/src`. Broadened to all four long-lived server roots (474 → **620**
files scanned), and proven by planting a listener-less pool in `packages/server/src`
and watching the guard fail on it. The *fix* was always complete —
`packages/server/src` creates no production pool, so `layers/base/server/utils/db.ts`
really is the only long-lived one — but the guard's reach did not match the claim I
made for it. Same mistake as session 256's, one level up.

The four other pools in the repo (`scripts/db-migrate.mjs`,
`scripts/reconcile-counters.mjs`, `scripts/migrate-homepage-layout.mjs`,
`apps/reference/scripts/seed.ts`) have no listener and **do not need one**: they are
one-shot CLI tools that call `pool.end()`, and for a migration runner an uncaught
error meaning a non-zero exit is the correct behaviour, not a bug. That exemption is
now documented in the guard rather than left as an unexplained gap.

**2. I understated a finding by 4x, and then fixed the wrong scope.** P2-10 said the
explainer's second sanitizer was "bypassed by entity encoding and leading control
characters" — 2-3 vectors. Re-testing every sanitizer in the repo against the *union*
of all vectors showed **12 of 24**, including named entities (`&colon;`, `&Tab;`,
`&NewLine;`), zero-padded and semicolon-less numeric entities, and embedded CR. And
my F-1 fix had repaired one of the package's two sanitizers while leaving the other
broken — which is precisely the failure mode this whole report is about. Both now
import one shared `src/urlSafety.ts`, pinned by a test that scans the package for
sanitizers and fails if a third appears without it.

**3. My "checked and correct" on the layer sanitizers was right, but under-tested.**
The 29 vectors I used did not include `javasjavascript:cript:` — the reassembly case
that broke the explainer's. A false all-clear is worse than a missed finding, because
it tells the reader to stop looking. Re-tested: `layer.sanitizeBlockHtml`,
`layer.sanitizeRichHtml` and `protocol.sanitizeHtml` score **0 of 24 failures**, and
structurally so — they parse with `new URL()` against a scheme allowlist, so there is
no string replace for a payload to reassemble around. The claim stands, now on evidence
rather than a narrower sample.

**4. I got the contest-PII enumeration right by luck of the grep.** I searched for
`includePii` and found 3 routes. Deriving from the *tables* instead finds **four**
server functions. Both extras are correct — the GDPR export scopes every private read
to the requesting user, and the submissions path is a write — so the conclusion held.
But I only know that because I re-derived it; the method that produced the original
answer could not have told me.

**5. Two published counts were wrong.** "36 rule-level hardcoded colours across 27
files" is **8 across 6**, and roughly three of those are genuine (recorded in the CSS
section above). "14 production test accounts" is **19** (recorded in its own box).
Both were cases of trusting a number rather than re-deriving it — and in the test-account
case, of grepping the one string I had been told about.

**What re-checking confirmed rather than overturned.** The "151 packages resolve to
different versions between deveco's two lockfiles" figure reproduces exactly (614
packages in both lockfiles, 151 divergent). The 1,910/223 font-size count reproduces
exactly. The layer lint numbers, the 56 duplicate function names, the 19 test accounts,
the compression measurements and the 47-flag consistency were all mine and all re-derive.
I also deliberately did **not** promote a second lockfile figure — my parser reports 417
packages present in `package-lock` but absent from `pnpm-lock`, which is almost certainly
an artifact of a crude YAML scan rather than a real gap, so it appears nowhere in this
report.

### Round three — auditing the second round's fixes

The corrections made in round two were themselves audited. Four more things.

**6. The self-referential import I introduced needed proving, not assuming.**
`vue/utils/sanitize.ts` now does `import { isSafeUrl } from '@commonpub/explainer'` —
a package importing itself by name. `src/` is not in the published `files` array, so a
relative import would have broken for npm consumers; the self-reference is the only
correct choice. But "correct choice" is not "verified", and this is precisely the
fork-invisible class this report is about: it resolves through a workspace symlink in
the monorepo and through flat `node_modules` in the forks.

Tested end to end rather than reasoned about: `pnpm pack` (which rewrites
`workspace:*` the way publish does — `npm pack` does NOT, and my first attempt at this
test was invalid because of it), `npm install` of the tarball into a clean directory,
then ESM resolution from inside the package and an esbuild bundle of the installed
file. The self-reference resolves to `dist/index.js`, and the sanitizer bundled from
that install neutralises 12/12 dangerous vectors while preserving 4/4 legitimate URLs.
The hazard is not present. (Noted in passing: `require()` of this package fails with
`ERR_PACKAGE_PATH_NOT_EXPORTED` — its `exports` map declares only `import`. That is
pre-existing and correct for an ESM-only package, not something this change caused.)

**7. I wrote entity semantics from memory and five of nineteen were wrong.**
`decodeForSchemeCheck` was written against my recollection of the HTML5 named
character reference table. Checked against Chromium's actual parser across 19
encodings: **zero holes** — every URL the browser resolves to `javascript:` is
refused — but **five over-blocks**. HTML named references are case-SENSITIVE and,
outside the legacy set, require their semicolon, so `&COLON;`, `&Colon;` (which is
U+2237 PROPORTION, not a colon), `&colon` without a semicolon, `&tab;` and
`&newline;` are *not* decoded by a browser. My decoder decodes them anyway.

Deliberately **kept**: over-blocking costs one dropped href in a contrived URL,
under-blocking costs XSS. But my test listed those five under `EXECUTABLE` and
asserted it "refuses executable URLs" — which is false, they are not executable. They
now sit in a separate `OVER_BLOCKED` group with the measured browser behaviour
recorded, and `urlSafety.ts` documents the margin as intentional. A test that
mislabels why it passes is a test that will be deleted by the next person who reads it.

**8. My first replacement for the denylist mangled ordinary prose.** I put the scheme
check in a whole-document regex, matching `href=` anywhere — including in text
content. So `<p>Use href=data:text/html for inline docs.</p>` came out as
`href="#"`, and a code sample showing `<a href="javascript:x">` was rewritten inside
its own `<pre>`. The original denylist had the same bug for `javascript:`/`vbscript:`;
mine widened it to every unsafe scheme.

Fixed structurally: the scheme check now runs **inside the per-tag attribute loop**,
which is how the sibling sanitizer already did it, so text content is never touched.
Both explainer sanitizers are now the same shape as well as sharing the same gate.
Pinned by three regression cases, mutation-tested by putting the whole-document pass
back (3 named failures).

**9. A positive control I added was too strict.** The broadened pool guard asserted
that *every* long-lived root contributes at least one file. `apps/shell/server` holds
exactly one. A guard that goes red because a starter template lost its last server
file is reporting a problem that does not exist. Now asserts only on the two roots
that must always have files.

**The honest summary.** The high-severity findings held up; where I was wrong, I was
wrong about *extent* rather than existence, and in every case the error came from
accepting a count or grepping a known string instead of deriving the class — which is
the same failure the report attributes to the codebase. That symmetry is not ironic,
it is the point: it is an easy mistake, which is why the counter-measure has to be
mechanical (make the guard scan) rather than a resolution to be careful.

---

## What was NOT checked

- **No authenticated flows were driven on production.** Everything against the live
  instances was an unauthenticated GET. Signed-in behaviour — the contest funnel end to
  end, admin screens, messages, persona forms — was read in source and tested locally.
  The mobile-menu verification is signed-out only.
- **No writes to any live instance**, so the 14 test accounts remain and the
  operator-side deveco contest items are untouched.
- **`profileVisibility != 'public'` and `status = 'suspended'` could not be exercised
  end to end** — no such row exists on any instance and the audit was read-only. P1-1
  is confirmed by predicate reading plus unauthenticated 200s, not by observing a
  hidden profile leak.
- **The 49 migrations were not replayed.** P1-12 says CI never does this; neither did
  I. Nobody has executed that sequence from empty except production.
- **Vue template linting could not be run** (the plugin is not installed), so the
  `.vue` error count is unknown rather than zero.
- The 79 `useLazyFetch`/`useLazyAsyncData` sites were counted but not individually
  classified into "neutral skeleton" versus "renders a lie".
- Message/DM, contest and hub-flag privacy surfaces were not audited as their own
  dimension.
- Contrast was measured on each instance's homepage in two themes, not every page or
  all seven themes.
