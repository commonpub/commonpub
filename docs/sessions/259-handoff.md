# Session 259 — contest announcements, the email rendering fix, and one PR still open

Full detail: `docs/sessions/259-contest-announcements.md`.
Plan: `docs/plans/contest-announcements.md`. Previous: `docs/sessions/258-handoff.md`.

## Read this first

**Two rolls shipped and are live. A third change is built, green and NOT rolled.**

1. **Contest announcements** — an organizer composes a one-off email and sends it to a
   contest audience. Rolled.
2. **The email rendering fix** — which the first roll's review uncovered, and which was a
   LIVE defect rather than a cosmetic one. Rolled.
3. **Hand-picked individuals as an audience** — **PR #92, open, CI fully green, merged
   nowhere.** See "The open PR" below before doing anything else with it.

**`contestBroadcast` is now ON on deveco.io** (the operator enabled it after the roll), so
the Announcements tab is live there and deveco can send real mail to real registrants
today. That is a deliberate operator choice, not drift — but it does mean deveco is no
longer a dormant instance for this feature. Re-check with `curl /api/features` before
trusting any flag claim; it changes out of band.

## State at handoff (2026-09-13)

**Published (all match `main`):** schema **0.67.0** · config **0.41.0** · infra **0.23.0** ·
protocol **0.15.4** · auth **0.13.4** · editor **0.17.3** · explainer **0.9.2** ·
learning **0.5.6** · server **2.136.0** · test-utils **0.5.18** · layer **0.138.1**.
Unchanged: ui 0.16.1, docs 0.6.3, persona 0.2.1, theme-studio 0.7.0.

**Live**, verified by request:

| instance | flags | contestBroadcast | emailNotifications | can send? |
| --- | --- | --- | --- | --- |
| commonpub.io | 48 | false | false | tab hidden |
| **deveco.io** | 48 | **true** | **true** | **yes, right now** |
| heatsynclabs.io | 48 | false | false | tab hidden |

Migrations through **0049** everywhere. Both forks pin `^0.138.1` / `^2.136.0`.

Suites: server 2204, layer 3020, schema 604, infra 210, config 39, editor 267, ui 272,
protocol 431, auth 98. Build 17/17, typecheck 30/30, lint 0 errors.

## Three tabs, and why that cost an hour

This is the single most useful thing to know before touching contest email again. There are
**three** different surfaces and they are easy to confuse:

| where | what it does | when |
| --- | --- | --- |
| contest editor → **Emails** | edits the *copy* of the two AUTOMATIC emails (registration confirmation, deadline reminder). Sends nothing on demand. | session 232 |
| contest editor → **Announcements** | composes and sends a ONE-OFF to a contest audience | session 259 |
| **`/admin/broadcast`** | one-off to everyone on the instance, by role, or hand-picked | pre-existing |

The operator went looking for the one-off sender, found the **Emails** tab, and reasonably
concluded the feature did not exist — the Announcements tab was invisible because the flag
was off. If someone says "I only see registration and deadline", they are on the Emails tab.

**`/admin/broadcast` is plain text only.** Its body is a `<textarea>` validated as
`bodyText` and rendered as escaped paragraphs plus an optional CTA. None of the block
editor, tokens, or rich formatting reached it — all of that landed on the contest path. It
also has **no idempotency key**, so a double-clicked admin blast mails everyone twice.
Both are known and deliberately unfixed.

## The open PR (#92) — read before merging

Adds **"Specific people"** as a fourth audience, so an organizer can mail named individuals
rather than only whole tiers. CI is green on all three jobs and it is `MERGEABLE`.

**It is not a small roll.** It changes `@commonpub/schema`, and every package pinning schema
must republish because `workspace:*` publishes as an EXACT pin:

```
schema 0.67.0 -> 0.68.0     server 2.136.0 -> 2.137.0   layer 0.138.1 -> 0.139.0
auth 0.13.4 -> 0.13.5       editor 0.17.3 -> 0.17.4     explainer 0.9.2 -> 0.9.3
learning 0.5.6 -> 0.5.7     test-utils 0.5.18 -> 0.5.19
```

Eight packages, and **both forks need hand-edited pins**: `^0.138.1` cannot reach `0.139.0`
and `^0.67.0` cannot reach `0.68.0`, because a caret on a 0.x version does not cross a
minor. `^2.136.0` does reach `2.137.0`. A dry-run bump script is in the session scratch.

**The security property to preserve if you touch it:** the organizer's people-picker calls
`searchUsers`, which searches the WHOLE INSTANCE. The picked ids are intersected
server-side with everyone connected to that contest (registrant, entrant, judge,
stakeholder). Without that intersect a contest organizer could mail any member. That
intersect is mutation-tested; so are the verified, soft-delete, global-unsubscribe and
per-contest-opt-out gates.

Verified in a browser before it was parked: three registrants, two picked, send reported 2
recipients, and exactly those two rows appear in `email_outbox`.

## The email defect, because it was live and invisible

`renderEmailBlocks` reduced every html-bearing block to its bare text:

| authored | delivered |
| --- | --- |
| `<a href="https://x/rules">rules</a>` | `rules` — href gone from BOTH MIME parts |
| `<ul><li>A laptop</li><li>A power strip</li></ul>` | `A laptopA power strip` |
| `Line one<br>Line two` | `Line oneLine two` |
| `Deadline is <s>Friday</s> Monday` | `Deadline is Friday Monday` |

The last row inverts meaning rather than losing a style. "Questions? Email the organizers"
arrived with the address nowhere in the message, in either part. The editor rendered all of
it correctly while the preview and the send dropped it, so nothing told the author.

It was sending: `emailCopy.ts` shares the renderer, and `contestEmailEditor` +
`contestReminders` are both ON on deveco with a live Resend transport.

Fixed by parsing with **linkedom** (already a direct dependency) and emitting a CLOSED
output vocabulary — nothing is copied from the input except text, which is escaped. That is
stronger than sanitize-and-pass-through: there is no filter to defeat.

The shell is also now **light**. All three instances render light sites while every template
used a near-black shell, and the block styles assumed a light page — the callout measured
**1.24:1**, text you could not read.

## Things that will bite the next person

**A satisfied caret is never upgraded on its own.** Both forks pinned `^0.138.0`, which
`0.138.0` already satisfies, so neither `npm update` nor `pnpm update` moved. The lockfile
refresh looked like it worked and changed nothing — a no-op PR nearly shipped. Raise the
floor, which also documents the minimum version carrying the fix.

**`workspace:*` publishes as an EXACT pin.** The announcement roll moved ELEVEN packages for
one feature. The email roll moved three, because schema and config were untouched. Check the
fork lockfile for duplicate versions before merging.

**npm "staged" is not "published".** `protocol@0.15.4` and `layer@0.138.0` both reported
`+ pkg@version` and were then absent for minutes. Re-publishing returns `E409 Cannot publish
over previously staged version`, which is how you tell staged from failed. Separately, npm
resolves against the **abbreviated** packument, which lags the full one — `npm install` kept
failing `ETARGET` while a direct registry read showed the version. Do not filter publish
output through grep; it hid the first symptom.

**A guard can be vacuous and still green.** Four were, this session, each caught only by
mutation testing: a claim-first test that passed with the fix reverted; a contrast test that
asserted source constants, so four mutants reverting the shell to dark survived; security
tests that missed the inline drop-list and href escaping; and a `<li>` probe regex that
could never match `<li style="...">`. Revert your fix and watch the test fail, or you do not
have a guard.

## Next, in order

1. **Decide on PR #92.** It is green and ready; the cost is an eight-package roll plus
   hand-edited fork pins. Merging it is the only way "send to one person" becomes a real
   message rather than a `[TEST]`-prefixed one.
2. **Before any large send on deveco:** it has a live transport and real registrants, the
   send is immediate and not undoable, and there is no scheduling. Send a test to the
   operator's own address first. The bound is 5 announcements per contest per 24h, and a
   double-click cannot double-send.
3. **Give `/admin/broadcast` the block editor and an idempotency key.** It is the only
   instance-wide sender and it is plain text, with a double-click hazard.
4. **Per-instance email colours.** `emailBranding` carries an accent, header, logo and
   footer text, and nothing about background or foreground. The light shell matches all
   three instances today, but it is a default, not a theme.
5. **`@commonpub/docs@0.6.3` pins `schema@0.16.0` + `config@0.12.0`.** Its workspace
   package.json declares no `@commonpub` deps, but the published tarball predates that, so
   every consumer tree carries two copies of schema and two of config. Verified
   pre-existing. Republish docs from current source, ALONE.
6. **Deferred from the announcement plan, not cancelled:** the per-contest opt-out (the
   `email_opt_out_at` column ships in 0049 and the audience predicate already honours it,
   with a test, so no second migration), the in-app notification, send scheduling, and the
   remaining audiences (entrants, judges, stakeholders, stage cohorts) — the resolver is
   already id-set based so they drop in without touching the send path.
7. Still open from 258: rotate the crates.io publish token, `sharp` to >= 0.35.0, and make
   deveco's deploy able to fail (its post-deploy check is warn-only).
