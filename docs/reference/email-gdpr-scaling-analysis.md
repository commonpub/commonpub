# CommonPub — Email, GDPR/Consent, and Scaling Analysis

> Operator-facing analysis compiled 2026-06-25 (session 227). Answers: when consent/terms
> show up + GDPR posture; how email works + current prod state; admin broadcast feasibility;
> digest mechanics + template; Resend spend projections; per-instance scaling capacity.
> Live flag state verified by `curl /api/features` on all 3 (email OFF everywhere).

---

## 0. Headline answers

- **Email is OFF in production on all 3 instances** (`emailNotifications=false` confirmed live;
  adapter defaults to `console`; no Resend/SMTP secret is wired in any deploy workflow). So today
  **$0 email spend and zero emails sent** — including no signup-verification or password-reset mail
  (those use the console no-op adapter). Turning email on is an env-var + flag change, not a code change.
- **Cookie banner**: exists, but only appears if the instance registers a *non-essential* cookie.
  A stock instance ships essential-only cookies, so the banner never shows (legally defensible).
- **Terms/Privacy at signup**: shown as passive notice text ("By creating an account, you agree…"),
  **not a checkbox, and acceptance is not recorded anywhere**. This is the main GDPR gap.
- **Admin "email all/specific users"**: does **not** exist. Every primitive to build it is present.
- **Digests**: fully implemented, opt-in `daily | weekly | none`, **default off**, sent 08:00 UTC,
  content = batched unread in-app notifications, **single hardcoded HTML template, not admin-editable**.
- **Scaling**: one DigitalOcean droplet per instance running app + Postgres + Redis + Meilisearch
  co-located, 1 app replica. Realistic ceiling on the recommended 2 vCPU / 4 GB box is order
  **a few thousand to ~10k registered users** at low concurrency; **Postgres-on-shared-CPU saturates first**.

---

## 1. Cookies, consent, terms & GDPR

### When the cookie banner shows
- Component `layers/base/components/CookieConsent.vue`, mounted in `layouts/default.vue:278`.
- Shows on first visit **only if** `hasNonEssentialCookies` is true, i.e. the instance registered a
  cookie of category `functional` or `analytics` via `cookies` in `commonpub.config.ts`.
- The 3 built-in cookies are all `essential`, so **a stock instance never shows the banner**. That is
  a deliberate, defensible posture (essential cookies don't require consent under GDPR/ePrivacy).
- Choice persists in a 1-year first-party cookie `cpub-consent` (`all` | `essential`). **No server-side
  consent record** — only the user's own browser cookie.

### Cookies set (all first-party, essential only — no trackers)
| Cookie | Purpose | Notes |
|---|---|---|
| `better-auth.session_token` (prod `__Secure-`) | auth session | HttpOnly, secure, sameSite=lax, 7-day |
| `better-auth.session_data` | SSR session cache | cleared on logout/delete |
| `cpub-consent` | stores cookie-consent choice | 1 year |
| `cpub-color-scheme` | light/dark pref | set on theme toggle only |

No analytics/ad/tracking cookies, no GA/Plausible/Matomo. One disclosed third-party network call:
Font Awesome via Cloudflare CDN (no cookie). CSRF is header-based (Origin/Referer), not a cookie.

### Terms / Code of Conduct
- `/terms` (combined Community Terms + Code of Conduct, config-templated per instance), `/privacy`
  (genuine GDPR-aware policy with a federation data-sharing section), `/cookies` (policy + live
  preference manager). All footer-linked.
- At signup (`auth/register.vue`): passive text only, **no opt-in checkbox, acceptance not stored**
  (no `acceptedTermsAt` column, no terms version/hash captured).

### GDPR data rights
- **Export** (`/api/auth/export-data` → `exportUserData`): JSON of profile, content, comments, likes,
  follows, bookmarks, notifications, sent messages. **Incomplete**: omits hub memberships, learning
  enrollments, events/RSVPs, votes, contest entries, **contest PII, and agreement acceptances**, and
  exports only sent (not received) messages.
- **Delete** (`/api/auth/delete-user` → `deleteUser`): **hard delete** of the `users` row; broad DB-level
  `ON DELETE CASCADE` wipes content, social, federation keypairs, and **all contest tables incl. PII +
  agreement acceptances**. Sends best-effort federation `Delete` activities (failures swallowed; remote
  cached copies not guaranteed gone — inherent ActivityPub limitation, disclosed). Last-admin guard.
  Caveat: erasure correctness relies entirely on every PII table keeping its cascade FK — no app-level
  safety net or test asserts the PII tables are emptied.
- **Contest PII** is well-handled: partitioned into `contest_entry_private_fields` (permission-gated)
  and an immutable, hash-snapshotted, IP-stamped `contest_agreement_acceptances` audit log. This is the
  codebase's **only** real consent audit trail (contest-scoped, not site-wide).

### GDPR gap list (specific)
1. **No site-wide terms/consent audit trail** — signup records nothing; can't prove acceptance or which
   version. (Contrast: contests do this correctly.)
2. **No explicit signup opt-in checkbox** — passive notice is weaker than a clear affirmative act.
3. **No cookie-consent audit trail** — choice lives only in the user's browser cookie.
4. **Consent banner doesn't auto-gate cookies** — `allowsFunctional`/`allowsAnalytics` are exposed but
   no built-in path reads them; an operator adding analytics must wire gating themselves (easy to forget).
5. **Data export is narrower than the deletion cascade and narrower than the privacy policy promises**
   (missing contest PII, enrollments, events, votes, received messages).
6. **No config flags** to require terms acceptance, force the banner, or gate on CoC.

---

## 2. How email works

### Architecture
- Three adapters in `packages/infra/src/email.ts`: **Console** (no-op default), **SMTP** (nodemailer),
  **Resend** (HTTP `POST https://api.resend.com/emails`).
- Selected by `NUXT_EMAIL_ADAPTER` (`console` default). Missing creds → silent fallback to console
  (with a prod warning). Resend needs `NUXT_RESEND_API_KEY` + `NUXT_RESEND_FROM`.
- `EmailAdapter.send({ to, subject, html, text })` — **synchronous, one send per call. No queue, no
  batching, no retry, no rate-limiting, no throttle.** Errors are caught at call sites and logged.

### What it can send (5 live paths; 2 templates are dead code)
| Email | Trigger | Wired | Mode | Respects pref |
|---|---|---|---|---|
| Email verification | signup (Better Auth) | yes | immediate | n/a |
| Password reset | forgot-password | yes | immediate | n/a |
| Like | someone likes your content | yes | instant or digest | `likes` |
| Comment | comment on your content | yes | instant or digest | `comments` |
| Follow | new follower | yes | instant or digest | `follows` |
| Mention | @mention | yes | instant or digest | `mentions` |
| Notification digest | scheduler 08:00 UTC | yes | digest | `digest` |
| Contest / hub / fork / build / certificate / system | `createNotification(...)` | **in-app only, no email** | — | — |
| `contestAnnouncement`, `certificateIssued` | — | **defined but never called** | — | — |

- Only `like/comment/follow/mention` map to an email toggle (`TYPE_TO_PREF`). Everything else is in-app
  notification only. Notifications require `email_verified=true` to email. Instant emails are suppressed
  when the user is on daily/weekly digest.
- Templates: hand-written raw-HTML strings with inline styles (no MJML/engine), dark theme, only
  `siteName` + URLs interpolated. Not operator-customizable.

### Current production state
- `emailNotifications` flag = **false on all 3** (verified live). Adapter defaults to `console`. **No
  deploy workflow injects any EMAIL/RESEND/SMTP secret.** → No real email is sent in prod today.
- To enable on an instance: set `NUXT_PUBLIC_FEATURES_EMAIL_NOTIFICATIONS=true` **and**
  `NUXT_EMAIL_ADAPTER=resend` + `NUXT_RESEND_API_KEY` + `NUXT_RESEND_FROM` on the container, plus verify
  a sending domain (SPF/DKIM) in Resend.

---

## 3. Admin email to specific / all users — does NOT exist (but is easy to add)

- No admin compose UI, no broadcast/newsletter endpoint, no "notify users" path. All outbound email is
  system-triggered + per-user. The in-app DM/messages feature is user-to-user, admin-inaccessible, and
  **never emails**.
- All the primitives exist: `useEmailAdapter().send`, `emailTemplates.*` (incl. an unused
  `contestAnnouncement` body), trivial `users` queries (reused by the digest job),
  `createNotification(type:'system')` for in-app delivery, `shouldEmailNotification` + `emailVerified`
  gating, and RBAC `requirePermission`.

### Feasibility sketch (recommended build)
1. Add a permission e.g. `users.notify` to `packages/schema/src/permissions.ts` (auto-granted to admin).
2. New route `layers/base/server/api/admin/broadcast/index.post.ts`, gated by that permission. Body
   `{ subject, message, audience: 'all' | userId[] | { role } }`.
3. Target: filter `users` by `emailVerified=true` (+ role join for by-role).
4. **Batch + throttle the send** through Redis/Valkey (already in the stack) — do NOT loop synchronously
   (see the rate-limit caveat in §6). Optionally also `createNotification(type:'system')` for in-app.
5. Add a `features.adminBroadcast` flag (CLAUDE.md rule 2).
6. **Compliance**: respect `emailNotifications` prefs, only verified users, and **add a per-email
   unsubscribe token/link** — today the footer says "manage your preferences in settings" but there's
   no one-click unsubscribe, which a true broadcast/newsletter needs for CAN-SPAM/GDPR.
7. UI: `admin/broadcast.vue` (compose + audience picker) + a quick-action on the admin dashboard.

---

## 4. Digests — frequency, content, template

- **Scheduler**: Nitro plugin `notification-email.ts`, hourly tick, acts only at **08:00 UTC** (daily) /
  **Monday 08:00 UTC** (weekly). Cross-replica de-dup via `digest_runs` (`onConflictDoNothing` claim →
  exactly one replica sends).
- **Frequency**: per-user `daily | weekly | none`, stored on `users.email_notifications` JSONB.
  **Default = none (off)**, opt-in via `settings/notifications.vue`.
- **Content**: batched **unread in-app notifications** from the last 1 day (daily) / 7 days (weekly),
  max 50, rendered as a linked list. It is notification-driven, **not** an independent "new content from
  your follows" feed. **Skipped entirely if there's no new activity.**
- **What it looks like**: subject `"{N} new notification(s) — {siteName}"`; a 600px dark-themed
  (`#0a0a0a` bg, `#5b9cf6` accent) inline-styled HTML email, JetBrains-Mono uppercase site-name header,
  `Hi {username}, Here's what you missed:` + `<ul>` of linked items + a footer pointing to settings.
  Plain-text fallback included.
- **Per opted-in active user**: daily ≈ **30/mo**, weekly ≈ **4–5/mo** (one per UTC day max), 0 if no
  activity. Default-off users get 0 digests (but may get instant emails if those toggles are on).

### Customizable digest templates (your idea) — assessment
Currently the template is a single hardcoded function (`emailTemplates.notificationDigest` +
`wrapTemplate` in `packages/infra/src/email.ts`); admins can't touch markup, sections, or branding
beyond the instance name. **Feasible and a natural fit.** Where it plugs in:
- Parameterize `wrapTemplate`/`notificationDigest` to accept per-instance overrides (header/footer/
  accent color/intro copy), persisted in an instance-settings row (same pattern as the theme editor's
  `instance_settings`).
- Add an `admin/email-templates.vue` editor following the `admin/features.vue` / theme-editor pattern,
  with a live preview (the codebase already renders email HTML; a preview scene is straightforward).
- Keep a safe-by-default token allowlist (`{siteName}`, `{username}`, `{items}`, unsubscribe link) and
  run author input through the existing `escapeHtml`/sanitizer to avoid HTML-injection in emails.
- Scope creep to watch: full WYSIWYG email design is a large effort; a "branding + intro/footer copy +
  accent" override covers 80% of the value cheaply.

---

## 5. Resend spend projection

Pricing (resend.com, retrieved 2026-06-25 — re-verify on the live page before committing a budget):

| Plan | $/mo | Included/mo | Notes |
|---|---|---|---|
| Free | $0 | 3,000 | **100/day hard cap** |
| Pro | $20 | 50,000 | overage **$0.90 / 1,000** |
| Pro (upper) | $35 | 100,000 | |
| Scale | $90→$650 | 100K→1M | $90/100K · $160/200K · $350/500K · $650/1M; dedicated IP $30/mo add-on |
| Enterprise | custom | 3M+ | |

- **Overage is metered** (you don't have to jump tiers): $0.90/1k on Pro, dropping toward $0.46/1k at
  Scale volumes. Billed in 1,000-email buckets, rounded up.
- **Rate limit: 5 requests/sec per team.** Batch endpoint: up to 100 emails/request → ~500/sec max.

### Email volume per user/month (heuristic)
- Low ~2 (transactional-only / low opt-in), Typical ~6–8 (weekly digest + a little transactional),
  High ~33 (daily digest + transactional). Digests dominate volume.

### Cost by user count (rough, monthly)
| Registered users | Low (~2/u) | Typical (~7/u) | High (~33/u, daily digest) |
|---|---|---|---|
| 1,000 | ~2k → Free/$0* | ~7k → Pro $20 | ~33k → Pro $20 |
| 10,000 | ~20k → Pro $20 | ~70k → Pro $35 | ~330k → Scale ~$350 (or Pro+overage ~$272) |
| 50,000 | ~100k → Pro $35 | ~350k → Scale $350 | ~1.65M → ~$945 (Scale 1.5M + overage) |
| 100,000 | ~200k → Scale $160 | ~700k → Scale $650 (1M) | ~3.3M → Enterprise / ~$1,150+ |

\*The Free tier's **100/day cap** means any digest run to >100 users in a day already exceeds it — in
practice you're on a paid plan as soon as you enable digests for more than ~100 users.

**Context vs alternatives**: Amazon SES is ~$0.10/1k (≈4–9× cheaper than Resend) but you build
deliverability/monitoring yourself. At 3.3M/mo, SES ≈ $330 vs Resend ≈ $1,150+. SendGrid ≈ Resend at the
50k tier; Postmark/Mailgun are pricier per email. Resend is the right default for ergonomics until volume
makes SES's savings worth the operational cost.

### ⚠️ The send path will not scale as written
Before enabling email for more than low-thousands of recipients, the digest/notification sender needs
work — **it is the single biggest email-related engineering risk**:
- It loops **one synchronous `fetch` per recipient**, with **no batching, no throttle, no retry**.
- Resend caps at **5 req/s**; the loop has no throttle, so a large digest run blows past it → **429s**,
  and because there's **no retry, those emails are silently dropped**.
- It runs **in-process on the single app replica at 08:00 UTC**, holding a DB connection and competing
  with request traffic — a 10k-recipient run is 10k serial HTTP calls on the web server.
- Fix before scaling: use Resend's **batch endpoint (100/req)**, throttle to ≤5 req/s, retry-with-backoff
  on 429, and move the send to a dedicated worker/queue (Redis/BullMQ).

---

## 6. Scaling & per-instance capacity

### Topology
One DigitalOcean droplet per instance: Caddy → **1 Nuxt/Nitro app replica** → Postgres + Redis +
Meilisearch, **all co-located**, no CPU/mem limits (except Redis 256 MB). Recommended size
**s-2vcpu-4gb ($24/mo)**; "production" s-4vcpu-8gb. Vertical scaling only today. **Postgres shares CPU/RAM
with SSR + search + workers.** DB pool `max:20` per process. **11 background workers run in-process** as
`setInterval` plugins (federation delivery 30s/batch 20, scheduled-publishing 60s, digest 1h, hub-sync
1h, registry 6h, metrics 6h). Redis is cache + rate-limit + SSE pub/sub, **not a job queue**; the "queue"
is Postgres tables polled on intervals.

### What's already good (verified)
- Keyset pagination on the hot recency/popular feed (no COUNT, no OFFSET); composite hot-read indexes
  (migration 0027); feed N+1 fixed (joins); COUNT gated to page 1; delivery follower-resolution batched;
  multi-replica worker claims are race-safe; Better Auth sessions are DB-backed (replica-safe).

### What saturates first under an influx
**Postgres CPU/connections, co-resident with the app.** The 20-conn pool caps concurrent DB-bound
requests; under burst, requests queue on pool acquisition (5s → 500) while Postgres + Nitro + Meili fight
for 2 vCPUs. Federation delivery and email are interval-throttled / I/O-bound, so they bottleneck a
*federation* or *email* influx, not a *read* influx. Meilisearch competing for RAM is a secondary
saturator on a 4 GB box. SSE connections (each = a Redis subscriber + a 30s DB poll) erode headroom.

### Rough capacity (assumption: 2 vCPU / 4 GB; unmeasured — no load tests in repo)
Roughly **30–80 req/s of mixed authenticated traffic** before p95 degrades — order-of-magnitude **a few
thousand to ~10k registered users at low concurrency** (single-digit-% online), or **low hundreds of
truly-concurrent sessions**. Per-query cost is cheap (indexed, sub-ms to low-ms); the ceiling is
contention, not query cost. Bumping to 4 vCPU / 8 GB (or moving Postgres off-box) roughly multiplies this.
A sudden influx beyond that shows up as slow pages + pool-acquire 500s, not data loss.

### Top 5 changes to reach 10k–100k active users
1. **Move Postgres to its own node** (managed PG or dedicated droplet) — biggest single win; removes the
   primary contention. Add PgBouncer once replicas × pool-20 exceed `max_connections`.
2. **Run N stateless app replicas behind a load balancer, and move the 11 in-process workers into one
   dedicated worker container** (claims are already replica-safe, but running every worker in every
   replica is wasteful and steals request CPU).
3. **Replace table-polling with a real Redis/BullMQ queue**, use `FOR UPDATE SKIP LOCKED` for delivery
   batching, and parallelize the currently-sequential per-inbox delivery loop. (Same fix unblocks email —
   see §5.)
4. **Add the missing `federated_content (publishedAt, id)` composite index and a `pg_trgm` GIN search
   index** (the two remaining full-scan paths); move `/api/content` popular/featured to keyset.
5. **Offload realtime fanout** (dedicated SSE/WS tier or hosted pub/sub) and put a CDN/edge cache in front
   of public read pages so SSR + the 30s SSE DB-poll aren't paid per connected viewer.

---

## 7. Suggested priorities

1. **GDPR quick wins** (low effort, real risk reduction): add a signup terms-acceptance checkbox that
   records `acceptedTermsAt` + terms version, and add a per-email unsubscribe link. Both are small.
2. **Before enabling email at any real scale**: fix the send path (batch + throttle + retry + queue).
   This gates both the digest and any admin-broadcast feature.
3. **Admin broadcast** + **customizable digest templates**: both are feasible and share the same
   template/queue plumbing — build them together after #2.
4. **Scaling**: fine as-is for current traffic; if an influx is anticipated, do #1 (Postgres off-box) and
   #2 (worker separation) from the §6 list first.
