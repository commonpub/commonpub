/**
 * registrationMarkdown — a small, forgiving markdown DSL for authoring a contest
 * registration (or stage submission) form as text, and the inverse serializer so a
 * built form round-trips back to editable markdown. Pure + framework-free so it can
 * be unit-tested and reused by the editor UI (client-side only — the parsed
 * `FormField[]` is saved through the normal contest PUT, which re-validates).
 *
 * DSL (see docs/reference/registration-markdown.md):
 *   ## Section Title            → a `section` field
 *   A line right after a heading → that section's description (help)
 *   - Label* (type, pii): a, b  → a field:  `*` = required,  (…) = type + modifiers,
 *                                 `: a, b` = options (select/radio)
 *     > help text               → indented `>` line = the field's help
 *     - term line               → indented bullets under an `(agreement)` = its terms
 *
 * Modifiers inside (…): a type keyword (text/textarea/number/date/select/radio/
 * checkbox/email/tel/url/agreement/address/file/signature or an alias), plus any of
 * `required`, `pii`, `max=N` (maxLength), `accept=…` (file mime), `size=N` (maxSizeKb).
 */
import type { FormField } from '@commonpub/schema';
import { fieldKeyFromLabel } from './contestStages';

type FieldType = FormField['type'];

const VALID_TYPES: readonly FieldType[] = [
  'text', 'textarea', 'number', 'date', 'select', 'radio', 'checkbox',
  'email', 'tel', 'url', 'agreement', 'address', 'file', 'signature', 'section',
];

// Author-friendly aliases → canonical type.
const TYPE_ALIASES: Record<string, FieldType> = {
  phone: 'tel', dropdown: 'select', choice: 'select', longtext: 'textarea',
  paragraph: 'textarea', link: 'url', agree: 'agreement', sig: 'signature',
  header: 'section', heading: 'section', check: 'checkbox',
};

function resolveType(token: string): FieldType | null {
  const t = token.toLowerCase();
  if ((VALID_TYPES as readonly string[]).includes(t)) return t as FieldType;
  return TYPE_ALIASES[t] ?? null;
}

function optionValue(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 120) || 'option';
}

export interface ParseResult {
  fields: FormField[];
  /** Human-readable problems (blocking or advisory) with 1-based line numbers. */
  errors: string[];
}

/** Parse the DSL into a FormField[]. Never throws; problems collect in `errors`. */
export function registrationMarkdownToTemplate(md: string): ParseResult {
  const errors: string[] = [];
  const fields: FormField[] = [];
  const usedKeys = new Set<string>();
  let current: FormField | null = null;
  let currentIsSectionHeading = false;
  const termLines: string[] = []; // accrues for the current agreement

  const flushTerms = (): void => {
    if (current && current.type === 'agreement' && termLines.length) {
      current.terms = termLines.join('\n');
    }
    termLines.length = 0;
  };

  const uniqueKey = (label: string): string => {
    const base = fieldKeyFromLabel(label);
    let key = base;
    // Reserve room for the `_n` suffix so a ≤40-char cap can't truncate it back to
    // `base` and loop forever (two labels sharing a 40-char key would hang).
    for (let n = 2; usedKeys.has(key); n++) {
      const suffix = `_${n}`;
      key = base.slice(0, 40 - suffix.length) + suffix;
    }
    usedKeys.add(key);
    return key;
  };

  const lines = md.replace(/\r\n?/g, '\n').split('\n');
  // Authors paste documented forms that carry an HTML comment header (the jinger
  // reference form does); the DSL should ignore `<!-- … -->` blocks rather than
  // choke on them. `inComment` carries an unterminated opener across lines.
  let inComment = false;
  lines.forEach((raw, i) => {
    const ln = i + 1;
    let line = raw;
    if (inComment) {
      const end = line.indexOf('-->');
      if (end === -1) return; // whole line is still inside the comment
      line = line.slice(end + 3);
      inComment = false;
    }
    // Drop any complete inline `<!-- … -->` spans, then an unterminated opener
    // enters comment mode and truncates the rest of the line.
    line = line.replace(/<!--[\s\S]*?-->/g, '');
    const open = line.indexOf('<!--');
    if (open !== -1) { inComment = true; line = line.slice(0, open); }
    const raw2 = line;
    const trimmed = raw2.trim();
    if (!trimmed) return;
    // Count leading indentation, treating a tab as two spaces so tab-indented help /
    // agreement terms aren't misread as unparseable top-level lines.
    const indent = (raw2.match(/^[ \t]*/)?.[0] ?? '').replace(/\t/g, '  ').length;

    // Heading → section field.
    const heading = trimmed.match(/^#{1,6}\s+(.*)$/);
    if (heading && indent === 0) {
      flushTerms();
      const label = heading[1].trim();
      current = { key: uniqueKey(label), label, type: 'section', required: false };
      fields.push(current);
      currentIsSectionHeading = true;
      return;
    }

    // Indented continuation (help / agreement terms) for the current field.
    if (indent >= 2 && current) {
      const content = trimmed.replace(/^([-*]|>)\s+/, '');
      if (current.type === 'agreement') {
        termLines.push(content);
      } else if (current.type === 'section') {
        current.help = current.help ? `${current.help} ${content}` : content;
      } else {
        current.help = current.help ? `${current.help} ${content}` : content;
      }
      return;
    }

    // Unindented paragraph immediately under a section heading → section description.
    if (indent === 0 && currentIsSectionHeading && current && !/^[-*]\s+/.test(trimmed)) {
      current.help = current.help ? `${current.help} ${trimmed}` : trimmed;
      return;
    }

    // Top-level list item → a field.
    if (indent === 0 && /^[-*]\s+/.test(trimmed)) {
      flushTerms();
      currentIsSectionHeading = false;
      const parsed = parseFieldLine(trimmed.replace(/^[-*]\s+/, ''), ln, errors);
      if (!parsed) return;
      parsed.key = uniqueKey(parsed.label);
      fields.push(parsed);
      current = parsed;
      return;
    }

    errors.push(`Line ${ln}: could not parse "${trimmed.slice(0, 60)}" (expected a "## Section", a "- Field", or indented help/terms).`);
  });
  flushTerms();

  // Advisory validation (the server PUT re-validates authoritatively).
  if (fields.length > 50) errors.push(`Too many fields (${fields.length}); the maximum is 50.`);
  for (const f of fields) {
    if ((f.type === 'select' || f.type === 'radio') && !(f.options && f.options.length)) {
      errors.push(`Field "${f.label}" is a ${f.type} but has no options (add "…: option1, option2").`);
    }
    if (f.type === 'agreement' && !f.terms?.trim()) {
      errors.push(`Agreement "${f.label}" has no terms (add indented bullet lines under it).`);
    }
  }
  return { fields, errors };
}

/** A `(…)` group is a type spec only if it names a known type or a modifier —
 *  otherwise it's just part of the label (e.g. "Shirt size (S/M/L)"). */
function isSpecLike(content: string): boolean {
  return content
    .split(',')
    .map((s) => s.trim())
    .some((t) => !!resolveType(t) || /^(required|pii|private)$/i.test(t) || /^(max|accept|size)\s*=/i.test(t));
}

/** Split a spec on commas, re-joining `accept=` value fragments (mime `a/b` or bare
 *  `.ext`) that a naive comma-split would sever. */
function specTokens(spec: string): string[] {
  const out: string[] = [];
  for (const t of spec.split(',').map((s) => s.trim()).filter(Boolean)) {
    const prev = out[out.length - 1];
    if (prev && /^accept\s*=/i.test(prev) && !t.includes('=') && (t.includes('/') || /^\.\w+$/.test(t))) {
      out[out.length - 1] = `${prev},${t}`;
    } else {
      out.push(t);
    }
  }
  return out;
}

function parseFieldLine(text: string, ln: number, errors: string[]): FormField | null {
  // Extract the LAST `(…)` group that actually looks like a spec; a non-spec `(…)`
  // (a label such as "Shirt size (S/M/L)") is left as part of the label.
  let spec = '';
  const specRe = /\(([^)]*)\)/g;
  let m: RegExpExecArray | null;
  let chosen: { start: number; len: number; content: string } | null = null;
  while ((m = specRe.exec(text)) !== null) {
    if (isSpecLike(m[1])) chosen = { start: m.index, len: m[0].length, content: m[1] };
  }
  if (chosen) spec = chosen.content;

  // Parse the spec first — the type decides how the rest is split.
  let type: FieldType = 'text';
  let pii = false;
  let required = false;
  let maxLength: number | undefined;
  let accept: string | undefined;
  let maxSizeKb: number | undefined;
  for (const token of specTokens(spec)) {
    const asType = resolveType(token);
    if (asType) { type = asType; continue; }
    const lower = token.toLowerCase();
    if (lower === 'required') { required = true; continue; }
    if (lower === 'pii' || lower === 'private') { pii = true; continue; }
    const kv = token.match(/^(max|accept|size)\s*=\s*(.+)$/i);
    if (kv) {
      const k = kv[1].toLowerCase();
      if (k === 'max') maxLength = clampInt(kv[2], 1, 4000);
      else if (k === 'size') maxSizeKb = clampInt(kv[2], 1, 100 * 1024);
      else accept = kv[2].trim().replace(/\|/g, ',').slice(0, 300);
      continue;
    }
    errors.push(`Line ${ln}: unknown modifier "${token}".`);
  }

  // The label is the text BEFORE the spec; options (choice types) follow a ": " AFTER
  // the spec — so a colon inside the label ("Deadline: when?" / "Region: pick") never
  // splits it.
  let labelPart = text;
  let optsPart = '';
  if (chosen) {
    labelPart = text.slice(0, chosen.start);
    const afterSpec = text.slice(chosen.start + chosen.len).replace(/^\s+/, '');
    if (afterSpec.startsWith(':')) optsPart = afterSpec.slice(1);
  }
  labelPart = labelPart.trim();

  // A trailing `*` marks required; `\*` is a literal asterisk in the label.
  if (/\\\*$/.test(labelPart)) labelPart = labelPart.slice(0, -2) + '*';
  else if (labelPart.endsWith('*')) { required = true; labelPart = labelPart.slice(0, -1).trim(); }
  labelPart = labelPart.replace(/\\\*/g, '*');
  if (!labelPart) { errors.push(`Line ${ln}: a field needs a label.`); return null; }

  const field: FormField = { key: '', label: labelPart.slice(0, 120), type, required };
  if (pii) field.pii = true;
  if (maxLength) field.maxLength = maxLength;
  if (accept) field.accept = accept;
  if (maxSizeKb) field.maxSizeKb = maxSizeKb;
  if (type === 'agreement') field.mustAccept = true;
  if ((type === 'select' || type === 'radio') && optsPart.trim()) {
    const parsed = optsPart.split(',').map((o) => {
      const eq = o.indexOf('=');
      if (eq >= 0) return { value: o.slice(0, eq).trim().slice(0, 120), label: o.slice(eq + 1).trim().slice(0, 120) };
      const label = o.trim().slice(0, 120);
      return { value: optionValue(label), label };
    }).filter((o) => o.label);
    const withValue = parsed.filter((o) => o.value.length > 0);
    if (withValue.length < parsed.length) errors.push(`Line ${ln}: an option on "${labelPart}" has an empty value.`);
    if (withValue.length) field.options = withValue;
  }
  return field;
}

function clampInt(raw: string, min: number, max: number): number | undefined {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return undefined;
  return Math.min(Math.max(n, min), max);
}

/** Serialize a FormField[] back into the DSL (round-trips with the parser). */
export function templateToRegistrationMarkdown(fields: FormField[]): string {
  const out: string[] = [];
  for (const f of fields) {
    if (f.type === 'section') {
      out.push(`\n## ${f.label}`);
      if (f.help) out.push(f.help);
      continue;
    }
    const mods: string[] = [f.type];
    if (f.pii) mods.push('pii');
    if (f.maxLength) mods.push(`max=${f.maxLength}`);
    if (f.accept) mods.push(`accept=${f.accept.replace(/,/g, '|')}`);
    if (f.maxSizeKb) mods.push(`size=${f.maxSizeKb}`);
    // Escape a trailing `*` in the label so it round-trips as a literal, not the
    // required marker (the parser un-escapes `\*`).
    const escLabel = f.label.replace(/\*$/, '\\*');
    let line = `- ${escLabel}${f.required ? '*' : ''} (${mods.join(', ')})`;
    if ((f.type === 'select' || f.type === 'radio') && f.options?.length) {
      line += `: ${f.options.map((o) => (o.value === optionValue(o.label) ? o.label : `${o.value}=${o.label}`)).join(', ')}`;
    }
    out.push(line);
    if (f.type === 'agreement' && f.terms) {
      for (const t of f.terms.split('\n')) out.push(`  - ${t.replace(/^[•\-*]\s*/, '')}`);
    } else if (f.help) {
      out.push(`  > ${f.help}`);
    }
  }
  return out.join('\n').trim() + '\n';
}
