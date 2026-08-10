# Session 251 — "Validation failed": why nobody could diagnose it, and what was causing it

Operator report: *a user tried to submit an entry / publish a project and got "validation
failed"* — with a guess that it might be an image upload issue. No error payload captured.

Method: a 16-agent `ultracode` audit (5 parallel finders → adversarial refute-by-default
verification → synthesis) run alongside a hands-on local repro against the real UI. The audit
confirmed the finder work and surfaced two causes the repro had not reached.

## The literal string has exactly one source

`"Validation failed"` is produced only by `parseBody` (`layers/base/server/utils/validate.ts`) —
a 400 carrying `data: { errors: zodError.flatten().fieldErrors }`. So it is always a Zod
rejection of a request body, never a business rule. (`parseQueryParams` says "Invalid query
parameters"; the contest routes raise their own specific messages, including session 250's
403 registration gate.)

## Why it was undiagnosable — the bug behind the bug

h3 nests `createError({ data })` under a `data` key of the response **body**, and ofetch sets
`FetchError.data` to that whole body. The per-field map therefore arrives at
**`err.data.data.errors`**. `useApiError.extract` read the shallow `err.data.errors`, which is
*always* `undefined`, and fell through to the bare `statusMessage`.

So every validation failure in the app — all 19 call sites — surfaced as the useless string
"Validation failed" with no field name. Confirmed empirically in a browser, and against the
live wire (`curl 'https://deveco.io/api/contests?limit=abc'` returns the field map fine).
A `grep` for `data.data` across the repo returned zero hits: nothing read the real location.

**Fix:** widen the read to `e?.data?.data?.errors ?? e?.data?.errors`, and log the rejected
field **names** server-side (never values — bodies carry PII) so an operator report is
actionable without a browser.

## What was actually failing

- **Cover "From URL"** (`ProjectEditor`, `ArticleEditor`) took a raw `window.prompt` string with
  no validation. `coverImageUrl` is `optionalUrl()` = absolute http(s) only, so
  `example.com/a.jpg`, `/uploads/x.png` or a copied `data:` URI 400s on **every** later save.
  This is the image-shaped path the operator suspected — but it is the *From URL* option, not
  the file upload. Now: a bare host is normalized to `https://`, anything else is refused with
  a message. The schema guard (session 247's stored-XSS defense) is deliberately left alone —
  fix the input, not the validator.
- **Tags.** `EditorTagInput` had no length or count cap against `max(64)` / `max(20)`. Paste
  fires no `keydown`, so pasting `solar, battery, off-grid, …` and pressing Enter created **one
  68-character tag** that then 400s forever. Now splits on commas, caps per tag and at 20, and
  shows `N/20`.
- **Number fields broke contest forms outright.** Vue's `v-model` on `<input type="number">`
  casts the value to a **number**, but the form model — and the wire contract — is a string. The
  shared helpers called `.trim()` on it: `TypeError` inside a computed, so Save stuck disabled
  and answers were silently dropped. Affects the registration form **and** entry/proposal
  submission (all three surfaces share the helpers). Fixed at both ends — the input keeps a
  string, and the helpers coerce defensively so no DOM value can ever break a form again.
  (deveco's live 41-field form has no number field, so the live contest was not hit.)
- **No client-side length caps** for capped fields (description 2000, seoDescription 320,
  subtitle 255, series 128, buildTime/estimatedCost 64, title 255) — an author could only
  discover a cap by failing to save.
- **`null` in optional-but-not-nullable fields.** `buildSaveBody` stripped `''` but not `null`.
- **`Number('') === 0`** sent for a cleared `estimatedMinutes`, which the server rejects as `>0`.

## …and the message was invisible anyway

The editor page runs with `definePageMeta({ layout: false })`, and the toast host lives in
`layouts/default.vue`. So **every toast the editor raised went nowhere** — a failed publish, the
session-250 contest auto-enter result, the new cover-URL rejection. Mounted `AppToast` on the
editor page. (The inline `cpub-editor-error` banner did work, and is fed by `extractError`, so
it now shows the field-level message.)

## Ruled out

- **The file-upload path is healthy.** Uploads return absolute URLs (S3 adapter
  `${publicUrl}/${key}`; local adapter builds from `SITE_URL`), and all 20 sampled deveco covers
  are absolute `deveco.nyc3.digitaloceanspaces.com` URLs. Create + publish with an uploaded
  cover round-trips 200. No deveco config change is needed.
- Image **blocks** inside content bodies are not validated at all (`content: z.unknown()`), so
  they cannot produce this error.
- Session 250's registration gate raises its own 403 and is never collapsed into this message.
- `z.string().uuid()` strictness — real content/file ids are v4 and pass.

## Verification

10/10 browser checks against the real editor and registration form (cover-URL reject + normalize,
pasted tag list, tag counter, no page errors, publish clean, field-level message surfaced);
layer 1599, editor 267, `pnpm typecheck` 28/28, lint clean. Screenshots reviewed.

**Rolled: editor 0.17.0 / layer 0.125.0** (no schema/config/server change, no migration) to all
three; health ok and `/`, `/contests`, `/feed` 200 on each.

## Open / next

- `optionalUrl()` stays strict by design. If instance-relative covers are ever wanted, that is a
  deliberate schema decision, not a bug fix.
- Still deferred from 250: themed-email redesign, nonce CSP, legacy-URL scrub migration 0046.
