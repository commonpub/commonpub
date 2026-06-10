# Session 197 — contest large-text hardening + crash-prevention

## Trigger

User created a contest, pasted a large HTML blob into the description, hit "validation
failed", then the site went slow, they got logged out, and the contest read "not found".
Asked to: deeply investigate how a large blob could crash/slow the server and prevent it,
remove the description cap to allow large descriptions, fix the broken Edit button, check
tests, update codebase analysis.

## Investigation — what actually happened

- **No data loss.** A freshly-created contest is `draft`, and `canViewContest` 404s drafts
  for anyone who isn't owner/admin/stakeholder/judge. Once the user was logged out, their
  own draft 404'd ("contest not found"). Direct-URL load (SSR, still authed) showed it.
- **"Validation failed" on HTML** was NOT an HTML-rejection rule — the schema accepts HTML.
  It was either the old 10k length cap on a large paste, or a different field. The contest
  write path has no body-scanning/HTML-blocking middleware.
- **The slow/crash** is two synchronous, event-loop-blocking steps independent of the Zod cap:
  1. `parseBody` `readBody`s + `JSON.parse`s the whole body before `safeParse` — no size limit
     existed on JSON API writes (only the federation inbox had its own 413).
  2. Contest description renders through `CpubMarkdown` → `markdownToBlockTuples` inside a Vue
     `computed` = synchronous SSR parse on every page view, and the parser built a fresh
     `unified()` processor **per block node** (O(N) construction).
- **The logout** was `useAuth().refreshSession()` clearing auth on ANY thrown `/api/me`
  (a slow/5xx/timeout), not just a genuine logged-out response.
- **The Edit button** uses `useLazyFetch`; on client-side nav `data` is null while pending, so
  the edit page's `v-else` flashed/stuck on "Contest not found" (works on direct URL = SSR).

## Changes

| File | Change |
|------|--------|
| `packages/schema/src/validators.ts` | `CONTEST_RICH_TEXT_MAX = 50_000`; description/rules/prizesDescription 10k → 50k (create + update) |
| `layers/base/server/utils/validate.ts` | `parseBody` rejects 413 on `Content-Length` > `MAX_JSON_BODY_BYTES` (10MB) before `readBody`. Generous on purpose: `content` is `z.unknown()` (unbounded) so a tight cap would reject real large saves; 10MB only kills catastrophic bodies |
| `packages/editor/src/markdown/parser.ts` | Shared frozen `unified` processors (`treeToHtml`); `MAX_MARKDOWN_LENGTH` (100k) backstop → plain text |
| `layers/base/composables/useAuth.ts` | `refreshSession` keeps auth state on a thrown `/api/me` (only a successful null logs out) |
| `layers/base/pages/contests/[slug]/edit.vue` | `status`-gated loading state vs not-found; `maxlength="50000"` on textareas |
| `layers/base/pages/contests/create.vue` | `maxlength="50000"` on description/rules/prizes textareas |
| Tests | parser oversize-guard + many-node cases; schema 50k boundary; new `parseBody-size-limit.test.ts` |
| `codebase-analysis/09-gotchas-and-invariants.md` | 4 new entries (ingest+render bounds, refreshSession, lazy-fetch not-found flash) |

## Verification

- editor 234 ✓ · schema 457 ✓ · layer 993 ✓ (incl. new guard test) · reference `nuxt typecheck` EXIT=0.
- Parser refactor proven output-identical by the 24 pre-existing parser tests.

## Decisions

- Cap **raised, not removed.** Unbounded free text is the exact ingest+render DoS the incident
  was about; 50k (~16 pages) is "large" while staying inside the 1MB ingest envelope and 100k
  render backstop. Can raise further on request, with the tradeoff noted.

## Open / next

- **Release not done.** Changes span published packages: `@commonpub/schema` + `@commonpub/editor`
  must publish, then `@commonpub/layer` bump its pins, then deploy all 3. (CLI/consumers as needed.)
- Deeper option deferred: the per-node parse still does one `treeToHtml` per block; fine now with
  shared processors, but a single whole-tree pass is possible if profiling ever demands it.
