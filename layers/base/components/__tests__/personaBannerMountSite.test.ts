/**
 * The persona invitation banner has a MOUNT SITE.
 *
 * A source sweep, not a render test, because the defect it guards is not a
 * rendering bug. `PersonaInvitationBanner.vue` shipped complete, tested, axe
 * clean, with a dedicated `GET /api/persona/status` route feeding it and a
 * `BUILTIN_COOKIES` disclosure for the cookie it writes, and it was referenced
 * by no page or layout at all. The route had zero callers, the disclosed cookie
 * could never be set, and the only route to `/settings/persona` was a member
 * opening Settings and noticing a new tab. The whole feature shipped invisible.
 *
 * Nothing a component test can express catches that. This one asserts the tag
 * appears in a page, and asserts it appears under the name Nuxt will actually
 * register it as: `components/persona/PersonaInvitationBanner.vue` dedupes the
 * `persona` path prefix against the `Persona` filename prefix, so a bare
 * `<InvitationBanner>` renders EMPTY with no error.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const LAYER = resolve(HERE, '../..');
const DASHBOARD = resolve(LAYER, 'pages/dashboard.vue');
const BANNER = resolve(LAYER, 'components/persona/PersonaInvitationBanner.vue');
const STATUS_ROUTE = resolve(LAYER, 'server/api/persona/status.get.ts');

describe('the persona invitation banner is reachable', () => {
  it('guards its own guard: every file it reads exists and is non-trivial', () => {
    // A moved or renamed file must fail red, not scan nothing and pass.
    for (const path of [DASHBOARD, BANNER, STATUS_ROUTE]) {
      expect(existsSync(path), path).toBe(true);
      expect(readFileSync(path, 'utf8').length, path).toBeGreaterThan(500);
    }
  });

  it('is mounted on the dashboard, which is where plan 8.4 put the offer', () => {
    const source = readFileSync(DASHBOARD, 'utf8');
    expect(source).toMatch(/<PersonaInvitationBanner\s*\/?>/);
  });

  it('is mounted under the auto-import name Nuxt registers, not the bare name', () => {
    const source = readFileSync(DASHBOARD, 'utf8');
    // `<InvitationBanner>` resolves to nothing and renders empty with no error.
    expect(source).not.toMatch(/<InvitationBanner[\s/>]/);
  });

  it('takes no props, so a mount site cannot get the gating wrong', () => {
    // Every gate is server-owned: the feature flag, "has this person answered
    // anything", and the two-dismissal ceiling all come from
    // `/api/persona/status`. A mount site that had to pass a flag would be a
    // second place for the rule to live.
    const source = readFileSync(DASHBOARD, 'utf8');
    const tag = /<PersonaInvitationBanner([^>]*)>/.exec(source);
    expect(tag).not.toBeNull();
    expect((tag?.[1] ?? '').replace(/\/$/, '').trim()).toBe('');
  });

  it('reads the cookie name and the ceiling from @commonpub/persona, not literals', () => {
    // Three surfaces speak this cookie and none can import the others. A
    // hand-copied name that drifts does not fail loudly: the refusal stops
    // being remembered and the banner comes back forever.
    for (const path of [BANNER, STATUS_ROUTE]) {
      const source = readFileSync(path, 'utf8');
      expect(source, path).toContain('PERSONA_INVITE_DISMISSED_COOKIE');
      expect(source, path).toContain('PERSONA_INVITE_MAX_DISMISSALS');
      // The literal appears in exactly one place in the tree: the composable's
      // cookie disclosure, which plan 14.9 pins to one persona-mentioning line.
      expect(source, path).not.toContain("'cpub-persona-invite-dismissed'");
    }
  });
});
