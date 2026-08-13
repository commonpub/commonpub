# Session 255: Persona customization, sharing consent, and audience analytics

**Date:** 2026-08-12
**Outcome:** Plan, two audits, and a built v1. Not yet rolled.
**Plan:** `docs/plans/persona-customization-and-audience-analytics.md` (2130 lines, sections 0-14)

## Part 1: the plan

A 14-agent research and design pass over the profile, form-engine, consent, analytics, config and
onboarding subsystems, then three competing architectures, two independent judges, an adversarial
critique and a revision. Both judges independently picked the consent-first architecture.

## Part 2: two audits

**Appendix A** records the disposition of all 31 findings from the first critique.

**Appendix B** is a second pass that found 16 more, five of which changed what got built: a
`column: 'website'` binding that would have written nowhere, a purpose-limitation mechanism with no
field property to key on, consent copy that hid the `profile_visibility` exclusion, a settings back
door closed for `persona.` but left open for `dataSharing.`, and the plan's own "declare twice"
violation in its k-anonymity floors.

## Part 3: section 14, the isolation rewrite

The plan as designed reached into eight live subsystems. The decisive observation: **persona shares
almost nothing behavioural with the contest form engine.** It has no `required`, no `pii`, never calls
`isFormFieldPii`, has its own renderer, and section 8.2 had already concluded it cannot reuse
`FormTemplateEditor`. Moving `FormField` and the URL validators out of `packages/schema` to serve that
was a large refactor of a live system in exchange for cosmetic unity.

Verified constraints that decided the boundaries:

| Fact | Consequence |
|---|---|
| `packages/schema/drizzle.config.ts` is `schema: './src/*.ts'`, non-recursive | tables MUST be `packages/schema/src/persona.ts` |
| No feature package owns a `pgTable`; all 20 domains are one file each in schema | tables in schema is the house pattern |
| `packages/server/src/` is domain directories | logic goes in `packages/server/src/persona/` |
| `@commonpub/theme-studio` is a pure-TS brain package | the precedent `@commonpub/persona` follows |
| `runDailyRollup` is a hardcoded body with no pass registry | persona must not edit it |

**What v1 deliberately does not touch** (section 14.4): the contest form engine, `FormTemplateEditor`,
the URL validators, `fnv1a32` in the cookie composable, `user_consents`, `api_keys`, the
`socialLinks` cutover, `metrics_daily`, and Phase 0's profile privacy fixes (which ship separately).

Result: **migration 0046 creates four tables and alters nothing.** A purely additive migration cannot
break an existing reader.

## Part 4: the build

12 agents with strict file ownership, then one verify agent. All gates independently re-run and
confirmed:

| Gate | Result |
|---|---|
| `pnpm typecheck` | 30/30 tasks, zero errors |
| `pnpm test` | 35/35 tasks, ~6800 tests, zero failures |
| `pnpm lint` | 29/29, 0 errors (82 pre-existing warnings) |
| Migration 0046 | 4 CREATE TABLE, 7 indexes, 3 FKs on its own tables, zero ALTERs on existing tables |
| Isolation | every forbidden file untouched |

Shipped: `@commonpub/persona` (23 files, 126 tests, zod-only), four tables, three flags,
`packages/server/src/persona/` (registry with drift reconciler, values, consent, k-anonymous metrics),
13 routes, `/settings/persona`, `/settings/privacy`, `/admin/persona`, the invitation banner, DSAR
sections, and `read:audience` with wildcard protection.

## Decisions made

- **Persona is a package, not an extension of the contest engine.** Requirement 3 ("not a disparate
  system") is satisfied by following the house architecture, not by merging two type unions.
- **`persona_metrics_daily` instead of `metrics_daily`.** An own table means the `/metrics/timeseries`
  back door never exists and `runDailyRollup`'s body is never edited.
- **Sharing consent lives only in `user_purpose_consents`.** The planned `user_consents` audit row
  bought nothing the new table did not already have and cost an ALTER on a live GDPR table.
- **Link fields bridge to the existing seven `socialLinks` keys.** The normalization existed for query
  speed, which a once-a-day rollup makes moot.
- **Quantisation floors rather than rounds** (Appendix B8), so a published count never overstates.
- **First run is an offer, not a gate and not a signup step**, with a terminal second dismissal.

## The one exception to the isolation rule (section 14.9)

Post-build verification caught that `cpub-persona-invite-dismissed` shipped with no `BUILTIN_COOKIES`
entry, because that file was on the do-not-touch list. A privacy feature was shipping an undisclosed
cookie. Fixed with one `essential` entry, 17 lines, no logic. `currentScope` digests non-essential
cookies only, so it provably cannot move the consent digest; all 174 layer test files and the pinned
digest assertions still pass. The isolation test now pins the exception rather than banning the word,
and both halves were mutation-tested.

General rule recorded: **an isolation boundary protects a mechanism, not a vocabulary.**

## Open

1. **`profile_analytics` is the only offerable toggle.** `recruiter_visibility` and `sponsor_sharing`
   are registered with full copy but not offered, because no member-level read surface exists and
   consent for an unactionable purpose fails Art 4(11). Named deviation from the literal ask; needs
   the operator to confirm or override.
2. **Nothing has run against real Postgres.** Integration tests use PGlite; 0046 has never been
   applied to a live database.
3. **No browser, no Playwright, no axe run.** The 390px chip-tappability check is exactly what jsdom
   cannot answer.
4. Not built: `validatePersonaRegistry` key-lock-on-read, the markdown DSL, `completeness: 'points'`,
   the cross-device dismissal record, `/api/admin/data-sharing/recipients`.

## Next steps

1. Operator reviews section 14 and the open question above.
2. Apply 0046 to a real Postgres and run the integration suite against it.
3. Browser pass at 390px per the memory rule: dist rebuild plus dev server restart first, because
   `@commonpub/persona`, `config`, `schema` and `server` all run from `dist`.
4. Roll: publish `@commonpub/persona`, then config, schema, server, ui, then the layer. Bump the
   fork's DIRECT `@commonpub/schema` pin or `db-migrate` silently skips 0046.
