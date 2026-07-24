# Plan — Surfacing registration data to the people who act on it (shipping, verification, consent)

**Status:** PROPOSED (design only). Author context: session 246. Companion to the rich
registration work (`rich-contest-registration-forms.md`) and the form-UX change (session 246:
dedicated `/register` page + short-form modal).

## 0. The gap

Rich registration now *captures* everything Jinger asked for (shipping address, entity
verification file, signature, consents). But "captured" ≠ "usable by the person who ships
the dev kit or verifies the docs." Three concrete gaps surfaced when auditing
`ContestRegistrantsPanel` + the registrants export:

1. **Address renders as a JSON blob.** The `address` type is stored as one JSON-encoded
   string (`server/src/contest/validation.ts` partition); the registrants table + CSV print
   that raw string. A fulfillment coordinator can't paste `{"line1":…,"city":…}` into a
   shipping label.
2. **File / signature answers aren't retrievable from the table.** They're private refs
   (a storage key / JSON), served only via the gated `files/[id]/raw` route. The registrants
   panel shows the ref value, not a **download link** — so verifying an entity document or a
   signature from that table isn't wired.
3. **PII is all-or-nothing, owner-scoped.** The registrants route gates PII on
   `contest.pii` (`registrants.get.ts`); the per-contest `editor` stakeholder does **not**
   get it. There's no way to hand a shipping coordinator *just the address list* without
   granting full PII across the contest.

## 1. Current state (verified)

- **Admin view:** `ContestRegistrantsPanel.vue` → `GET /api/contests/[slug]/registrants`
  (organizer-gated; `includePii` true only when the viewer holds `contest.pii`) → a table,
  answers label-mapped by the template. `section` + `agreement` columns are skipped. CSV via
  `GET …/registrants-export` (same gating, formula-injection-neutralized).
- **PII partition:** public answers → `contest_registrations.fields`; PII (address/email/
  flagged) → `contest_registration_private_fields`; consent → `contest_agreement_acceptances`
  (terms snapshot + IP + timestamp). Shared `isFormFieldPii` drives both write + read side
  (`ContestRegistrantsPanel.vue:38`).
- **Files:** private uploads stream from `layers/base/server/api/files/[id]/raw.get.ts`
  (auth + `contest.pii`-gated, 404-not-403, no-store) — the plumbing exists; the registrants
  UI just doesn't link to it.
- **Judges:** score **entries**, never see registrations (correct — different concern).

## 2. Fixes

### Fix A — render structured addresses as columns (the shipping blocker)

- `address` values are a fixed JSON shape (`{recipient?, line1, line2?, city, region, postal,
  country}`). Add a shared `parseAddress(value): AddressParts | null` + `formatAddressLines`
  helper in `@commonpub/schema` (so server export + client table share it, per the
  "server routes don't auto-import utils" rule).
- **Registrants table:** an `address` column renders the parsed lines (recipient / street /
  city, region postal / country) stacked, not the JSON string.
- **CSV export:** explode each `address` field into **separate columns**
  (`{label} Recipient`, `{label} Street`, `{label} City`, `{label} Region`, `{label} Postal`,
  `{label} Country`) so a coordinator gets a clean, mail-merge-ready sheet. Keep the
  formula-injection neutralization per column.

### Fix B — download links for file / signature answers

- The registrants route already knows the private ref; return a **resolved download URL**
  (the existing `files/[id]/raw` path) alongside the value, gated the same as PII.
- **Table:** `file` / `signature` cells render a "Download" link (filename + size) instead of
  the raw ref. `signature` (typed-name) renders the name inline; `signature` (drawn image, if
  P6 lands) renders a thumbnail + link.
- **CSV:** emit the download URL in the cell (staff already authenticated).
- Reuse the P0 private-storage gating — **no** new public exposure; the link 404s without
  `contest.pii`.

### Fix C — a scoped "fulfillment" surface (PII without full contest.pii)

Two options, pick at impl:

- **(C1, lighter) A shipping-only export + role.** Add a per-contest `fulfillment`
  stakeholder role (extend `STAKEHOLDER_ROLES`, `validators/contest.ts:257`) that grants
  **only** the shipping-address + recipient/phone columns of the registrants export (not
  free-text PII, not files). The registrants route checks this role as an alternate to
  `contest.pii` but returns a **restricted projection** (address/phone only). Mirrors the
  existing owner-OR-role gate idiom.
- **(C2, simpler now) Keep `contest.pii` as the gate, add a "Shipping list" export.** A
  dedicated `GET …/shipping-export` (contest.pii-gated) that returns only recipient + address
  + phone as clean columns — so an organizer with PII can hand off a focused sheet without
  exposing the whole registrant table. No new role.

Recommend **C2 first** (no new role, immediate value), C1 later if operators need to delegate
without granting full PII.

### Fix D (small) — surface consent/agreement status

Agreements are recorded but invisible in the registrants table (columns are skipped). Add a
compact **"Consents: N/N accepted"** indicator per registrant (from
`contest_agreement_acceptances` counts) so an organizer can confirm required consents were
captured, with the full audit still in the GDPR export.

## 3. Where this touches

- Schema: `@commonpub/schema` — `parseAddress`/`formatAddressLines` shared helpers;
  (C1) `STAKEHOLDER_ROLES` + `fulfillment`.
- Server: `packages/server/src/contest/registrations.ts` (`listContestRegistrants` returns
  parsed address parts + resolved file URLs + consent counts); `export` (address columns,
  file URLs); new `shipping-export` (C2) or role-gated projection (C1).
- Layer API: `contests/[slug]/registrants.get.ts`, `registrants-export.get.ts`, new
  `shipping-export.get.ts`.
- UI: `ContestRegistrantsPanel.vue` (address cells, download links, consent indicator,
  a "Shipping list" download button).

## 4. Phasing

- **S1 — Fix A (addresses as columns) + Fix B (file/signature downloads).** Highest value,
  no schema-role change; touches the registrants read path + export + panel.
- **S2 — Fix C2 (shipping-only export).** One gated route + a button.
- **S3 — Fix D (consent indicator).**
- **S4 (optional) — Fix C1 (fulfillment role).** Only if delegation-without-full-PII is asked
  for.

## 5. Constraints / landmines

- Never widen the private-storage exposure: file/signature links stay `contest.pii`-gated,
  404-not-403, no-store (P0 invariants).
- Address parsing must tolerate legacy / partial values (older rows, missing fields) — render
  what's present, never throw (a blank cell beats a 500 in the registrants table).
- CSV formula-injection neutralization must apply **per exploded column**, not just the whole
  cell.
- The shared `parseAddress` must live where both server (export) and client (table) import it
  — `@commonpub/schema`, not a layer `utils/` (Nitro routes don't auto-import those).
- If the `group`/team field lands (`team-registration-and-collaborative-content.md`), the
  registrants surfacing must handle a group value (team roster) — coordinate the two.
