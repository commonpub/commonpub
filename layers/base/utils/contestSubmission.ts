import { isRequiredFormField, type ContestSubmissionTemplateField } from '@commonpub/schema';

// Client-side helpers for the entrant submission form (the per-stage artifact
// form + the proposal form share these). The SERVER (validateSubmissionFields)
// is the authoritative validator; these only drive UX (required gating, the
// payload shape) so the two surfaces behave identically.

/** Markers a checkbox/agreement value counts as accepted/checked. */
const TRUTHY = new Set(['true', 'on', '1', 'yes', 'accepted', 'checked']);

export function isChecked(value: string | undefined): boolean {
  return TRUTHY.has((value ?? '').trim().toLowerCase());
}

/** Structured mailing-address subfields (stored JSON-encoded in the value). */
export const ADDRESS_SUBFIELDS = [
  { key: 'line1', label: 'Address line 1' },
  { key: 'line2', label: 'Address line 2' },
  { key: 'city', label: 'City' },
  { key: 'region', label: 'State / region' },
  { key: 'postal', label: 'Postal code' },
  { key: 'country', label: 'Country' },
] as const;

export type AddressValue = Partial<Record<(typeof ADDRESS_SUBFIELDS)[number]['key'], string>>;

export function parseAddress(value: string | undefined): AddressValue {
  if (!value) return {};
  try {
    const o = JSON.parse(value);
    return o && typeof o === 'object' && !Array.isArray(o) ? (o as AddressValue) : {};
  } catch {
    return {};
  }
}

/** Serialize an address to a compact JSON string, or '' when entirely empty. */
export function serializeAddress(addr: AddressValue): string {
  const cleaned: AddressValue = {};
  for (const { key } of ADDRESS_SUBFIELDS) {
    const v = (addr[key] ?? '').trim();
    if (v) cleaned[key] = v;
  }
  return Object.keys(cleaned).length ? JSON.stringify(cleaned) : '';
}

/** True when a field's value is "filled" for required purposes (type-aware). */
export function isFieldFilled(field: ContestSubmissionTemplateField, value: string | undefined): boolean {
  // Sections are display-only (no input) — never "unfilled", so a required
  // section can't block submission (mirrors the server, which skips section).
  if (field.type === 'section') return true;
  const v = (value ?? '').trim();
  if (field.type === 'checkbox' || field.type === 'agreement') return isChecked(v);
  if (field.type === 'address') return Object.keys(parseAddress(v)).length > 0;
  return v.length > 0;
}

/**
 * The KEYS of fields that block submission: required-but-empty fields, plus any
 * must-accept agreement that isn't accepted. "Required" is the shared
 * `isRequiredFormField` predicate (@commonpub/schema) so the entry gate, the
 * registration form's inline gate, the signup card's form-first decision, and the
 * server's enforcement can't diverge. Mirrors the server so the entrant sees the
 * problem before the round-trip.
 */
export function blockingFieldKeys(
  template: ContestSubmissionTemplateField[],
  values: Record<string, string>,
): string[] {
  return template.filter((f) => isRequiredFormField(f) && !isFieldFilled(f, values[f.key])).map((f) => f.key);
}

/** As `blockingFieldKeys`, but the human labels (for the entrant-facing summary). */
export function blockingFields(
  template: ContestSubmissionTemplateField[],
  values: Record<string, string>,
): string[] {
  const keys = new Set(blockingFieldKeys(template, values));
  return template.filter((f) => keys.has(f.key)).map((f) => f.label);
}

/**
 * Build the submit payload: trimmed values, omitting blanks. Checkbox/agreement
 * normalize to 'true'/'false'; address passes its JSON through; everything else
 * is the trimmed string. Empty optional fields are dropped.
 */
export function buildSubmissionPayload(
  template: ContestSubmissionTemplateField[],
  values: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of template) {
    const raw = (values[f.key] ?? '').trim();
    if (f.type === 'checkbox' || f.type === 'agreement') {
      // Only send a positive marker (the server treats absent as not-accepted).
      if (isChecked(raw)) out[f.key] = 'true';
      else if (f.type === 'checkbox' && raw) out[f.key] = 'false';
    } else if (raw) {
      out[f.key] = raw;
    }
  }
  return out;
}
