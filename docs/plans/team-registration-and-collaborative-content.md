# Plan — Teams: repeatable group fields → collaborative, multi-person content

**Status:** PROPOSED (design only). Author context: session 246. Grounded in an audit of
the current ownership/collaboration model (file:line refs inline).

## 0. Goal & the two coupled problems

Jinger's registration form has a **"+ Add Team Member"** repeatable block, and the intent
behind it is that those team members become **real people who can manage and edit the
team's project entry** — not just names in a text blob. That splits into two problems that
must be solved together to be worth anything:

1. **Collect a team in a form** — a repeatable **`group`** field type (a mini-form
   repeated per member). Deferred from `rich-contest-registration-forms.md` §5/§0 because
   it's a value-model change, not a switch-case.
2. **Let multiple people own/edit one piece of content** — CommonPub content is
   **hard single-owner** today. A collected team is useless unless the teammates can
   actually co-manage the entry's content.

Solving #1 without #2 gives a team roster that does nothing. Solving #2 is the real work.

## 1. Current state (what exists — verified)

- **Content is single-owner, hard-wired.** `content_items.authorId` is one non-null FK
  (`packages/schema/src/content.ts:31-33`); identity/uniqueness is built on it
  (`content_items_author_type_slug` unique `content.ts:106`). `updateContent`/`deleteContent`
  gate purely on `authorId === userId` inside the SQL WHERE
  (`packages/server/src/content/content.ts:766-849`); the route 404s on null
  (`layers/base/server/api/content/[id]/index.put.ts:12-15`). **There is no `content.edit`
  permission** (catalog has only `content.moderate`/`content.editorial`/`content.read`,
  `packages/schema/src/permissions.ts:36-39`), no per-content role, no co-author column.
- **A contest entry is one user + one content.** `contest_entries` FKs `contestId` +
  `contentId` + `userId`, unique `(contestId, userId, contentId)`
  (`packages/schema/src/contest.ts:397-466`). A "team" today could only be multiple entry
  rows pointing at one `contentId`, but the single-owner content constraint means only the
  content's author can actually edit it.
- **Registration `team` is self-reported text**, not teammate records: the legacy
  `team: 'solo'|'have'|'looking'` radio (`contest.ts:628-635`, `DEFAULT_REGISTRATION_TEMPLATE`
  `contest.ts:206-238`) is stored verbatim; no relationship is created.
- **The working "multiple people on one resource with roles" blueprints:**
  - `contest_stakeholders` — `(contestId,userId,role)` unique `(contestId,userId)`, roles
    `reviewer|editor`; server `stakeholders.ts` (`isContestEditor` gate `:157-168`), UI
    `ContestStakeholderManager.vue`. **This is the closest existing analog.**
  - `contest_judges` — same shape + an **accept lifecycle** (`invitedAt`/`acceptedAt`,
    `acceptJudgeInvite` `judges.ts:134-178`).
  - `hub_members` — `(hubId,userId,role)` with a full role hierarchy + hub-scoped RBAC
    (`packages/server/src/utils.ts:24-72`).
- **The "add people" UX is search-existing-user → assign role → POST** (both contest
  managers): `/api/contests/{slug}/user-search` (public fields only, manager-gated) →
  `POST …/stakeholders {userId, role}` (`ContestStakeholderManager.vue:40-53`). **There is
  NO invite-by-email for a not-yet-registered user anywhere** — contests reference an
  existing `userId`; hubs use anonymous `hub_invites` tokens (`hub.ts:168-183`).
- **Federation is single-actor.** `contentMapper` sets `attributedTo: actorUri` (one value,
  `packages/protocol/src/contentMapper.ts:215,339`) from the single author. All contest
  tables are instance-local, never federated (`contest.ts:516,637-640,670-674`).

**Implication:** the model to add is a per-content role junction (mirroring
`contest_stakeholders`), a widened content-edit authorization, a `group` form field, and a
**net-new email-invite path** for teammates who don't have accounts yet.

## 2. Design overview

Four building blocks, each independently useful, shippable in order:

```
 group field (collect)  ──►  invitations (resolve people)  ──►  content_collaborators (co-own)  ──►  co-edit UI
      Phase A                        Phase C                          Phase B                         Phase D
```

Phase B (co-ownership + edit authz) is the keystone and is useful on its own (manual
"add a collaborator" on any project), independent of contests. Phases A/C wire team
*registration* into it.

## 3. `content_collaborators` — the missing per-content role table (Phase B, keystone)

Mirror `contest_stakeholders` at the content layer.

```
content_collaborators
  id            uuid pk
  content_id    uuid  → content_items.id  (cascade)
  user_id       uuid  → users.id          (cascade)   -- null while a pending email invite
  invited_email text  null                              -- set for email invites; cleared on accept
  role          text  not null default 'editor'         -- 'owner' | 'editor' | 'viewer'
  invited_by    uuid  → users.id
  invited_at    timestamptz default now()
  accepted_at   timestamptz null                        -- null = pending
  UNIQUE(content_id, user_id)                            -- one row per (content, user)
  partial UNIQUE(content_id, lower(invited_email)) WHERE user_id IS NULL
  CHECK (user_id IS NOT NULL OR invited_email IS NOT NULL)
```

- **The content's `authorId` stays the canonical primary owner** (no data migration; every
  existing content is unaffected). `content_collaborators` is *additive* — it grants extra
  people access. The author is implicitly `role='owner'`; we do **not** duplicate them into
  the table (keeps the existing single-author invariant + federation intact).
- **Roles:** `owner` (edit + manage collaborators + delete), `editor` (edit content, not
  membership), `viewer` (see drafts/private). Matches the stakeholder `reviewer|editor`
  split, plus `owner` for delegated management.

## 4. Content-edit authorization change (Phase B)

Replace the author-only WHERE in `updateContent`/`publishContent`/`scheduleContent`
(`content.ts:766-886`) with an **explicit authorization step** before the write (mirroring
the contest route idiom `ownerOrPermission(...) || isContestEditor(...)`,
`contests/[slug]/index.put.ts:15-19`):

```
canEditContent(db, contentId, userId) :=
     content.authorId === userId
  || hasCollaboratorRole(db, contentId, userId, ['owner','editor'])   -- accepted only
  || hasPermission('content.moderate')                                -- existing admin path
```

- Add a **`content.edit`-style leaf** to the permission catalog only if we want a
  site-wide override; otherwise reuse `content.moderate` for admins. Recommend: no new
  global permission — keep edit rights **resource-scoped** via collaborators (least
  privilege), exactly like stakeholders.
- **Keep the SQL-WHERE ownership check for `deleteContent`** gated to `owner`
  (author or `role='owner'`) — deletion is not an editor capability.
- **Concurrency:** co-editing invites lost-update races. Content already has
  `content_versions` (`content.ts:145-147`); reuse optimistic concurrency (version/`updatedAt`
  check on write) so two editors don't silently clobber. No live OT/CRDT — last-write-wins
  with a version guard + a "reloaded, someone edited" notice. (Real-time co-editing is
  explicitly out of scope.)
- **Audit:** `content_versions.createdById` already records who authored each version — it
  becomes a real co-authorship trail once non-authors can write.

## 5. The `group` (repeatable) field type (Phase A)

From `rich-contest-registration-forms.md` §0 (the deferred blocker), made concrete:

- **Value model.** Today everything is `Record<string,string>` (renderer
  `ContestSubmissionField.vue`, driver `ContestProposalForm.vue`, helpers
  `utils/contestSubmission.ts`, server `validateSubmissionFields`). A group value is
  `GroupRow[]` where `GroupRow = Record<string,string>`. Introduce a wire type
  `type FieldValue = string | GroupRow[]` and thread it through **all** of: the renderer,
  both drivers, the client helpers, the server validator/partitioner, and the CSV export.
  This is the bulk of the work — it is a type change across ~8 sites, not a new switch-case.
- **Schema.** Extend `FormField` with `children?: FormField[]` (child field defs) and
  `min?`/`max?` (row-count bounds). Depth is capped at **1** (groups cannot nest — enforce
  in the zod refine, `validators/contest.ts`). Child keys are namespaced at rest as
  `groupKey[i].childKey`; the `field_key` regex `^[a-z0-9_]+$` + `varchar(40)` stays for the
  *stored* per-row key by encoding the index outside the key (store rows as a JSON array
  under the single group key, not flattened keys).
- **Storage & PII.** A group can contain both public and private children. On partition, a
  private child's values route to the private table keyed `groupKey[i].childKey`; consent
  children in a group recurse into the agreement audit.
- **Char cap.** The 4000-char per-*value* cap can't apply to a packed team array — cap
  **per child value** and bound `max` rows (recommend ≤ 20).
- **Renderer.** `ContestSubmissionField` gets a `group` branch: a repeated mini-form of
  `children` with "+ Add {label}" / remove, honoring `min`/`max`, a11y-labeled per row.
- **DSL.** Extend the registration-markdown DSL (`registrationMarkdown.ts`,
  `docs/reference/registration-markdown.md`) with a nested syntax, e.g. a `(group)` field
  whose indented `- child (type)` lines are its children:
  ```
  - Team Members (group, min=1, max=10)
    - Name* (text)
    - Role (text)
    - Email* (email, pii)
  ```
  (The parser already attaches indented lines to the current field; extend it to build
  `children` when the field is a group instead of treating them as help/terms.)

## 6. Invitations — resolving form-collected people into collaborators (Phase C)

The one genuinely net-new mechanism (nothing invite-by-email exists today).

- A `group` child flagged `role:'teammate'` (or a dedicated field) collects each member's
  **email** (and optional name/role). On a **combined-mode** team registration (or an
  explicit "invite teammates" action on a project), for each collected email:
  - **existing user** (email match) → insert an `accepted`/`pending` `content_collaborators`
    row (`role='editor'`) + an in-app notification (reuse the `notifyStakeholder` pattern,
    `stakeholders.ts:102-118`).
  - **no account** → insert a **pending** row (`user_id NULL`, `invited_email` set) + send an
    email invite (reuse the `email_outbox` + branded-email infra from session 227). On the
    invitee's signup/login with that email, **claim** all pending rows for that address
    (set `user_id`, clear `invited_email`, `accepted_at=now`). This claim-on-signup step is
    the net-new piece; everything else reuses existing infra.
- **Abuse bounds:** cap invited emails per content (e.g. ≤ 20), rate-limit, require the
  inviter to be `owner`/`author`, and only send to addresses not opted out. Pending invites
  expire (e.g. 30 days) and are idempotent (the partial-unique on `invited_email`).
- **Security:** a claim only grants access to content the invite explicitly named; the token
  is single-address-scoped; never auto-verify the email from the invite alone.

## 7. Team registration → one co-owned entry (Phase C)

In **combined mode** a team registration creates **one** `contest_entries` row (one
`content_id`, owned by the registrant) + collaborator rows for the teammates on that
content. The entry stays single-`userId` (the team lead / registrant) to preserve the
`(contestId,userId,contentId)` unique key and judging model; **co-management comes from
`content_collaborators` on the linked content**, not from multiple entry rows. This avoids
touching the entry uniqueness/judging invariants at all.

## 8. UI (Phase D)

- A **`ContentCollaboratorManager.vue`** on the project/content editor, cloned from
  `ContestStakeholderManager.vue` (search-existing-user → role → POST) **plus** an
  "invite by email" input (the new path). Shows pending vs accepted (like the judge
  "Pending" badge, `ContestJudgeManager.vue:101`).
- A "Team" surface on the entry/content page listing collaborators (avatars), gated so only
  `owner` manages membership.
- Editor affordance: when a collaborator (not the author) opens the content editor, the
  version guard + "someone else edited" reload notice (§4).

## 9. Federation scope

- **v1: collaborators are instance-local**, like every other contest/hub membership table
  (`contest.ts:516`). `attributedTo` stays the single author — no protocol change, zero
  federation risk.
- **Later (optional):** widen `attributedTo` to an array to federate co-authorship
  (`contentMapper.ts:215`). This is a protocol + remote-actor-resolution change (multiple
  `attributedTo` actors, some remote) and belongs behind its own flag + ADR, after the
  local model proves out. Do **not** couple it to Phases A–D.

## 10. Data model + migrations (additive, forward-only)

1. `content_collaborators` table (§3) — new table, no change to existing rows.
2. `FormField.children` / `min` / `max` (jsonb shape only; no column change — lives inside
   the existing `registration_template` / `submissionTemplate` jsonb).
3. Optional `content_invites` semantics folded into `content_collaborators` (pending rows),
   so **no separate invite table** — one table, `accepted_at IS NULL` = pending.
4. Reuse `email_outbox` (session 227, mig 0036) for invite emails — no new email infra.

All additive → low risk, matches the rich-registration migration posture.

## 11. Permissions matrix (per content)

| Action | author | `owner` collab | `editor` collab | `viewer` collab | `content.moderate` |
|---|---|---|---|---|---|
| View drafts/private | ✓ | ✓ | ✓ | ✓ | ✓ |
| Edit content | ✓ | ✓ | ✓ | — | ✓ |
| Manage collaborators | ✓ | ✓ | — | — | — |
| Delete content | ✓ | ✓ | — | — | ✓ (moderation) |
| Transfer authorship | ✓ | — | — | — | — |

## 12. Phasing (each: schema → server → UI → tests → adversarial audit → roll)

- **Phase B (keystone) — content co-ownership.** `content_collaborators` + `canEditContent`
  + version guard + a manual `ContentCollaboratorManager` (search-existing-user only). Ships
  useful on its own ("add an editor to my project"). Behind `contentCollaborators` flag.
- **Phase A — `group` field type.** Value-model change + renderer + validator + DSL nesting.
  Independently useful for any form (team rosters, multiple links). Behind `formGroupFields`.
- **Phase C — email invites + claim-on-signup + team-registration wiring.** The net-new
  invite path; reuses email_outbox. Behind `teamInvites`.
- **Phase D — polish.** Team surface on content pages, pending/accepted badges, notifications.
- **Phase E (optional, later) — federate co-authorship** (`attributedTo` array). Own ADR.

## 13. Open decisions

1. **Author vs owner:** keep `content_items.authorId` as the immutable primary owner
   (recommended — no migration, federation intact), or allow authorship transfer? (§3/§11
   assume immutable author + delegable `owner` collaborators.)
2. **Global `content.edit` permission?** Recommend NO — keep edit resource-scoped via
   collaborators; reuse `content.moderate` for admins only.
3. **Real-time co-editing?** Out of scope — optimistic version guard + reload notice, not
   OT/CRDT.
4. **Entry model for teams:** one entry owned by the lead + collaborators on the content
   (recommended, §7), vs multiple entry rows (breaks the unique key + judging). 
5. **Invite expiry + caps:** 30-day expiry, ≤ 20 invited emails/content — confirm.
6. **Does co-authorship federate in v1?** Recommend NO (local-only), Phase E later.

## 14. Risks / landmines

- The `group` value-model change touches ~8 `Record<string,string>` sites — do it in
  lockstep or `nuxt typecheck` (the layer gate) fails (see `rich-contest-registration-forms.md`
  build-pipeline note). Ship Phase B (no value-model change) first to de-risk.
- Widening content-edit authz is a **security-sensitive** change (a 404-on-not-owned becomes
  a role check) — needs the adversarial-audit pass + tests for every negative case (viewer
  can't edit, expired invite can't claim, cross-content invite can't leak).
- Email invites are a spam/enumeration vector — rate-limit, cap, opt-out honoring, and
  never leak whether an email has an account (uniform response).
- Federation must stay single-actor until Phase E, or remote instances see a broken
  `attributedTo`.
