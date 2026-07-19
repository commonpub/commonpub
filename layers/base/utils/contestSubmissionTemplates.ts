import type { ContestSubmissionTemplateField } from '@commonpub/schema';
import { fieldKeyFromLabel } from './contestStages';

/**
 * Field presets + whole-form templates for the submission-form builder (P2). Pure
 * data + helpers so they unit-test in isolation; the builder UI
 * (FormTemplateEditor) appends a preset or replaces the whole form via the
 * `templatePreset*`/template builders here. Keys are derived from the label and
 * uniquified against the existing template so two "Email" fields don't collide
 * (template field keys must be unique — `contestStageSchema`).
 *
 * Address/Agreement presets + the address/shipping templates are PII-gated
 * (`features.contestPii`): the agreement/address field types are only offered in
 * the builder when that flag is on, so the UI hides them otherwise. The pure
 * builders take an explicit `{ pii }` so they degrade the same way in isolation.
 */
type TemplateField = ContestSubmissionTemplateField;

/** Default terms an organiser can keep or edit; shared by the preset + template. */
export const RULES_AGREEMENT_TERMS =
  'By entering, I confirm this submission is my own original work and I agree to the contest rules and code of conduct.';

/** A ready-made eligibility attestation for US-entity-only contests (organiser can edit). */
export const US_ENTITY_TERMS =
  'I confirm that the entity I am entering on behalf of is a legally registered entity in the United States.';

/** Make `base` unique within `taken` by appending `_2`, `_3`, … */
function uniqueKey(taken: Set<string>, base: string): string {
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}_${n}`)) n += 1;
  return `${base}_${n}`;
}

/** Stamp keys on a set of keyless fields, keeping them unique among themselves. */
function withKeys(fields: Array<Omit<TemplateField, 'key'> & { key?: string }>): TemplateField[] {
  const taken = new Set<string>();
  return fields.map((f) => {
    const key = uniqueKey(taken, f.key || fieldKeyFromLabel(f.label));
    taken.add(key);
    return { ...f, key };
  });
}

// ─── One-click field presets (the "Add field" menu) ───

export interface FieldPreset {
  id: string;
  /** Menu label. */
  label: string;
  /** FontAwesome icon (no `fa-solid` prefix). */
  icon: string;
  /** Requires `features.contestPii` (agreement/address field types). */
  pii?: boolean;
  /** The field this preset seeds (key derived from the label at add time). */
  field: Omit<TemplateField, 'key'>;
}

export const FIELD_PRESETS: FieldPreset[] = [
  { id: 'text', label: 'Short text', icon: 'fa-font', field: { label: 'Short answer', type: 'text', required: false } },
  { id: 'textarea', label: 'Long text', icon: 'fa-align-left', field: { label: 'Details', type: 'textarea', required: false } },
  { id: 'url', label: 'Link (URL)', icon: 'fa-link', field: { label: 'Link', type: 'url', required: false, help: 'Include the full https:// address.' } },
  { id: 'email', label: 'Email', icon: 'fa-envelope', field: { label: 'Email address', type: 'email', required: false } },
  { id: 'number', label: 'Number', icon: 'fa-hashtag', field: { label: 'Number', type: 'number', required: false } },
  { id: 'select', label: 'Dropdown', icon: 'fa-list', field: { label: 'Choose one', type: 'select', required: false, options: [{ value: '', label: '' }] } },
  { id: 'radio', label: 'Choice (radio)', icon: 'fa-list-check', field: { label: 'Choose one', type: 'radio', required: false, options: [{ value: '', label: '' }] } },
  { id: 'checkbox', label: 'Checkbox', icon: 'fa-square-check', field: { label: 'Confirm', type: 'checkbox', required: false } },
  { id: 'date', label: 'Date', icon: 'fa-calendar', field: { label: 'Date', type: 'date', required: false } },
  { id: 'tel', label: 'Phone', icon: 'fa-phone', field: { label: 'Phone number', type: 'tel', required: false } },
  { id: 'section', label: 'Section header', icon: 'fa-heading', field: { label: 'Section title', type: 'section', required: false } },
  {
    id: 'address',
    label: 'Mailing address',
    icon: 'fa-location-dot',
    pii: true,
    field: { label: 'Mailing address', type: 'address', required: false, pii: true, help: 'Stored privately. Only staff with PII access and the entrant can read it.' },
  },
  {
    id: 'agreement',
    label: 'Agreement',
    icon: 'fa-file-signature',
    pii: true,
    field: { label: 'Agreement', type: 'agreement', required: true, mustAccept: true, terms: RULES_AGREEMENT_TERMS },
  },
  {
    id: 'us-entity',
    label: 'US entity attestation',
    icon: 'fa-flag-usa',
    pii: true,
    field: { label: 'Eligibility', type: 'agreement', required: true, mustAccept: true, terms: US_ENTITY_TERMS },
  },
  {
    id: 'signature',
    label: 'Signature',
    icon: 'fa-signature',
    pii: true,
    field: { label: 'Signature', type: 'signature', required: true, help: 'Type your full name to sign.' },
  },
  {
    id: 'file',
    label: 'File upload',
    icon: 'fa-file-arrow-up',
    pii: true,
    /** Also requires the contestPrivateFiles flag — the builder filters it out otherwise. */
    field: { label: 'Upload a document', type: 'file', required: false, help: 'Stored privately. Only staff with PII access and you can read it.' },
  },
];

/** Presets offered for the builder, gated by whether PII field types are enabled. */
export function availableFieldPresets(pii: boolean): FieldPreset[] {
  return pii ? FIELD_PRESETS : FIELD_PRESETS.filter((p) => !p.pii);
}

/** Append a preset field, deriving a unique machine key from its label. */
export function templatePresetAdded(t: TemplateField[], preset: FieldPreset): TemplateField[] {
  const taken = new Set(t.map((f) => f.key));
  const key = uniqueKey(taken, fieldKeyFromLabel(preset.field.label));
  return [...t, { ...preset.field, key }];
}

// ─── Whole-form templates (the "Start from template" picker) ───

export interface SubmissionFormTemplate {
  id: string;
  label: string;
  description: string;
  /** Requires `features.contestPii` to seed its address/agreement fields. */
  pii?: boolean;
  /** Build the field array; flag-adaptive so it degrades when PII / private files
   *  are off (those field types are simply omitted). */
  build(opts: { pii: boolean; privateFiles?: boolean }): TemplateField[];
}

const SHIPPING_AGREEMENT_TERMS =
  'If selected, I agree to provide a valid shipping address and accept responsibility for any hardware sent to me.';

export const SUBMISSION_FORM_TEMPLATES: SubmissionFormTemplate[] = [
  {
    id: 'standard',
    label: 'Standard proposal',
    description: 'Name, summary, description, approach (and a rules agreement when PII is on).',
    build({ pii }): TemplateField[] {
      const fields: Array<Omit<TemplateField, 'key'>> = [
        { label: 'Project name', type: 'text', required: true },
        { label: 'One-line summary', type: 'text', required: true, help: 'A single sentence describing your idea.' },
        { label: 'Description', type: 'textarea', required: true, help: 'What you are building and the problem it solves.' },
        { label: 'Approach', type: 'textarea', required: false, help: 'How you plan to build it (optional).' },
      ];
      if (pii) fields.push({ label: 'Contest rules', type: 'agreement', required: true, terms: RULES_AGREEMENT_TERMS, mustAccept: true });
      return withKeys(fields);
    },
  },
  {
    id: 'hardware',
    label: 'Hardware / shipping',
    description: 'Standard proposal plus a mailing address and a shipping agreement (PII).',
    pii: true,
    build({ pii }): TemplateField[] {
      const fields: Array<Omit<TemplateField, 'key'>> = [
        { label: 'Project name', type: 'text', required: true },
        { label: 'One-line summary', type: 'text', required: true, help: 'A single sentence describing your idea.' },
        { label: 'Description', type: 'textarea', required: true, help: 'What you are building and the problem it solves.' },
      ];
      if (pii) {
        fields.push({ label: 'Mailing address', type: 'address', required: true, pii: true, help: 'Stored privately. Only staff with PII access and the entrant can read it.' });
        fields.push({ label: 'Shipping agreement', type: 'agreement', required: true, terms: SHIPPING_AGREEMENT_TERMS, mustAccept: true });
      }
      return withKeys(fields);
    },
  },
  {
    id: 'comprehensive-intake',
    label: 'Comprehensive challenge intake',
    description: 'A full sectioned registration form (track, contact, org, project, shipping, consent, signature) — reproduces a rich challenge intake. Edit to taste.',
    pii: true,
    build({ pii, privateFiles }): TemplateField[] {
      const fields: Array<Omit<TemplateField, 'key'>> = [
        { label: 'Challenge track', type: 'section' as const, required: false, help: 'Which track are you entering?' },
        { label: 'Track', type: 'radio' as const, required: true, options: [{ value: 'developer', label: 'Developer' }, { value: 'startup', label: 'Startup' }] },
        { label: 'Your details', type: 'section' as const, required: false },
        { label: 'Full name', type: 'text' as const, required: true },
        { label: 'Country of residence', type: 'select' as const, required: true, options: [{ value: 'us', label: 'United States' }, { value: 'ca', label: 'Canada' }, { value: 'gb', label: 'United Kingdom' }, { value: 'other', label: 'Other' }] },
        { label: 'I confirm I am eligible to participate under the contest rules', type: 'checkbox' as const, required: true },
        { label: 'Organization (optional)', type: 'section' as const, required: false, help: 'If you are entering on behalf of an organization.' },
        { label: 'Organization name', type: 'text' as const, required: false },
        { label: 'Your role', type: 'text' as const, required: false },
        { label: 'Organization website', type: 'url' as const, required: false, help: 'Include the full https:// address.' },
        { label: 'Project', type: 'section' as const, required: false },
        { label: 'Project page URL', type: 'url' as const, required: true, help: 'A link to your project (repo, demo, or write-up).' },
      ];
      // Email is default-PII; contact + shipping + consent are the PII-gated cluster.
      if (pii) {
        fields.push(
          { label: 'Email address', type: 'email' as const, required: true },
          { label: 'Dev-kit shipping', type: 'section' as const, required: false, help: 'Where we ship hardware if you are selected. Stored privately.' },
          { label: 'Shipping address', type: 'address' as const, required: false, pii: true },
          { label: 'Phone number', type: 'tel' as const, required: false, pii: true },
          { label: 'Compliance & consent', type: 'section' as const, required: false },
          { label: 'Eligibility & rules', type: 'agreement' as const, required: true, mustAccept: true, terms: US_ENTITY_TERMS },
          { label: 'Intellectual property & liability', type: 'agreement' as const, required: true, mustAccept: true, terms: 'I confirm my submission is my own original work, and I accept the contest IP, liability, and governing-law terms.' },
          { label: 'I consent to publicity of my participation and results', type: 'checkbox' as const, required: false },
          { label: 'I acknowledge that AI tools may assist judging', type: 'checkbox' as const, required: false },
        );
        // Private document upload (registered-entity docs) — only when the
        // private-storage path is enabled; otherwise omitted (still a valid form).
        if (privateFiles) {
          fields.push(
            { label: 'Registered entity documents', type: 'file' as const, required: false, pii: true, help: 'Upload proof of registration (PDF). Stored privately.', accept: 'application/pdf,image/*' },
          );
        }
      }
      fields.push(
        { label: 'Signature', type: 'section' as const, required: false, help: 'Print your name, date, and sign below.' },
        { label: 'Print name', type: 'text' as const, required: true },
        { label: 'Date', type: 'date' as const, required: true },
        { label: 'Signature', type: 'signature' as const, required: true, help: 'Type your full name to sign.' },
      );
      return withKeys(fields);
    },
  },
  {
    id: 'minimal',
    label: 'Minimal',
    description: 'Just a project name and a link.',
    build(): TemplateField[] {
      return withKeys([
        { label: 'Project name', type: 'text', required: true },
        { label: 'Link', type: 'url', required: false, help: 'Include the full https:// address.' },
      ]);
    },
  },
  {
    id: 'blank',
    label: 'Blank',
    description: 'Start with no fields.',
    build(): TemplateField[] {
      return [];
    },
  },
];

/** Templates offered for the builder, gated by whether PII field types are enabled. */
export function availableFormTemplates(pii: boolean): SubmissionFormTemplate[] {
  return pii ? SUBMISSION_FORM_TEMPLATES : SUBMISSION_FORM_TEMPLATES.filter((t) => !t.pii);
}
