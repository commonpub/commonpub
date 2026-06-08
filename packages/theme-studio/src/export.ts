/**
 * Theme exporters — turn a generated token map into portable artifacts.
 * Pure functions (no DOM); the caller triggers the download. Ports gauge's
 * "AI brief" + a DTCG-style token JSON, adapted to CommonPub's token names.
 */

export interface ExportMeta {
  name: string;
  description?: string;
}

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const isColor = (v: string): boolean => HEX_RE.test(v) || v.startsWith('rgb');

/**
 * A markdown brief for handing a theme to an AI coding assistant. Lists the
 * key token values grouped by purpose, so the assistant can reproduce the look.
 */
export function buildBrief(meta: ExportMeta, tokens: Record<string, string>): string {
  const v = (k: string): string => tokens[k] ?? '(inherits)';
  const L: string[] = [];
  L.push(`# ${meta.name} — CommonPub theme`);
  L.push('');
  if (meta.description) L.push(`> ${meta.description}`, '');
  L.push('Generated with CommonPub Theme Studio. Use these exact CSS custom-property values.');
  L.push('');
  L.push('## Color');
  L.push('| Token | Value | Role |');
  L.push('|---|---|---|');
  const colorRows: [string, string][] = [
    ['bg', 'page background'], ['surface', 'card / panel'], ['surface2', 'input / hover'],
    ['text', 'primary text'], ['text-dim', 'secondary text'], ['border', 'strong border'],
    ['accent', 'primary accent'], ['color-link', 'links (AA on bg)'], ['secondary', 'secondary accent'],
    ['green', 'success'], ['yellow', 'warning'], ['red', 'error'],
    ['purple', 'category 1'], ['teal', 'category 2'], ['pink', 'category 3'],
  ];
  for (const [k, role] of colorRows) L.push(`| --${k} | ${v(k)} | ${role} |`);
  L.push('');
  L.push('## Typography');
  L.push(`- Display: \`${v('font-display')}\``);
  L.push(`- Body: \`${v('font-body')}\``);
  L.push(`- Mono: \`${v('font-mono')}\``);
  L.push(`- Sizes: base \`${v('text-base')}\`, lg \`${v('text-lg')}\`, 2xl \`${v('text-2xl')}\`, 4xl \`${v('text-4xl')}\`.`);
  L.push(`- Body line-height: \`${v('leading-normal')}\`.`);
  L.push('');
  L.push('## Shape & motion');
  L.push(`- Radius: \`${v('radius')}\` (md \`${v('radius-md')}\`, lg \`${v('radius-lg')}\`). Border width: \`${v('border-width-default')}\`.`);
  L.push(`- Shadow (md): \`${v('shadow-md')}\`. Transition: \`${v('transition-default')}\`.`);
  if (tokens['grain']) L.push(`- Film grain overlay opacity: \`${v('grain')}\`.`);
  L.push('');
  L.push('Generated with CommonPub Theme Studio.');
  L.push('');
  return L.join('\n');
}

/** DTCG-style design-tokens JSON for Style Dictionary / Figma import. */
export function buildTokensJson(meta: ExportMeta, tokens: Record<string, string>): string {
  const out: Record<string, unknown> = {
    $description: `${meta.name} — CommonPub theme tokens`,
  };
  const color: Record<string, unknown> = {};
  const other: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(tokens)) {
    if (isColor(val)) color[k] = { $value: val, $type: 'color' };
    else other[k] = { $value: val };
  }
  out.color = color;
  out.token = other;
  return JSON.stringify(out, null, 2);
}
