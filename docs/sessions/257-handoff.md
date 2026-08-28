# Session 257 — Handoff

A full-repository audit, and three fixes for what it found.

**Nothing was published. Nothing was deployed. Nothing was deleted.** Three defects
are fixed on `main`'s working tree and need a release to reach production.

Report: `docs/reviews/2026-08-23-full-audit.md`.

## What this session was

A lead pass plus a 28-agent fan-out across thirteen dimensions — privacy, security,
federation, API/DB, fork architecture, release engineering, CSS, accessibility,
cruft, docs, scaling, tests, frontend correctness — with every dimension's findings
re-derived by an adversarial verifier instructed to refute rather than confirm.
Roughly 150 findings survived. Findings the report marks **[hand-verified]** I
reproduced myself afterwards; the rest are as good as the finder-plus-verifier pass
and no better, and the report says which is which.

The rule for the whole session was that `docs/STATUS.md`, the session logs, the
prior audit reports and the code comments are **claims to check, not facts.** That
turned out to matter: STATUS.md was wrong on 27 of 38 present-tense state claims,
and three of the four biggest findings are places where a *previous* fix was
correct and incomplete.

## The one thing worth carrying forward

**A fix lands on the instance that was noticed. A guard is written that pins that
instance. The rest of the class ships.**

Four confirmed examples, all from earlier sessions' own work:

| the earlier session found | it fixed | the class actually was |
| --- | --- | --- |
| `escapeXml` missing a C0 strip in 2 files | those 2, and a guard over those 2 | **5 copies** — the 3 unlisted are live RSS routes |
| a pg pool with no `'error'` listener crashing a test run | the **4 pools in the test helper** | the **production** pool still had none |
| `profileVisibility` ignored by `sitemap.xml` | the sitemap, and a guard over the sitemap | **7 sites enforce it, ~13 public read paths do not** |
| a ContentCard date mismatching across timezones | ContentCard | **45 files**; 32 of 85 live items show the wrong day |

The counter-measure is small and mechanical: **make the guard discover its targets
by scanning, not by listing them.** Both guards written this session do that —
`xml-escape.test.ts` walks `layers/base/server/` for every `escapeXml`, and
`db-pool-error.test.ts` walks it for every `new Pool(` — so a sixth copy added
tomorrow fails a test instead of shipping.

## Fixed — released 2026-08-27, live on all three instances

**1. Stored XSS in the live explainer render path — and, after the self-audit, the
package's other sanitizer too.**
`packages/explainer/vue/utils/sanitize.ts` neutralised dangerous URLs with
`.replace(/javascript\s*:/gi, '')`. A single-pass replace cannot do that job: 8 of
12 vectors produced a live `javascript:`/`data:`/`vbscript:` protocol in a real DOM
parser, including `javasjavascript:cript:` (the replace removes the inner
occurrence and the halves close up), a tab or newline inside the scheme, and
`javascript&#58;`. It reaches production because `sanitizeExplainerDocument`
enumerates fields by hand and never touches `section.module`, `createContentSchema`
types content as `z.unknown()`, and `ExplainerView` → `ScrollViewer` →
`SectionRenderer` → `InteractiveContainer` renders module content through that
sanitizer. `explainers` is ON on all three instances and all three have open
registration. Now default-denies on the decoded **scheme**; `src` is checked as well
as `href`. The scheme gate lives in one module, `packages/explainer/src/urlSafety.ts`,
which BOTH of the package's sanitizers import — the second one was failing 12 of 24
vectors and fixing only the first would have left the class open. 34 + 67 tests, both
proven to fail without the fix.

**2. The production Postgres pool could crash the whole server.**
`layers/base/server/utils/db.ts` created its pool with no `'error'` listener. In
Node that event is an uncaught exception, and `pg.Pool` raises it for an idle client
whenever the backend goes away — a restart, a failover, a `pg_terminate_backend`, a
network blip. Session 256 diagnosed this exact mechanism and fixed the four pools in
`realpgdb.ts`; the one that serves production was not part of it. 7 tests.

**3. Three live RSS routes emitted XML that readers reject.**
The per-user, per-hub and federated-hub feeds each carried their own `escapeXml`
without the C0 strip. Proven with libxml2: a feed whose first title carries U+000B
parses to 1 item instead of 2, because the document is truncated at the error. The
federated one takes its content from remote instances. 31 tests.

Gates after the changes AND after the self-audit's corrections, uncached:
`pnpm turbo run typecheck lint test --force` → **68 successful, 68 total, exit 0**
(8m31s, zero cached, no failure marker anywhere in the log); layer 2,938 passing;
eslint 0 problems on every changed and new file.

Each guard was mutation-tested: xml-escape 31 (revert a copy → 2 named failures);
explainer/vue 34 (remove the decode → 6); db-pool-error 7 (delete the listener → 2,
**plant a pool outside the layer → 1**); urlSafety 73 (revert to the denylist → 6,
remove the decode → 14, restore the whole-document pass → 3). A guard that has not been seen to fail is not yet a guard —
db-pool-error passed its first mutation test while still having the wrong scan root,
and only the *plant a pool outside the layer* mutation caught that.

Cascade, if you roll it: `explainer` → `server` → `layer` (exact pins), plus `layer`
on its own for fixes 2 and 3.

## Local instance drive (2026-08-25)

The report's biggest stated gap was that everything signed-in had been read in source
and never driven. Closed: fresh database, 49 migrations replayed the production way, a
production build of `apps/reference`, and a browser driving it. Thirteen findings a
running instance produced that source reading had not, in
`docs/reviews/2026-08-23-full-audit.md` under "Local instance drive". The ones that
matter:

1. **`profileVisibility` PROVEN inert.** No live instance had a non-public row, so P1-1
   rested on reading predicates. I made one. A `private` profile is fully readable by an
   anonymous caller on **6 of 8** paths — API, profile page, AP actor, WebFinger, people
   search, member list — and the page renders with Follow and Message buttons. Only the
   sitemap (the session-256 fix) hides it. `members` leaks identically.
2. **Two unguarded dereferences take an explainer page down.** `resolveThemePreset`
   (`types.ts:205`) does `theme.preset` with no guard, so a document without `theme`
   renders fully in SSR and then blanks to a client-side 500 — measured, body shrinks
   28,031 → 10,881 bytes on hydration and never recovers. A crawler sees the article, a
   human sees an error page. Separately, 5 of the module viewers dereference
   `props.content.X` unguarded, so a `section.module` without `props` is an HTTP 500.
   Both reachable because `createContentSchema` types content as `z.unknown()`.
3. **`section.module` is stored completely unsanitised** — confirmed against the actual
   database row, `onerror=` handler and all. That is the write-path half of F-1 and it
   is still open; F-1 fixed only the render barrier.
4. **P1-12 corrected downward.** The 49 migrations replay cleanly from empty (1,064ms,
   110 tables) and `migrate` vs `push` are **semantically identical** — 1004 columns,
   342 indexes, 1104 constraints, 205 enum labels all matching. The process gap is real;
   the live risk I implied is not.
5. **The signup submit button is disabled, looks enabled, and says nothing** — the exact
   defect session 256 fixed on the contest form, still on the first funnel step.
6. **A non-admin gets HTTP 200 + a blank page + no `<title>`** on all 8 admin routes.
7. **`POST /api/content` silently ignores `status: 'published'`** and saves a draft.
8. **Colour contrast fails on every page of the DEFAULT theme** (4–19 serious nodes),
   so P1-25 is not a fork or theme-studio problem.
9. **`pnpm seed` is broken** — `apps/reference` imports `pg` without declaring it.

**The feature surface works.** Driven end to end with the real contracts: create a
project → publish → anonymous public page renders correctly; like, bookmark, comment;
create a conversation and send a message; create a hub; create a contest whose page
renders with its CTAs; search finds the newly published item. Content, social,
messaging, hubs, contests and search are all functional.

Clean on the local instance: no horizontal overflow at 320/360/375/390px on 9 routes
(so P2-4 is genuinely fork-only), no hydration mismatch on 26 routes signed-in or out,
admin pages fine for a real admin, 49 migrations replay cleanly.

Two further observations rather than defects: **nothing in the codebase reads
`prefers-color-scheme`** (0 files) and the appearance picker offers only Light/Dark
with no System option — a design choice with the consequence that a dark-mode visitor
gets a light page until they find the setting. And the **cookie consent banner is
`role="dialog"` with no `aria-modal`**, no focus trap and no Escape — mislabelled
semantics for what is really a persistent region.

**Three of my own leads died under re-testing, all measurement errors**, and they are
written up as such rather than deleted: four "API defects" that were my own wrong
payload shapes (the social endpoints take `{targetType,targetId}`, comments take
`content`, messages take `{participants:[uuid]}`, content updates go by id not slug);
and two "modal" findings that were measuring the consent banner instead of the Cmd+K
search — which turns out not to be a dialog at all, so focus leaving it is correct.
The only residue is minor: Escape does not dismiss the Cmd+K search.

**And one method error of mine:** a backgrounded `… | tail -6` reported `exited with
code 0` while turbo had actually reported `Failed: @commonpub/layer#test … exited (143)`
— a SIGTERM from resource contention, not a test failure (the suite passes alone:
202 files, 2,945 tests). I quoted a pipeline's exit code as the command's. I re-checked
all four previously-reported gate runs for the same masking; they are genuinely clean.

## Highest-value things NOT fixed

Ranked by what I would do first.

1. **Rotate the crates.io publish token.** It enters the Docker build context
   (`.dockerignore` does not exclude `.secrets/`) and is baked into a build layer.
2. **Turn on compression.** `deploy/Caddyfile` and deveco's have no `encode`
   directive; heatsync's does. deveco's contest page is 514 KB on the wire and
   102 KB gzipped. One line, two files, ~5× on the two busiest instances.
3. **`profileVisibility` does not work.** Offered in the UI with the words "Only
   people signed in to this site can see your profile", ignored by ~13 public read
   paths including the AP actor, WebFinger, people search and the profile page's own
   API. `getUserByUsername` does not even return the field, so no caller could gate
   on it. Suspension writes `deletedAt = null` and hides nothing. Nothing has leaked
   yet only because no instance has a non-public row.
4. **`emailNotifications` is served to unauthenticated callers.** Verified live with
   a real account. One field to drop from `UserProfile`.
5. **The fork deploys have no gates.** heatsync has no CI at all; deveco's health
   check has never passed and cannot fail the deploy, and it lacks `set -o pipefail`.
6. **The layer is not linted and no `.vue` file anywhere is** — 12 live eslint errors,
   and six `eslint-disable vue/no-v-html` directives for a rule that can never fire.
7. **CI never runs the migrations.** `push --force` in CI, `migrate` in production;
   46 of 49 migration files are executed by no test at all.

## Two corrections to earlier records

- **The `server: false` "zero-seed" item is mis-stated in the 256 handoff.**
  `ContestActionBar.vue:22-26` documents the client-only tier as deliberate, with a
  fixed-height bar so the swap cannot shift layout. What harmed users was the
  *frozen subtree* from a hydration mismatch, and that cause is fixed. Restate the
  open item as "any hydration mismatch on a page carrying per-viewer state degrades
  to a wrong CTA" — which is why the live mismatch on heatsynclabs.io matters more
  than its cosmetic blast radius suggests.
- **The production test accounts number 19, not the 6 recorded** — 5 of
  commonpub.io's 8 public profiles (62%), 10 on deveco.io, 4 of heatsynclabs.io's 10.
  All are in the sitemaps, WebFinger-resolvable and counted in NodeInfo.

  Worth reading as a small object lesson: my *first* correction said 14, because I
  grepped for `authprobe` — the string the 256 handoff named — and missed `sectest`,
  `probe2acct` and `test.fixer`. Deriving the class rather than grepping the known
  string is the whole point of this session's findings, and I got it wrong once on the
  way to getting it right. Not removed: deleting is destructive and they are yours.

## I audited the audit, and it found five things

Recorded because a report claiming ~150 findings and no errors of its own is not
credible. Full detail in the report's "Audit of this audit" section.

1. **A guard I wrote had the exact defect it was written to catch.**
   `db-pool-error.test.ts` scanned only `layers/base/server/` — the tree where I found
   the bug — so it would not have caught a long-lived pool added to
   `packages/server/src`. Broadened to all four long-lived server roots (474 → 620
   files) and proven by planting a listener-less pool outside the layer and watching
   it fail. The *fix* was always complete; the guard's reach did not match my claim
   for it.
2. **I understated a finding 4x and then fixed the wrong scope.** The explainer's
   second sanitizer failed **12 of 24** vectors, not the 2-3 I reported — and my F-1
   fix had repaired one of the package's two sanitizers and left the other broken,
   which is the exact failure mode this report is about. Both now import one shared
   `src/urlSafety.ts`, pinned by a test that scans the package and fails if a third
   copy appears.
3. **A "checked and correct" was right but under-tested.** My 29 layer-sanitizer
   vectors omitted `javasjavascript:cript:` — the case that broke the explainer's.
   Re-tested: the layer's two and protocol's all score 0 of 24 failures, structurally
   (they parse with `new URL()`, so there is no replace to reassemble around). Claim
   stands, now on evidence.
4. **I got the contest-PII enumeration right by luck of the grep.** I searched
   `includePii` (3 routes); deriving from the tables finds 4 functions. Both extras are
   correct, so the conclusion held — but the method could not have told me that.
5. **Two published counts were wrong** — 36/27 hardcoded colours is really 8/6, and 14
   test accounts is really 19.

A third pass then audited the second pass's fixes and found four more:

6. **The self-referential import I introduced needed proving.** `vue/utils/sanitize.ts`
   now imports `@commonpub/explainer` — the package importing itself. It is the only
   correct choice (`src/` is not published, so a relative import would break npm
   consumers), but "correct choice" is not "verified", and this is exactly the
   fork-invisible class: workspace symlink here, flat node_modules there. Tested by
   `pnpm pack` → `npm install` into a clean dir → ESM resolve from inside the package
   → esbuild bundle → run the vectors. 12/12 neutralised, 4/4 legitimate preserved.
   (My first attempt at this test was invalid: `npm pack` does not rewrite
   `workspace:*`, so the tarball would not install at all.)
7. **I wrote entity semantics from memory; 5 of 19 were wrong.** Checked against
   Chromium: zero holes, but `&COLON;`, `&Colon;`, `&colon` (no semicolon), `&tab;`
   and `&newline;` are not decoded by a browser and I refuse them anyway. Kept — the
   margin is right for a security gate — but my test called them "executable", which
   is false. They now sit in a measured `OVER_BLOCKED` group.
8. **My first replacement for the denylist mangled prose.** The scheme check ran over
   the whole document, so `<p>Use href=data:text/html …</p>` and a code sample showing
   an anchor were both rewritten. Moved inside the per-tag attribute loop, matching how
   the sibling sanitizer already worked. Three regression cases, mutation-tested.
9. **A positive control I added was too strict** — it required every long-lived root to
   contain a file, and `apps/shell/server` has exactly one.

Where I was wrong I was wrong about *extent* or *framing*, not existence, and nearly
every error came from accepting a count, grepping a known string, or writing from
memory instead of measuring — the same failure I attribute to the codebase. Which is
the argument for making the counter-measure mechanical rather than a resolution to be
careful.

## Three CSS claims that did NOT survive

Recorded because two of them were in an earlier draft of the report:

- **"36 rule-level hardcoded colours across 27 layer files" was wrong — it is 8 across
  6 files**, and roughly three of those eight are genuine. Three different numbers were
  produced before this settled (a crude grep said 51/16, an agent said 36/27). The whole
  difference is that `var(--x, #fff)` is a *token fallback* and `--x: #fff` is a token
  *definition*; neither is a hardcoded colour.
- **The universal `* { border-radius: var(--radius) }` is not a defect** — base.css:385-390
  documents it and states the escape hatch, and `*` has specificity 0 so any rule opts out.
- **1,910 px font-sizes across 223 files is accurate** but is an already-accepted house
  convention, not a new finding.

## Things the earlier sessions got right

Worth recording, because re-auditing found more correct than incorrect:
the sitemap privacy predicate and its guard (an exemplar — it carries a positive
control), the SSRF guard, the contest PII partition, the DOMPurify write path, the
layer's own two sanitizers (29 adversarial vectors, no bypass), the published layer
tarball's completeness, the mobile-menu scroll fix (verified live at three
viewports on all three instances), the persona date-fixture fix, and the
"1,907 hardcoded font-sizes across 223 files" figure, which re-measures as 1,910/223.

## Disk: the repo was 21 GB, now 1.1 GB

Not test output or logs — the **Turborepo cache**. `.turbo/cache` held **20 GB** across
16,795 entries dating to 14 April, gitignored with zero tracked files. `turbo.json`
caches `.output/**` AND `.nuxt/**` for the two Nuxt apps, so every app build stores
~110 MB (one sampled entry: 8,636 files); 115 entries over 50 MB accounted for 12.3 GB
alone. Nothing prunes it and turbo has no local size cap.

Removed, with approval: `.turbo/cache` and `test-site/node_modules` (240 MB, a scratch
app not in the workspace or CI — its source is intact). Repo **21 GB → 1.1 GB**, free
disk 6.8 → 27 GB, `git status` unchanged apart from this session's own edits.

**No backups exist anywhere in the repo** — searched `*.bak`, `*backup*`, `*.dump`,
`*.sql.gz`, `*~`, `*.orig`; zero hits outside a library path. Left alone: seven
gitignored screenshot/report dirs (~31 MB total, some look like design reference), and
`codebase-analysis` (tracked).

Worth a decision rather than a periodic `rm`: both apps are `private` and never
published, so caching ~110 MB of `.output` per build to save a couple of minutes is a
poor trade. Either drop `apps/*` from cached build outputs or schedule a prune. Detail
in the report under L-11.

## Gate runs: read the exit code, not the summary

Two consecutive full-gate runs failed, and **neither was a real test failure**:

- once exit **143** (SIGTERM — the layer suite killed by contention)
- once exit **1** — three files timing out (`Hook timed out in 60000ms`,
  `Test timed out in 5000ms`), with `@commonpub/server:test` pulling a schema
  concurrently

Run alone, the layer suite is **202 files, 2,945 tests, exit 0** — verified twice.
And the **whole suite is green at `--concurrency=2`**:

```
pnpm turbo run typecheck lint test --force --concurrency=2
  Tasks: 68 successful, 68 total · 0 cached · 12m9s
  7,898 tests across 520 test files · zero failure markers in 8,374 log lines
```

So the two earlier failures were contention, proven by the same suite passing at a
lower fan-out. This reproduces the hazard `ci.yml:71-77` documents in its own comment,
at the same `--concurrency=50%` CI uses. Recorded as L-12; those three suites want a
higher timeout or serial execution.

## The release — SHIPPED 2026-08-27

Reversing the call recorded earlier the same day. That earlier entry said "do not ship
today", on the reasoning that "ensure no degradation" cannot be honoured on an instance
whose health check can neither pass nor fail. Told to check how this is normally done
and ship once certain it was safe, the answer was to **make the unverifiable step
verifiable first**, then ship. Both happened. All three instances are live and were
verified behaviourally, not by deploy colour.

**Published, in dependency order** (the graph is `explainer → learning → server → layer`;
my first note said `explainer → server → layer`, which is wrong — `learning` sits in
between and its exact pin would have dangled):

| package | version | why it moved |
| --- | --- | --- |
| `@commonpub/explainer` | **0.9.0** | the fix, plus two new exports (`isSafeUrl`, `decodeForSchemeCheck`) — a minor, not a patch |
| `@commonpub/learning` | **0.5.4** | exact-pin cascade only |
| `@commonpub/server` | **2.133.2** | exact-pin cascade only |
| `@commonpub/layer` | **0.137.4** | pool listener + `escapeXml`, plus the cascade |

`0.137.4-rc.1` is still on the `next` tag. It was the verification vehicle, not a
mistake; leaving it costs nothing and documents the gate.

### The gate that made this safe

Memory says the fork's CI is the only thing that typechecks the *published* `.d.ts`
surface, and that a prerelease tag is how you find that out without moving `latest`.
Followed literally:

1. Published everything to **`--tag next`** first, so `latest` did not move.
2. Opened deveco **PR #32** pinned to `0.137.4-rc.1`. Its `Build & Typecheck` passed
   (2m54s) against the real published tarballs.
3. Only then promoted the four packages to `latest`, and opened the real pin bumps.

PR #32 was closed after it served its purpose. Had it failed, `latest` would never have
moved and no fork would have seen a broken layer.

### Order shipped, and what each was verified by

1. **commonpub.io** — merged `81712f9b`, then `36e341cb` for the version bumps. Deploy
   success. Verified: health `ok/ok`, all four XML routes 200 and parse as XML.
2. **deveco.io** — PR #33 → `84cb0753`. CI green, deploy success. Verified below.
3. **heatsync** — PR #37 → `f165b291`. It has **no CI at all**, so merging is deploying;
   sequenced last, after deveco had already proven the same layer version in production.
   Deploy success, then re-verified: health `ok/ok`, `/feed.xml`, `/sitemap.xml`,
   `/api/users/moheeb/feed.xml`, `/api/hubs/sewing-group/feed.xml` all 200 and parse.

**A correction on that last one.** I first reported heatsync's four routes green while
its deploy was still `in_progress` — that check hit the *old* container and proved
nothing about the new build. The numbers above are the re-run after the swap completed.

Both forks needed **both** lockfiles bumped, per memory: `package-lock.json` (what the
Dockerfile builds from) and `pnpm-lock.yaml` (what CI frozen-installs). A third
correction: that memory said deveco's `package-lock.json` was gitignored. It is
**tracked**. Following the stale note would have left CI verifying one dependency tree
while the image built another — exactly P1-15. The memory file is fixed.

### What is now true that was not

The three production-reachable defects from `docs/reviews/2026-08-23-full-audit.md` are
live-fixed on all three instances:

- the stored XSS in `section.module`, which any registered user could reach;
- the Postgres pool with no `'error'` listener, which turned a failover into a crashed
  Nitro process;
- the three RSS routes emitting C0 characters that feed readers reject.

**Not fixed, and still true:** deveco's post-deploy health check still runs on the host
against a port the container only `expose`s, still ends in `|| echo ::warning::`, and
its deploy script still lacks `set -o pipefail` (P1-10, P1-11). This roll worked around
that by verifying deveco by hand from outside. The next one should not have to.

## deveco.io copy change (separate from the audit)

`deveco-io/layouts/default.vue:94` — the thin top banner now reads:

> Supported by **EDGE AI FOUNDATION** · Part of the Internet of Communities™

Restored from `5e84220`, which is where the markup came from originally (that is also
why the orphaned `.de-top-banner strong` rule at line 259 existed — it had nothing to
style until now). Wording changed from the original "Backed by" to "Supported by" at
the operator's instruction.

Verified against the live page's real CSS at 320/360/375/390/1440px:

```
banner height 33px -> 50px on mobile (wraps to two lines), 33px at desktop
page scrollWidth UNCHANGED at every width (372/320, 373/360, 375/375, 390/390)
banner itself does not overflow
link contrast 5.89:1 on rgb(0,78,83) — PASSES 4.5:1
```

So it does not worsen the ≤374px horizontal overflow recorded as P2-4, which comes
from `.de-topbar-actions` in the row below.

**Worth knowing before this ships.** Two commits deliberately removed this mention:
`9a35516` ("EDGE AI FOUNDATION is a scholarship partner, not the platform's subject")
and `7eb9d7b` ("the platform is described by what it is for, not by a partner"). The
banner at the time said "Partnered with"; the footer's "Backed by" was changed in the
same commit to "**EDGE AI FOUNDATION** Scholarship Partner", which is what
`layouts/default.vue:210`, `README.md:5` and `pages/about.vue:17` still say.
"Supported by" sits compatibly with "Scholarship Partner" in a way "Backed by" did
not, so the wording change resolves most of that tension — but the banner and the
footer now describe the same relationship in two different words, and that is a
deliberate call rather than an oversight.

**Live** as of 2026-08-27, in `84cb0753` (PR #33), which also carried the
`0.137.4` pin bump. Confirmed on the production page by its real Vue scope attribute
(`data-v-ee83d523`), not by an injected fragment — an earlier contrast measurement in
this same session was wrong precisely because injected HTML loses that scope and picks
up browser-default link colour.

**It is not independently revertable.** I said in the PR that the banner would land as
its own commit so it could be backed out without touching the layer pin. deveco squashes
on merge, per repo convention, so it did not. Reverting the banner is a one-line edit to
`layouts/default.vue:94`, not a `git revert`.

## What the local run left on your machine

Nothing was deleted and nothing existing was modified. Created, for you to remove
whenever you like:

- Postgres databases `cpub_audit_0825` and `cpub_audit_push` on the dev instance at
  :5433. The first now holds the audit's test data (4 users, several projects, a hub,
  a contest, a conversation, two explainers). Drop with
  `DROP DATABASE cpub_audit_0825; DROP DATABASE cpub_audit_push;`
- `apps/reference/.output` was rebuilt by `pnpm build`. The local server I ran on
  :3100 has been stopped.
- `.turbo/cache` was removed (20 GB) — the next turbo run rebuilds instead of
  restoring, so expect one slow build.

**Not touched:** the default dev database, the two pre-existing `nuxt dev --port 3001`
servers from an earlier session (they are still running and still sharing
`apps/reference/.nuxt`, which is what caused a mid-run restart — worth cleaning up), and
all three live instances.

## What I did not check

No authenticated flows on production; no writes to any instance; the
`profileVisibility != 'public'` path could not be exercised because no such row
exists anywhere; the 49 migrations were not replayed; `.vue` linting could not be run
because the plugin is not installed; the 79 `useLazyFetch` sites were counted but not
classified; contrast was measured on homepages in two themes, not every page in all
seven.
