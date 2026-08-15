/**
 * Component test for `/settings/profile/questions` (plan R2.3, R3.1, R3.4
 * phase 2).
 *
 * Lives under components/__tests__ (bracket-free) so packaging excludes it: the
 * layer's `!**\/__tests__/` exclusion is unreliable under `pages/`, which carries
 * bracketed route directories that npm pack reads as glob character classes.
 *
 * The page is a composer, so what is tested is what the page itself owns: the
 * flat per-section answer map it hands the editor, the per-section save call,
 * the h3 error nesting, the retired-data delete, and above all the FRAMING.
 *
 * Three of these are the correction itself and are asserted on rendered output
 * rather than on props:
 *
 *  1. With the sharing flags off, the page contains no sharing vocabulary of any
 *     kind. A makerspace asking which machines somebody is checked out on must
 *     not read one word about recruiters, sponsors or statistics.
 *  2. With `dataSharingConsents` on but no recipient declared, the same holds.
 *     The server returns an empty `purposes` array in that case, and an empty
 *     array must produce silence rather than a heading with nothing under it.
 *  3. Nothing bundles. Saving answers issues zero consent requests, and the
 *     consent switch issues zero persona writes.
 *
 * The word-list sweeps carry their own guard: each asserts the render is
 * non-trivial and contains a sentence it must contain, because a page that
 * failed to mount passes every ban trivially.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent } from '@testing-library/vue';
import axe from 'axe-core';
import { createApp, defineComponent, h, ref, Suspense, nextTick, type App, type PropType } from 'vue';
import QuestionsPage from '../../pages/settings/profile/questions.vue';
// The REAL composable, not a stand-in: the h3 error nesting is the thing under
// test, and a hand-written extractor in the test would prove nothing about it.
import { useApiError } from '../../composables/useApiError';
// The REAL registry copy. The statistics note is the one block whose words this
// page imports rather than receives, so the test compares against the source of
// truth instead of a copy that could drift with it.
import { PERSONA_STATISTICS } from '@commonpub/persona';

type Answers = Record<string, string | string[] | null>;

interface SectionStub {
  key: string;
  label: string;
  collapsedByDefault?: boolean;
  fields: Array<{
    key: string;
    label: string;
    type: string;
    showOnProfile?: boolean;
    sensitive?: boolean;
    column?: string;
  }>;
}

const NuxtLink = defineComponent({
  name: 'NuxtLink',
  props: { to: { type: String, default: '' } },
  setup: (props, { slots }) => () => h('a', { href: props.to }, slots.default?.()),
});

/** Stands in for `components/persona/PersonaSectionEditor.vue`. Renders the props
 *  it is given so the page's own derivation is observable, and re-emits `save`. */
const PersonaSectionEditor = defineComponent({
  name: 'PersonaSectionEditor',
  props: {
    section: { type: Object as PropType<SectionStub>, required: true },
    values: { type: Object as PropType<Record<string, string | string[]>>, default: () => ({}) },
    platforms: { type: Array as PropType<unknown[]>, default: () => [] },
    index: { type: Number, default: 0 },
    saving: { type: Boolean, default: false },
    error: { type: String as PropType<string | null>, default: null },
  },
  emits: ['save'],
  setup(props, { emit }) {
    return () =>
      h('section', { class: 'stub-section', 'data-key': props.section.key }, [
        h('span', { class: 'stub-index' }, String(props.index)),
        h('span', { class: 'stub-values' }, JSON.stringify(props.values)),
        props.error ? h('p', { class: 'stub-error' }, props.error) : null,
        h(
          'button',
          {
            class: 'stub-save',
            onClick: () => emit('save', { sectionKey: props.section.key, answers: props.values }),
          },
          'Save',
        ),
      ]);
  },
});

const PersonaCompletenessMeter = defineComponent({
  name: 'PersonaCompletenessMeter',
  props: {
    completeness: { type: Object as PropType<Record<string, unknown> | null>, default: null },
    label: { type: String, default: '' },
  },
  setup: (props) => () =>
    h('div', { class: 'stub-meter' }, props.completeness ? JSON.stringify(props.completeness) : 'none'),
});

const PersonaRetiredData = defineComponent({
  name: 'PersonaRetiredData',
  props: {
    items: { type: Array as PropType<Array<{ fieldKey: string }>>, required: true },
    deletingKey: { type: String as PropType<string | null>, default: null },
  },
  emits: ['delete'],
  setup(props, { emit }) {
    return () =>
      h(
        'div',
        { class: 'stub-retired' },
        props.items.map((item) =>
          h(
            'button',
            { class: 'stub-retired-delete', key: item.fieldKey, onClick: () => emit('delete', item.fieldKey) },
            item.fieldKey,
          ),
        ),
      );
  },
});

function makePersona(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    sections: [
      {
        key: 'basics',
        label: 'Basics',
        fields: [
          // Column-bound, exactly as the built-in `basics` section binds it.
          // `/settings/profile/basics` owns this one now.
          { key: 'display_name', label: 'Display name', type: 'text', column: 'displayName' },
          { key: 'industry', label: 'Industry', type: 'select' },
        ],
      },
      {
        // Every field bound to a column: nothing left to ask, so the whole
        // section goes rather than rendering an empty disclosure.
        key: 'name_only',
        label: 'Name only',
        fields: [{ key: 'headline', label: 'Job title', type: 'text', column: 'headline' }],
      },
      {
        key: 'interests',
        label: 'Interests',
        fields: [{ key: 'interests', label: 'Interests', type: 'multiselect' }],
      },
      {
        key: 'tech_stack',
        label: 'Tech stack',
        collapsedByDefault: true,
        fields: [{ key: 'tech_stack', label: 'Tech stack', type: 'multiselect' }],
      },
      {
        key: 'links',
        label: 'Links',
        fields: [{ key: 'link_github', label: 'GitHub', type: 'link' }],
      },
    ],
    values: {
      answers: { industry: ['hardware'], interests: ['pcb', 'firmware'] },
      text: {},
      links: { link_github: 'https://github.com/sam' },
      columns: { display_name: 'Sam' },
    },
    retired: [],
    completeness: {
      perSection: [],
      filledFields: 4,
      totalFields: 5,
      percent: 80,
      points: 0,
    },
    ...overrides,
  };
}

/**
 * The recruiter card as the server builds it, with the REGISTRY copy. Copied
 * from `PROCESSING_PURPOSE_SPECS` rather than invented, because the assertions
 * below are about which registry sentence is rendered in which state, and a
 * paraphrase in the fixture would let the page paraphrase too.
 */
const RECRUITER_OFF =
  'Right now nobody outside this site can find you through the hiring directory, and none of your answers are sent to anyone.';
const RECRUITER_ON =
  'If you turn this on: your name, your public profile, the links on it, the town you list and your answers about interests and tech stack are shown to the people named below when they search this site for someone to hire. Each time one of them looks you up it is recorded and shown to you. They cannot see your email address.';
const RECRUITER_REVOCATION =
  'You can turn this off at any time, and new searches stop finding you straight away. It cannot recall what was already shared: somebody who looked you up keeps whatever they noted down. Your answers stay in your account.';

interface PurposeFixture {
  id: string;
  label: string;
  offSummary: string;
  onSummary: string;
  revocationEffect: string;
  recipients: Array<Record<string, unknown>>;
  state: 'granted' | 'revoked' | 'absent';
  needsReconfirmation: boolean;
}

function recruiterPurpose(overrides: Partial<PurposeFixture> = {}): PurposeFixture {
  return {
    id: 'recruiter_visibility',
    label: 'Let people hiring find me by my answers',
    offSummary: RECRUITER_OFF,
    onSummary: RECRUITER_ON,
    revocationEffect: RECRUITER_REVOCATION,
    recipients: [
      {
        id: 'acme',
        name: 'Acme Robotics',
        privacyPolicyUrl: 'https://acme.example/privacy',
        relationship: 'independent_controller',
      },
    ],
    state: 'absent',
    needsReconfirmation: false,
    ...overrides,
  };
}

function makeConsent(purposes: PurposeFixture[]): Record<string, unknown> {
  return { scopeDigest: 'digest-1', policyVersion: '3', purposes, deferredPurposes: [], minBucket: 5, minPopulation: 25 };
}

const personaRef = ref<Record<string, unknown> | null>(makePersona());
const consentRef = ref<Record<string, unknown> | null>(null);
const refreshPersona = vi.fn(async () => {});
const refreshConsent = vi.fn(async () => {});
// Typed params, not `vi.fn(async () => ...)`: a zero-arity mock infers
// `calls: []`, and every `calls[0]![1]` assertion below then fails vue-tsc with
// "tuple of length 0 has no element at index 1" while vitest stays green.
const $fetch = vi.fn(async (_url: string, _opts?: Record<string, unknown>) => ({}) as unknown);
const toast = vi.fn();
const featureOn = ref(true);
const consentsOn = ref(false);
const analyticsOn = ref(false);

const useFetch = vi.fn((url: string, _opts?: Record<string, unknown>) =>
  (url === '/api/consent/purposes'
    ? { data: consentRef, pending: ref(false), refresh: refreshConsent }
    : { data: personaRef, pending: ref(false), refresh: refreshPersona }));

Object.assign(globalThis, {
  definePageMeta: () => {},
  useSeoMeta: () => {},
  useSiteName: () => 'Test',
  useToast: () => ({ show: toast }),
  useApiError,
  useFeatures: () => ({
    persona: featureOn,
    dataSharingConsents: consentsOn,
    personaAnalytics: analyticsOn,
  }),
  useFetch,
  $fetch,
});

beforeEach(() => {
  personaRef.value = makePersona();
  consentRef.value = null;
  refreshPersona.mockClear();
  refreshConsent.mockClear();
  useFetch.mockClear();
  $fetch.mockClear();
  $fetch.mockImplementation(async () => ({}));
  toast.mockClear();
  featureOn.value = true;
  consentsOn.value = false;
  analyticsOn.value = false;
});

/**
 * The page has top-level `await useFetch` calls, so its setup is async and Vue
 * needs a Suspense boundary. `@testing-library/vue`'s `render` cannot supply one
 * that resolves (its VTU mount leaves the pending branch in Suspense's hidden
 * container, so the assertion target stays empty and every test would pass or
 * fail for the wrong reason). Mounting the boundary with `createApp` gives real
 * DOM, so the stub components are registered globally rather than as VTU stubs.
 */
const mounted: Array<{ app: App; el: HTMLElement }> = [];

async function mount(): Promise<{ container: HTMLElement }> {
  const el = document.createElement('div');
  document.body.appendChild(el);
  const Wrapper = defineComponent({
    setup: () => () => h(Suspense, null, { default: () => h(QuestionsPage) }),
  });
  const app = createApp(Wrapper);
  app.component('NuxtLink', NuxtLink);
  app.component('PersonaSectionEditor', PersonaSectionEditor);
  app.component('PersonaCompletenessMeter', PersonaCompletenessMeter);
  app.component('PersonaRetiredData', PersonaRetiredData);
  app.mount(el);
  mounted.push({ app, el });
  await settle();
  return { container: el };
}

/** Suspense resolves its async setup across microtasks; one tick is not enough. */
async function settle(): Promise<void> {
  for (let i = 0; i < 4; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await nextTick();
  }
}

afterEach(() => {
  while (mounted.length) {
    const entry = mounted.pop()!;
    entry.app.unmount();
    entry.el.remove();
  }
});

function sectionEl(container: HTMLElement, key: string): HTMLElement {
  const el = container.querySelector<HTMLElement>(`.stub-section[data-key="${key}"]`);
  if (!el) throw new Error(`section ${key} not rendered`);
  return el;
}

function valuesOf(container: HTMLElement, key: string): Answers {
  return JSON.parse(sectionEl(container, key).querySelector('.stub-values')!.textContent ?? '{}') as Answers;
}

function callsTo(url: string): Array<[string, Record<string, unknown> | undefined]> {
  return $fetch.mock.calls.filter((c) => c[0] === url) as Array<[string, Record<string, unknown> | undefined]>;
}

function text(container: HTMLElement): string {
  return container.textContent ?? '';
}

/**
 * Sharing and statistics vocabulary, as word-boundary patterns so `account`
 * does not read as `count` and `shown` does not read as `share`. Anything here
 * describes processing an instance running `persona` alone does not carry out.
 */
const SHARING_WORDS: RegExp[] = [
  /\bshare(s|d)?\b/i,
  /\bsharing\b/i,
  /\brecruit/i,
  /\bsponsor/i,
  /\bhiring\b/i,
  /\bemployer/i,
  /\bthird part/i,
  /\bconsent/i,
  /\bdirectory\b/i,
  /\brecipient/i,
  /\bstatistic/i,
  /\bcount(s|ed|ing)?\b/i,
  /\banalytic/i,
  /\baggregate/i,
  /\btotals?\b/i,
  /\bobject(s|ed|ion|ing)?\b/i,
];

function assertNoSharingVocabulary(container: HTMLElement): void {
  const rendered = text(container);
  // The guard on the guard: a page that failed to mount contains none of these
  // words and would pass every ban below without rendering anything at all.
  expect(rendered).toContain('These are the questions this site asks.');
  expect(rendered.length).toBeGreaterThan(120);
  expect(container.querySelectorAll('.stub-section').length).toBeGreaterThan(0);
  for (const pattern of SHARING_WORDS) {
    expect(rendered).not.toMatch(pattern);
  }
}

describe('/settings/profile/questions', () => {
  describe('the questions themselves', () => {
    it('renders one editor per section, minus what another tab now owns', async () => {
      const { container } = await mount();
      const keys = Array.from(container.querySelectorAll('.stub-section')).map((e) => e.getAttribute('data-key'));
      // `name_only` held nothing but a column-bound field, so it is gone
      // entirely: the merge is a deletion, and an empty section is not a merge.
      expect(keys).toEqual(['basics', 'interests', 'tech_stack', 'links']);
    });

    it('drops the column-bound fields the Basics tab edits, and keeps the question beside them', async () => {
      const { container } = await mount();
      const basics = JSON.parse(
        sectionEl(container, 'basics').querySelector('.stub-values')!.textContent ?? '{}',
      ) as Answers;
      expect(basics).not.toHaveProperty('display_name');
      expect(basics).toHaveProperty('industry');
      // Two editors for one datum is what this merge removes, so a member is
      // told where the other one is rather than left to find it.
      expect(text(container)).toContain('Your name, photo and bio are on the');
    });

    it('hands each editor a flat value map merged across the storage partitions it renders', async () => {
      const { container } = await mount();
      expect(valuesOf(container, 'basics')).toEqual({ industry: 'hardware' });
      expect(valuesOf(container, 'interests')).toEqual({ interests: ['pcb', 'firmware'] });
      expect(valuesOf(container, 'links')).toEqual({ link_github: 'https://github.com/sam' });
      // An unfilled key is OMITTED rather than sent as null: the editor's prop
      // type carries no null, and "absent" is the only way this map says unfilled.
      expect(valuesOf(container, 'tech_stack')).toEqual({});
    });

    it('passes the render position so the editor can own its own open state', async () => {
      const { container } = await mount();
      const positions = Array.from(container.querySelectorAll('.stub-index')).map((e) => e.textContent);
      expect(positions).toEqual(['0', '1', '2', '3']);
    });

    it('offers the empty state on what THIS page asks, not on the whole profile', async () => {
      // `completeness.filledFields` stays 4, because the display name typed at
      // registration is a filled profile field. It is not an answer to any
      // question on this page, so the prompt must still appear.
      personaRef.value = makePersona({
        values: { answers: {}, text: {}, links: {}, columns: { display_name: 'Sam' } },
      });
      const { container } = await mount();
      expect(text(container)).toContain('Nothing here yet.');
    });

    it('saves ONE section per request and refreshes', async () => {
      const { container } = await mount();
      await fireEvent.click(sectionEl(container, 'interests').querySelector('.stub-save')!);
      const puts = callsTo('/api/persona');
      expect(puts).toHaveLength(1);
      expect(puts[0]![1]!.method).toBe('PUT');
      expect(puts[0]![1]!.body).toEqual({
        sectionKey: 'interests',
        answers: { interests: ['pcb', 'firmware'] },
      });
      expect(refreshPersona).toHaveBeenCalled();
      expect(toast).toHaveBeenCalledWith('Saved', 'success');
    });

    it('surfaces the FIELD NAME from a Zod 400, not the bare "Validation failed"', async () => {
      // h3 nests `createError({ data })` under a `data` key of the body, so the
      // field errors a route raises as `data: { errors }` arrive at
      // err.data.data.errors, one level deeper than they look.
      $fetch.mockImplementation(async () => {
        throw {
          statusCode: 400,
          data: { statusMessage: 'Validation failed', data: { errors: { interests: ['Pick at most 5'] } } },
        };
      });
      const { container } = await mount();
      await fireEvent.click(sectionEl(container, 'interests').querySelector('.stub-save')!);
      await nextTick();

      const shown = sectionEl(container, 'interests').querySelector('.stub-error')?.textContent ?? '';
      expect(shown).toContain('interests');
      expect(shown).toContain('Pick at most 5');
      expect(shown).not.toBe('Validation failed');
      expect(sectionEl(container, 'basics').querySelector('.stub-error')).toBeNull();
    });

    it('deletes one retired field through the page, then refreshes', async () => {
      personaRef.value = makePersona({
        retired: [{ fieldKey: 'old_question', values: ['a'], text: null, retiredAt: '2026-01-02T00:00:00.000Z' }],
      });
      const { container } = await mount();
      await fireEvent.click(container.querySelector('.stub-retired-delete')!);
      const deletes = callsTo('/api/persona/retired/old_question');
      expect(deletes).toHaveLength(1);
      expect(deletes[0]![1]!.method).toBe('DELETE');
      expect(refreshPersona).toHaveBeenCalled();
    });

    it('binds the meter to the fetched DTO and never to a zero seed', async () => {
      const { container } = await mount();
      const meter = container.querySelector('.stub-meter')!.textContent ?? '';
      expect(meter).toContain('"filledFields":4');
      expect(meter).not.toBe('none');
    });

    it('renders nothing but a notice, and asks for nothing, when the feature is off', async () => {
      featureOn.value = false;
      consentsOn.value = true;
      personaRef.value = null;
      consentRef.value = null;
      const { container } = await mount();
      expect(text(container)).toContain('These questions are not enabled on this site.');
      expect(container.querySelectorAll('.stub-section')).toHaveLength(0);
      // BOTH fetches must be told not to fire: `/api/persona` is
      // `requireFeature('persona')` and 404s, and with no questions there is
      // nothing for a recipient to receive either.
      for (const url of ['/api/persona', '/api/consent/purposes']) {
        const call = useFetch.mock.calls.find((c) => c[0] === url);
        expect(call, `${url} was never asked for`).toBeDefined();
        expect(call![1]).toMatchObject({ immediate: false });
      }
    });
  });

  describe('visibility, after the showOnProfile inversion', () => {
    /** Mutates one field of the served schema, by key rather than by position. */
    function withField(key: string, patch: Record<string, unknown>): void {
      const persona = makePersona();
      for (const section of persona.sections as SectionStub[]) {
        for (const field of section.fields) {
          if (field.key === key) Object.assign(field, patch);
        }
      }
      personaRef.value = persona;
    }

    it('says plainly that answers are not on the public profile when no field opts in', async () => {
      const { container } = await mount();
      expect(text(container)).toContain('None of them appear on your public profile.');
    });

    it('NAMES the fields the operator opted in, rather than restating a rule', async () => {
      withField('interests', { showOnProfile: true });
      const { container } = await mount();
      expect(text(container)).toContain('These answers appear on your public profile: Interests.');
      expect(text(container)).not.toContain('None of them appear on your public profile.');
    });

    it('never names a SENSITIVE field as public, whatever the flag says', async () => {
      // Mirrors `GET /api/users/:username/persona`, which skips a sensitive
      // field before it ever reads `showOnProfile`.
      withField('interests', { showOnProfile: true, sensitive: true });
      const { container } = await mount();
      expect(text(container)).toContain('None of them appear on your public profile.');
      expect(text(container)).not.toContain('public profile: Interests');
    });

    it('does not claim a link field is private, because the profile hero prints it', async () => {
      const { container } = await mount();
      const rendered = text(container);
      // The link is not counted as one of the opted-in ANSWERS...
      expect(rendered).not.toContain('public profile: GitHub');
      // ...and it is not swept up by the sentence that says the rest is private.
      expect(rendered).toContain('The links you list are shown on your profile');
      expect(container.querySelector('a[href="/settings/profile/links"]')).not.toBeNull();
    });
  });

  describe('an instance that shares nothing', () => {
    it('carries NO sharing vocabulary with the sharing flags off', async () => {
      const { container } = await mount();
      assertNoSharingVocabulary(container);
      expect(container.querySelectorAll('[role="switch"]')).toHaveLength(0);
    });

    it('stays silent when dataSharingConsents is on but no recipient is declared', async () => {
      // Both surviving purposes require a recipient, so the server answers with
      // an empty list. Silence is the only honest render: a heading with nothing
      // under it, or a sentence naming what is NOT offered, still teaches a
      // makerspace member that recruiters are in this software.
      consentsOn.value = true;
      consentRef.value = makeConsent([]);
      const { container } = await mount();
      assertNoSharingVocabulary(container);
      expect(container.querySelectorAll('[role="switch"]')).toHaveLength(0);
    });

    it('carries NO statistics vocabulary while personaAnalytics is off', async () => {
      const { container } = await mount();
      // Covered by the sweep above, pinned separately so the reason is legible:
      // nothing counts anything on an instance with the rollup pass switched off.
      expect(text(container)).not.toMatch(/\bstatistic/i);
      expect(text(container)).not.toContain(PERSONA_STATISTICS.basisNote);
    });
  });

  describe('the one sharing decision, when the operator has configured one', () => {
    beforeEach(() => {
      consentsOn.value = true;
      consentRef.value = makeConsent([recruiterPurpose()]);
    });

    it('states the current truth in the registry’s words, before offering the change', async () => {
      const { container } = await mount();
      const rendered = text(container);
      expect(rendered).toContain('Let people hiring find me by my answers');
      expect(rendered).toContain(RECRUITER_OFF);
      // The off state is the status line. What WOULD change is behind the
      // disclosure, and so is the switch.
      expect(rendered).not.toContain(RECRUITER_ON);
      expect(container.querySelectorAll('[role="switch"]')).toHaveLength(0);
    });

    it('never offers the switch before the disclosure that names the recipients', async () => {
      const { container } = await mount();
      const more = container.querySelector<HTMLButtonElement>('.cpub-questions-purpose-more')!;
      expect(more.getAttribute('aria-expanded')).toBe('false');

      await fireEvent.click(more);
      await nextTick();

      const rendered = text(container);
      expect(rendered).toContain(RECRUITER_ON);
      expect(rendered).toContain('Acme Robotics');
      expect(rendered).toContain(RECRUITER_REVOCATION);
      const policy = container.querySelector('a[href="https://acme.example/privacy"]');
      expect(policy).not.toBeNull();

      const sw = container.querySelector<HTMLButtonElement>('[role="switch"]')!;
      expect(sw).not.toBeNull();
      expect(sw.getAttribute('aria-checked')).toBe('false');
      // Labelled by the purpose, described by the state sentence. Neither is
      // invented here: both ids point at registry copy on the page.
      expect(sw.getAttribute('aria-labelledby')).toBe('cpub-questions-purpose-recruiter_visibility');
      expect(container.querySelector('#cpub-questions-purpose-recruiter_visibility')?.textContent)
        .toContain('Let people hiring find me by my answers');
      expect(container.querySelector(`#${sw.getAttribute('aria-describedby')}`)?.textContent)
        .toContain(RECRUITER_OFF);
    });

    it('grants through its OWN request, one purpose, with the digest it was shown', async () => {
      const { container } = await mount();
      await fireEvent.click(container.querySelector('.cpub-questions-purpose-more')!);
      await nextTick();
      await fireEvent.click(container.querySelector('[role="switch"]')!);
      await settle();

      const puts = callsTo('/api/consent/purposes');
      expect(puts).toHaveLength(1);
      expect(puts[0]![1]!.method).toBe('PUT');
      expect(puts[0]![1]!.body).toEqual({
        purpose: 'recruiter_visibility',
        grant: true,
        scopeDigest: 'digest-1',
      });
      // ANTI-BUNDLING, first direction: the consent control writes no answers.
      expect(callsTo('/api/persona')).toHaveLength(0);
      expect(refreshConsent).toHaveBeenCalled();
    });

    it('ANTI-BUNDLING: saving a section touches no consent surface at all', async () => {
      const { container } = await mount();
      await fireEvent.click(sectionEl(container, 'interests').querySelector('.stub-save')!);
      await settle();

      expect(callsTo('/api/persona')).toHaveLength(1);
      expect(callsTo('/api/consent/purposes')).toHaveLength(0);
      // Not even a read. Nothing on the save path speaks to the consent record.
      expect($fetch.mock.calls.every((c) => !String(c[0]).startsWith('/api/consent'))).toBe(true);
    });

    it('renders the ON state as the registry’s onSummary, with withdrawal one click away', async () => {
      consentRef.value = makeConsent([recruiterPurpose({ state: 'granted' })]);
      const { container } = await mount();
      const rendered = text(container);
      expect(rendered).toContain(RECRUITER_ON);
      // No expander to get past: while it is on, the switch is already there.
      expect(container.querySelector('.cpub-questions-purpose-more')).toBeNull();

      const sw = container.querySelector<HTMLButtonElement>('[role="switch"]')!;
      expect(sw.getAttribute('aria-checked')).toBe('true');

      await fireEvent.click(sw);
      await settle();
      const puts = callsTo('/api/consent/purposes');
      expect(puts).toHaveLength(1);
      expect(puts[0]![1]!.body).toEqual({
        purpose: 'recruiter_visibility',
        grant: false,
        scopeDigest: 'digest-1',
      });
    });

    it('never points aria-controls at an element that is not there', async () => {
      const { container } = await mount();
      const more = container.querySelector<HTMLButtonElement>('.cpub-questions-purpose-more')!;
      expect(more.hasAttribute('aria-controls')).toBe(false);

      await fireEvent.click(more);
      await nextTick();
      const target = container.querySelector<HTMLButtonElement>('.cpub-questions-purpose-more')!
        .getAttribute('aria-controls');
      expect(target).toBeTruthy();
      expect(container.querySelector(`#${target}`)).not.toBeNull();
    });

    it('keeps the block open after a withdrawal, so the new status is where the switch was', async () => {
      consentRef.value = makeConsent([recruiterPurpose({ state: 'granted' })]);
      const { container } = await mount();
      // The server is the record, and `refresh` in this test does not change the
      // fixture, so the state stays granted. What is asserted is the page's own
      // decision not to collapse the block it was just clicked in.
      await fireEvent.click(container.querySelector('[role="switch"]')!);
      await settle();
      expect(container.querySelector('[role="switch"]')).not.toBeNull();
      expect(toast).toHaveBeenCalledWith('Turned off', 'success');
    });

    it('shows a STALE grant as off, because a stale grant authorises nothing', async () => {
      consentRef.value = makeConsent([
        recruiterPurpose({ state: 'granted', needsReconfirmation: true }),
      ]);
      const { container } = await mount();
      expect(text(container)).toContain(RECRUITER_OFF);
      await fireEvent.click(container.querySelector('.cpub-questions-purpose-more')!);
      await nextTick();
      expect(container.querySelector('[role="switch"]')!.getAttribute('aria-checked')).toBe('false');
    });

    it('records nothing and retries nothing when the scope moved under it', async () => {
      $fetch.mockImplementation(async (url: string) => {
        if (url === '/api/consent/purposes') {
          throw { statusCode: 409, data: { data: { code: 'SCOPE_CHANGED', retryable: false } } };
        }
        return {};
      });
      const { container } = await mount();
      await fireEvent.click(container.querySelector('.cpub-questions-purpose-more')!);
      await nextTick();
      await fireEvent.click(container.querySelector('[role="switch"]')!);
      await settle();

      expect(callsTo('/api/consent/purposes')).toHaveLength(1);
      const rendered = text(container);
      expect(rendered).toContain('nothing has been recorded');
      // The full card is the one that can be read against the new scope.
      expect(container.querySelector('.cpub-questions-purpose-moved a[href="/settings/privacy"]'))
        .not.toBeNull();
      expect(toast).not.toHaveBeenCalledWith('Turned on', 'success');
    });

    it('points at Privacy for the record, rather than restating it here', async () => {
      const { container } = await mount();
      expect(container.querySelector('a[href="/settings/privacy"]')).not.toBeNull();
    });
  });

  describe('statistics are disclosed, never asked', () => {
    beforeEach(() => {
      analyticsOn.value = true;
    });

    it('renders the registry basis note and no control of any kind', async () => {
      const { container } = await mount();
      const stats = container.querySelector<HTMLElement>('.cpub-questions-statistics')!;
      expect(stats).not.toBeNull();
      expect(stats.textContent).toContain(PERSONA_STATISTICS.label);
      expect(stats.textContent).toContain(PERSONA_STATISTICS.basisNote);
      // An objection is not a consent and is not presented as one: no switch
      // here, and no switch anywhere on the page while sharing is unconfigured.
      expect(stats.querySelectorAll('[role="switch"]')).toHaveLength(0);
      expect(container.querySelectorAll('[role="switch"]')).toHaveLength(0);
      expect(stats.querySelector('a[href="/settings/privacy"]')).not.toBeNull();
    });

    it('says nothing about sharing while only the statistics flag is on', async () => {
      const { container } = await mount();
      const rendered = text(container);
      // `consent` is NOT banned here, and deliberately: the registry's own basis
      // note says "This is not a consent question", which is the sentence that
      // stops an objection reading as one. Banning the word would ban the
      // correction.
      for (const pattern of [/\bshare(s|d)?\b/i, /\bsharing\b/i, /\brecruit/i, /\bsponsor/i, /\bhiring\b/i]) {
        expect(rendered).not.toMatch(pattern);
      }
      // Guard: the statistics block really did render, so the bans above ran
      // against a page that had something to ban.
      expect(rendered).toContain(PERSONA_STATISTICS.label);
    });
  });

  describe('accessibility', () => {
    it('has no axe violations in the fullest render', async () => {
      consentsOn.value = true;
      analyticsOn.value = true;
      consentRef.value = makeConsent([recruiterPurpose()]);
      const { container } = await mount();
      await fireEvent.click(container.querySelector('.cpub-questions-purpose-more')!);
      await nextTick();
      // `color-contrast` is off because jsdom computes no colours (the token
      // pairs are measured against the theme files instead), and `region`
      // because this page is mounted bare rather than inside the settings
      // layout that provides the landmarks.
      const results = await axe.run(container, {
        rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
      });
      expect(results.violations).toEqual([]);
    });
  });

  describe('copy rules', () => {
    it('carries no em dash and no banned growth-copy string, in the fullest render', async () => {
      consentsOn.value = true;
      analyticsOn.value = true;
      consentRef.value = makeConsent([recruiterPurpose()]);
      personaRef.value = makePersona({
        retired: [{ fieldKey: 'old_question', values: ['a'], text: null, retiredAt: null }],
      });
      const { container } = await mount();
      await fireEvent.click(container.querySelector('.cpub-questions-purpose-more')!);
      await nextTick();

      const rendered = text(container);
      expect(rendered.length).toBeGreaterThan(400); // guard: an empty render passes any ban
      expect(rendered).not.toMatch(/—/);
      for (const banned of ['Help us improve', 'Get the most out of', 'Unlock', 'Boost', 'You are missing out']) {
        expect(rendered).not.toContain(banned);
      }
    });
  });
});
