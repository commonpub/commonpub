# Handling likely-fake accounts

Status: **proposed** (session 260, 2026-10-08). Nothing built yet.

Prompted by suspected fake accounts on deveco.io during the live Qualcomm contest.

## What exists today

| Capability | State | Where |
| --- | --- | --- |
| Suspend a user | Yes. Kills sessions, audited, middleware treats them as signed out | `packages/server/src/admin/admin.ts` (status update), `layers/base/server/middleware/auth.ts` |
| Hard-delete a user | Yes. Cascades, purges private files, audited | `layers/base/server/api/admin/users/[id].delete.ts` |
| Filter users by email confirmed | Yes | `/admin/users` |
| Paginate users | **Yes from layer 0.138.2** (was capped at the newest 20) | `layers/base/pages/admin/users.vue` |
| Signup rate limit | 5 requests/min per IP on `/api/auth/*` | `packages/infra/src/security.ts` |
| Captcha / Turnstile / honeypot / disposable-domain list | **None** | n/a |
| Email-verified required to register, enter or vote in a contest | **No.** Unverified accounts only lose email delivery | contest routes don't check `emailVerified` |
| Close or pause signups, approval queue | **None** | n/a |
| Signup IP | Partly: `sessions.ip_address` / `user_agent` per login. The signup consent row has IP columns but they aren't written | `packages/schema/src/auth.ts` |
| Agreement-acceptance IP for contest entries | Yes | `packages/server/src/contest/submissions.ts` |
| User reports (reason `spam`), admin queue | Yes | `/admin/reports` |
| Suspended user's contest entries / content | **Still public.** The entries listing filters on content status, not `users.status` | `packages/server/src/contest/entries.ts` |

## Common practice

- **Graduated trust instead of a binary ban.** Discourse starts new accounts at trust
  level 0 with link, attachment and DM limits, and promotes them automatically.
  Mastodon has approval-required signups, then freeze, then limit (hidden), then
  suspend (30 days to recover, then purged). Each action notifies the user, who gets
  one appeal.
- **Hide, don't announce.** GitHub hides flagged accounts from everyone else (a
  shadow flag) rather than banning them outright. Stack Exchange voids sockpuppet
  votes daily without punishing the target.
- **Contests verify at payout, not at entry.** Hackster, AIcrowd and Zindi rules:
  potential winners are "subject to verification", may need to sign an affidavit of
  eligibility, one prize per person or household, multiple accounts mean
  disqualification, and the sponsor may void suspicious entries. AIcrowd asks
  winners for government ID.
- **Detection signals:** disposable email domains, signup bursts, several accounts
  on one IP, ASN or user agent, generated-looking usernames, no activity after
  signup, email never confirmed, duplicate entry text.
- **GDPR:** fraud prevention is a legitimate interest (Art 6(1)(f), Recital 47). A
  significant decision made solely by automation, such as an automatic suspension,
  falls under Art 22: a person must review it, the user must be able to contest it,
  and they are owed an explanation. Let automation flag and a person decide.

## Recommendation

### Now, with no code (deveco contest)

0. **One concrete case already.** maxic93 (account created 2026-08-05, submitted
   09-04) and pldubouilh (account created 09-04, submitted 09-06) entered proposals
   with the **identical title**. Open both entries and compare. If it's one person
   twice, keep one entry and leave the other out with Pick manually at the cut.

1. **Pull the evidence (read-only).** For every contest registrant and entrant:
   `users.created_at`, `email_verified`, email domain, `sessions.ip_address` /
   `user_agent`, agreement-acceptance IP, referral attribution. Group by IP, by
   domain and by signup minute. Check the domains against the disposable list
   (github.com/disposable-email-domains). Use a read replica or a one-off read query
   through the deploy tooling, not hand edits over SSH.
2. **A person reviews each suspect.** For clear fakes, **suspend, don't delete.**
   Suspension can be undone, keeps the evidence, and is audited. Deleting destroys
   the evidence you'd need to answer an appeal.
3. **Pull their entries out of judging.** Suspension alone leaves an entry visible
   and in the judges' list. Either archive the backing project (admin content), or
   leave the entry out when you advance with **Pick manually**.
4. **Put it in the rules.** Check that the Qualcomm rules say: one entry or prize
   per person, multiple accounts mean disqualification, the sponsor may void
   suspicious entries, and winners must verify identity and eligibility before
   payout. Verify identity **at payout**, not for everyone.

### Build, in order

| # | Change | Effort | Why |
| --- | --- | --- | --- |
| 1 | Hide a suspended user's entries and content from public lists and the judge page | ~0.5 day | Closes the gap above. Same class of fix as the existing visibility predicates. Pin every caller (sitemap, feeds, entries, search) |
| 2 | Flag: require a confirmed email to register, enter or vote in a contest | ~0.5 day | Cheapest real barrier. Soft verification is already ON on deveco |
| 3 | `/admin/users`: status filter, signup-date sort, "shares IP with N accounts" column, bulk suspend; write IP and user agent on the signup consent row | ~2 days | Turns the SQL above into a screen an operator can use |
| 4 | Disposable-domain blocklist at signup (vendored list, behind a flag) | ~0.5 day | Stops the cheapest fakes at the door |
| 5 | Cloudflare Turnstile on signup, behind a flag, plus CSP update | ~1 day | Stops scripted signups. Needs a CSP and cookie-disclosure entry |
| 6 | "Limited" account state plus a notice-and-appeal email | ~2–3 days + migration | The Mastodon model. Gets Art 22 right once enforcement is partly automated |

Every item needs a feature flag (rule 2) and tests first (rule 11).
