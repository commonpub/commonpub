# Plan — Contest Announcements (organizer "message participants")

> Created 2026-09-12 (session 259). Supersedes the sketch at
> `docs/plans/contest-communications.md` §4b ("Organizer message entrants"), which named the
> flag `contestBroadcast` and a `contest.message` permission. This plan keeps the flag name and
> **drops** the new permission (see §4.2).
>
> **The ask:** a contest organizer composes an arbitrary email and sends it to that contest's
> participants, with templating, from inside the contest editor.

## 1. What already exists (verified in the tree, 2026-09-12)

Almost every part of this feature is already built for a neighbouring purpose. This is a
composition job, not a greenfield one.

| Piece | Where | Reusable as-is |
| --- | --- | --- |
| Durable outbox: enqueue, chunk, throttle, retry/backoff, dead-letter, deferred `scheduledAt` | `packages/server/src/comms/outbox.ts` | yes |
| Outbox drain worker (10 min interval, flag-gated) | `layers/base/server/plugins/email-outbox.ts` | yes |
| Block body to email-safe HTML + text, `{token}` interpolation, URL absolutization, http(s)-only, escape-once | `packages/server/src/emailBlocks.ts` (`renderEmailBlocks`) | yes |
| Email render kernel: `wrapTemplate`, `button`, `escapeHtml`, unsubscribe + footer chrome | `packages/infra/src/email/render.ts` | yes |
| Instance email branding (accent, logo, header, footer) | `packages/server/src/comms/branding.ts` | yes |
| Per-recipient one-click unsubscribe (RFC 8058 POST + RFC 2369 URL) | `packages/server/src/comms/unsubscribe.ts` | yes |
| Global mailability gate (`emailVerified`, `status='active'`, `deletedAt IS NULL`, `unsubscribedAll`) | `emailPrefs.ts` + `broadcast.ts:audienceWhere` | yes |
| Claim-first exactly-once ledger idiom (`INSERT ... ON CONFLICT DO NOTHING RETURNING` inside a tx) | `packages/server/src/contest/reminders.ts:196` | pattern |
| Admin blast: audience, recipient count, audit row, history list | `packages/server/src/comms/broadcast.ts` + `layers/base/pages/admin/broadcast.vue` | pattern |
| Organizer email composer: block palette restricted to email-safe types, debounced server preview in a sandboxed iframe, token chips | `layers/base/components/contest/ContestEmailEditor.vue` | extract + reuse |
| Organizer-gated contest email routes (preview + test-send) | `layers/base/server/api/contests/[slug]/email-preview.post.ts`, `email-test.post.ts` | pattern |
| Organizer gate | `ownerOrPermission(event, contest.createdById, 'contest.manage') \|\| isContestEditor(db, contest.id, user.id)` | yes |
| Contest editor body-tab slot mechanism (`stages`, `registration`, `emails` are form tabs) | `ContestEditor.vue:100`, `ContestBodyCanvas.vue` | yes |

**What is genuinely missing:** a contest-scoped audience resolver, an announcement record +
per-recipient ledger, a send route, an announcement email template, and the compose UI.

## 2. Definition of done

An organizer opens their contest, goes to **Emails to Announcements**, picks an audience, sees a
live recipient count, composes subject + a block body with `{tokens}`, previews it as a real
recipient would see it, sends a test to themselves, then sends. Every eligible participant gets
exactly one email, rendered per-recipient, carrying a working one-click unsubscribe. The send is
recorded, shows in a history list, and cannot be double-sent by a double-click or a retry.
Verified with a local app run and a real enqueue asserted against Postgres, not only green units.

## 3. The state that makes this high-stakes

**deveco.io delivers real mail today.** Verified 2026-09-12:

- `curl https://deveco.io/api/features` : `emailNotifications: true`, `contests: true`,
  `contestReminders: true`, `contestEmailEditor: true`, `adminBroadcast: true`. 47 flags.
- The deveco fork sets a real transport: `deploy-prod.yml:54-57` writes
  `NUXT_EMAIL_ADAPTER=resend` + `NUXT_RESEND_API_KEY` + `NUXT_RESEND_FROM=noreply@deveco.io`
  into the box `.env` from a CI secret. `gh secret list` shows `NUXT_RESEND_API_KEY` present
  since 2026-07-15.

**This contradicts memory `project_email_flag_state_2026_07`, which still says "console sink".**
It is not a console sink any more. A send on deveco reaches real inboxes.

commonpub.io and heatsynclabs.io have `emailNotifications: false`, so their outbox worker
returns immediately (`email-outbox.ts:24`) and anything enqueued there sits forever. See §4.7.

## 4. Design

### 4.1 Flag

`contestBroadcast: z.boolean().default(false)` in `packages/config/src/schema.ts` (+ `types.ts`,
`useFeatures.ts`, the layer default map). Ships OFF everywhere, including deveco.

Do not add a literal upper bound anywhere the flag count is validated: the admin features PUT
must derive its bound from the enumerated flag set (memory `feedback_cap_smaller_than_its_domain`;
this takes the count from 47 to 48).

### 4.2 Authorization: reuse the organizer gate, do NOT add `contest.message`

`docs/plans/contest-communications.md` §4b proposed a contest-scoped `contest.message`
permission. Drop it. The same people (owner, `contest.manage` holder, per-contest editor)
already control `contests.email_copy`, which is the copy of the reminder that mails **every**
registrant automatically on a schedule. The blast radius is already theirs; a second permission
key would add a schema change, role seeding and an admin surface while gating nothing new.

Use the exact expression the two existing contest email routes use:

```ts
const canManage =
  ownerOrPermission(event, contest.createdById, 'contest.manage')
  || (await isContestEditor(db, contest.id, user.id));
```

### 4.3 Audience

**v1 ships the `registrants` selector only.** It is modelled as a single `.strict()` object
rather than a union of one, so adding entrants/judges/stakeholders/stage/hand-picked later is a
purely additive change to a `z.union([...])` with no rewrite of the resolver's shape. The union
below is the target design, kept here so the later phases have somewhere to land.

```ts
// packages/schema/src/validators/contest.ts
export const contestAnnouncementSelectorSchema = z.union([
  z.object({ kind: z.literal('registrants'), tier: z.enum(['full', 'reminders', 'all']).default('all') }).strict(),
  z.object({ kind: z.literal('entrants'), submitted: z.boolean().optional() }).strict(),
  z.object({ kind: z.literal('judges') }).strict(),
  z.object({ kind: z.literal('stakeholders') }).strict(),
  z.object({ kind: z.literal('stage'), stageId: z.string().min(1), status: z.enum(['active','advanced','eliminated']).optional() }).strict(),
  z.object({ kind: z.literal('users'), userIds: z.array(z.string().uuid()).min(1).max(1000) }).strict(),
]);
export const contestAnnouncementAudienceSchema = z.array(contestAnnouncementSelectorSchema).min(1).max(6);
```

Source tables, all already present:

- `registrants` : `contest_registrations` (`tier` = `full` \| `reminders`; session 239's two-tier
  signup). `all` matches the reminder sweep, which applies no tier filter.
- `entrants` : `contest_entries`. `submitted: false` = the entry content is still the
  `placeholder=true` draft; `true` = a real developed entry. This is the ONLY
  submitted-vs-not signal that exists (`contest-communications.md` §"Audience reality").
- `judges` : `contest_judges`. `stakeholders` : `contest_stakeholders`.
- `stage` : per-entry stage status (`submissions.ts` / `stages.ts`).
- `users` : hand-picked, from the existing `user-search.get.ts` + `ContestRegistrantsPanel.vue`.

**The mailability gate is non-negotiable and identical to `broadcast.ts:audienceWhere`:**

```sql
u.status = 'active'
AND u.deleted_at IS NULL
AND (u.email_notifications ->> 'unsubscribedAll') IS DISTINCT FROM 'true'
AND (u.email_verified = true)            -- unless features.emailUnverified
AND cr.email_opt_out_at IS NULL          -- per-contest opt-out, see 4.5
```

Put this predicate in exactly ONE exported function used by both the count endpoint and the send
(memory `feedback_pii_partition_single_source_of_truth`, `feedback_shared_predicate_needs_every_caller_pinned`).
A count that disagrees with the send is a bug report waiting to happen.

### 4.4 Storage

Migration `0049` (latest is `0048_concerned_sasquatch.sql`), generated, never hand-written.

```ts
export const contestAnnouncements = pgTable('contest_announcements', {
  id: uuid('id').defaultRandom().primaryKey(),
  contestId: uuid('contest_id').notNull().references(() => contests.id, { onDelete: 'cascade' }),
  subject: text('subject').notNull(),
  bodyBlocks: jsonb('body_blocks').$type<BlockTuple[]>().notNull(),
  audience: jsonb('audience').$type<ContestAnnouncementAudience>().notNull(),
  recipientCount: integer('recipient_count').notNull().default(0),
  status: text('status').notNull().default('sent'),   // draft | scheduled | sent | failed
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  sentById: uuid('sent_by_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index('idx_contest_announcements_contest_created').on(t.contestId, desc(t.createdAt))]);

// Exactly-once ledger. Mirrors contest_reminder_sends.
export const contestAnnouncementSends = pgTable('contest_announcement_sends', {
  id: uuid('id').defaultRandom().primaryKey(),
  announcementId: uuid('announcement_id').notNull().references(() => contestAnnouncements.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  sentAt: timestamp('sent_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [unique('uq_contest_announcement_sends').on(t.announcementId, t.userId)]);
```

Plus one column for the per-contest opt-out (§4.5):

```ts
// contest_registrations
emailOptOutAt: timestamp('email_opt_out_at', { withTimezone: true }),
```

`broadcasts` has no ledger, so a double-clicked admin blast sends twice. Do not repeat that here:
contest audiences are real people who registered, and a scheduled send needs to be re-runnable.

### 4.5 Per-contest opt-out (recommended, small)

Today the only way to stop contest mail is `unsubscribedAll`, which also kills reminders,
notifications and digests across the whole instance. Someone who wants their deadline reminders
but not a chatty organizer has no move except to leave.

Add `contest_registrations.email_opt_out_at` and extend the unsubscribe surface with an optional
contest scope. `buildUnsubscribeLinks(siteUrl, userId, secret)` gains an optional
`{ contestId }`, folded into the signed token; `/unsubscribe` handles the scoped form by
stamping the column rather than `unsubscribedAll`. The announcement footer offers both:
"Stop emails about {contestTitle}" and the existing global link.

Announcements honour `email_opt_out_at`. **Reminders and the registration confirmation do not** :
those are transactional (the user entered the contest). Announcements are organizer-authored and
can be anything, so they get the narrower consent. Record the scope, do not assume it
(memory `feedback_consent_must_record_its_scope`).

### 4.6 Templating

Reuse `renderEmailBlocks` with an announcement token set. Tokens resolved per recipient:

| token | source |
| --- | --- |
| `{username}` | recipient |
| `{displayName}` | recipient, falls back to username |
| `{contestTitle}` `{contestUrl}` | contest |
| `{deadline}` | `formatDeadlineUtc(nextContestDeadline(contest, now).at)`, empty when past |
| `{timeRemaining}` | `humanizeTimeRemaining`, empty when past |
| `{siteName}` `{siteUrl}` | instance config |
| `{entryTitle}` | the recipient's entry title, `''` when they have none |

`{entryTitle}` is the one that needs a join; resolve it in the recipient query with a
`LEFT JOIN contest_entries`, never a per-recipient round trip.

**The subject must be tokenized too.** CORRECTION (audit): no new export is needed --
`interpolateTokens` already exists in `packages/infra/src/email/render.ts` and is what both
existing contest templates use. Pass it RAW token values: a subject is a plain-text header,
not HTML, so escaping there ships `Q&amp;A Jam` (see `feedback_escape_at_the_layer_that_needs_it`).
The header hazard is CR/LF, guarded in the validator and collapsed again at render.

**One token map, not four.** As built, the send, the preview and the test send all call
`announcementContext` + `announcementTokens` from `@commonpub/server`; the composer mirrors
only the NAMES in `layers/base/utils/contestEmailTokens.ts`, pinned by
`layers/base/__tests__/announcementTokenParity.test.ts`. The first cut hand-built the map in
all four places and had already drifted.

Block palette: exactly the types `renderEmailBlocks` renders, no more. Anything else renders in
the editor and is silently dropped from the sent mail
(`feedback_block_type_key_must_match_renderer`). Today that set is text/paragraph, heading,
blockquote, callout, image, horizontal_rule, registrationLink. `ContestEmailEditor.vue:70-89`
already declares it; **extract that array to a shared module** so the two editors cannot drift.

New template `emailTemplates.contestAnnouncement(...)` in `packages/infra/src/email/templates.ts`,
built on `wrapTemplate` + `button`, carrying: the contest name in the header band, the rendered
block body, a system "View contest" CTA, and both unsubscribe links. No organizer HTML reaches
the wire; the body arrives pre-rendered and escaped from `renderEmailBlocks`, the single choke point.

House rule: **no em dashes in any user-facing copy** (memory `feedback_no_em_dashes_in_copy`).

### 4.7 Send path

```
POST /api/contests/:slug/announcements/recipients   -> { count }        (no PII, count only)
POST /api/contests/:slug/announcements/preview      -> { html, subject } (sandboxed iframe)
POST /api/contests/:slug/announcements/test         -> { sent, to }      (mirrors email-test.post.ts)
POST /api/contests/:slug/announcements              -> { id, recipientCount }
GET  /api/contests/:slug/announcements              -> history
```

All five: `requireFeature('contests')` + `requireFeature('contestBroadcast')` + `requireAuth` +
the §4.2 organizer gate.

**The send route additionally requires `emailNotifications`.** On an instance where it is off the
drain worker returns immediately, so enqueueing produces a row nobody will ever deliver and a UI
that says "sent". Refuse with a clear message ("Email delivery is off on this instance; ask an
operator to enable it") rather than queueing into a void. Silent success is the failure mode this
repo has been bitten by repeatedly (`feedback_deploy_verify_behaviour_not_presence`).

Send algorithm, in `packages/server/src/contest/announcements.ts`:

1. Insert the `contest_announcements` row with `status='sending'`.
2. In ONE transaction, claim-first:
   `INSERT INTO contest_announcement_sends (announcement_id, user_id) SELECT DISTINCT ... ON CONFLICT DO NOTHING RETURNING user_id`,
   joined back to `users` for email/username/displayName and to `contest_entries` for `{entryTitle}`.
3. Render per recipient, `enqueueEmails` in chunks of 500 inside the same transaction, so a
   failed enqueue rolls the claim back and the send is retryable (exactly the reasoning in
   `reminders.ts:186-193`).
4. Update `recipient_count`, `sent_at`, `status='sent'`.

`OutboxMessage.category` gains `'announcement'`.

**Scheduling comes free.** `OutboxMessage.scheduledAt` already defers delivery, so "send at a
time" needs no new worker: enqueue now with `scheduledAt`. The audience is frozen at compose
time. That is a defensible behaviour (the recipient count the organizer approved is the count
that gets mailed) but it must be stated in the UI, because people who register after composing
will not receive it.

### 4.8 In-app notification alongside the email

`emailNotifications` is OFF on two of three instances, so an email-only feature does nothing on
commonpub.io and heatsynclabs.io. Emit `createNotification({ type: 'contest', ... })` to every
audience member as well, always, regardless of the email flag.

Watch the dedup collision: contest notifications collide on
`UNIQUE(userId, type, actorId, link)` and overwrite each other
(`contest-communications.md` §1a). Discriminate the link per announcement:
`/contests/{slug}?a={announcementId}`.

### 4.9 Guardrails

1. **Header injection.** `subject: z.string().trim().min(1).max(200).regex(/^[^\r\n]+$/)`.
   `broadcastInputSchema` has the same gap today (see §7).
2. **Rate limit.** Cap sends per contest per rolling 24h. Derive nothing from a literal that can
   be outgrown (`feedback_cap_smaller_than_its_domain`); a count query against
   `contest_announcements` with a named constant is fine, a hardcoded recipient ceiling is not.
3. **No recipient PII to the organizer.** The recipients endpoint returns a count. Addresses stay
   server side, exactly as `email-test.post.ts` resolves a `toUserId` without echoing the address.
   The existing `contest.pii` boundary is untouched.
4. **Absolute URLs.** Pass `siteUrl` from every send AND preview path; a root-relative CTA in an
   inbox resolves to a bogus host (`feedback_relative_url_in_email_breaks_host`).
5. **Preview is a sandboxed `<iframe :srcdoc sandbox="">`, never `v-html`.**
6. **Nitro does not auto-import `server/utils/`** and **bundles every non-test `.ts` under
   `server/`**. All logic lives in `@commonpub/server`; shared test helpers go in
   `layers/base/test-helpers/` (memories `feedback_server_route_no_utils_autoimport`,
   `feedback_nitro_bundles_nontest_ts_under_server`).
7. **Federation: none.** `contest_announcements` and `contest_announcement_sends` are
   instance-local and must never serialize through `@commonpub/protocol`. Add the row to the
   CLAUDE.md federation-scope table and pin it with the existing openapi-route-parity test, the
   way persona and hub_flags were pinned.
8. **GDPR.** CORRECTION (audit): this was wrong, and following it would have made the export
   incoherent. `contest_reminder_sends` -- the same kind of (recipient, thing-sent) ledger,
   already shipped -- is NOT exported, and `profile/export.ts` excludes send queues explicitly
   as "operational queues (not subject data)". Exporting the announcement ledger while the
   reminder ledger stayed out would have been a deviation dressed as a fix. Both are now NAMED
   in that exclusion list so the omission reads as a decision, with a note to reconsider the
   pair together if the class is ever revisited.

## 5. Phases

**v1 scope locked 2026-09-12 by the operator: P1-P6 and P9. Send-now only, registrants only.**
P7 (per-contest opt-out), P8 (in-app notification) and scheduling are DEFERRED, not cancelled.
The consequence of deferring P7, stated once so it is not a surprise: the only way a participant
can stop announcements is the global `unsubscribedAll`, which also stops their deadline reminders,
notifications and digests instance-wide. The consequence of deferring P8: on commonpub.io and
heatsynclabs.io, where `emailNotifications` is off, this feature does nothing at all (the send
route refuses, per 4.7).

Each phase is independently shippable and test-first (CLAUDE.md rule 11).

- **P1 Schema.** `contestAnnouncements`, `contestAnnouncementSends`,
  `contest_registrations.email_opt_out_at`, the Zod validators, migration `0049`. Tests: validator
  round-trip, `.strict()` rejection, CRLF subject rejection, audience union parse.
- **P2 Audience resolver.** One exported predicate + `countAnnouncementRecipients` +
  `resolveAnnouncementRecipients`. v1 resolves the `registrants` selector only. Tests against
  real Postgres: each tier, every mailability exclusion (unverified, suspended, soft-deleted, `unsubscribedAll`,
  per-contest opt-out), and **count === send recipients** for the same input.
- **P3 Template + render.** `emailTemplates.contestAnnouncement`, exported subject interpolation,
  the shared email-safe block palette module. Tests: token substitution in subject and body,
  escape-once, dropped unsupported block types, absolute URLs, both unsubscribe links present.
- **P4 Send.** `sendContestAnnouncement` with the claim-first ledger. Tests: exactly-once under a
  repeated call, rollback on enqueue failure, chunking above 500, the real enqueue asserted in
  `email_outbox` (assert subject + html, per `contest-email-template-editor.md` §2).
- **P5 Routes.** Five routes, each with an authz test (anon 401, non-organizer 403, editor 200)
  and a flag-off test. Plus the `emailNotifications`-off refusal.
- **P6 UI.** Extract the shared composer out of `ContestEmailEditor.vue`; add an `announcements`
  body tab to `ContestEditor.vue` (the `stages`/`registration`/`emails` form-tab slot pattern,
  `ContestEditor.vue:100,501,641`). Audience picker + live count + preview + test-send + send
  confirm + history. Component tests with axe; WCAG 2.1 AA.
- ~~**P7 Per-contest unsubscribe.**~~ DEFERRED. Scoped token + `/unsubscribe` handling + footer
  link. The `email_opt_out_at` column still ships in migration 0049 so P7 needs no second
  migration, and the audience predicate already reads it (it is simply always NULL in v1).
- ~~**P8 In-app notification**~~ DEFERRED, with the per-announcement link discriminator.
- **P9 Verify + roll.** Local run, real browser walk-through at desktop and 390px, a test send to
  a real inbox, then publish schema to config to server to layer and roll with the flag OFF.

## 6. Release order

`@commonpub/schema` -> `@commonpub/config` -> `@commonpub/infra` (template) ->
`@commonpub/server` -> `@commonpub/layer`.

`workspace:*` publishes as an EXACT pin, so every package above a changed leaf must be
republished or the consumer resolves two copies (memory `feedback_exact_pin_cascade_republish`).
Publish to `--tag next` first and let deveco's CI typecheck the real tarballs before `latest`
moves (memory `feedback_prerelease_tag_verifies_consumer`). Ship nothing else in the same deploy.

**Roll with `contestBroadcast: false` on all three, deveco last.** deveco has a live Resend
transport and `emailNotifications: true`; the first real send there must be a test to the
operator's own address, then a single small audience, before any full blast.

## 7. Found while auditing (not this feature, worth filing)

- `broadcastInputSchema.subject` (`packages/schema/src/validators/comms.ts:38`) has no CRLF
  guard. `adminBroadcast` is ON on deveco with a live transport. Low severity (both adapters
  encode headers) but it is a one-line fix and the same shape this plan guards.
- `sendBroadcast` has no idempotency ledger, so a double-submitted admin blast mails everyone
  twice.
- The email-safe block palette is declared inline in `ContestEmailEditor.vue:70-89`. A second
  editor makes drift between the palette and `renderEmailBlocks` a live risk.
- Memory `project_email_flag_state_2026_07` is stale: deveco is no longer a console sink.

## 8. Open decisions

1. ~~**Scheduling in v1?**~~ RESOLVED: no. Send-now only. Free via `OutboxMessage.scheduledAt`
   whenever it is wanted, but it freezes the audience at compose time, so it needs the caveat
   surfaced in the UI before it ships.
2. **Drafts?** The `status` column allows `draft`, but autosaving an unsent blast adds a state
   machine. Recommendation: no drafts in v1; the compose form is not persisted.
3. **Reply-to.** Should an announcement set `Reply-To` to the organizer's address so participants
   can answer? Useful, but it discloses the organizer's email to every recipient. Recommendation:
   off in v1, then an explicit per-send opt-in checkbox.
