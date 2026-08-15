# Plan: opt-in member visibility for recruiters and sponsors

**Status:** PROPOSED (design only). Author context: session 255, follow-on to
`persona-customization-and-audience-analytics.md`. That plan built the consent machinery and
deliberately stopped short of a member-level read surface. This is that surface.

**Operator intent, verbatim:** members who opt in show up in searches through the API. Recruiters and
sponsors do **not** get to contact them directly. Contact stays on-instance, through DMs. Email is
never shared.

> **SUPERSEDED IN PART (session 256).** `docs/plans/profile-persona-information-architecture.md`
> revisions 2 and 3 are authoritative wherever they disagree with this document. Two of this plan's
> assumptions were corrected in shipped code: persona answers are **private by default**
> (`showOnProfile: true` opts one field in; there is no `publicOnProfile`), and being counted in
> instance statistics is **not a consent purpose** (`profile_analytics` was removed; statistics run
> on legitimate interest with an objection recorded in `user_statistics_objections`). Read the
> machinery here, take the model from there.


---

## 0. The finding that reframes this

`GET /api/public/v1/users` already ships. With a `read:users` key it returns, for **every**
public-profile member with no consent of any kind:

`username`, `displayName`, `headline`, `bio`, `avatarUrl`, `pronouns`, `location`, `website`,
`skills`, and `socialLinks` (GitHub, LinkedIn, X, YouTube, Mastodon, Discord)

It supports `q` search and pagination (`layers/base/server/api/public/v1/users/index.get.ts`,
`toPublicUser` at `packages/server/src/publicApi/serializers.ts:53-71`). Email is already excluded.

So the honest framing of this work is **not** "expose members to third parties". That already happens.
It is:

1. add an **explicit opt-in signal**, which today does not exist;
2. let a recipient filter by persona answers, which today is impossible;
3. put that behind a **protected scope with a per-recipient disclosure audit**, which the existing
   endpoint does not have.

Net effect on privacy: a recipient who wants leads currently scrapes everyone. Afterwards they have a
reason to pull a smaller, consenting, better-qualified set. That is a genuine improvement, and it is
worth saying out loud that the status quo is the less protective option.

**Separate follow-up, not this plan:** `read:users` returning every member's `socialLinks` with no
opt-out short of going fully private deserves its own look. Filed in §9.

---

## 1. What already exists and is reused unchanged

| Piece | Where | Status |
|---|---|---|
| `recruiter_visibility`, `sponsor_sharing` purposes with full member-facing copy | `packages/persona/src/purposes.ts` | built |
| Consent storage, supersede-then-insert history, revocation | `user_purpose_consents`, `packages/server/src/persona/consent.ts` | built |
| Scope digest, stale-grant degradation | `purposeScopeDigest`, bound into SQL | built |
| Named recipients with `relationship`, `agreementRef`, `country`, `transferMechanism` | `dataRecipientSchema` | built |
| Refusal to offer a purpose whose recipient is an unpapered non-processor | `purposeIsOfferable` | built |
| `WILDCARD_PROTECTED_SCOPES` so a scope is not covered by `read:*` | `packages/server/src/publicApi/scopes.ts` | built |
| DMs between any two accounts | `packages/server/src/messaging/` | built |
| Public serializer that already omits email | `toPublicUser` | built |

**The consent copy already describes this exact product.** `recruiter_visibility.onSummary` reads:
"people the operator has approved for hiring can see what is already on your public profile, plus your
interests and tech stack. They cannot see your email address. They contact you through messages on this
site." Written before the surface existed, and it is accurate for what is proposed here. No copy change
and **no fourth purpose** are needed, because any authenticated account can already DM any other
account, so being listed grants no new contact capability. It signals willingness, nothing more.

---

## 2. Design principles specific to this surface

| # | Principle | Why |
|---|---|---|
| D1 | **This is not metrics. It must not share a module with the aggregate pipeline.** | `personaMetrics.ts` exists to make individuals unidentifiable: suppression below 5, floors, quantisation. A directory identifies individuals **on purpose, with consent**. Routed through the same code, either the directory returns nothing or someone deletes the suppression and silently breaks every aggregate. Separate module, separate test, isolation assertion in both directions. |
| D2 | **The required grant is the specific purpose.** | The directory needs `recruiter_visibility` alone, because that purpose's copy describes exactly this disclosure. _(As shipped, this is now the only reading available: `profile_analytics` was removed, and `/persona/audience` counts a single purpose per slot with no second join.)_ |
| D3 | **Every disclosure is attributable to a named recipient and logged before the response.** | Without it, "who has my data" is unanswerable, which fails Art 15 and makes the whole product untrustworthy. The log is also what makes bulk extraction visible. |
| D4 | **Email is structurally absent, not filtered out.** | Reuse `toPublicUser`, which has no email field, rather than selecting columns and remembering to drop one. |
| D5 | **Revocation removes you from the next response. History of past disclosures is retained.** | Cannot unring a bell; the copy must say so rather than implying recall. |
| D6 | **The member can see who looked.** | The accountability record is worth more to the member than to the operator. It is also the strongest anti-cringe feature available here. |

---

## 3. Data model

One new table. Migration **0047**, purely additive apart from one nullable column.

```ts
// packages/schema/src/persona.ts (appended)

/** One row per (recipient, member) disclosure. Written synchronously with the
 *  response that disclosed them, BEFORE the payload is returned. */
export const disclosureEvents = pgTable('disclosure_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  /** The named recipient from `dataSharing.recipients`. Not an FK: recipients are
   *  config/DB data, not a table. Validated against the effective recipient list. */
  recipientId: varchar('recipient_id', { length: 40 }).notNull(),
  /** Which key made the request, so a revoked key's history stays attributable. */
  apiKeyId: uuid('api_key_id').references(() => apiKeys.id, { onDelete: 'set null' }),
  /** The member disclosed. Cascades: erasure removes the member's disclosure rows. */
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  purpose: varchar('purpose', { length: 24 }).notNull(),
  /** The grant that authorised it, so an audit can prove consent was current. */
  scopeDigest: varchar('scope_digest', { length: 16 }).notNull(),
  disclosedAt: timestamp('disclosed_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('idx_disclosure_user_time').on(t.userId, t.disclosedAt),      // "who saw me"
  index('idx_disclosure_recipient_time').on(t.recipientId, t.disclosedAt), // operator view + rate view
  // Deliberately NOT unique on (recipient, user): a repeat pull is a repeat
  // disclosure and the count is the useful signal.
]);
```

```sql
-- api_keys gains its recipient binding. Nullable, so every existing key is
-- unaffected and reads nothing new.
ALTER TABLE api_keys ADD COLUMN recipient_id varchar(40);
```

**Why `recipient_id` on the key and not the deferred `purposes` array.** Appendix B2 of the persona
plan killed `api_keys.purposes` because no field carried a data class to intersect against. A recipient
binding is the primitive that actually works: the key says *who* it belongs to, the recipient record
(already modelled, already carrying `purposes`) says what that party may see. One join, no new
classification scheme, and it is what makes `disclosure_events` attributable.

**Retention.** `disclosure_events` rows are kept for `dataSharing.disclosureRetentionYears` (default 2),
enforced by the same purge plugin that handles the other retention job, not merely documented.

---

## 4. The endpoint

```
GET /api/public/v1/members/open-to/{audience}
    audience = 'recruiters' | 'sponsors'
```

Deliberately **not** under `/metrics/`. A people-lister under a metrics prefix is a category error that
invites someone to hand it a metrics key.

| Aspect | Decision |
|---|---|
| Scope | **New `read:members`**, added to `PUBLIC_API_SCOPES` and to `WILDCARD_PROTECTED_SCOPES` in the same commit, so `read:*` does not grant it |
| Key binding | 403 unless the key carries a `recipient_id` that resolves to a recipient whose `purposes` include the mapped purpose |
| Flags | `persona` + `dataSharingConsents` + new `memberDirectory` (default false). `requireFeature` throws 404, so a non-participating instance does not reveal the surface |
| Filters | `interests=`, `techStack=`, `industry=` (repeatable, validated against the effective schema, unknown key is a clean 400), `hasLink=github,linkedin`, `q=` reusing the existing search, `location=` |
| Pagination | `limit` 1..50 default 20 (lower than the metrics family: this is people), `offset`, `toPageMeta` like the rest of the family |
| Response | `toPublicUser` fields **plus** the member's persona answers, resolved to labels. Never email. Never `sensitive` fields. _(As shipped: the profile-visibility gate was removed from this payload when the `recruiter_visibility` copy stopped pointing at the profile and started naming the answers directly. `showOnProfile` governs `/u/:username`, not this surface.)_ |
| Audit | `disclosure_events` rows inserted in the same transaction that reads the page, before the response is serialised |

The consent join, in `packages/server/src/persona/directory.ts` (new module, D1):

```sql
SELECT u.*  -- projected through toPublicUser
FROM users u
JOIN user_purpose_consents c
  ON c.user_id       = u.id
 AND c.purpose       = $purpose          -- 'recruiter_visibility' | 'sponsor_sharing'
 AND c.state         = 'granted'
 AND c.superseded_at IS NULL
 AND c.scope_digest  = $currentDigest    -- stale grant authorises nothing
WHERE u.deleted_at IS NULL
  AND u.status = 'active'
  AND u.profile_visibility = 'public'
  AND <persona answer filters, as EXISTS subqueries on user_persona_answers>
ORDER BY u.created_at DESC, u.id DESC     -- unique tiebreaker
LIMIT $limit OFFSET $offset
```

Same shape as the aggregate join for the same reason: consent is an INNER JOIN with the digest bound in
the join condition, so there is no version of this query without it.

**Not k-anonymised, and that is correct.** The rows are consenting, identified people. There is also no
leak back into the aggregates: this set is a strict subset of consenting members, so it reveals nothing
about anyone who did not opt in.

---

## 5. Member-facing surfaces

Two additions to `/settings/privacy`, both of which make the deal legible:

1. **The two toggles become offerable.** One line: add `recruiter_visibility` and `sponsor_sharing` to
   `OFFERED_PROCESSING_PURPOSES` (`packages/server/src/persona/consent.ts:170`). `purposeIsOfferable`
   already refuses to show them until a recipient covering that purpose is declared with a valid
   `agreementRef`, so the operator cannot switch this on before papering the transfer. The existing
   "This site does not offer these choices yet" sentence disappears on its own, because it is derived.

2. **"Who has seen you"**, from `disclosure_events`:

   > **Who has looked at your profile through the hiring directory**
   > Acme Robotics, 3 times, most recently 4 August 2026.
   > Turning this off removes you from future results. It cannot recall what was already shared.

   That last sentence is the honest one and it must not be softened.

Public profile is unchanged: being open to recruiters is not a badge, because a visible badge turns a
private choice into social signalling.

---

## 6. Operator surfaces

- `/admin/data-sharing/recipients`: the CRUD that the persona plan deferred. Now required, because a
  recipient must exist before a key can bind to one. File-declared recipients render read-only next to
  DB ones, following `trusted-instances.get.ts`.
- `/admin/api-keys`: a recipient selector when the key holds `read:members`, and the `read:*`
  disclaimer line gains `read:members` (generated from `WILDCARD_PROTECTED_SCOPES`, so it cannot drift).
- `/admin/persona-metrics`: a disclosure panel. Members disclosed per recipient per month, so bulk
  extraction is visible without reading the table.

---

## 7. Phasing

| Phase | Ships | Flag | Migration |
|---|---|---|---|
| 1 | `disclosure_events`, `api_keys.recipient_id`, `read:members` + wildcard protection, `directory.ts` with the consent join and filters | `memberDirectory` (off) | 0047 |
| 2 | The endpoint, the disclosure write, per-recipient key binding, OpenAPI + `docs/public-api.md` | same | none |
| 3 | Recipients admin CRUD, key binding UI, disclosure panel | same | none |
| 4 | Purposes become offerable, "Who has seen you" on `/settings/privacy` | `dataSharingConsents` | none |

Phase 4 last, deliberately: nothing asks a member for this consent until the surface that honours it,
and the surface that shows them who used it, both exist.

---

## 8. Tests

- A member with no grant is absent. With a stale digest, absent. Revoked, absent. Non-public profile,
  absent. Suspended or soft-deleted, absent.
- A member holding a grant for some OTHER purpose only (`sponsor_sharing`) is absent from the
  recruiter directory (D2 in the other direction: one consent is not another).
- Every response writes exactly one `disclosure_events` row per member returned, in the same
  transaction, and a failed write fails the request rather than disclosing unlogged.
- A `read:*` key gets 403. A `read:members` key with no `recipient_id` gets 403. A key bound to a
  recipient whose `purposes` exclude the audience gets 403.
- No response contains an email address anywhere: assert on the serialised payload, not the type.
- **Isolation both ways:** `directory.ts` does not import `metrics.ts` and `metrics.ts` does not import
  `directory.ts`, with file-count floors. This is what stops k-anonymity leaking into the directory or
  out of the aggregates.
- Erasure removes a member's `disclosure_events` rows; the purge job deletes expired ones.

---

## 9. Open questions

| # | Question | Recommendation |
|---|---|---|
| 1 | Should there be an **in-app** directory for recruiter-role accounts, not only an API? | Probably yes, later. A recruiter needs an account to DM anyway, so the API-then-website round trip is clumsy. Out of scope here; the API returns `username`, which is enough to reach `/u/:username` and press Message. |
| 2 | Should `read:users` keep returning every member's `socialLinks` with no opt-out? | **Look at this separately.** It is the larger exposure and it predates this work. Options: gate `socialLinks` behind a new consent, or add a per-member "exclude me from the public API" switch. |
| 3 | Rate limiting for bulk extraction | Start with the existing per-key limit plus `limit` capped at 50 and the disclosure panel. Add a monthly disclosure ceiling per recipient only if a real recipient misbehaves. |
| 4 | Do sponsors and recruiters need different field sets? | Not in v1. Same projection, different purpose and different recipient. Split only when an operator asks. |
| 5 | Should a member be able to exclude a **specific** recipient? | Desirable, deferred. It needs per-recipient consent rows rather than per-purpose, which is a real schema change. Note it in the copy: consent is per audience, not per company. |

---

## 10. What this does not do

No email, ever. No direct contact channel: DMs already exist between any two accounts and are subject
to the instance's own blocking and reporting. No badge on the public profile. No cross-instance
federation of any of it. No recall of data already disclosed, and the copy says so.
