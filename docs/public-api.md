# Public Read API

A scoped, admin-provisioned REST API for reading CommonPub data from outside the instance — analytics, aggregators, mirror sites, third-party clients, bots.

## Contents
1. [Status and scope](#status-and-scope)
2. [Authentication](#authentication)
3. [Scopes](#scopes)
4. [Rate limiting](#rate-limiting)
5. [Endpoints](#endpoints)
6. [Metrics](#metrics)
7. [Audience metrics (persona)](#audience-metrics-persona)
8. [Member visibility directory](#member-visibility-directory)
9. [Metrics privacy contract](#metrics-privacy-contract)
10. [Errors](#errors)
11. [What is NEVER returned](#what-is-never-returned)
12. [CORS](#cors)
13. [Versioning and deprecation](#versioning-and-deprecation)
14. [Creating a key (admin)](#creating-a-key-admin)
15. [Revoking a key (admin)](#revoking-a-key-admin)

## Status and scope

- **v1** — read-only, phase 2 expanded coverage.
- Feature-flagged off by default. Admin must enable `features.publicApi = true` in `commonpub.config.ts` or via the admin settings panel before any `/api/public/v1/*` route responds.
- When the flag is off, every endpoint returns `404 Not Found` — the API surface is invisible on instances that haven't opted in.
- Write scopes, webhook subscriptions, and GraphQL are explicitly deferred to later phases.

## Authentication

Every request must include an `Authorization: Bearer <token>` header. Tokens look like:

```
cpub_live_ak_xF9kMpQ2...
```

- Keys are admin-created at `/admin/api-keys`.
- The raw token is shown **once** at creation and never again — the server only stores a SHA-256 hash. Copy it somewhere safe before closing the reveal panel.
- Revoked keys return `401`.
- Expired keys return `401` with `API key expired` so consumers can distinguish rotation-required from invalid.

### Example

```bash
curl -H "Authorization: Bearer cpub_live_ak_xF9kMpQ2..." \
     https://commonpub.io/api/public/v1/instance
```

Never put the token in a query string — it will end up in access logs, referrers, and browser history. Header only.

## Scopes

Scopes are read-only in v1. A key must hold the listed scope for each endpoint. `read:*` is a shortcut for all read scopes but should be reserved for trusted internal consumers.

| Scope | Allows |
|---|---|
| `read:content` | `/content`, `/content/:slug`, `/search` |
| `read:hubs` | `/hubs`, `/hubs/:slug` |
| `read:users` | `/users`, `/users/:username` |
| `read:instance` | `/instance` |
| `read:learn` | `/learn`, `/learn/:slug` |
| `read:events` | `/events`, `/events/:slug` (feature-gated) |
| `read:contests` | `/contests`, `/contests/:slug` (feature-gated) |
| `read:videos` | `/videos`, `/videos/:id` (feature-gated) |
| `read:docs` | `/docs`, `/docs/:slug` (feature-gated) |
| `read:tags` | `/tags` |
| `read:search` | `/search` |
| `read:analytics` | `/metrics/overview`, `/metrics/content/top`, `/metrics/tags/trending`, `/metrics/contributors/top`, `/metrics/engagement`, `/metrics/timeseries` |
| `read:federation` | `/metrics/federation` (also needs `features.publicApiMetricsFederation`) |
| `read:audience` | `/metrics/persona/fields`, `/metrics/persona/distribution`, `/metrics/persona/links`, `/metrics/persona/audience` (also needs `features.persona` and `features.personaAnalytics`) |
| `read:members` | `/members/open-to/:audience` (also needs `features.persona`, `features.dataSharingConsents` and `features.memberDirectory`, **and** a key bound to a named data recipient) |
| `read:*` | every `read:...` scope EXCEPT the wildcard-protected ones below |

A wrong-scope request returns `403 Missing scope: <scope>`.

### Scopes `read:*` does not cover

Two scopes are **wildcard protected**: a key holding `read:*` is refused and
must be granted them by name.

- `read:audience`, on the four aggregate persona endpoints.
- `read:members`, on the member visibility directory. It is the only scope in
  the API that returns identified people rather than aggregates, and it needs a
  recipient binding on top of the scope itself, so a `read:*` key could not use
  it even if the wildcard covered it.

The reason is that the scope arrived after the keys did. Keys already in the
field were issued to read content and instance metrics; the people who issued
them agreed to that, not to member cohort data derived from answers their
members gave under a separate consent. A shortcut that silently widened as new
scopes shipped would make every past grant a blank cheque.

The protected set is `WILDCARD_PROTECTED_SCOPES`, declared in
`packages/schema/src/validators/publicApi.ts` and re-exported as a Set by
`packages/server/src/publicApi/scopes.ts`. It is the single source for this
table, for the admin key screen's disclaimer and for the refusal itself, and a
test derives this section's list from it so a protected scope cannot ship
undocumented. An explicit grant always wins: a key holding both `read:*` and
`read:audience` passes, because the exact-match check runs before the
protection check.

## Rate limiting

Every key has a per-minute request limit (default 60, admin-configurable per key). Responses include:

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 52
X-RateLimit-Reset: 1776458223
```

Exceeding the limit returns `429 Rate limit exceeded`. The `Reset` field is a Unix timestamp in seconds.

Limits are per-key; rotating keys does not reset a window (each key has its own bucket). Multi-instance web-tier deployments currently run per-process limits — migrate to Redis before scaling horizontally.

## Endpoints

All responses are `application/json; charset=utf-8`. Timestamps are ISO 8601 strings in UTC.

### `GET /api/public/v1/content`

Scope: `read:content`. List published content items.

Query parameters:
- `type` — `project`, `blog`, or `explainer`
- `tag` — tag slug
- `authorId` — UUID
- `categoryId` — UUID
- `difficulty` — `beginner` | `intermediate` | `advanced`
- `sort` — `recent` (default), `popular`, `featured`
- `limit` — 1..100 (default 20)
- `offset` — default 0

Response:
```json
{
  "items": [
    {
      "id": "cf0a91a0-...",
      "type": "blog",
      "title": "Airboat with Arduino Uno Q",
      "slug": "airboat-with-arduino-uno-q",
      "description": "Remote-Controlled Airboat...",
      "coverImageUrl": "https://...",
      "difficulty": null,
      "publishedAt": "2026-04-15T01:10:49.840Z",
      "updatedAt": "2026-04-15T01:11:08.607Z",
      "viewCount": 18,
      "likeCount": 2,
      "commentCount": 0,
      "author": {
        "id": "...",
        "username": "jeremybobbin",
        "displayName": "Jeremy",
        "avatarUrl": null
      },
      "canonicalUrl": "https://commonpub.io/u/jeremybobbin/blog/airboat-with-arduino-uno-q"
    }
  ],
  "total": 42,
  "limit": 20,
  "offset": 0
}
```

### `GET /api/public/v1/content/:slug`

Scope: `read:content`. Single content detail including block content and tags.

Optional query: `author=<username>` to disambiguate user-scoped slugs.

Drafts, unlisted, and private content always return `404`.

### `GET /api/public/v1/hubs`

Scope: `read:hubs`. List hubs.

Query: `type` (`community` | `product` | `company`), `limit`, `offset`.

### `GET /api/public/v1/hubs/:slug`

Scope: `read:hubs`. Hub detail.

### `GET /api/public/v1/users`

Scope: `read:users`. List public-profile active users.

Query: `q` (search username/displayName), `limit`, `offset`.

Users with `profileVisibility != 'public'`, deleted users, and suspended accounts are filtered out.

### `GET /api/public/v1/users/:username`

Scope: `read:users`. Single user public profile.

### `GET /api/public/v1/learn`, `/learn/:slug`

Scope: `read:learn`. Requires `features.learning`. List published learning paths or fetch a single one. Fields: id, title, slug, description, coverImageUrl, difficulty, lessonCount, enrollmentCount, publishedAt, createdAt, author, canonicalUrl.

### `GET /api/public/v1/events`, `/events/:slug`

Scope: `read:events`. Requires `features.events`. Non-owner status filter whitelisted to `{published, active, completed}`; anything else coerces to no filter (same pattern as the internal `/api/events` hardening). Fields include eventType, status, location, locationUrl, startAt, endAt, timezone, capacity, attendeeCount, waitlistCount, hubId, host, canonicalUrl.

### `GET /api/public/v1/contests`, `/contests/:slug`

Scope: `read:contests`. Requires `features.contests`. Only `upcoming`/`active`/`judging`/`completed` statuses are returned; draft and cancelled are excluded.

### `GET /api/public/v1/videos`, `/videos/:id`

Scope: `read:videos`. Requires `features.video`. Detail requires a UUID id; returns url, embedUrl, thumbnailUrl, duration, category, view/like counts, author, canonicalUrl.

### `GET /api/public/v1/docs`, `/docs/:slug`

Scope: `read:docs`. Requires `features.docs`. Returns docs sites with pageCount, versionCount, defaultVersion, owner. Individual page contents are not exposed in v1 — phase 2b if there's demand.

### `GET /api/public/v1/tags`

Scope: `read:tags`. All tags ordered by `usageCount DESC` then name. Paginated.

### `GET /api/public/v1/search?q=...`

Scope: `read:search`. Content search (Meilisearch with Postgres fallback). Returns `PublicContentSummary[]` ordered by the search backend's relevance.

### `GET /api/public/v1/openapi.json`

Requires any valid key. Returns an OpenAPI 3.1 spec for the entire API — import into Postman, Insomnia, Swagger UI, or an SDK generator.

### `GET /api/public/v1/instance`

Scope: `read:instance`. Instance metadata — name, counts, enabled features, software version, discovery links.

```json
{
  "name": "CommonPub",
  "description": "Open platform for maker communities",
  "domain": "commonpub.io",
  "software": { "name": "commonpub", "version": "1.0.0" },
  "users": { "total": 3, "activeMonth": 3 },
  "content": { "total": 17 },
  "hubs": { "total": 12 },
  "features": { "content": true, "hubs": true, "federation": true, ... },
  "openRegistrations": true,
  "links": {
    "nodeinfo": "https://commonpub.io/nodeinfo/2.1",
    "webfinger": "https://commonpub.io/.well-known/webfinger",
    "api": "https://commonpub.io/api/public/v1"
  }
}
```

## Metrics

Aggregate, privacy-respecting analytics for DevRel and community reporting. All metrics endpoints are read-only and return aggregates only (never per-user activity). See the [Metrics privacy contract](#metrics-privacy-contract).

### `GET /api/public/v1/metrics/overview`

Scope: `read:analytics`. Instance scorecard: lifetime totals (users, contributors, content by type, hubs, tags, cumulative engagement) plus 7-day and 30-day growth deltas derived from timestamps.

```json
{
  "domain": "commonpub.io",
  "generatedAt": "2026-06-04T00:00:00.000Z",
  "totals": {
    "users": 3, "contributors": 2,
    "content": { "total": 17, "byType": { "project": 9, "blog": 6, "explainer": 2 } },
    "hubs": 12, "tags": 40,
    "engagement": { "views": 1820, "likes": 96, "comments": 14 }
  },
  "recent": {
    "newUsers": { "last7d": 1, "last30d": 3 },
    "newContent": { "last7d": 2, "last30d": 8 },
    "activeContributors": { "last7d": 1, "last30d": 2 }
  },
  "notes": ["..."]
}
```

Per-day engagement time-series (not just cumulative totals) arrives with the Phase 3 daily rollups.

### `GET /api/public/v1/metrics/content/top`

Scope: `read:analytics`. Leaderboard of published, public content. Query: `metric` (`views` | `likes` | `comments`, default `views`), `type` (`project` | `blog` | `explainer`), `limit` (1..100, default 20). Items are `PublicContentSummary` objects with author attribution and canonical URLs.

### `GET /api/public/v1/metrics/tags/trending`

Scope: `read:analytics`. Tags ranked by lifetime `usageCount` (unused tags excluded). Query: `limit`.

### `GET /api/public/v1/metrics/contributors/top`

Scope: `read:analytics`. Public-profile, active users ranked by published, public content, with engagement received. Private, suspended, and deleted profiles are excluded.

```json
{
  "items": [
    { "user": { "id": "...", "username": "alice", "displayName": "Alice", "avatarUrl": null },
      "publishedContent": 9, "totalViews": 1200, "totalLikes": 64,
      "canonicalUrl": "https://commonpub.io/u/alice" }
  ],
  "limit": 20
}
```

### `GET /api/public/v1/metrics/engagement`

Scope: `read:analytics`. Aggregate engagement ratios and funnels: content likes/comments-per-view and average views per item; learning enroll to complete; event capacity to attendance; contest entries. Feature-gated sections (`learning`, `events`, `contests`) are present only when that feature is enabled.

### `GET /api/public/v1/metrics/timeseries`

Scope: `read:analytics`. Daily time-series from the `metrics_daily` rollups (written by the `metrics-rollup` worker). Query: `metric` (required: `users.total`, `users.new`, `content.total`, `content.new`, `content.views`, `content.likes`, `content.comments`), `interval` (`day` | `week` | `month`, default `day`), `from`/`to` (`YYYY-MM-DD`, default last 90 days, span clamped to 2 years).

```json
{
  "metric": "users.total",
  "kind": "cumulative",
  "interval": "month",
  "from": "2026-01-01",
  "to": "2026-06-30",
  "since": "2026-01-01",
  "points": [
    { "date": "2026-01-01", "value": 2, "delta": 0 },
    { "date": "2026-02-01", "value": 5, "delta": 3 }
  ]
}
```

`kind: "flow"` series (e.g. `users.new`) sum within a bucket; `kind: "cumulative"` series take the bucket's end value. `delta` is the change versus the previous bucket. Count-based series (`users.*`, `content.total`/`new`) are backfilled from timestamps as a survivorship curve; engagement series (`content.views`/`likes`/`comments`) begin at the first rollup (see `since`).

### `GET /api/public/v1/metrics/federation`

Scope: `read:federation`. Federation reach: known instances, active mirrors, accepted followers, and inbound content by origin domain (domain-level only). Query: `limit`.

Opt-in: requires both `features.federation` and `features.publicApiMetricsFederation` (default OFF). When either is off the endpoint returns `404`, keeping the surface invisible. This exposes network-topology data about third-party instances, so enabling it is a deliberate operator decision on top of granting the `read:federation` scope.

## Audience metrics (persona)

Group totals over the optional questions members answer about themselves. Four
endpoints, all scoped `read:audience`, all requiring `features.persona` and
`features.personaAnalytics`. When either flag is off they return `404`, not
`403`, so an instance that does not run this feature does not advertise it.

Three properties hold across all four, and they are enforced in SQL rather than
in the serializer:

- **Consent is a join, not a check.** Every aggregate INNER JOINs the consent
  table on a current grant whose recorded scope digest equals the live one. A
  grant given against an older disclosure authorises nothing, and there is no
  code path that counts a person without passing through that join.
- **Counts are FLOORED, never rounded**, to a multiple of `quantum` (the
  instance's k-anonymity bucket floor, at least 5). Rounding to nearest would
  publish a true 8 as 10, which on a small instance is a false statement and
  overstates every cohort an operator is making decisions with.
- **A completed UTC day, not a live count.** These endpoints serve the finalised
  rollup and report which day in `asOf`. A live count can be polled, and polling
  reveals the moment a bucket crosses the floor from below, which is the floor
  defeated by repetition.

Two things are refused outright and are not planned: cross-tabulation (asking
for one field split by another), and cohort membership (asking who is in a
bucket). Both turn group totals back into an identification tool.

### `GET /api/public/v1/metrics/persona/fields`

The countable fields on THIS instance, so a caller can discover the cohorts
before asking for one. Schema metadata, never answers. Query: `limit`
(1..100, default 20). Returns `items`, `limit`, `total` and `truncated` (both
counting FIELDS), plus `quantum` and `asOf`.

### `GET /api/public/v1/metrics/persona/distribution`

One field's distribution. Query: `field` (required, a key from `/fields`),
`limit` (1..100, default 20).

```json
{
  "field": "interests",
  "label": "What are you into?",
  "items": [
    { "value": "robotics", "label": "Robotics", "count": 40 },
    { "value": "pcb", "label": "PCB design", "count": 25 }
  ],
  "suppressed": 2,
  "quantum": 5,
  "available": true,
  "asOf": "2026-08-11"
}
```

`suppressed` is a count of withheld BUCKETS, never of people. There is
deliberately no `total`, no `population` and no `eligibleUsers`: publishing a
total alongside suppressed buckets lets a caller subtract, which recovers the
withheld count exactly.

When the surface cannot be served, `available` is `false` and `reason` says
which rule refused. `distribution`, `links` and `fields` use one set of values
and `audience` uses another, because they no longer answer the same kind of
question: the first three count answers the instance holds, and `audience`
counts consent grants.

**`distribution`, `links`, `fields`** — four values, and a consumer switching on
`reason` should handle all of them:

| `reason` | Meaning | What a consumer should do |
|---|---|---|
| `no_snapshot_yet` | This instance has not finished a UTC day yet, or its most recent finalised day is more than a week old. **The first value every new instance returns.** | Retry tomorrow. |
| `insufficient_population` | Fewer counted, eligible members than the instance's minimum. | Nothing; this is a small instance. |
| `insufficient_bucket_diversity` | A single-answer field with any withheld bucket, where the remaining buckets would identify the withheld one by elimination. | Nothing; the field is structurally unpublishable at this size. |
| `statistics_not_covered` | The surface asks for a data class this instance's statistics disclosure does not declare. | Stop asking for it. |

`scope_changed` and `purpose_not_offered` are **not** in that list and cannot
appear on these three. Both were statements about a consent scope, and nothing a
member consents to decides whether the instance counts its own answers.

**`audience`** — four values:

| `reason` | Meaning | What a consumer should do |
|---|---|---|
| `no_snapshot_yet` | As above. | Retry tomorrow. |
| `scope_changed` | The operator changed what sharing covers (a recipient, the policy version, or the set of counted fields), so every existing grant now authorises nothing until members confirm again. | Retry after the next finalisation. |
| `insufficient_population` | Fewer grant holders than the instance's minimum. | Nothing; this is a small instance. |
| `purpose_not_offered` | This instance does not offer that purpose, so nobody could have granted it. | Stop asking for it. |

`asOf` names the finalised UTC day served, or is `null` for a live read and when
no snapshot exists.

### `GET /api/public/v1/metrics/persona/links`

Presence counts per link platform, computed once a day from profile links. No
query parameters: a `limit` would drop platforms from a list whose `suppressed`
count is only meaningful against the whole set. Each item carries
`authenticitySignal`, which says whether an account on that platform is
independently verifiable, not anything about the member.

### `GET /api/public/v1/metrics/persona/audience`

Counts of members who have granted a sharing purpose. This is the ONE endpoint
in the family that requires `features.dataSharingConsents` in addition to the
two persona flags, because it is the only one whose numbers are consent counts.

The payload carries a top-level `available`, `reason`, `quantum` and `asOf`
alongside one slot per registered purpose:

| Slot | Purpose |
|---|---|
| `openToRecruiters` | `recruiter_visibility` |
| `openToSponsorSharing` | `sponsor_sharing` |

There was a third slot, `sharingAnalytics`, counting grants of a
`profile_analytics` purpose. Both are gone. Being counted in instance statistics
is not something a member consents to: it runs on legitimate interest, disclosed
on `/privacy`, with an objection a member can exercise at any time. There is no
endpoint reporting how many members have objected, and there will not be one.

Each slot is a discriminated union: `{ "available": true, "count": 25 }` or
`{ "available": false, "reason": "..." }`. Purposes this release does not offer
are reported as `{ "available": false, "reason": "purpose_not_offered" }` rather
than as `0`. A hard zero that means "not implemented" reads as "nobody opted in",
and an operator would act on it. Counts are floored to `quantum` exactly as
distribution counts are.

**Only `audience` requires `features.dataSharingConsents`.** `fields`,
`distribution` and `links` require `persona` and `personaAnalytics` alone.

All four used to carry the sharing flag, on the reasoning that everything they
counted was a purpose grant and the counting must not outlive the surface where
a member gives and withdraws one. That is still true of `audience`, and it is no
longer true of the other three: they count answers the instance holds about its
own members, under legitimate interest, minus anyone who has objected. Requiring
the sharing flag there would have forced an operator who wants public aggregates
to also switch on third-party sharing they do not do.

Two consequences worth stating for a consumer:

- `links` counts a platform only when the member both lists it and has agreed to
  share it, so these numbers are a lower bound on how many members list a
  platform, and they moved when per-platform sharing shipped.
- A member who has objected is in none of these numbers, and there is no way to
  tell from the API how many people that is.

## Member visibility directory

One endpoint, and the only one in this API that returns identified people. Say
plainly what it is:

**A list of members who asked to be found.** Each one holds a current, explicit
grant for the purpose the audience maps to, given against the disclosure that is
in force today. **No email address is in the payload, ever**, and there is no
contact channel here at all: a recipient reaches somebody through the
direct messages any two accounts on the instance already have, subject to the
same blocking and reporting as every other message on it. Being listed signals
willingness and grants nothing else. **Every read is logged per recipient, and
the member can see who looked.**

It is deliberately not under `/metrics/`. A list of people beneath a metrics
prefix is a category error that invites somebody to hand it an analytics key.
The persona aggregates exist to make individuals unidentifiable; this endpoint
identifies them on purpose, with consent, and the two are separate modules that
share no code path.

### `GET /api/public/v1/members/open-to/{audience}`

Scope: `read:members` (**not** covered by `read:*`). `audience` is `recruiters`
or `sponsors`; anything else is `404`. Requires `features.persona`,
`features.dataSharingConsents` and `features.memberDirectory`, all three of
which return `404` when off, so an instance that does not run the directory does
not advertise it.

**In this release only `recruiters` can return members.** The recruiter purpose
tells members that people approved for hiring will see their public profile, so
it covers disclosing who they are. The sponsor purpose says their interests,
tech stack and profile links are shared, and never that their name is, so
`sponsors` answers `404` rather than publishing names under a sentence nobody
read. Enabling it is a copy change on the purpose, and that change re-asks every
member who already agreed. That cost is the point, not an obstacle.

**The key must be bound to a named recipient.** An operator binds a key to an
entry in `dataSharing.recipients`, and the request is refused with `403` unless
that recipient exists and its declared `purposes` include the purpose the
audience maps to (`recruiters` to `recruiter_visibility`, `sponsors` to
`sponsor_sharing`). The binding is what makes a disclosure attributable: without
it, "who has my data" is a question the instance could not answer. Deleting a
recipient stops its key immediately; revoking the key afterwards is cleanup, not
the control.

Query parameters:

| Parameter | Meaning |
|---|---|
| `interests`, `techStack`, `industry` | Persona option values, repeatable (`?interests=a&interests=b`) or comma-joined (`?interests=a,b`). OR within one field, AND across fields. An unknown field or an unknown option value is a `400`, never a silent empty page. |
| `hasLink` | Link platform keys, **ANDed**: a member must have all of them. A caller wanting either can issue two requests and merge; a caller wanting both cannot express that with any number of OR requests, so the API provides the direction that is not recoverable. |
| `location` | Substring match on the member's own location string. |
| `q` | Username or display name search, identical to `/users`. |
| `limit` | 1..**50**, default 20. Half the metrics family's ceiling, because these are people. |
| `offset` | Default 0. |

```json
{
  "items": [
    {
      "id": "11111111-...",
      "username": "ada",
      "displayName": "Ada Lovelace",
      "headline": "Builds small robots",
      "bio": "Mostly ARM and a lot of solder.",
      "avatarUrl": null,
      "pronouns": "she/her",
      "location": "Manchester",
      "website": "https://ada.example",
      "skills": ["soldering"],
      "socialLinks": { "github": "https://github.com/ada" },
      "createdAt": "2026-01-02T03:04:05.000Z",
      "persona": [
        {
          "fieldKey": "interests",
          "label": "What are you into?",
          "display": "chips",
          "values": ["Robotics"]
        }
      ]
    }
  ],
  "total": 1,
  "hasMore": false,
  "limit": 20,
  "offset": 0,
  "disclosed": 1
}
```

`disclosed` is how many rows this response wrote to the instance's disclosure
log, and it always equals `items.length`. It is published rather than hidden: a
recipient should be able to see that they are being recorded.

What the payload can and cannot carry:

- The public profile fields, through the same serializer every other public
  endpoint uses. That serializer has **no email field at all**, so email is
  structurally absent rather than filtered out.
- The member's persona answers, resolved to **labels**, never raw option
  values. A `sensitive` field never appears, a field the operator marked
  non-public never appears, and a field whose meaning changed since the answer
  was stored is withheld rather than misrepresented.
- Nothing a member's own public profile would not already show. This endpoint
  adds the opt-in signal, the filtering and the audit; it does not widen what is
  visible.

Refusals worth handling separately:

| Status | Meaning |
|---|---|
| `400` | Unknown filter field, unknown option value, or a malformed parameter. The body carries a machine `code`. |
| `403` | Missing `read:members`, **or** the key is not bound to a recipient declared for this audience. |
| `404` | Unknown audience, a feature flag off, or the audience's purpose does not cover disclosing who somebody is. The last one is a real state: a purpose whose member-facing copy never said a name would be shared cannot back a listing of names, and widening it takes a copy change that re-asks every member who already agreed. |

Two things this endpoint does not do, and neither is an oversight. **It cannot
recall what was already disclosed.** A member who revokes disappears from the
next response; earlier disclosures happened and the member-facing copy says so
rather than implying otherwise. And **consent is per audience, not per company**:
a member cannot currently exclude one specific recipient, which needs
per-recipient consent rows and is deferred rather than pretended.

## Metrics privacy contract

These rules are enforced in the serializers and queries, not just documented:

- **Aggregates and intentional public leaderboards only.** No endpoint returns per-individual-user activity (no "who viewed or liked what").
- **No new PII, no tracking.** Every metric derives from columns that already exist (denormalized counters, timestamps). No IP, user-agent, email, referrer, or cookie is read, stored, or returned.
- **Public entities only.** Aggregations count only `status='published'`, `visibility='public'`, non-deleted content, and only active, public-profile, non-deleted users, filtered at the SQL level.
- **Contributor attribution is already-public information.** Leaderboards rank only public-profile users by their already-public published content.
- **Federation reach is opt-in and domain-level.** Never per-user; gated by a config flag that defaults OFF.
- **Persona aggregates are consent-joined, floored and k-anonymised.** Answers count only where the member's grant is current AND its recorded scope digest matches what is disclosed today, and only where their profile is public, their account active and not deleted. Buckets below the floor are dropped inside the database, and the withheld-bucket count is a bucket count, never a person count. Free-text persona answers are never aggregated, never returned, and are not referenced anywhere in the aggregation module.
- **k-anonymity applies to the persona family and to nothing else yet.** The Phase 2 content and contributor metrics are non-pivotable instance aggregates plus an intentional public leaderboard, so no suppression applies to them. The persona endpoints are the first surface where `METRICS_MIN_BUCKET` is enforced, and it is enforced in SQL (`HAVING count(*) >= minBucket`), at write time in the rollup, and again on read so that raising the floor takes effect immediately rather than at the next finalisation.
- **Residual channel, stated rather than hidden.** These are DAILY series. A caller polling once a day can see a bucket appear when it crosses the floor, which says one specific person joined that bucket that day. Serving a finalised day coarsens that observation from hourly to daily; it does not remove it. The population floor (`MIN_AUDIENCE_POPULATION`, 25) is the actual defence, and an operator wanting more should raise `dataSharing.minBucket` and `dataSharing.minPopulation` in `commonpub.config.ts`.
- **Where the thresholds live.** `dataSharing.recipients`, `dataSharing.policyVersion`, `dataSharing.minBucket` and `dataSharing.minPopulation` are declared in `commonpub.config.ts` only. There is no runtime override route for them in this release, and `PUT /api/admin/settings` refuses any `dataSharing.` key.

## Errors

All errors are JSON bodies:

```json
{ "error": true, "statusCode": 401, "statusMessage": "Invalid API key", "message": "..." }
```

| Code | Meaning |
|---|---|
| `400 Bad Request` | Query parameters or body failed validation |
| `401 Unauthorized` | Missing/invalid/expired key |
| `403 Forbidden` | Key is valid but lacks the required scope |
| `404 Not Found` | Resource not found, feature flag off, or draft/private content requested |
| `429 Too Many Requests` | Key exceeded its per-minute limit |

## What is NEVER returned

This is the core safety guarantee. Serializers for every public endpoint are allow-lists — a new column in the underlying DB table is excluded by default until explicitly added to the `to*` helper. Forbidden categories:

- **Auth**: `email`, `emailVerified`, `passwordHash`, session tokens, 2FA state
- **Role/moderation**: `role`, `status`, admin flags, moderation reports, audit log
- **Private content**: drafts (`status != 'published'`), unlisted (`visibility != 'public'`), deleted (`deletedAt IS NOT NULL`)
- **Private messaging**: all `messages.*` rows, group chats, DMs
- **Feature internals**: instance settings, feature-flag overrides, OAuth2 client secrets
- **Federation internals**: instance keypairs, delivery queues, pending activities
- **Other keys**: API keys themselves (prefix or hash)

If you notice a response leaking any of the above, treat it as a security bug and report it via `GET /api/public/v1/instance` → `instance.links.nodeinfo` → instance contact.

## CORS

By default, no `Access-Control-Allow-Origin` headers are sent on actual (non-preflight) responses. The API is designed for server-to-server use, and browsers will block cross-origin calls until a key opts in.

Each key has a CORS allow-list (`allowedOrigins`) of **origin patterns**. The only wildcard metacharacter is `*`:

| Pattern | Matches |
|---|---|
| `*` | Any origin (wildcard-all). Responds with `Access-Control-Allow-Origin: *`. |
| `localhost` | `http://localhost` and `https://localhost` on any port (shorthand). |
| `https://app.example.com` | That exact origin. |
| `http://localhost:*` | Any port on `http://localhost`. |
| `https://*.example.com` | Any subdomain of `example.com` over https. |
| `*://localhost:*` | Any scheme and any port on localhost. |

When a real request's `Origin` matches a non-wildcard pattern, the server reflects it in `Access-Control-Allow-Origin` and advertises `Vary: Origin`. When the list contains `*`, it responds with the literal `*` (no `Vary`). Only `http`/`https` (or `*`) schemes are accepted; `javascript:`, `data:`, and the like are rejected at key-creation time.

### Why `*` is safe here

This API authenticates with `Authorization: Bearer <token>`, **not cookies**. There are no ambient credentials, and the server never sends `Access-Control-Allow-Credentials`. So `Access-Control-Allow-Origin: *` cannot leak anything: a cross-origin page still cannot obtain a key it does not already possess. CORS here only *enables* legitimate browser clients; the Bearer token is what protects the data. Set `["*"]` when you want a fully open, read-only browser API, or `["localhost"]` for local development.

### Origin validation

The server only reflects an `Origin` that is a syntactically valid web origin (`scheme://host[:port]`, no path, query, whitespace, or control characters). Requests whose `Origin` header is malformed or carries control characters receive no CORS headers, which closes off response-header injection. IPv6-literal hosts (`http://[::1]`) and the `null` origin are not supported.

### Preflight

Preflight (`OPTIONS`) requests bypass authentication (they have to, because the browser does not include the `Authorization` header on preflight) and echo any `Origin` so the browser can proceed to the real request. The real request then goes through the per-key allow-list check above, which is the actual gate.

## Versioning and deprecation

- v1 is stable; breaking changes ship as `/api/public/v2/*` with at least 6 months of overlap.
- Additive changes (new fields, new filter params) can land in v1 without a major bump.
- Response fields are documented as a contract — removing or renaming a field is a breaking change.

## Creating a key (admin)

1. Navigate to `/admin/api-keys` on the instance.
2. Click **New key**. Pick a name, check scopes, optionally set an expiry and CORS origins.
3. Submit. The raw token appears in a green reveal panel at the top of the page — copy it now.
4. Share the token with the consumer through a secure channel (1Password, SSO vault, encrypted email). Do not paste it into a chat that logs messages.

## Revoking a key (admin)

Click **Revoke** in the key table. Soft-delete — the `apiKeyUsage` history is preserved; the key is immediately rejected on next request.

Rotation: revoke, then create a new key and hand it off. There's no in-place "rotate" button because atomic rotation requires cutover coordination with the consumer; explicit revoke-and-issue is safer.

## Per-key usage analytics

`GET /api/admin/api-keys/:id/usage?windowDays=7` (admin-only) returns:

```json
{
  "windowDays": 7,
  "totalRequests": 142,
  "errorCount": 3,
  "errorRate": 0.021,
  "requestsByDay": [{ "day": "2026-04-17", "count": 42 }],
  "topEndpoints": [{ "endpoint": "/api/public/v1/content", "count": 88, "p95LatencyMs": 120 }]
}
```

Rendered inline in the admin table under each key's **Usage** button. Default window is 7 days, max 90. The underlying SQL uses conditional aggregation + `percentile_cont(0.95)` — narrow, indexed query on `(keyId, timestamp)`.

## Audit trail

Every `POST /api/admin/api-keys` and `DELETE /api/admin/api-keys/:id` writes to the instance `audit_logs` table with actions `api_key.create` and `api_key.revoke`. The token itself is never audited — only `id`, `name`, `scopes`, and (for create) `expiresAt` + `rateLimitPerMinute` land in the audit metadata. Per-request traffic goes to a separate `api_key_usage` table for analytics; that table only records the key id, endpoint path (no query string), HTTP status, and latency.
