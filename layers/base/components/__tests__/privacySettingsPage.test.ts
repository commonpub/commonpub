/**
 * Component test for `/settings/privacy` (plan 6.8, 8.7 rules 1, 3, 4, 6 and 9;
 * test plan 10.2).
 *
 * Lives under components/__tests__ (bracket-free) so packaging excludes it: the
 * layer's `!**\/__tests__/` exclusion is unreliable under `pages/`, which carries
 * bracketed route directories that npm pack reads as glob character classes.
 *
 * Four assertions here are the design, not decoration:
 *   - zero consent rows leaves every switch off;
 *   - `offSummary` precedes `onSummary` in DOM order on every card;
 *   - revoking is one click with no confirmation of any kind;
 *   - a stale grant is passive and authorises nothing.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent } from '@testing-library/vue';
import axe from 'axe-core';
import { createApp, defineComponent, h, ref, Suspense, nextTick, type App } from 'vue';
import PrivacyPage from '../../pages/settings/privacy.vue';
// The REAL composable: the h3 error nesting is behaviour under test, and a
// hand-written extractor in the test would prove nothing about it.
import { useApiError } from '../../composables/useApiError';

const NuxtLink = defineComponent({
  name: 'NuxtLink',
  props: { to: { type: String, default: '' } },
  setup: (props, { slots }) => () => h('a', { href: props.to }, slots.default?.()),
});

const OFF_SUMMARY =
  'Right now your answers are only visible on your profile and are not counted anywhere.';
const ON_SUMMARY =
  'If you turn this on: your interests and tech stack are counted in group totals. Totals are only shown when at least five people share an answer, and counts are rounded. Your name is never attached and nothing about you leaves this site. While your profile is set to private, your answers are not counted, even with this turned on.';

interface PurposeFixture {
  id: string;
  label: string;
  offSummary: string;
  onSummary: string;
  revocationEffect: string;
  legalBasis: string;
  answersAfterRevocation: string;
  recipients: Array<Record<string, unknown>>;
  state: 'granted' | 'revoked' | 'absent';
  needsReconfirmation: boolean;
  actedAt: string | null;
}

function purpose(overrides: Partial<PurposeFixture> = {}): PurposeFixture {
  return {
    id: 'profile_analytics',
    label: 'Count my answers in community statistics',
    offSummary: OFF_SUMMARY,
    onSummary: ON_SUMMARY,
    revocationEffect:
      'You can turn this off at any time. Turning it off stops your answers being counted in new statistics, usually within a day.',
    legalBasis: 'consent',
    answersAfterRevocation: 'kept_on_your_profile',
    recipients: [],
    state: 'absent',
    needsReconfirmation: false,
    actedAt: null,
    ...overrides,
  };
}

function sponsorPurpose(): PurposeFixture {
  return purpose({
    id: 'sponsor_sharing',
    label: 'Share my answers with contest sponsors',
    offSummary: 'Right now nothing about you is shared with sponsors.',
    onSummary:
      'If you turn this on: your interests, your tech stack and your public profile links are shared with the sponsors named below.',
    recipients: [
      {
        id: 'acme',
        name: 'Acme Robotics',
        privacyPolicyUrl: 'https://acme.example/privacy',
        relationship: 'independent_controller',
      },
    ],
  });
}

function response(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    scopeDigest: 'digest-1',
    policyVersion: '3',
    purposes: [purpose()],
    deferredPurposes: [],
    minBucket: 5,
    minPopulation: 25,
    ...overrides,
  };
}

interface DisclosureFixture {
  recipientId: string;
  recipientName: string;
  recipientKnown: boolean;
  purposes: string[];
  count: number;
  lastDisclosedAt: string;
}

function disclosure(overrides: Partial<DisclosureFixture> = {}): DisclosureFixture {
  return {
    recipientId: 'acme',
    recipientName: 'Acme Robotics',
    recipientKnown: true,
    purposes: ['recruiter_visibility'],
    count: 3,
    lastDisclosedAt: '2026-08-04T09:00:00.000Z',
    ...overrides,
  };
}

const consentRef = ref<Record<string, unknown> | null>(response());
const historyRef = ref<{ history: unknown[] } | null>({ history: [] });
const historyErrorRef = ref<Error | null>(null);
const disclosureRef = ref<{ disclosures: DisclosureFixture[] } | null>({ disclosures: [] });
const disclosureErrorRef = ref<Error | null>(null);
const directoryOn = ref(true);
const profileRef = ref<Record<string, unknown> | null>({ profileVisibility: 'public' });
const refresh = vi.fn(async () => {});
const refreshProfile = vi.fn(async () => {});
// Typed params, not `vi.fn(async () => ...)`: a zero-arity mock infers
// `calls: []`, and every `calls[0]![1]` assertion below then fails vue-tsc
// with "tuple of length 0 has no element at index 1" while vitest stays green.
const $fetch = vi.fn(async (_url: string, _opts?: Record<string, unknown>) => ({}) as unknown);
const toast = vi.fn();
const consentsOn = ref(true);
const confirmSpy = vi.fn(() => true);

Object.assign(globalThis, {
  definePageMeta: () => {},
  useSeoMeta: () => {},
  useSiteName: () => 'Test',
  useToast: () => ({ show: toast }),
  useApiError,
  useFeatures: () => ({ dataSharingConsents: consentsOn, memberDirectory: directoryOn }),
  useFetch: vi.fn((url: string) => {
    const path = String(url);
    if (path.includes('/api/profile')) {
      return { data: profileRef, pending: ref(false), refresh: refreshProfile };
    }
    if (path.includes('/history')) {
      return { data: historyRef, error: historyErrorRef, pending: ref(false), refresh: vi.fn() };
    }
    if (path.includes('/disclosures')) {
      return {
        data: disclosureRef,
        error: disclosureErrorRef,
        pending: ref(false),
        refresh: vi.fn(),
      };
    }
    return { data: consentRef, error: ref(null), pending: ref(false), refresh };
  }),
  $fetch,
});

beforeEach(() => {
  consentRef.value = response();
  historyRef.value = { history: [] };
  historyErrorRef.value = null;
  disclosureRef.value = { disclosures: [] };
  disclosureErrorRef.value = null;
  directoryOn.value = true;
  profileRef.value = { profileVisibility: 'public' };
  refresh.mockClear();
  refreshProfile.mockClear();
  $fetch.mockClear();
  $fetch.mockImplementation(async () => ({}));
  toast.mockClear();
  confirmSpy.mockClear();
  consentsOn.value = true;
  window.confirm = confirmSpy as unknown as typeof window.confirm;
});

/**
 * The page has a top-level `await useFetch`, so its setup is async and Vue needs
 * a Suspense boundary. `@testing-library/vue`'s `render` cannot supply one that
 * resolves (its VTU mount leaves the pending branch in Suspense's hidden
 * container, so every assertion target would be empty and every test would pass
 * or fail for the wrong reason). `createApp` gives real DOM.
 */
const mountedApps: Array<{ app: App; el: HTMLElement }> = [];

async function mount(): Promise<{ container: HTMLElement }> {
  const el = document.createElement('div');
  document.body.appendChild(el);
  const Wrapper = defineComponent({
    setup: () => () => h(Suspense, null, { default: () => h(PrivacyPage) }),
  });
  const app = createApp(Wrapper);
  app.component('NuxtLink', NuxtLink);
  app.mount(el);
  mountedApps.push({ app, el });
  await settle();
  return { container: el };
}

async function settle(): Promise<void> {
  for (let i = 0; i < 4; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await nextTick();
  }
}

afterEach(() => {
  while (mountedApps.length) {
    const entry = mountedApps.pop()!;
    entry.app.unmount();
    entry.el.remove();
  }
});

function switches(container: HTMLElement): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll<HTMLButtonElement>('[role="switch"]'));
}

function putCalls(): Array<[string, { method?: string; body?: Record<string, unknown> }]> {
  return $fetch.mock.calls.filter(
    (c) => (c[1] as { method?: string } | undefined)?.method === 'PUT',
  ) as unknown as Array<[string, { method?: string; body?: Record<string, unknown> }]>;
}

describe('/settings/privacy', () => {
  it('leaves every switch off when the user has no consent rows (rule 1)', async () => {
    consentRef.value = response({ purposes: [purpose(), sponsorPurpose()] });
    const { container } = await mount();
    const found = switches(container);
    expect(found).toHaveLength(2); // guard: an empty render satisfies any "all off" claim
    for (const control of found) {
      expect(control.getAttribute('aria-checked')).toBe('false');
      expect(control.textContent).toContain('Off');
    }
  });

  it('renders offSummary ABOVE onSummary on every card (rule 9)', async () => {
    consentRef.value = response({ purposes: [purpose(), sponsorPurpose()] });
    const { container } = await mount();
    const cards = Array.from(container.querySelectorAll('.cpub-purpose-card'));
    expect(cards).toHaveLength(2); // guard: no cards would vacuously pass the ordering
    for (const card of cards) {
      const off = card.querySelector('.cpub-purpose-off');
      const on = card.querySelector('.cpub-purpose-on');
      expect(off).not.toBeNull();
      expect(on).not.toBeNull();
      // Bound to the CONTENT as well as the class, so a class rename that broke
      // the query would fail here rather than silently stop testing anything.
      expect(off!.textContent).toContain('Right now');
      expect(on!.textContent).toContain('If you turn this on');
      expect(
        off!.compareDocumentPosition(on!) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
  });

  it('revokes in ONE click with no confirmation of any kind (rules 3, 4 and 6)', async () => {
    consentRef.value = response({
      purposes: [purpose({ state: 'granted', actedAt: '2026-08-01T10:00:00.000Z' })],
    });
    const { container } = await mount();
    const control = switches(container)[0]!;
    expect(control.getAttribute('aria-checked')).toBe('true');

    await fireEvent.click(control);
    await settle();

    // One click, one request, straight to the withdrawal.
    expect(putCalls()).toHaveLength(1);
    expect(putCalls()[0]![0]).toBe('/api/consent/purposes');
    expect(putCalls()[0]![1].body).toEqual({
      purpose: 'profile_analytics',
      grant: false,
      scopeDigest: 'digest-1',
    });
    // No dialog, no second step, no shaming.
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(container.querySelector('dialog')).toBeNull();
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(container.querySelector('[role="alertdialog"]')).toBeNull();
    expect(container.textContent).not.toMatch(/are you sure/i);
  });

  it('grants and revokes through the SAME control, so refusing is never the harder path (rule 6)', async () => {
    const { container } = await mount();
    const off = switches(container)[0]!;
    const offBox = off.getBoundingClientRect();
    await fireEvent.click(off);
    await settle();
    expect(putCalls()[0]![1].body).toMatchObject({ grant: true });

    consentRef.value = response({ purposes: [purpose({ state: 'granted' })] });
    const second = await mount();
    const on = switches(second.container)[0]!;
    // Same element type, same class, same box: the refuse action is not a text
    // link beside a filled button.
    expect(on.tagName).toBe(off.tagName);
    expect(on.className).toBe(off.className);
    expect(on.getBoundingClientRect().width).toBe(offBox.width);
  });

  it('renders a stale grant as a passive card that authorises nothing (rule 4)', async () => {
    consentRef.value = response({
      purposes: [purpose({ state: 'granted', needsReconfirmation: true })],
    });
    const { container } = await mount();
    expect(container.textContent).toContain(
      'This needs your confirmation again. We added a recipient since you agreed. Nothing is being shared in the meantime.',
    );
    // A stale grant authorises nothing, so the switch reads OFF, honestly.
    expect(switches(container)[0]!.getAttribute('aria-checked')).toBe('false');
    // Passive means passive: no dialog and no request fired on render.
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(putCalls()).toHaveLength(0);
  });

  it('renders a 409 diff ABOVE the card, keeps the toggle where the user left it, and needs one more click', async () => {
    $fetch.mockImplementationOnce(async () => {
      throw {
        statusCode: 409,
        data: {
          statusMessage: 'Scope changed',
          data: {
            code: 'SCOPE_CHANGED',
            retryable: false,
            expectedScopeDigest: 'digest-2',
            receivedScopeDigest: 'digest-1',
            policyVersion: '3',
            diff: {
              resolved: true,
              recipientsAdded: [
                {
                  id: 'contoso',
                  name: 'Contoso Tools',
                  relationship: 'independent_controller',
                  privacyPolicyUrl: 'https://contoso.example/privacy',
                },
              ],
              recipientsRemoved: [],
              countedFieldsAdded: [],
              countedFieldsRemoved: [],
              policyVersionChanged: null,
              truncated: false,
            },
          },
        },
      };
    });
    const { container } = await mount();
    await fireEvent.click(switches(container)[0]!);
    await settle();

    const diff = container.querySelector('.cpub-purpose-diff');
    expect(diff).not.toBeNull();
    expect(diff!.textContent).toContain('Contoso Tools');
    const card = container.querySelector('.cpub-purpose-card')!;
    expect(diff!.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // The toggle stays where the user left it: nothing was auto-applied and
    // nothing was auto-retried against a disclosure they have not read.
    expect(switches(container)[0]!.getAttribute('aria-checked')).toBe('true');
    expect(putCalls()).toHaveLength(1);

    expect(container.textContent).toContain('Nothing has been recorded.');

    // One more click CONFIRMS the same choice against the digest the page now
    // holds. It must not flip the intent back, which is what a plain toggle
    // would do and would make the re-ask unanswerable.
    consentRef.value = response({ scopeDigest: 'digest-2' });
    await settle();
    await fireEvent.click(switches(container)[0]!);
    await settle();
    expect(putCalls()).toHaveLength(2);
    expect(putCalls()[1]![1].body).toEqual({
      purpose: 'profile_analytics',
      grant: true,
      scopeDigest: 'digest-2',
    });
  });

  it('lists recipients inline with their relationship and a policy link', async () => {
    consentRef.value = response({ purposes: [sponsorPurpose()] });
    const { container } = await mount();
    expect(container.textContent).toContain('Acme Robotics');
    expect(container.textContent).toContain('decides on its own how your data is used');
    const link = container.querySelector<HTMLAnchorElement>('.cpub-recipient-policy');
    expect(link?.getAttribute('href')).toBe('https://acme.example/privacy');
    expect(link?.getAttribute('rel')).toContain('noopener');
  });

  it('shows the B3 note ON THE CARD before any grant exists, for the person who needs it', async () => {
    // Appendix B3 asks for the note ON THE TOGGLE. It used to live two sections
    // below, inside "Who can see your profile", and to appear only once a grant
    // already existed. Both halves were wrong: the person who most needs it is
    // the one whose profile is ALREADY private and who is deciding whether to
    // turn counting on, and they saw nothing at all.
    profileRef.value = { profileVisibility: 'private' };
    consentRef.value = response({ purposes: [purpose({ state: 'absent' })] });
    const { container } = await mount();

    const note = container.querySelector('#cpub-purpose-visibility-profile_analytics');
    expect(note?.textContent).toContain('not counted even with this');

    // And a screen-reader user ON the control hears it, rather than finding it
    // two sections later.
    const describedBy = container
      .querySelector('.cpub-purpose-switch')
      ?.getAttribute('aria-describedby');
    expect(describedBy).toContain('cpub-purpose-visibility-profile_analytics');
    profileRef.value = { profileVisibility: 'public' };
  });

  it('names the purposes this instance does not offer, rather than staying silent', async () => {
    // One switch under a heading called "Sharing choices" cannot tell a member
    // whether the other options were never built or are quietly on.
    consentRef.value = response({
      deferredPurposes: [
        { id: 'recruiter_visibility', label: 'Let people hiring see my profile' },
        { id: 'sponsor_sharing', label: 'Share my answers with contest sponsors' },
      ],
    });
    const { container } = await mount();
    expect(container.textContent).toContain('does not offer these choices yet');
    expect(container.textContent).toContain('Nothing is shared for them.');
  });

  it('renders the legal basis and what happens to answers after a withdrawal', async () => {
    // Both were on the payload, typed on the page, asserted by two other tests,
    // and rendered nowhere. A disclosure nobody can read is not a disclosure.
    consentRef.value = response();
    const { container } = await mount();
    expect(container.textContent).toContain('only because you said yes');
    expect(container.textContent).toContain('Your answers stay on your profile either way.');
  });

  it('makes profileVisibility settable and discloses that a non-public profile is not counted', async () => {
    consentRef.value = response({ purposes: [purpose({ state: 'granted' })] });
    const { container } = await mount();
    const select = container.querySelector<HTMLSelectElement>('#cpub-profile-visibility')!;
    expect(select.value).toBe('public');
    expect(container.textContent).not.toContain('your answers are not counted, even with sharing');

    await fireEvent.update(select, 'private');
    await settle();
    expect(container.textContent).toContain(
      'While your profile is not public, your answers are not counted, even with sharing turned on.',
    );

    await fireEvent.click(container.querySelector('.cpub-btn')!);
    await settle();
    const profilePuts = putCalls().filter((c) => c[0] === '/api/profile');
    expect(profilePuts).toHaveLength(1);
    expect(profilePuts[0]![1].body).toEqual({ profileVisibility: 'private' });
  });

  it('offers the subject-rights links', async () => {
    const { container } = await mount();
    expect(container.querySelector('a[href="/api/auth/export-data"]')).not.toBeNull();
    expect(container.querySelector('a[href="/settings/account"]')).not.toBeNull();
  });

  it('lists every grant and revoke with its date and what was shown at the time', async () => {
    historyRef.value = {
      history: [
        {
          id: 'c2',
          purpose: 'profile_analytics',
          state: 'revoked',
          actedAt: '2026-08-02T09:00:00.000Z',
          policyVersion: '3',
          scopeDigest: 'digest-1',
          source: 'settings',
          scopeSnapshot: {
            purposeLabel: 'Count my answers in community statistics',
            offSummary: OFF_SUMMARY,
            onSummary: ON_SUMMARY,
            recipients: [],
            dataClasses: ['persona_selections'],
            aggregatableFieldKeys: ['interests'],
            policyVersion: '3',
          },
        },
        {
          id: 'c1',
          purpose: 'profile_analytics',
          state: 'granted',
          actedAt: '2026-08-01T09:00:00.000Z',
          policyVersion: '3',
          scopeDigest: 'digest-1',
          source: 'settings',
          scopeSnapshot: null,
        },
      ],
    };
    const { container } = await mount();
    const rows = Array.from(container.querySelectorAll('.cpub-history-table tbody tr'));
    expect(rows).toHaveLength(2);
    expect(rows[0]!.textContent).toContain('Turned off');
    expect(rows[1]!.textContent).toContain('Turned on');
    // The machine-readable date is present from SSR; the human string is
    // rendered only after mount, because toLocaleDateString formats in the
    // RENDERER's timezone and would otherwise mismatch on hydration.
    const times = Array.from(container.querySelectorAll('time'));
    expect(times).toHaveLength(2);
    expect(times[0]!.getAttribute('datetime')).toBe('2026-08-02T09:00:00.000Z');
    expect(container.querySelector('.cpub-history-details')).not.toBeNull();
  });

  it('says the history could not be loaded rather than claiming there is none', async () => {
    historyRef.value = null;
    historyErrorRef.value = new Error('404');
    const { container } = await mount();
    expect(container.textContent).toContain('Your record of past choices could not be loaded.');
    expect(container.textContent).not.toContain('You have not made any sharing choices yet.');
  });

  /**
   * "Who has looked at your profile through the hiring directory" (directory
   * plan D6). Three properties are the design: it renders NOTHING when nobody
   * has looked, a failed load never reads as "nobody has looked", and the
   * sentence about revocation is not softened.
   */
  describe('who has looked at you', () => {
    const HEADING = 'Who has looked at your profile through the hiring directory';
    const HONEST_SENTENCE =
      'Turning this off removes you from future results. It cannot recall what was already shared.';

    it('renders nothing at all when nobody has looked', async () => {
      disclosureRef.value = { disclosures: [] };
      const { container } = await mount();
      // Guard: the page rendered something, so the absence below is the block
      // being absent rather than the whole page failing to mount.
      expect(container.querySelector('.cpub-purpose-card')).not.toBeNull();
      expect(container.textContent).not.toContain(HEADING);
      expect(container.querySelector('.cpub-disclosure-list')).toBeNull();
      expect(container.textContent).not.toContain(HONEST_SENTENCE);
    });

    it('renders one line per recipient, with the count and the date', async () => {
      disclosureRef.value = { disclosures: [disclosure()] };
      const { container } = await mount();
      expect(container.textContent).toContain(HEADING);
      const items = Array.from(container.querySelectorAll('.cpub-disclosure-list li'));
      expect(items).toHaveLength(1);
      // The whole line, verbatim, whitespace collapsed the way a reader sees it.
      const line = items[0]!.textContent!.replace(/\s+/g, ' ').trim();
      expect(line).toMatch(/^Acme Robotics, 3 times, most recently .+\.$/);
    });

    it('says one time rather than 1 times', async () => {
      disclosureRef.value = { disclosures: [disclosure({ count: 1 })] };
      const { container } = await mount();
      const line = container
        .querySelector('.cpub-disclosure-list li')!
        .textContent!.replace(/\s+/g, ' ');
      expect(line).toContain('1 time,');
      expect(line).not.toContain('1 times');
    });

    it('carries the raw ISO timestamp in datetime and never a server-formatted local date', async () => {
      // `toLocaleDateString` formats in the RENDERER's timezone, so a date
      // formatted during SSR mismatches the browser's on hydration in
      // production only. The machine-readable value is always the ISO one.
      disclosureRef.value = { disclosures: [disclosure()] };
      const { container } = await mount();
      const time = container.querySelector('.cpub-disclosure-list time')!;
      expect(time.getAttribute('datetime')).toBe('2026-08-04T09:00:00.000Z');
      expect(time.textContent).not.toBe('');
    });

    it('states plainly that revocation cannot recall what was already shared', async () => {
      disclosureRef.value = { disclosures: [disclosure()] };
      const { container } = await mount();
      expect(container.textContent).toContain(HONEST_SENTENCE);
    });

    it('says the record could not be loaded rather than claiming nobody has looked', async () => {
      disclosureRef.value = null;
      disclosureErrorRef.value = new Error('500');
      const { container } = await mount();
      expect(container.textContent).toContain(HEADING);
      expect(container.textContent).toContain(
        'The record of who has looked could not be loaded.',
      );
      // The reassuring reading must not be available: no list, and none of the
      // copy that only makes sense when the list is complete.
      expect(container.querySelector('.cpub-disclosure-list')).toBeNull();
      expect(container.textContent).not.toContain(HONEST_SENTENCE);
    });

    it('names a removed recipient as unlisted rather than dropping the disclosure', async () => {
      disclosureRef.value = {
        disclosures: [disclosure({ recipientId: 'ghost', recipientName: 'ghost', recipientKnown: false })],
      };
      const { container } = await mount();
      expect(container.textContent).toContain('A recipient this site no longer lists (ghost)');
    });

    it('renders nothing, and never fetches, when memberDirectory is off', async () => {
      directoryOn.value = false;
      disclosureRef.value = { disclosures: [disclosure()] };
      const { container } = await mount();
      expect(container.textContent).not.toContain(HEADING);
      const useFetchMock = (globalThis as unknown as { useFetch: ReturnType<typeof vi.fn> })
        .useFetch;
      const calls = useFetchMock.mock.calls.filter((c) =>
        String(c[0]).includes('/api/consent/disclosures'),
      );
      expect(calls.length).toBeGreaterThan(0); // guard: a renamed route would vacuously pass
      expect((calls.at(-1)?.[1] as { immediate?: boolean } | undefined)?.immediate).toBe(false);
    });
  });

  it('renders nothing but a notice, and never fetches consent, when the flag is off', async () => {
    consentsOn.value = false;
    consentRef.value = null;
    const { container } = await mount();
    expect(container.textContent).toContain('Sharing choices are not enabled on this site.');
    expect(switches(container)).toHaveLength(0);
    const useFetchMock = (globalThis as unknown as { useFetch: ReturnType<typeof vi.fn> }).useFetch;
    const consentCalls = useFetchMock.mock.calls.filter((c) =>
      String(c[0]).includes('/api/consent/purposes'),
    );
    expect(consentCalls.length).toBeGreaterThan(0); // guard: a renamed route would vacuously pass
    const lastCall = consentCalls.at(-1);
    expect((lastCall?.[1] as { immediate?: boolean } | undefined)?.immediate).toBe(false);
  });

  it('carries no em dash, no banned string and no exclamation mark', async () => {
    consentRef.value = response({ purposes: [purpose(), sponsorPurpose()] });
    disclosureRef.value = { disclosures: [disclosure()] };
    const { container } = await mount();
    const text = container.textContent ?? '';
    expect(text.length).toBeGreaterThan(200); // guard: an empty render bans nothing
    expect(text).not.toMatch(/—/);
    expect(text).not.toMatch(/!/);
    for (const banned of [
      'Help us improve',
      'Get the most out of',
      'Unlock',
      'Boost',
      'You are missing out',
      'No thanks',
    ]) {
      expect(text).not.toContain(banned);
    }
  });

  it('has no axe violations', async () => {
    consentRef.value = response({ purposes: [purpose(), sponsorPurpose()] });
    disclosureRef.value = {
      disclosures: [disclosure(), disclosure({ recipientId: 'contoso', recipientName: 'Contoso Tools', count: 1 })],
    };
    historyRef.value = {
      history: [
        {
          id: 'c1',
          purpose: 'profile_analytics',
          state: 'granted',
          actedAt: '2026-08-01T09:00:00.000Z',
          policyVersion: '3',
          scopeDigest: 'digest-1',
          source: 'settings',
          scopeSnapshot: null,
        },
      ],
    };
    const { container } = await mount();
    const results = await axe.run(container, {
      rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });
});
