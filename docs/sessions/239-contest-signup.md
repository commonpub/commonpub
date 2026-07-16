# Session 239 — Two-tier contest signup + registration-link in contest editors

## What was done

### 1. Registration-link block in the contest body editors (rolled: layer 0.102)
`registrationLink` was already droppable in the email editor (M3, session 238) and
in article/project/explainer editors, but NOT in the contest **body** editors
(overview / rules / prizes). Added it to `contestBlockGroups` in `ContestEditor.vue`
(gated by `registrationBlock`, default ON) so it appears in both the persistent left
palette and the inline "Insert block" picker across all three body tabs. Layer-only
change. Visually verified. Rolled: layer 0.102, CLI 0.5.25, all 3 instances (36 flags).

### 2. Two-tier contest signup card (rolled: schema 0.59 / config 0.33 / server 2.110 / test-utils 0.5.13 / layer 0.103, migration 0042, CLI 0.5.26)

The contest page registration card (`ContestSidebar` → new `ContestSignup.vue`)
became the intended default registration experience, built to a DevRel/contest-expert
brief the user approved via AskUserQuestion (fields = "my 3, all optional"; scope = full):

- **Two tiers.** "Register for this contest" (a counted `full` participant) +
  "Just get reminders" (a lower-commitment `reminders` tier that is NOT counted as a
  participant but still receives deadline reminders). Reminders-only registrants get an
  "upgrade to full" CTA.
- **Optional info, zero friction.** One-click register never blocks. A post-register
  form (shown at the high-intent moment, auto-open for a fresh registrant with no info
  yet) collects **what you're building** (free text ≤280), **experience** (first / some /
  experienced), **team status** (solo / have / looking) — all optional. Persists +
  prefills; the organizer sees it in the registrant list.
- **Status-aware onboarding.** A "what's next" paragraph + milestone line set expectations
  per status (upcoming → "nothing to submit yet, plan + form a team, we'll email you when
  it opens"; active → "submit before the deadline"; judging → "results soon"; etc.).

**Data model:** `contest_registrations` += `tier` (text, default `'full'`, so every
pre-existing row stays a counted participant) + `fields` (jsonb) — migration **0042**
(additive, non-destructive). **Server:** `registerForContest` now upserts — a re-register
UPGRADES reminders→full (never downgrades) and updates `fields` only when a new object is
supplied (info edit persists; bare re-register keeps prior info); confirmation email only
on a genuine first insert. `getRegistrantCount` / `listContestRegistrants` are `full`-only;
new `getViewerRegistration` returns tier+fields. The reminder sweep serves BOTH tiers
(no tier filter) so reminders-only opt-ins get their nudges. **Flag:** `contestSignup`
(default ON; off ⇒ the simple single reminders opt-in fallback).

## Decisions
- Register is **logged-in only** (unchanged) and **one-click** — info is never required.
- The two info fields with best value-per-friction for a maker contest are intent
  ("what are you building"), experience, and team status. Anything heavier belongs in the
  submission, not registration.
- `contestSignup` default ON = the new card is the default everywhere; operators opt out.
- Migration is additive with safe defaults, so existing registrants become `tier='full'`
  (correct — they were all counted).

## Adversarial audit + fixes (rolled: server 2.111 / layer 0.104, CLI 0.5.27, NO migration)

A 5-lens ultracode adversarial audit (each finding independently verified by a refute-by-default
skeptic) raised 6, confirmed **5** (all P2/P3 after verification — **security lens clean**, no
P0/P1 survived), refuted 1 (textarea `maxlength` is standard). All 5 fixed:

1. **(P2) auto-register-on-entry didn't upgrade tier.** `entries.ts` + `submissions.ts` used
   `.onConflictDoNothing()` — a reminders-only opt-in who then submits an entry stayed `tier='reminders'`
   and was excluded from the (now full-only) count/list despite being a real entrant. → `onConflictDoUpdate`
   set `tier='full'` (preserves `fields`). Matches `registerForContest`'s own upgrade semantics.
2. **(P2) confirmation email wasn't tier-aware.** A reminders-only signup got a "You are now registered"
   participant email (contradicting its tier + the count). → extracted `sendParticipantConfirmation()`;
   fires ONLY when a user becomes a full participant (genuine full registration OR reminders→full upgrade),
   never for a reminders-only opt-in. Also closes the gap where an upgrading user previously got no email.
3. **(P3) info form offered on closed contests** where Save 400s. → gated `v-if="isFull && canRegister"`.
4. **(P3) milestone "TODAY" on a stale-status contest** (past startDate still `upcoming`). → suppress the
   countdown hint when the day count is negative (`dStart >= 0`); the date itself still shows.
5. **(P3) hint/optional copy failed WCAG AA** (`--text-faint` ~2.5:1). → `--text-dim` (~5.5:1).

Tests added: tier-aware confirmation (reminders→no email; upgrade→exactly one email; full re-register→no
double-send) + a reminders row upgraded to full when the user submits an entry. Server 89 tests green;
nuxt typecheck clean; milestone + contrast fixes visually re-verified (screenshot `50`). Note: the tier-aware
closure tripped the vue-tsc-strict-vs-vitest gap (TS widens a captured `contest` inside a nested function) —
bound a narrowed `const contestRow = contest` before the closure.

## Open questions / next
- Contest Signup **widget** as a droppable block (vs. the built-in sidebar card) — not built.
- resend-verification + verify-reminder UX (still the prerequisite before
  `requireEmailVerification` can be enabled on deveco — see session 237/238 landmine).

## Roll landmines (reconfirmed)
- All four 0.x packages crossed a minor (schema 0.58→0.59, config 0.32→0.33,
  layer 0.102→0.103, test-utils 0.5.12→0.5.13) ⇒ caret pins do NOT auto-cross;
  CLI (`template.rs`+`cli.rs`) + BOTH forks hand-edited + lockfiles regenerated.
  server 2.109→2.110 is within 2.x so `^2.109` would satisfy it, but bumped for clarity.
- Migration reaches prod via the schema npm package's shipped `migrations/` +
  `scripts/db-migrate.mjs` run by every deploy (fails the deploy on error).
- Local `nuxt dev`: `networkidle` never settles (SSE/federation workers) — Playwright
  navigations must use `domcontentloaded`.
