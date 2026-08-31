import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname, join, relative, sep } from 'node:path';

/**
 * Every `:href` bound to a value this instance did not author must pass through
 * `safeHref`.
 *
 * `layers/base/utils/safeUrl.ts` says so in its own header -- "every external
 * link binds through safeHref" -- and on 2026-08-30 twelve bindings did not.
 * The worst was `pages/authorize_interaction.vue`, which bound the raw `?uri=`
 * QUERY PARAMETER straight into an anchor: a link of the form
 * `/authorize_interaction?uri=javascript:...` rendered a working, clickable
 * script URL for whoever opened it. Seven more were fed by remote instances
 * through the federated-hub pages, and three by content authors.
 *
 * They survived a manual sweep in this same session because that sweep piped
 * its own output through `head -40` and then declared the class clean. This
 * file is the scan that does not truncate.
 *
 * HOW IT WORKS. It finds every `:href` in every component and requires each one
 * to be either obviously-internal (a literal, a route path, a template string),
 * already wrapped in a guard, or named in REVIEWED below. A new external
 * binding matches none of those and fails. Adding to REVIEWED is deliberate and
 * costs a line of justification.
 */
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Floor, not the count. 52 `:href` bindings exist today. */
const MIN_BINDINGS = 40;

/** Wrappers that are known to neutralise an executable scheme. */
const GUARDS = /\b(safeHref|safeLink|ctaHref|buildRegistrationHref|toEmbedUrl)\s*\(/;

/**
 * Unwrapped on purpose, each re-checked on 2026-08-30.
 *
 * `safeHref` collapses anything that is not http(s) to '#', so it must NOT be
 * applied to internal routes -- doing so would break navigation rather than
 * secure it. That is why the nav bindings are here rather than wrapped.
 */
const REVIEWED: Record<string, string> = {
  'components/ContentAttachments.vue': 'renders the pre-filtered `safeAttachments` computed, which drops unsafe schemes before the v-for',
  'components/nav/NavLink.vue': 'operator-configured nav; these are internal routes and safeHref would collapse them to #',
  'components/nav/NavDropdown.vue': 'same operator-configured internal nav',
  'components/nav/MobileNavRenderer.vue': 'same operator-configured internal nav',
  'components/sections/SectionCta.vue': 'admin-authored layout section; may legitimately be an internal path, so it needs a scheme denylist rather than an http-only allowlist. Filed, not fixed.',
  'pages/privacy.vue': 'operator config (analytics.policyUrl, validated at config load) plus two template literals over a constant SOURCE_BASE',
  'pages/settings/privacy.vue': 'recipient.privacyPolicyUrl from commonpub.config.ts; the admin data-sharing loader drops a recipient whose URL does not parse',
  'pages/settings/profile/questions.vue': 'same operator-configured recipient URL',
  'pages/admin/data-sharing.vue': 'same operator-configured recipient URL',
};

const SKIP = new Set(['node_modules', '.nuxt', '.output', 'dist', '__tests__']);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (p.endsWith('.vue')) out.push(p);
  }
  return out;
}

interface Binding { file: string; line: number; expr: string; src: string }

function bindings(): Binding[] {
  const out: Binding[] = [];
  for (const file of walk(repoRoot)) {
    const rel = relative(repoRoot, file).split(sep).join('/');
    const src = readFileSync(file, 'utf8');
    src.split('\n').forEach((text, i) => {
      const m = /:href\s*=\s*"([^"]*)"/.exec(text);
      if (m) out.push({ file: rel, line: i + 1, expr: m[1]!, src });
    });
  }
  return out;
}

/**
 * A binding may name a local computed that does the guarding itself, e.g.
 * `BlockRegistrationLinkView`'s `const href = computed(() =>
 * buildRegistrationHref(props.content))`. Following the identifier to its
 * declaration is the difference between a guard that understands the code and
 * one that just demands a particular spelling at the call site.
 */
function resolvesToAGuard(expr: string, src: string): boolean {
  const name = expr.trim();
  if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name)) return false;
  const decl = new RegExp(`\\bconst\\s+${name}\\s*=\\s*([\\s\\S]{0,400}?);\\n`, 'm');
  const body = decl.exec(src)?.[1] ?? '';
  return GUARDS.test(body);
}

/** An expression that cannot carry a scheme: a literal path, hash, or route. */
function isObviouslyInternal(expr: string): boolean {
  const e = expr.trim();
  if (/^[`'"]?[#/]/.test(e)) return true;                 // '#x', '/about', `/u/${..}`
  if (/^`[^$]*\/[^`]*`$/.test(e)) return true;            // template with a literal path
  return false;
}

describe('external :href bindings', () => {
  const all = bindings();

  it('found the components it means to scan', () => {
    expect(all.length, `only ${all.length} :href bindings found under ${repoRoot}`)
      .toBeGreaterThanOrEqual(MIN_BINDINGS);
  });

  it('the guard detector recognises the real wrappers', () => {
    expect(GUARDS.test('safeHref(content.url)')).toBe(true);
    expect(GUARDS.test('safeLink(l.url)')).toBe(true);
    expect(GUARDS.test('uri')).toBe(false);
    expect(isObviouslyInternal('/about')).toBe(true);
    expect(isObviouslyInternal('uri')).toBe(false);
    expect(isObviouslyInternal('hub.url')).toBe(false);
    // and it follows a bare identifier to the computed that guards it
    expect(resolvesToAGuard('href', 'const href = computed(() => buildRegistrationHref(x));\n')).toBe(true);
    expect(resolvesToAGuard('href', 'const href = computed(() => props.raw);\n')).toBe(false);
  });

  it('every external one is guarded, or reviewed and justified', () => {
    const unguarded = all
      .filter((b) => !isObviouslyInternal(b.expr))
      .filter((b) => !GUARDS.test(b.expr))
      .filter((b) => !resolvesToAGuard(b.expr, b.src))
      .filter((b) => !(b.file in REVIEWED))
      .map((b) => `${b.file}:${b.line} :href="${b.expr}"`);

    expect(
      unguarded,
      'these bind a non-internal value into an href with no scheme guard. Wrap in ' +
        'safeHref(), or add the file to REVIEWED with a reason:\n  ' + unguarded.join('\n  '),
    ).toEqual([]);
  });

  it('every REVIEWED entry still corresponds to a real file', () => {
    const seen = new Set(all.map((b) => b.file));
    const stale = Object.keys(REVIEWED).filter((f) => !seen.has(f));
    expect(stale, `REVIEWED names files with no :href binding any more: ${stale.join(', ')}`)
      .toEqual([]);
  });
});
