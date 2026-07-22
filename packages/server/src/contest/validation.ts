import { createHash } from 'node:crypto';
import type { ContestSubmissionTemplateField } from '@commonpub/schema';
import { isFormFieldPii } from '@commonpub/schema';
import type { AgreementAcceptanceInput, PartitionedSubmission } from './types.js';

// Pure submission-form validation + partition. No DB access — exhaustively
// unit-testable. The DB writers (recordPrivateAndAgreements, submitStageArtifact,
// submitContestProposal) live in submissions.ts and consume these.

/** Truthy markers an `agreement`/`checkbox` value is "accepted/checked". */
const ACCEPTANCE_VALUES = new Set(['true', 'on', '1', 'yes', 'accepted', 'checked']);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Personal-data partition test. Delegates to the SINGLE SOURCE OF TRUTH in
// `@commonpub/schema` (isFormFieldPii) so the write path here and every reader
// (registrants table, CSV export, DSAR) agree byte-for-byte — a drift silently
// hides a stored answer (read from the wrong map) or leaks PII to the public jsonb.
const isPiiField = isFormFieldPii;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Canonicalize a uuid to lowercase (Postgres `uuid::text` form) so file references
 *  compare consistently across write, the /raw reverse lookup, and the orphan sweep. */
export function canonicalUuid(v: string): string {
  return v.trim().toLowerCase();
}

/** sha-256 hex of an agreement's terms text (integrity check vs the snapshot). */
export function hashTerms(terms: string): string {
  return createHash('sha256').update(terms, 'utf8').digest('hex');
}

/**
 * Validate an entrant's submission values against a stage template AND partition
 * them into artifact / PII / agreements. Pure + exhaustively testable. Domain
 * checks, not just shape: unknown keys rejected (no smuggling values outside the
 * template), required fields non-blank, `url`/`email`/`number`/`select`/`date`/
 * `address` validated for their kind, agreements must be accepted when required.
 * PII (`pii`/`address`) and agreement fields are kept OUT of `artifact`.
 */
export function validateSubmissionFields(
  template: ContestSubmissionTemplateField[],
  values: Record<string, string>,
): { ok: true; result: PartitionedSubmission } | { ok: false; error: string } {
  const byKey = new Map(template.map((f) => [f.key, f]));
  for (const key of Object.keys(values)) {
    if (!byKey.has(key)) return { ok: false, error: `Unknown field: ${key}` };
    if (typeof values[key] !== 'string') return { ok: false, error: `Invalid value for ${key}` };
    if (values[key]!.length > 4000) return { ok: false, error: `${byKey.get(key)!.label} is too long (max 4000 characters)` };
  }

  const artifact: Record<string, string> = {};
  const pii: Record<string, string> = {};
  const agreements: AgreementAcceptanceInput[] = [];

  for (const field of template) {
    // Section headers are display-only (title + help) — no value, nothing to
    // validate or store. A stray value under a section key is rejected by the
    // unknown-key guard above only if the key isn't in the template; a section's
    // own key carries no data, so skip it entirely.
    if (field.type === 'section') continue;

    const value = (values[field.key] ?? '').trim();

    // Agreements are consent, not data — recorded separately, never in the artifact.
    if (field.type === 'agreement') {
      const mustAccept = field.mustAccept !== false; // default true
      const accepted = ACCEPTANCE_VALUES.has(value.toLowerCase());
      if ((field.required || mustAccept) && !accepted) {
        return { ok: false, error: `You must accept: ${field.label}` };
      }
      if (accepted) {
        agreements.push({
          fieldKey: field.key,
          label: field.label,
          terms: field.terms ?? '',
          termsFormat: field.termsFormat ?? 'markdown',
        });
      }
      continue;
    }

    // Checkbox: a normalized boolean. A required checkbox must be checked.
    if (field.type === 'checkbox') {
      const checked = ACCEPTANCE_VALUES.has(value.toLowerCase());
      if (field.required && !checked) return { ok: false, error: `${field.label} must be checked` };
      (isPiiField(field) ? pii : artifact)[field.key] = checked ? 'true' : 'false';
      continue;
    }

    if (!value) {
      if (field.required) return { ok: false, error: `${field.label} is required` };
      continue; // optional + blank ⇒ omit
    }

    // Per-field character cap (≤ the 4000 hard cap already checked above).
    if (field.maxLength != null && value.length > field.maxLength) {
      return { ok: false, error: `${field.label} is too long (max ${field.maxLength} characters)` };
    }

    switch (field.type) {
      case 'url': {
        // Scheme allow-list FIRST (https?:// only), then structural URL parse.
        if (!/^https?:\/\//i.test(value)) return { ok: false, error: `${field.label} must be an http(s) URL` };
        try {
          if (!new URL(value).hostname) return { ok: false, error: `${field.label} must be a valid URL` };
        } catch {
          return { ok: false, error: `${field.label} must be a valid URL` };
        }
        break;
      }
      case 'email':
        if (!EMAIL_RE.test(value)) return { ok: false, error: `${field.label} must be a valid email address` };
        break;
      case 'number':
        if (!Number.isFinite(Number(value))) return { ok: false, error: `${field.label} must be a number` };
        break;
      case 'date':
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))) {
          return { ok: false, error: `${field.label} must be a valid date` };
        }
        break;
      case 'select':
      case 'radio': {
        // `radio` is a display variant of `select` — same value contract.
        const allowed = new Set((field.options ?? []).map((o) => o.value));
        if (!allowed.has(value)) return { ok: false, error: `${field.label}: choose one of the listed options` };
        break;
      }
      case 'tel': {
        // Lenient phone check: allowed chars are digits, spaces, and + ( ) - .
        // (international formats vary), capped at 20 chars — AND must carry a real
        // number of digits (7–15, the E.164 range) so a punctuation-only string
        // like "(((((((" can't pass as a phone number.
        const digits = (value.match(/\d/g) ?? []).length;
        if (value.length > 20 || !/^\+?[0-9 ().-]+$/.test(value) || digits < 7 || digits > 15) {
          return { ok: false, error: `${field.label} must be a valid phone number` };
        }
        break;
      }
      case 'address': {
        let parsed: unknown;
        try {
          parsed = JSON.parse(value);
        } catch {
          return { ok: false, error: `${field.label} is not a valid address` };
        }
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          return { ok: false, error: `${field.label} is not a valid address` };
        }
        break;
      }
      case 'file': {
        // SHAPE only: the value is a files.id uuid. Ownership + visibility + mime/
        // size are verified in the DB-backed post-validation step (validateFileFields),
        // never here — this validator is pure (no DB).
        if (!UUID_RE.test(value)) return { ok: false, error: `${field.label}: attach a file` };
        break;
      }
      // text / textarea: no extra domain check.
    }

    // Canonicalize a `file` reference to lowercase: `UUID_RE`/the uuid cast accept
    // mixed case, but every reader compares against `files.id::text` (canonical
    // lowercase). Storing it lowercase keeps the reverse-lookup + orphan-sweep
    // reference checks correct — a mismatch would make the sweep DELETE a live file.
    const stored = field.type === 'file' ? canonicalUuid(value) : value;
    (isPiiField(field) ? pii : artifact)[field.key] = stored;
  }

  return { ok: true, result: { artifact, pii, agreements } };
}

/**
 * Back-compat artifact-only validator (the original per-stage-artifact contract).
 * Delegates to `validateSubmissionFields` and returns just the public artifact —
 * PII/agreement fields, if any, are partitioned out and handled by the caller.
 */
export function validateStageArtifactFields(
  template: ContestSubmissionTemplateField[],
  fields: Record<string, string>,
): { ok: true; fields: Record<string, string> } | { ok: false; error: string } {
  const r = validateSubmissionFields(template, fields);
  if (!r.ok) return r;
  return { ok: true, fields: r.result.artifact };
}
