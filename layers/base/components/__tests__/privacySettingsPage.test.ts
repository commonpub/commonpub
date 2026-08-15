/**
 * Component test for `/settings/privacy`.
 *
 * Lives under components/__tests__ (bracket-free) so packaging excludes it: the
 * layer's `!**\/__tests__/` exclusion is unreliable under `pages/`, which carries
 * bracketed route directories that npm pack reads as glob character classes.
 *
 * THE FIXTURES ARE THE REAL REGISTRY. `@commonpub/persona` supplies every
 * disclosure sentence below, so an assertion that the page renders `offSummary`
 * is an assertion about the sentence a member actually reads, not about a string
 * this file invented. A paraphrase in a fixture would let the page drift from
 * the registry while every test stayed green, which is the failure the registry
 * exists to prevent.
 *
 * Six assertions here are the design, not decoration:
 *   - there is no statistics CONSENT card, and no consent switch describes
 *     counting: statistics are legitimate interest with an objection;
 *   - the objection defaults to INCLUDED and the control opts out;
 *   - a purpose card defaults off with zero consent rows;
 *   - `offSummary` precedes `onSummary` in DOM order on every card;
 *   - revoking, and objecting, are one click with no confirmation of any kind;
 *   - with the sharing flags off, no sharing language appears anywhere.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent } from '@testing-library/vue';
import axe from 'axe-core';
import { createApp, defineComponent, h, ref, Suspense, nextTick, type App } from 'vue';
import {
  PERSONA_STATISTICS,
  PROCESSING_PURPOSE_SPECS,
  renderPurposeOnSummary,
  renderStatisticsSummary,
  statisticsStateSummary,
} from '@commonpub/persona';
import PrivacyPage from '../../pages/settings/privacy.vue';
// The REAL composable: the h3 error nesting is behaviour under test, and a
// hand-written extractor in the test would prove nothing about it.
import { useApiError } from '../../composables/useApiError';

const NuxtLink = defineComponent({
  name: 'NuxtLink',
  props: { to: { type: String, default: '' } },
  setup: (props, { slots }) => () => h('a', { href: props.to }, slots.default?.()),
});

/** The floors a test instance runs. The server substitutes them; we mirror that. */
const FLOORS = { minBucket: 5, minPopulation: 25 };

const RECRUITER = PROCESSING_PURPOSE_SPECS.recruiter_visibility;
const SPONSOR = PROCESSING_PURPOSE_SPECS.sponsor_sharing;

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
    id: 'recruiter_visibility',
    label: RECRUITER.label,
    offSummary: RECRUITER.offSummary,
    onSummary: renderPurposeOnSummary('recruiter_visibility', FLOORS),
    revocationEffect: RECRUITER.revocationEffect,
    legalBasis: RECRUITER.legalBasis,
    answersAfterRevocation: RECRUITER.answersAfterRevocation,
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
    label: SPONSOR.label,
    offSummary: SPONSOR.offSummary,
    onSummary: renderPurposeOnSummary('sponsor_sharing', FLOORS),
    revocationEffect: SPONSOR.revocationEffect,
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
    minBucket: FLOORS.minBucket,
    minPopulation: FLOORS.minPopulation,
    ...overrides,
  };
}

/** Mirrors `StatisticsObjectionPayload`, built from the registry the route reads. */
function objectionPayload(objected = false): Record<string, unknown> {
  return {
    state: objected ? 'objected' : 'counted',
    objected,
    objectedAt: objected ? '2026-08-05T10:00:00.000Z' : null,
    label: PERSONA_STATISTICS.label,
    legalBasis: PERSONA_STATISTICS.legalBasis,
    description: renderStatisticsSummary(FLOORS),
    basisNote: PERSONA_STATISTICS.basisNote,
    statusSummary: statisticsStateSummary(objected ? 'objected' : 'counted'),
    objectLabel: PERSONA_STATISTICS.objectLabel,
    objectEffect: PERSONA_STATISTICS.objectEffect,
    withdrawObjectionLabel: PERSONA_STATISTICS.withdrawObjectionLabel,
    withdrawObjectionEffect: PERSONA_STATISTICS.withdrawObjectionEffect,
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
const objectionRef = ref<Record<string, unknown> | null>(objectionPayload());
const objectionErrorRef = ref<Error | null>(null);
const directoryOn = ref(true);
const profileRef = ref<Record<string, unknown> | null>({ profileVisibility: 'public' });
const refresh = vi.fn(async () => {});
const refreshProfile = vi.fn(async () => {});
const refreshObjection = vi.fn(async () => {});
// Typed params, not `vi.fn(async () => ...)`: a zero-arity mock infers
// `calls: []`, and every `calls[0]![1]` assertion below then fails vue-tsc
// with "tuple of length 0 has no element at index 1" while vitest stays green.
const $fetch = vi.fn(async (_url: string, _opts?: Record<string, unknown>) => ({}) as unknown);
const toast = vi.fn();
const personaOn = ref(true);
const analyticsOn = ref(true);
const consentsOn = ref(true);
const confirmSpy = vi.fn(() => true);

Object.assign(globalThis, {
  definePageMeta: () => {},
  useSeoMeta: () => {},
  useSiteName: () => 'Test',
  useToast: () => ({ show: toast }),
  useApiError,
  useFeatures: () => ({
    persona: personaOn,
    personaAnalytics: analyticsOn,
    dataSharingConsents: consentsOn,
    memberDirectory: directoryOn,
  }),
  useFetch: vi.fn((url: string) => {
    const path = String(url);
    // Checked FIRST: `/api/consent/objection` also matches the consent fallback,
    // and a mis-ordered branch here would silently feed the objection block the
    // purposes payload.
    if (path.includes('/api/consent/objection')) {
      return {
        data: objectionRef,
        error: objectionErrorRef,
        pending: ref(false),
        refresh: refreshObjection,
      };
    }
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
  objectionRef.value = objectionPayload();
  objectionErrorRef.value = null;
  directoryOn.value = true;
  profileRef.value = { profileVisibility: 'public' };
  refresh.mockClear();
  refreshProfile.mockClear();
  refreshObjection.mockClear();
  $fetch.mockClear();
  $fetch.mockImplementation(async () => ({}));
  toast.mockClear();
  confirmSpy.mockClear();
  personaOn.value = true;
  analyticsOn.value = true;
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

function statisticsButton(container: HTMLElement): HTMLButtonElement | null {
  return container.querySelector<HTMLButtonElement>('.cpub-statistics-action');
}

/** Whitespace collapsed the way a reader sees it, so a wrapped sentence matches. */
function readable(container: HTMLElement): string {
  return (container.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function putCalls(): Array<[string, { method?: string; body?: Record<string, unknown> }]> {
  return $fetch.mock.calls.filter(
    (c) => (c[1] as { method?: string } | undefined)?.method === 'PUT',
  ) as unknown as Array<[string, { method?: string; body?: Record<string, unknown> }]>;
}

describe('/settings/privacy sharing consents', () => {
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

  it('renders the registry sentences verbatim rather than a paraphrase', async () => {
    consentRef.value = response({ purposes: [purpose(), sponsorPurpose()] });
    const { container } = await mount();
    const text = readable(container);
    for (const spec of [RECRUITER, SPONSOR]) {
      expect(text).toContain(spec.offSummary.replace(/\s+/g, ' '));
      expect(text).toContain(spec.revocationEffect.replace(/\s+/g, ' '));
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
      purpose: 'recruiter_visibility',
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
      purpose: 'recruiter_visibility',
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

  it('says a non-public profile stops you being FOUND, not counted, on a sharing card', async () => {
    // The note used to say "your answers are not counted", which described the
    // aggregate query rather than the directory. Counting is a different query
    // with a different basis and it now has its own block; `listableUserWhere`
    // is what this note is about.
    profileRef.value = { profileVisibility: 'private' };
    consentRef.value = response({ purposes: [purpose({ state: 'absent' })] });
    const { container } = await mount();

    const note = container.querySelector('#cpub-purpose-visibility-recruiter_visibility');
    expect(note?.textContent).toContain('nobody can find you through this');
    expect(note?.textContent).not.toContain('counted');

    // And a screen-reader user ON the control hears it, rather than finding it
    // two sections later.
    const describedBy = container
      .querySelector('.cpub-purpose-switch')
      ?.getAttribute('aria-describedby');
    expect(describedBy).toContain('cpub-purpose-visibility-recruiter_visibility');
  });

  it('names the purposes this instance does not offer, rather than staying silent', async () => {
    consentRef.value = response({
      deferredPurposes: [{ id: 'sponsor_sharing', label: SPONSOR.label }],
    });
    const { container } = await mount();
    expect(container.textContent).toContain('does not offer these choices yet');
    expect(container.textContent).toContain('Nothing is shared for them.');
  });

  it('says answers stay in your ACCOUNT after a withdrawal, not on your profile', async () => {
    // `showOnProfile` defaults false and no built-in field opts in, so most
    // members have no answers on a profile at all. A reassurance naming the
    // profile would describe a place the data is not.
    const { container } = await mount();
    const text = readable(container);
    expect(text).toContain('only because you said yes');
    expect(text).toContain('Your answers stay in your account either way.');
    expect(text).not.toContain('stay on your profile');
  });
});

/**
 * Community statistics: legitimate interest, and the Art. 21 objection.
 *
 * The whole point of this block is that it is NOT a consent card. The tests
 * below pin the three ways that could regress: a consent switch reappearing, the
 * default flipping to excluded, and the copy drifting into consent language.
 */
describe('/settings/privacy community statistics', () => {
  it('has no statistics CONSENT card and no switch that describes counting', async () => {
    consentRef.value = response({ purposes: [purpose(), sponsorPurpose()] });
    const { container } = await mount();

    // Exactly as many switches as there are consent purposes. A statistics
    // switch would make it three.
    expect(switches(container)).toHaveLength(2);
    const statisticsBlock = container.querySelector('.cpub-statistics-card')!;
    expect(statisticsBlock).not.toBeNull(); // guard: an absent block has no switch either
    expect(statisticsBlock.querySelector('[role="switch"]')).toBeNull();

    const text = readable(container);
    expect(text).not.toContain('Count my answers');
    expect(text).not.toContain('profile_analytics');
    // The one sentence that made this a consent question is gone in both
    // directions: nothing here is agreed to, and nothing claims counting stays
    // put because you allowed it.
    expect(text).toContain('there is nothing here to agree to');
  });

  it('defaults to INCLUDED, and the control opts out', async () => {
    const { container } = await mount();
    const text = readable(container);
    // The current standing, first, and it is the counted one with no record.
    expect(text).toContain(PERSONA_STATISTICS.countedSummary);
    expect(text).not.toContain(PERSONA_STATISTICS.objectedSummary);

    const button = statisticsButton(container);
    expect(button).not.toBeNull();
    expect(button!.textContent!.trim()).toBe(PERSONA_STATISTICS.objectLabel);

    await fireEvent.click(button!);
    await settle();

    const calls = putCalls().filter((c) => c[0] === '/api/consent/objection');
    expect(calls).toHaveLength(1);
    expect(calls[0]![1].body).toEqual({ objected: true });
    // One click, in the protective direction, with no dialog. Objecting is never
    // the harder path.
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(container.textContent).not.toMatch(/are you sure/i);
  });

  it('offers the way back once an objection is on record', async () => {
    objectionRef.value = objectionPayload(true);
    const { container } = await mount();
    const text = readable(container);
    expect(text).toContain(PERSONA_STATISTICS.objectedSummary);
    expect(text).toContain(PERSONA_STATISTICS.withdrawObjectionEffect.replace(/\s+/g, ' '));

    const button = statisticsButton(container)!;
    expect(button.textContent!.trim()).toBe(PERSONA_STATISTICS.withdrawObjectionLabel);

    await fireEvent.click(button);
    await settle();
    const calls = putCalls().filter((c) => c[0] === '/api/consent/objection');
    expect(calls[0]![1].body).toEqual({ objected: false });
  });

  it('renders the server-substituted floor and never a raw copy token', async () => {
    const { container } = await mount();
    const text = readable(container);
    expect(text).toContain(renderStatisticsSummary(FLOORS).replace(/\s+/g, ' '));
    expect(text).not.toMatch(/\{[a-zA-Z]+\}/);
    // The floor in the sentence is the one this instance was told to use.
    expect(text).toContain('at least 5 people give the same answer');
  });

  it('says the standing could not be loaded rather than claiming you are counted', async () => {
    // This control's default is ON, so a card assembled from client defaults
    // would tell a member who objected that they are being counted.
    objectionRef.value = null;
    objectionErrorRef.value = new Error('500');
    const { container } = await mount();
    const text = readable(container);
    expect(text).toContain('Where you stand on community statistics could not be loaded.');
    expect(text).not.toContain(PERSONA_STATISTICS.countedSummary);
    expect(statisticsButton(container)).toBeNull();
  });

  it('renders nothing, and never fetches, when personaAnalytics is off', async () => {
    // No total is ever computed without it, so an objection to being counted
    // would describe processing that does not happen.
    analyticsOn.value = false;
    const { container } = await mount();
    expect(container.querySelector('.cpub-statistics-card')).toBeNull();
    expect(readable(container)).not.toContain(PERSONA_STATISTICS.label);
    const useFetchMock = (globalThis as unknown as { useFetch: ReturnType<typeof vi.fn> }).useFetch;
    const calls = useFetchMock.mock.calls.filter((c) =>
      String(c[0]).includes('/api/consent/objection'),
    );
    expect(calls.length).toBeGreaterThan(0); // guard: a renamed route would vacuously pass
    expect((calls.at(-1)?.[1] as { immediate?: boolean } | undefined)?.immediate).toBe(false);
  });

  it('renders nothing when persona itself is off', async () => {
    personaOn.value = false;
    const { container } = await mount();
    expect(container.querySelector('.cpub-statistics-card')).toBeNull();
  });
});

/**
 * The makerspace case (plan R2.3). An instance may ask operational questions
 * with no recruitment, sponsor or analytics ambitions at all, and then every
 * sentence about sharing or totals on this page describes something that does
 * not happen there.
 */
describe('/settings/privacy with the sharing flags off', () => {
  beforeEach(() => {
    consentsOn.value = false;
    analyticsOn.value = false;
    consentRef.value = null;
    objectionRef.value = null;
  });

  it('says nothing at all about sharing, recruiters, sponsors or statistics', async () => {
    const { container } = await mount();
    const text = readable(container);
    // Guard: the page still rendered, so the absences below are absences.
    expect(text.length).toBeGreaterThan(200);
    for (const banned of [
      'Sharing choices',
      'sharing',
      'shared',
      'recruiter',
      'sponsor',
      'statistics',
      'group totals',
      'counted',
    ]) {
      expect(text.toLowerCase()).not.toContain(banned.toLowerCase());
    }
    expect(switches(container)).toHaveLength(0);
    expect(statisticsButton(container)).toBeNull();
  });

  it('still offers profile visibility and the subject-rights links', async () => {
    const { container } = await mount();
    expect(container.querySelector('#cpub-profile-visibility')).not.toBeNull();
    expect(container.querySelector('a[href="/api/auth/export-data"]')).not.toBeNull();
    expect(container.querySelector('a[href="/settings/account"]')).not.toBeNull();
  });

  it('never fetches consent, history or the objection', async () => {
    await mount();
    const useFetchMock = (globalThis as unknown as { useFetch: ReturnType<typeof vi.fn> }).useFetch;
    for (const route of ['/api/consent/purposes', '/api/consent/objection']) {
      const calls = useFetchMock.mock.calls.filter((c) => String(c[0]).includes(route));
      expect(calls.length).toBeGreaterThan(0); // guard: a renamed route would vacuously pass
      expect((calls.at(-1)?.[1] as { immediate?: boolean } | undefined)?.immediate).toBe(false);
    }
  });
});

describe('/settings/privacy profile visibility and rights', () => {
  it('makes profileVisibility settable and states each consequence under its own flag', async () => {
    consentRef.value = response({ purposes: [purpose({ state: 'granted' })] });
    const { container } = await mount();
    const select = container.querySelector<HTMLSelectElement>('#cpub-profile-visibility')!;
    expect(select.value).toBe('public');
    expect(readable(container)).not.toContain('While your profile is not public');

    await fireEvent.update(select, 'private');
    await settle();
    const text = readable(container);
    expect(text).toContain(
      'While your profile is not public, your answers are not counted in community statistics.',
    );
    expect(text).toContain(
      'While your profile is not public, nobody can find you through the choices above, even with one of them turned on.',
    );

    await fireEvent.click(container.querySelector('.cpub-field .cpub-btn')!);
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
});

describe('/settings/privacy consent history', () => {
  it('lists every grant and revoke with its date and what was shown at the time', async () => {
    historyRef.value = {
      history: [
        {
          id: 'c2',
          purpose: 'recruiter_visibility',
          state: 'revoked',
          actedAt: '2026-08-02T09:00:00.000Z',
          policyVersion: '3',
          scopeDigest: 'digest-1',
          source: 'settings',
          scopeSnapshot: {
            purposeLabel: RECRUITER.label,
            offSummary: RECRUITER.offSummary,
            onSummary: renderPurposeOnSummary('recruiter_visibility', FLOORS),
            recipients: [],
            dataClasses: ['persona_selections'],
            aggregatableFieldKeys: ['interests'],
            policyVersion: '3',
          },
        },
        {
          id: 'c1',
          purpose: 'recruiter_visibility',
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
    const times = Array.from(container.querySelectorAll('.cpub-history-table time'));
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
    expect(container.textContent).toContain('The record of who has looked could not be loaded.');
    // The reassuring reading must not be available: no list, and none of the
    // copy that only makes sense when the list is complete.
    expect(container.querySelector('.cpub-disclosure-list')).toBeNull();
    expect(container.textContent).not.toContain(HONEST_SENTENCE);
  });

  it('names a removed recipient as unlisted rather than dropping the disclosure', async () => {
    disclosureRef.value = {
      disclosures: [
        disclosure({ recipientId: 'ghost', recipientName: 'ghost', recipientKnown: false }),
      ],
    };
    const { container } = await mount();
    expect(container.textContent).toContain('A recipient this site no longer lists (ghost)');
  });

  it('renders nothing, and never fetches, when memberDirectory is off', async () => {
    directoryOn.value = false;
    disclosureRef.value = { disclosures: [disclosure()] };
    const { container } = await mount();
    expect(container.textContent).not.toContain(HEADING);
    const useFetchMock = (globalThis as unknown as { useFetch: ReturnType<typeof vi.fn> }).useFetch;
    const calls = useFetchMock.mock.calls.filter((c) =>
      String(c[0]).includes('/api/consent/disclosures'),
    );
    expect(calls.length).toBeGreaterThan(0); // guard: a renamed route would vacuously pass
    expect((calls.at(-1)?.[1] as { immediate?: boolean } | undefined)?.immediate).toBe(false);
  });
});

describe('/settings/privacy copy rules', () => {
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
      disclosures: [
        disclosure(),
        disclosure({ recipientId: 'contoso', recipientName: 'Contoso Tools', count: 1 }),
      ],
    };
    historyRef.value = {
      history: [
        {
          id: 'c1',
          purpose: 'recruiter_visibility',
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
