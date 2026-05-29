/**
 * autoFormSchema — pure Zod → form-field descriptor engine (Phase 3e).
 *
 * Converts a section's `configSchema` (a `z.ZodType`) into a normalized
 * `AutoFormField[]` that `<AdminLayoutsInspectorSection>` /
 * `<AdminLayoutsInspectorRow>` render as native inputs reusing the
 * `cpub-inspector-page-*` design language.
 *
 * ## Why hand-rolled, not FormKit (session 167 decision)
 *
 * The Phase 3 plan + `feedback-phase-3-hybrid-libraries` prescribed
 * `@formkit/zod` for this. Verified against source at session 167:
 *   1. `@formkit/zod`'s `createZodPlugin` adds VALIDATION ONLY to a form
 *      whose inputs you hand-author — it does NOT generate fields from a
 *      schema (formkit.com/plugins/zod). It delivers none of Phase 3e's
 *      auto-gen goal.
 *   2. `@formkit/zod@2.0.0` peer-deps `zod@^3`; the monorepo is on
 *      `zod@4.3.6` everywhere. FormKit has not shipped Zod 4 support.
 * The plan's risk register pre-authorized this exact fallback ("fall back
 * to a hand-rolled <AutoForm> — Phase 3e decision"). See
 * `project-session-167-formkit-pivot` memory.
 *
 * ## How it works
 *
 * Zod 4 ships a native `z.toJSONSchema()` that emits a complete, stable
 * JSON Schema (type/enum/minLength/maxLength/pattern/minimum/maximum/
 * minItems/maxItems/default/nested items+properties/required). We walk
 * THAT (a well-specified format) rather than poking Zod internals, so the
 * engine is resilient to Zod's internal churn. The §7.10 input-mapping
 * table maps 1:1 onto JSON Schema node kinds.
 *
 * The engine is intentionally framework-free (no Vue imports) so it is
 * unit-testable in isolation — per `feedback-css-cascade-unit-test-blind-spot`,
 * keeping the LOGIC pure means the only place a CSS-cascade bug can hide
 * is the `.vue` view, which gets the fresh-eyes pass.
 */
import { z, type ZodType } from 'zod';

/** The native input control a field maps to. */
export type AutoFormControl =
  | 'text'
  | 'textarea'
  | 'number'
  | 'select'
  | 'toggle'
  | 'array'
  | 'group'
  | 'unsupported';

export interface AutoFormOption {
  value: string | number;
  label: string;
}

export interface AutoFormField {
  /** Object key in the config blob (also the `name` for refs / labels). */
  key: string;
  /** Humanized label derived from `key` (e.g. `customTitle` → "Custom title"). */
  label: string;
  /** The control to render. */
  control: AutoFormControl;
  /**
   * Whether the field is required IN FORM TERMS — i.e. present in the
   * schema's `required` array AND has no `default`. A field with a default
   * is pre-filled, so it never blocks the user; we don't asterisk it.
   */
  required: boolean;
  /**
   * True when the field can legitimately be ABSENT — not in `required` AND
   * no `default` (e.g. the optional row-config enums). Selects use this to
   * offer a leading "default/unset" option so a `undefined` value doesn't
   * masquerade as the first real choice being selected.
   */
  optional: boolean;
  /** JSON Schema `description` — reserved for the §7.10 `keyword:arg`
   *  rich-field extension (rich/content-picker/image/color). Unused in v1. */
  description?: string;
  /** Schema default, if any. */
  defaultValue?: unknown;
  // --- string constraints ---
  minLength?: number;
  maxLength?: number;
  /** Regex source string (e.g. URL guards). Carried for inline validation. */
  pattern?: string;
  // --- number constraints ---
  min?: number;
  max?: number;
  /** Step granularity — 1 for integers, undefined (any) for floats. */
  step?: number;
  // --- select (enum + union-of-const) ---
  options?: AutoFormOption[];
  // --- array (repeater) ---
  /** For `array<object>`: the per-item sub-fields. */
  itemFields?: AutoFormField[];
  /** A blank item to append when the user clicks "+ Add". */
  itemDefault?: unknown;
  minItems?: number;
  maxItems?: number;
  // --- group (nested object) ---
  fields?: AutoFormField[];
}

export interface AutoFormModel {
  fields: AutoFormField[];
  /** True when the schema exposes no editable properties (e.g. `stats`). */
  isEmpty: boolean;
}

/**
 * maxLength at/above which a string renders as a multi-line textarea
 * instead of a single-line input. Tuned against the real section schemas:
 * caption(480)/subtitle(500)/body(800)/markdown(100k)/html(8k,50k) become
 * textareas; title(240)/heading(240)/name(255)/alt(240) stay single-line.
 * URL-pattern strings bypass this (see the `string` branch) — they're
 * single-line regardless of their 2048 cap.
 */
const LONG_TEXT_THRESHOLD = 480;

type JsonNode = Record<string, unknown>;

/** `#/$defs/Foo` → root.$defs.Foo. Zod inlines single-use subschemas but
 *  emits $ref/$defs when one is reused; resolve defensively either way. */
function resolveRef(node: JsonNode | undefined, root: JsonNode): JsonNode {
  if (!node) return {};
  const ref = node['$ref'];
  if (typeof ref !== 'string') return node;
  // Only the local "#/$defs/Name" form is produced by z.toJSONSchema.
  const m = /^#\/\$defs\/(.+)$/.exec(ref);
  if (!m) return node;
  const defs = root['$defs'] as Record<string, JsonNode> | undefined;
  const target = defs?.[m[1]!];
  // Merge so sibling keywords on the $ref node (rare) aren't lost.
  return target ? { ...target, ...stripRef(node) } : node;
}

function stripRef(node: JsonNode): JsonNode {
  const { ['$ref']: _ref, ...rest } = node;
  return rest;
}

/** `customTitle` → "Custom title"; `paddingY` → "Padding y"; `categorySlug` → "Category slug". */
export function humanizeKey(key: string): string {
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Enum value → display label. Keeps short slugs as-is (they're already
 *  terse design tokens like "sm"/"primary"); just trims. Numbers stringify. */
function optionLabel(value: string | number): string {
  return String(value);
}

function isConstUnion(node: JsonNode): node is JsonNode & { anyOf: JsonNode[] } {
  const anyOf = node['anyOf'];
  return Array.isArray(anyOf) && anyOf.length > 0 && anyOf.every((o) => o && typeof o === 'object' && 'const' in o);
}

/** Walk one object node's `properties` into fields. */
function objectToFields(node: JsonNode, root: JsonNode): AutoFormField[] {
  const properties = (node['properties'] as Record<string, JsonNode> | undefined) ?? {};
  const required = Array.isArray(node['required']) ? (node['required'] as string[]) : [];
  return Object.entries(properties).map(([key, raw]) => nodeToField(key, raw, root, required.includes(key)));
}

function nodeToField(
  key: string,
  rawNode: JsonNode,
  root: JsonNode,
  inRequiredArray: boolean,
): AutoFormField {
  const node = resolveRef(rawNode, root);
  const defaultValue = node['default'];
  // Form-required: in the required list AND no default to pre-fill it.
  const required = inRequiredArray && defaultValue === undefined;
  // Optional: absent-allowed (not required) AND no default to fall back to.
  const optional = !inRequiredArray && defaultValue === undefined;
  const base: AutoFormField = {
    key,
    label: humanizeKey(key),
    control: 'unsupported',
    required,
    optional,
    defaultValue,
  };
  const description = node['description'];
  if (typeof description === 'string') base.description = description;

  // 1. Union of literal consts (heading.level, content-feed.columns,
  //    learning.columns) — z.union([z.literal(1), …]) → anyOf:[{const}].
  if (isConstUnion(node)) {
    base.control = 'select';
    base.options = node.anyOf.map((o) => {
      const v = o['const'] as string | number;
      return { value: v, label: optionLabel(v) };
    });
    return base;
  }

  // 2. String enum → select.
  if (Array.isArray(node['enum'])) {
    base.control = 'select';
    base.options = (node['enum'] as Array<string | number>).map((v) => ({ value: v, label: optionLabel(v) }));
    return base;
  }

  const type = node['type'];
  switch (type) {
    case 'boolean':
      base.control = 'toggle';
      return base;

    case 'integer':
    case 'number':
      base.control = 'number';
      if (typeof node['minimum'] === 'number') base.min = node['minimum'] as number;
      if (typeof node['maximum'] === 'number') base.max = node['maximum'] as number;
      base.step = type === 'integer' ? 1 : undefined;
      return base;

    case 'string': {
      if (typeof node['maxLength'] === 'number') base.maxLength = node['maxLength'] as number;
      if (typeof node['minLength'] === 'number') base.minLength = node['minLength'] as number;
      // Pattern strings are URLs/paths in our schemas — single-line text,
      // NOT <input type=url> (which would reject valid root-relative paths
      // like `/about`). Carry the pattern for our own inline validation.
      if (typeof node['pattern'] === 'string') {
        base.control = 'text';
        base.pattern = node['pattern'] as string;
        return base;
      }
      base.control = base.maxLength !== undefined && base.maxLength >= LONG_TEXT_THRESHOLD ? 'textarea' : 'text';
      return base;
    }

    case 'array': {
      base.control = 'array';
      if (typeof node['minItems'] === 'number') base.minItems = node['minItems'] as number;
      if (typeof node['maxItems'] === 'number') base.maxItems = node['maxItems'] as number;
      const items = resolveRef(node['items'] as JsonNode | undefined, root);
      if (items['type'] === 'object' || items['properties']) {
        base.itemFields = objectToFields(items, root);
        base.itemDefault = buildDefaults(base.itemFields);
      } else {
        // Scalar array (none in v1 builtins, but handle generically).
        const itemField = nodeToField('item', items, root, false);
        base.itemFields = [itemField];
        base.itemDefault = blankFor(itemField);
      }
      return base;
    }

    case 'object': {
      base.control = 'group';
      base.fields = objectToFields(node, root);
      return base;
    }

    default:
      // Unknown / unrepresentable — render read-only so the admin sees the
      // field exists but can't corrupt it. R3 ops: forward-compat for new
      // Zod kinds a future schema introduces.
      base.control = 'unsupported';
      return base;
  }
}

/** A sensible blank value for a freshly-added array item / group. */
function blankFor(field: AutoFormField): unknown {
  if (field.defaultValue !== undefined) return field.defaultValue;
  switch (field.control) {
    case 'text':
    case 'textarea':
      return '';
    case 'number':
      return field.min ?? 0;
    case 'toggle':
      return false;
    case 'select':
      return field.options?.[0]?.value ?? '';
    case 'array':
      return [];
    case 'group':
      return field.fields ? buildDefaults(field.fields) : {};
    default:
      return undefined;
  }
}

/** Build a default object from a field list (for new array items / groups). */
export function buildDefaults(fields: AutoFormField[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) out[f.key] = blankFor(f);
  return out;
}

/**
 * Convert a Zod schema to a normalized form model. Returns `{ fields: [],
 * isEmpty: true }` if the schema is not an object or can't be represented
 * (degrades gracefully — never throws into the render path).
 */
export function buildAutoForm(schema: ZodType): AutoFormModel {
  let json: JsonNode;
  try {
    json = z.toJSONSchema(schema) as JsonNode;
  } catch {
    // Unrepresentable schema (z.toJSONSchema throws by default). Degrade to
    // an empty model; the view shows the "no options" state.
    return { fields: [], isEmpty: true };
  }
  if (json['type'] !== 'object' && !json['properties']) {
    return { fields: [], isEmpty: true };
  }
  const fields = objectToFields(json, json);
  return { fields, isEmpty: fields.length === 0 };
}
