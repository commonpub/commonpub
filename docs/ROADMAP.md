# CommonPub — Roadmap (prioritized remaining work)

> The single source of truth for **what's left and in what order**, consolidated from the
> session-228 audit of all 24 `docs/plans/`. Companion: `docs/STATUS.md` (where things stand +
> how to release/deploy). Snapshot 2026-06-26.
>
> **Context:** both major recent initiatives — the **email/communications overhaul** and **GDPR
> consent** (Phases 1+2 + server enforcement) — are COMPLETE and live on all 3 instances. Almost
> every other plan is COMPLETE or deferred-by-design. What remains is below, ordered by priority.
>
> Tags: **S/M/L** = effort · **risk** = blast radius · **gate** = a decision/prereq before starting.

---

## Tier 0 — Realize & protect what just shipped (highest leverage, low cost)

Do these first: they make a large body of just-shipped work actually useful, or protect it cheaply.

- **0.1 Enable email on an instance** — *operator decision + a Resend secret.* The ENTIRE email
  subsystem (notifications, digests, branding, admin broadcast) is inert in prod
  (`emailNotifications=false`, console adapter). Wire `NUXT_EMAIL_ADAPTER=resend` +
  `NUXT_RESEND_API_KEY`/`NUXT_RESEND_FROM` + `NUXT_PUBLIC_FEATURES_EMAIL_NOTIFICATIONS=true`, verify a
  sending domain in Resend, smoke one real send. Cost/scale model:
  `docs/reference/email-gdpr-scaling-analysis.md`. **Highest leverage** — a whole session's work is dormant. *(operator gate)*
- **0.2 Protective hardening before email scale** — *S, low risk, no gate.* (a) Paginate the digest
  worker's in-memory message build + flush in batches (currently builds all recipients in memory);
  (b) add a `pnpm pack` test-leak check to `publish:layer` (the bracketed-route packaging trap has
  bitten before). Small, defends the email investment + the release pipeline.

---

## Tier 1 — Major pending features (strategic; need your go-ahead + scoping)

The two largest pieces of un-built/partial work. Each needs a "yes, build it" before diving in.

- **1.1 Layout engine — finish + roll out.** *L, medium risk (blank-page), strategic gate.* The
  biggest dormant initiative. The visual page editor is ~80% built but stuck as a **commonpub.io-only
  canary** (`layoutEngine` OFF on deveco/heatsync; `LayoutSlot` is homepage-only). Plans:
  `docs/plans/phase-3-editor.md` (editor) + `docs/plans/layout-engine-rollout.md` (rollout).
  Remaining, in build order:
  - Editor **Phase 3e-remainder** (mobile colSpan slider / rich-field pickers / config-edit undo) + **3f** (inspector polish: per-breakpoint colSpan, visibility-rules form, duplicate/delete-with-confirm).
  - Rollout **Phases 4-10**: adopt `LayoutSlot` in ~7 more routes (hubs, blog/project/learn index, profile, footer, 404); the ~8 remaining section types; mobile editor; versioning/draft/publish/revert UI; then flip the canary to deveco/heatsync.
  - **Includes monolith-4a** (homepage 3-path consolidation) as a natural sub-step — `pages/index.vue` still has 3 branches (engine / custom-sections / legacy); collapsing them belongs to this work + needs a **2-phase deploy that seeds default layouts first** (else blank-page risk).
  - *Scope ONE phase at a time with the user — don't attempt the whole rollout in one go.*
- **1.2 instance-self-update — admin-driven self-update.** *L, decision gate.* Entirely un-built;
  plan status is literally "awaiting maintainer approval" (`docs/plans/instance-self-update.md`).
  Mission-aligned (self-hosted operators want one-click updates): an `/admin/updates` page + backend
  (check-for-update / apply-update) + a scaffolder `update.yml` workflow. **Confirm you want this
  before any build** — it's a product decision, not just engineering.

---

## Tier 2 — Ready, medium-value engineering (no big decision; pick when prioritized)

- **2.1 Federated-follow-from-profile UI (monolith-3c).** *S-M, low risk.* Backend is ready
  (`federation/follow.post.ts`, `remote-follow.post.ts`, `resolveRemoteActor`); the gap is a UI entry
  point to follow a remote actor from a profile. One design call: lightweight handle-input box vs a
  full remote-actor profile page. Completes a federation UX gap.
- **2.2 Extract the `inboxHandlers.onCreate` monolith (monolith-4b).** *M, high risk (federation
  code), test-prereq gate.* `inboxHandlers.ts` is ~1512 lines — the next clear "no monoliths" target
  after the email split. **Prereq: write inbound-`Create` integration tests first** (they anchor the
  refactor + add coverage to federation-critical code). Pure maintainability; do behind the test net.

---

## Tier 3 — Operator actions, polish, and deferred-by-design (do when triggered)

**Operator actions (can't be done headlessly):**
- Federation **P3 mirror Offer→Accept** live round-trip (needs an admin login on two instances).
- `reconcile-counters --check` on each droplet (expect 0 drift); browser-smoke `/admin/federation`.
- RBAC flag-flip rollout decision; enable Redis (`NUXT_REDIS_URL`) / Meilisearch (`MEILI_URL`) if load warrants (both code-complete, switched off by choice).

**Small follow-ups (low priority, S each):**
- Bulk PII review UI (contest); specific-users broadcast picker polish; email open/click analytics;
  contest entry-detail residuals; deferred a11y (`--accent` as small nav/link TEXT; `--green-border`-as-text).

**Deferred-by-design (only when the trigger condition is met — the plans marked these optional):**
- Pagination **step D** (unified `feed_items` timeline) — "only if federated volume grows large."
- Public-API **Phase 4** (event-tracking table) — "if demanded."
- Theme-studio **Phase E** (scoped-modal glass, `border-style` token, full radius migration).
- Contest **B3 teams** / per-entry judge assignment (a generic concern, modelled later).
- Federation small polish: wrap `approveMirrorRequest` in a transaction; admin-notify for custom
  `federation.manage` roles; streaming backfill-progress + filter dry-run preview in the admin UI;
  a public registry directory page.

---

## Recommended next move
1. **Tier 0.2 now** (protective email hardening) — small, no gate, defends a major investment; safe to do immediately.
2. **Decide Tier 1 direction** — the two big questions are "invest in finishing the layout engine?" (1.1) and "build instance self-update?" (1.2). Both are large + gated on your intent. Pick one, or neither, before committing.
3. **Tier 2** is good filler between the big pieces (3c is small + user-facing; 4b is clean maintainability behind tests).
4. **Tier 0.1** (enable email) is a parallel operator track — independent of dev work.
