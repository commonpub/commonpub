import { createHash } from 'node:crypto';
import type { ContestSubmissionTemplateField } from '@commonpub/schema';
import type { AgreementAcceptanceInput, PartitionedSubmission } from './types.js';

// Pure submission-form validation + partition. No DB access — exhaustively
// unit-testable. The DB writers (recordPrivateAndAgreements, submitStageArtifact,
// submitContestProposal) live in submissions.ts and consume these.

/** Truthy markers an `agreement`/`checkbox` value is "accepted/checked". */
const ACCEPTANCE_VALUES = new Set(['true', 'on', '1', 'yes', 'accepted', 'checked']);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * A field whose value is personal data — stored in the private table, not the
 * public artifact. `address` is structured personal data and is ALWAYS PII.
 * `email` defaults to PII too (an entrant's contact email in the public artifact is
 * an operator footgun), but an operator who genuinely wants a public contact email
 * can opt out with an explicit `pii: false`. Any field can be flagged with `pii: true`.
 */
function isPiiField(f: ContestSubmissionTemplateField): boolean {
  if (f.type === 'address') return true;
  if (f.pii === true) return true;
  if (f.type === 'email') return f.pii !== false; // default-PII, explicit opt-out
  return false;
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
      case 'select': {
        const allowed = new Set((field.options ?? []).map((o) => o.value));
        if (!allowed.has(value)) return { ok: false, error: `${field.label}: choose one of the listed options` };
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
      // text / textarea: no extra domain check.
    }

    (isPiiField(field) ? pii : artifact)[field.key] = value;
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
