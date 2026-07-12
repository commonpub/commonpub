# Plan — Content & Hub Privacy Enforcement (P1 LIVE security)

> Created 2026-07-12 (session 231, round-5 audit; fully verified round 6). **The highest-priority
> finding of the entire audit — live on all three instances, unauthenticated, and NOT addressed by
> the other plans.** Every site + the correct predicate below is code-verified (round 6, two agents +
> direct reads). It preempts `federation-email-audit-fixes.md` and `contest-communications.md`.

## The vulnerability

`contentItems.visibility` (`public` | `members` | `private`, `packages/schema/src/enums.ts:17`,
column default `public`) is a first-class user-facing control ("Hub members only" / "Only you /
Private" in the editor). Users rely on it. **But it is enforced on almost no read path.** The shared
`buildContentConditions` (`packages/server/src/content/content.ts:284-343`) only adds a visibility
predicate when the caller explicitly passes `filters.visibility` (`:329-331`) — and nearly no read
caller does. Hub read helpers key on `hubId`/`postId` with **zero** membership predicate. The
session-204 "private-content AP leak (P0)" fix patched exactly ONE path
(`layers/base/server/middleware/content-ap.ts:59`) and every sibling was left enforcing `status` but
not `visibility`/hub-privacy. Most sites are **not** federation-gated, so the flag state is
irrelevant. Net: an **unauthenticated** attacker reads content users marked "Members only"/"Only you"
and the full contents + member roster of a `private` hub.

## The correct predicate (verified — matches the 3 already-safe paths)

`contentItems` has **NO `hubId`** (content is not hub-scoped; the only content↔hub link is the
`hub_shares` join table). Grepping every use of content `visibility`: **no read path grants
`members` content to anyone but the author.** The three correct paths — `resolveContentQuery`
(`contentQuery.ts:22-34`, forces `visibility='public'` for non-owners), `content-ap.ts:55,59`, and
`public/v1` (`content/[slug].get.ts:25-32` = `getContentBySlug(requester=undefined)` + explicit
non-public→404) — all collapse to:

> **An item is readable iff `requesterId === authorId` (any status/visibility) OR
> (`status='published' AND visibility='public' AND deletedAt IS NULL`).** Plus admin / `content.moderate`
> privileged views. `members` and `private` are BOTH author-only today. **Do NOT add a "logged-in
> users see members" branch — no code implements it and it would widen exposure beyond every current
> safe path.** ("Hub members only" as a real feature would need a content↔hub linkage that doesn't
> exist — that's separate future work, not this security fix.)

Hub read access is a **separate** concept (hub privacy, not content visibility): a `private` hub's
posts/roster/gallery/resources/products must be gated on active membership, reusing the
`getHubBySlug:206-227` `hubMembers` (status='active') pattern. `unlisted`/`public` hubs serve by
design.

## Verified leak sites (19) — all CONFIRMED round 6

| # | Site | Helper | Missing predicate | Fed-gated? |
|---|------|--------|-------------------|-----------|
| 1 | `GET /api/content/<slug>` (main detail) | `getContentBySlug` (content.ts:596) | visibility (gates status only) | no |
| 2 | `GET /content/<slug>` (`Accept: activity+json`) | route content/[slug].ts:41-45 | `visibility='public'` | yes (feature.federation) |
| 3 | Instance RSS `feed.xml.ts:19` | `listContent` | `visibility='public'` | no |
| 4 | Per-user RSS `users/[username]/feed.xml.get.ts:24` | `listContent` | `visibility='public'` | no |
| 5 | Hub RSS `hubs/[slug]/feed.xml.get.ts:24` | `listHubGallery` | visibility + membership + `deletedAt` | no |
| 6 | Search (Meilisearch) `contentSearch.ts:82` | `searchContent` | visibility (not even indexed, `:286`) | no |
| 7 | Search (Postgres) `contentSearch.ts:143` | `searchContent` | `visibility='public'` | no |
| 8 | Profile listing `users/[username]/content.get.ts:26` | `getUserContent` (profile.ts:196) | visibility for non-owner | no |
| 9 | Product gallery `products/[slug]/content.get.ts` | `listProductContent` (product.ts:506) | visibility **and** `deletedAt` | no |
| 10 | Private-hub posts `posts/index.get.ts:15` | `listPosts` (posts.ts:133) | membership | no |
| 11 | Single post `posts/[postId].get.ts:11` | `getPostById` (posts.ts:381) | membership | no |
| 12 | Replies `posts/[postId]/replies.get.ts` | `listReplies` (posts.ts:599) | membership | no |
| 13 | Members roster `members.get.ts:20` | `listMembers` (members.ts:359) | membership (leaks roster+roles incl `steward`) | no |
| 14 | Hub gallery `gallery.get.ts` | `listHubGallery` (product.ts:579/642/691) | visibility + membership + `deletedAt` | no |
| 15 | Hub resources `resources/index.get.ts:7` | `listHubResources` | membership | no |
| 16 | Hub products `products.get.ts:20` | `listHubProducts` | membership | no |
| 17 | Draft learning lesson `learn/[slug]/[lessonSlug]/index.get.ts:45` | `getLessonBySlug` (learning.ts:898) | `learningPaths.status='published'` | no |
| 18 | Comments `social/comments.get.ts` | `listComments` (social.ts:190) | parent-visibility/membership | no |
| 19 | `listHubGallery`/`listProductContent` (product.ts:506/579/642/691) | — | `isNull(deletedAt)` (soft-deleted-published resurface) | no |

Search-endpoint nuance: `api/search` routes via the SAFE `resolveContentQuery` ONLY when
`seamlessFederation` is ON **and** there is no author/date/multi-tag filter; otherwise (federation
OFF = the default, or any of those filters) it calls `searchContent` directly → leak reachable in the
default config.

## Legit-access paths the fix MUST preserve (verified caller inventory)

1. **Author viewing own draft/members/private** — `requesterId === authorId` bypass (already in
   `getContentBySlug:596` + `resolveContentQuery` `isOwnContent`).
2. **Owner dashboard / own-profile drafts** — `getUserContent` with `viewerId===profileUserId`
   (profile.ts:196).
3. **Hub member viewing members-only hub posts/roster/gallery/resources** — add the `hubMembers`
   (status='active') check as a GRANT, not a blanket block.
4. **Admin / moderation / role-gated mutations** — `getPostById` is also used by like/lock/pin writes
   and internal refetches; these must still resolve the row (thread privilege, don't blanket-block the
   helper).
5. **Enrolled-learner lesson completion** (`complete.post.ts:14`) and **path-author lesson editing** —
   gate the READ route on path status but keep these flows working.

## Phased fix

**Phase P-1 — content visibility (sites 1-9, 17-19).** Add `visibleContentWhere(requesterId?)` in
`@commonpub/server` = `deletedAt IS NULL AND ((status='published' AND visibility='public') OR
authorId = requesterId)` and thread it into `buildContentConditions`/`listContent`/`getContentBySlug`/
`getUserContent`/`searchContent` (both engines; also add `visibility` to the Meili index +
filter)/`listProductContent`/`feed.xml`. Fix `content/[slug].ts` to match `content-ap.ts`. Add
`isNull(deletedAt)` to the product/gallery helpers. Gate `getLessonBySlug` on `learningPaths.status`
(author/enrolled bypass for the completion flow). For comments (18), gate on the parent's visibility.

**Phase P-2 — hub read access (sites 5, 10-16).** Add `requireHubReadAccess(hub, requesterId)` (=
serve if hub.privacy !== 'private', else require active `hubMembers` row or admin) and a
`getHubBySlug(db, slug, requesterId)` that resolves membership; thread the requester through every
hub read handler (posts/single-post/replies/members/gallery/resources/products) and pass it to the
member-gated helpers. Private-hub `getHubBySlug` must also stop returning the real `hub.id` in its
non-member stub.

**Phase P-3 — regression guard.** A CI grep/lint that FAILS on a raw `from(contentItems)` read (or a
hub-post/member/gallery read) that doesn't route through the shared predicate — so the next new route
can't silently re-introduce the leak (the exact session-204 failure mode). Also audit the adjacent
`profileVisibilityEnum` (same enum on user profiles) — the identical "enum exists, read-gate
forgotten" pattern may apply; confirm profile reads enforce it.

## Behavioral verification gate (do NOT ship on green unit tests)

The methodology audit proved the suite mocks the request boundary and asserts too loosely to catch
this class. Before declaring fixed:
- **HTTP-level tests** hitting every one of the 19 sites **unauthenticated** with a seeded
  members/private item + a private hub → assert 404/redaction, not 200-with-body; **and** a positive
  test that the author/member/admin STILL gets their content (preserve the 5 legit paths).
- The **CI grep guard** (Phase P-3) as an executable regression backstop.

## Rollout

- **P1/P0, live, unauthenticated, no flag needed for most sites.** Preempts all other backlog.
- **Server + layer only, no schema/migration.** Publish `@commonpub/server` + `@commonpub/layer`,
  roll to all 3 per the STATUS runbook; **curl each leak site unauthenticated before/after on every
  instance**, and verify no legit flow regresses (deveco has live email + federation on).
- Consider whether to disclose/patch quietly first given it's a live unauthenticated leak.

## Verified SOLID under re-attack (do not re-litigate)

HTTP-signature verify (raw-body digest, coverage, skew, no alg-confusion, no fail-open, actor↔signer
binding), SSRF pinning on all outbound remote fetches (one residual: megalodon/Mastodon-login axios
check-then-connect rebind TOCTOU, behind the OFF federation-login flag), the AP outbox projection, the
"never federated" local-only data (`steward`/`hub_flags`/`referral_*`/`featuredId`/PII partitions),
the contest scoring/PII/winner path, and the auth/session core (hand-minted-cookie concern remediated).

---

## Implementation status (session 231, branch `session-231-content-privacy`)

**SHIPPED (in working tree, verified):** P-1 (content visibility) + P-2 (hub read access) across the
19 sites. New helpers `content/visibility.ts` (`visibleContentWhere`), `hub/access.ts`
(`canReadHub` + `REDACTED_HUB_ID`), `utils/hubAccess.ts` (`requireHubReadAccess`), membership-aware
`getHubBySlug(requesterId, {asPlatformAdmin})`. Tests: `content-visibility-p1` (20) + `hub-privacy-p2`
(17) + `social.integration` (15) = **52 pass**; server + reference typecheck clean; only the
pre-existing Phase-0 outbox date-bomb failures remain.

**Adversarial verification (workflow) caught + FIXED before commit:**
- **Regression the fix introduced:** the 5 hub WRITE routes (`index.put`/`index.delete`/`products.post`/
  `resources/index.post`/`resources/reorder`) passed `user.id` to `getHubBySlug`, so a platform admin
  who is not a member of a private hub got `REDACTED_HUB_ID` → broken edit/delete (500/403). Fixed by
  switching those writes to the (previously unused) `getHubIdBySlug` write helper. Also
  `updateHub` now threads `asPlatformAdmin` into its return re-fetch (was returning a redacted body /
  nil id to an admin), and `index.get` threads `asPlatformAdmin` (session-230 override consistency).
- **Site 18 half-done:** `listComments` gated only content targets; `post`/`lesson` bypassed. Added a
  hub-membership gate for `post` targets and a path-published gate for `lesson`; `video` has no privacy
  field so it is served. (Regression test added.)

**DEFERRED (tracked follow-ups, NOT blocking this commit):**
- **`profileVisibility`** — the enum/column exist and the public API reads them, but **no writer sets
  it** (default `public`, no settings UI/API), so it is a LATENT surface with nothing to leak today.
  Gate `getUserByUsername` (+ followers/following/feed) when a writer is added.
- **P-3 CI grep guard** — the regression backstop (fail CI on a raw `from(contentItems)` read lacking
  the predicate). The fix is closed + tested; add the guard as a backstop.
- **AP-twin hub collection routes** (`routes/hubs/[slug]/{outbox,followers,products,resources}.ts`)
  serve a private hub over ActivityPub with no privacy gate — but they are behind `federation &&
  federateHubs` (OFF in prod) and belong to the federation plan's item **2e** (private-hub federation
  gate). Handle there.
- **Meilisearch reindex sequencing (ROLLOUT):** `contentSearch.ts` now filters `visibility="public"`.
  On rollout, `configureContentIndex` must re-run (add `visibility`/`authorId` as filterable) AND a
  full reindex must populate the field BEFORE the filter is trusted, or search returns empty/500s
  (fail-closed, not a leak). Add this step to the deploy runbook.
