/**
 * Every public API route appears in the emitted OpenAPI document, and the
 * persona family stays out of the AP actor.
 *
 * Plan 10.4 specified both of these and neither shipped. They are source sweeps
 * because the thing they guard cannot be observed from a response: the OpenAPI
 * document is a hand-written literal in `openapi.json.get.ts`, so a new public
 * route is published to callers with no entry in the contract and nothing goes
 * red. `grep -rl openapi --include=*.test.ts` over this repo previously returned
 * nothing at all, which is why four persona endpoints could have shipped
 * undocumented.
 *
 * Both sweeps carry a file-count floor (P7): a broken path yields zero files,
 * and zero files is how a sweeping test passes green while walking nothing.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve, relative, sep } from 'node:path';

const V1 = resolve(__dirname, '..');
const LAYER = resolve(__dirname, '..', '..', '..', '..', '..');
const OPENAPI = join(V1, 'openapi.json.get.ts');

/** Public routes that are not resources and are deliberately not in `paths`. */
const NOT_A_PATH = new Set(['openapi.json.get.ts']);

/** Floor from plan 10.4. The v1 surface is well past this and only grows. */
const MIN_ROUTES = 25;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__') continue;
      out.push(...walk(full));
      continue;
    }
    if (entry.endsWith('.get.ts')) out.push(full);
  }
  return out;
}

/**
 * Turn a route file path into the OpenAPI path it documents.
 *
 * `metrics/persona/fields.get.ts` -> `/metrics/persona/fields`
 * `content/[id].get.ts`           -> `/content/{id}`
 */
function openapiPath(file: string): string {
  const rel = relative(V1, file)
    .split(sep)
    .join('/')
    .replace(/\.get\.ts$/, '')
    // `content/index.get.ts` IS `/content`, the collection itself.
    .replace(/(^|\/)index$/, '');
  return `/${rel.replace(/\[([^\]]+)\]/g, '{$1}')}`;
}

const routeFiles = walk(V1).filter((f) => !NOT_A_PATH.has(relative(V1, f)));
const openapiSource = readFileSync(OPENAPI, 'utf8');

describe('the public API document covers the public API', () => {
  it('walked the v1 tree (P7)', () => {
    expect(routeFiles.length).toBeGreaterThanOrEqual(MIN_ROUTES);
    expect(openapiSource.length).toBeGreaterThan(5000);
    expect(openapiSource).toContain('paths:');
  });

  it.each(routeFiles.map((f) => [openapiPath(f), f] as const))(
    '%s is documented',
    (path) => {
      // The document is a literal, so a substring match on the quoted key is
      // exactly as strong as parsing it and far less brittle.
      expect(openapiSource).toContain(`'${path}'`);
    },
  );

  it('documents the four persona metrics endpoints by name', () => {
    // Named explicitly as well as swept, because these are the endpoints the
    // whole k-anonymity argument is about and a consumer switching on `reason`
    // needs the contract to list every value it can receive.
    for (const path of [
      '/metrics/persona/fields',
      '/metrics/persona/distribution',
      '/metrics/persona/links',
      '/metrics/persona/audience',
    ]) {
      expect(openapiSource).toContain(`'${path}'`);
    }
  });
});

describe('nothing persona-shaped reaches the ActivityPub actor', () => {
  /**
   * CLAUDE.md's federation table now asserts that persona is instance-local and
   * that the AP Person document is unchanged by this feature. That claim is true
   * today and was pinned by nothing, so the next person to widen the actor for
   * an unrelated reason has no way to find out they broke it.
   */
  const AP_SURFACES = [
    'server/routes/users/[username].ts',
    'server/api/federation/resolve-uri.post.ts',
  ] as const;

  const FORBIDDEN = [
    'persona',
    'userPersonaAnswers',
    'userPersonaText',
    'user_persona',
    'userPurposeConsents',
    'user_purpose_consents',
    'PROCESSING_PURPOSES',
  ] as const;

  const sources = AP_SURFACES.map((rel) => ({
    rel,
    src: readFileSync(resolve(LAYER, rel), 'utf8'),
  }));

  it('read every actor surface (P7)', () => {
    expect(sources).toHaveLength(AP_SURFACES.length);
    for (const { rel, src } of sources) {
      expect(src.length, `${rel} is empty or moved; check the path`).toBeGreaterThan(200);
    }
  });

  it.each(sources)('$rel mentions nothing persona-shaped', ({ src }) => {
    for (const token of FORBIDDEN) {
      expect(src.toLowerCase()).not.toContain(token.toLowerCase());
    }
  });
});
