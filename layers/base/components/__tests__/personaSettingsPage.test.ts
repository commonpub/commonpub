/**
 * Component test for `/settings/persona` (plan 8.1, 10.2).
 *
 * Lives under components/__tests__ (bracket-free) so packaging excludes it: the
 * layer's `!**\/__tests__/` exclusion is unreliable under `pages/`, which carries
 * bracketed route directories that npm pack reads as glob character classes.
 *
 * The page is a composer. What is tested here is what the page itself owns: the
 * flat per-section answer map it hands the editor, the expansion seed, the
 * per-section save call, the h3 error nesting, the retired-data delete, and the
 * copy rules. The chip grids and field inputs belong to
 * `layers/base/components/persona/**` and are stubbed.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent } from '@testing-library/vue';
import { createApp, defineComponent, h, ref, Suspense, nextTick, type App, type PropType } from 'vue';
import PersonaPage from '../../pages/settings/persona.vue';
// The REAL composable, not a stand-in: the h3 error nesting is the thing under
// test, and a hand-written extractor in the test would prove nothing about it.
import { useApiError } from '../../composables/useApiError';

type Answers = Record<string, string | string[] | null>;

interface SectionStub {
  key: string;
  label: string;
  collapsedByDefault?: boolean;
  fields: Array<{ key: string; label: string; type: string }>;
}

const NuxtLink = defineComponent({
  name: 'NuxtLink',
  props: { to: { type: String, default: '' } },
  setup: (props, { slots }) => () => h('a', { href: props.to }, slots.default?.()),
});

/** Stands in for `components/persona/SectionEditor.vue`. Renders the props it is
 *  given so the page's own derivation is observable, and re-emits `save`. */
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

function makeResponse(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    sections: [
      {
        key: 'basics',
        label: 'Basics',
        fields: [
          { key: 'display_name', label: 'Display name', type: 'text' },
          { key: 'industry', label: 'Industry', type: 'select' },
        ],
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

const responseRef = ref<Record<string, unknown> | null>(makeResponse());
const refresh = vi.fn(async () => {});
// Typed params, not `vi.fn(async () => ...)`: a zero-arity mock infers
// `calls: []`, and every `calls[0]![1]` assertion below then fails vue-tsc
// with "tuple of length 0 has no element at index 1" while vitest stays green.
const $fetch = vi.fn(async (_url: string, _opts?: Record<string, unknown>) => ({}) as unknown);
const toast = vi.fn();
const featureOn = ref(true);
const consentsOn = ref(true);

Object.assign(globalThis, {
  definePageMeta: () => {},
  useSeoMeta: () => {},
  useSiteName: () => 'Test',
  useToast: () => ({ show: toast }),
  useApiError,
  useFeatures: () => ({ persona: featureOn, dataSharingConsents: consentsOn }),
  useFetch: vi.fn(() => ({ data: responseRef, pending: ref(false), refresh })),
  $fetch,
});

beforeEach(() => {
  responseRef.value = makeResponse();
  refresh.mockClear();
  $fetch.mockClear();
  $fetch.mockImplementation(async () => ({}));
  toast.mockClear();
  featureOn.value = true;
  consentsOn.value = true;
});

/**
 * The page has a top-level `await useFetch`, so its setup is async and Vue needs
 * a Suspense boundary. `@testing-library/vue`'s `render` cannot supply one that
 * resolves (its VTU mount leaves the pending branch in Suspense's hidden
 * container, so the assertion target stays empty and every test would pass or
 * fail for the wrong reason). Mounting the boundary with `createApp` gives real
 * DOM, so the stub components are registered globally rather than as VTU stubs.
 */
const mounted: Array<{ app: App; el: HTMLElement }> = [];

async function mount(): Promise<{ container: HTMLElement }> {
  const el = document.createElement('div');
  document.body.appendChild(el);
  const Wrapper = defineComponent({
    setup: () => () => h(Suspense, null, { default: () => h(PersonaPage) }),
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

describe('/settings/persona', () => {
  it('renders one editor per section', async () => {
    const { container } = await mount();
    const keys = Array.from(container.querySelectorAll('.stub-section')).map((e) => e.getAttribute('data-key'));
    expect(keys).toEqual(['basics', 'interests', 'tech_stack', 'links']);
  });

  it('hands each editor a flat value map merged across all four storage partitions', async () => {
    const { container } = await mount();
    // column-bound and answers-sink values, in one flat map, scoped to the section
    expect(valuesOf(container, 'basics')).toEqual({ display_name: 'Sam', industry: 'hardware' });
    // multiselect keeps its array; the link sink is looked up, never re-derived
    expect(valuesOf(container, 'interests')).toEqual({ interests: ['pcb', 'firmware'] });
    expect(valuesOf(container, 'links')).toEqual({ link_github: 'https://github.com/sam' });
  });

  it('OMITS an unfilled key rather than sending null (the editor prop carries no null)', async () => {
    const { container } = await mount();
    expect(valuesOf(container, 'tech_stack')).toEqual({});
    const response = makeResponse();
    (response.values as { columns: Record<string, string> }).columns = {};
    (response.values as { answers: Record<string, string[]> }).answers = {};
    responseRef.value = response;
    const second = await mount();
    expect(valuesOf(second.container, 'basics')).toEqual({});
  });

  it('passes the render position so the editor can own its own open state', async () => {
    const { container } = await mount();
    const positions = Array.from(container.querySelectorAll('.stub-index')).map((e) => e.textContent);
    expect(positions).toEqual(['0', '1', '2', '3']);
  });

  it('saves ONE section per request and refreshes', async () => {
    const { container } = await mount();
    await fireEvent.click(sectionEl(container, 'interests').querySelector('.stub-save')!);
    const puts = $fetch.mock.calls.filter((c) => (c[1] as { method?: string } | undefined)?.method === 'PUT');
    expect(puts).toHaveLength(1);
    expect(puts[0]![0]).toBe('/api/persona');
    expect((puts[0]![1] as { body: unknown }).body).toEqual({
      sectionKey: 'interests',
      answers: { interests: ['pcb', 'firmware'] },
    });
    expect(refresh).toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith('Saved', 'success');
  });

  it('surfaces the FIELD NAME from a Zod 400, not the bare "Validation failed"', async () => {
    // h3 nests `createError({ data })` under a `data` key of the body, so the
    // field errors a route raises as `data: { errors }` arrive at
    // err.data.data.errors, one level deeper than they look. Reading the shallow
    // one is how every validation failure in this app once read "Validation failed".
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
    // The error is scoped to the section that failed; a sibling stays clean.
    expect(sectionEl(container, 'basics').querySelector('.stub-error')).toBeNull();
  });

  it('shows the empty state only when nothing at all is filled in', async () => {
    const { container } = await mount();
    expect(container.textContent).not.toContain('Nothing here yet.');

    const response = makeResponse();
    (response.completeness as { filledFields: number }).filledFields = 0;
    responseRef.value = response;
    const second = await mount();
    expect(second.container.textContent).toContain(
      'Nothing here yet. Pick whatever you want people to see. You can change it at any time.',
    );
  });

  it('binds the meter to the fetched DTO and never to a zero seed', async () => {
    const { container } = await mount();
    const meter = container.querySelector('.stub-meter')!.textContent ?? '';
    expect(meter).toContain('"filledFields":4');
    expect(meter).not.toBe('none');
  });

  it('deletes one retired field through the page, then refreshes', async () => {
    const response = makeResponse();
    response.retired = [
      { fieldKey: 'old_question', values: ['a'], text: null, retiredAt: '2026-01-02T00:00:00.000Z' },
    ];
    responseRef.value = response;
    const { container } = await mount();
    await fireEvent.click(container.querySelector('.stub-retired-delete')!);
    const deletes = $fetch.mock.calls.filter((c) => (c[1] as { method?: string } | undefined)?.method === 'DELETE');
    expect(deletes).toHaveLength(1);
    expect(deletes[0]![0]).toBe('/api/persona/retired/old_question');
    expect(refresh).toHaveBeenCalled();
  });

  it('renders nothing but a notice, and never fetches, when the feature is off', async () => {
    featureOn.value = false;
    responseRef.value = null;
    const { container } = await mount();
    expect(container.textContent).toContain('Profile details are not enabled on this site.');
    expect(container.querySelectorAll('.stub-section')).toHaveLength(0);
    const useFetchMock = (globalThis as unknown as { useFetch: ReturnType<typeof vi.fn> }).useFetch;
    const lastCall = useFetchMock.mock.calls.at(-1);
    expect((lastCall?.[1] as { immediate?: boolean } | undefined)?.immediate).toBe(false);
  });

  it('points at Privacy settings without offering an inline consent toggle', async () => {
    const { container } = await mount();
    const link = container.querySelector('a[href="/settings/privacy"]');
    expect(link).not.toBeNull();
    // Rule 2 (no bundling): the editor carries no consent control of any kind.
    expect(container.querySelectorAll('[role="switch"]')).toHaveLength(0);
  });

  it('carries no em dash and no banned growth-copy string', async () => {
    const response = makeResponse();
    (response.completeness as { filledFields: number }).filledFields = 0;
    response.retired = [{ fieldKey: 'old_question', values: ['a'], text: null, retiredAt: null }];
    responseRef.value = response;
    const { container } = await mount();
    const text = container.textContent ?? '';
    expect(text.length).toBeGreaterThan(80); // guard: an empty render passes any ban
    expect(text).not.toMatch(/—/);
    for (const banned of ['Help us improve', 'Get the most out of', 'Unlock', 'Boost', 'You are missing out']) {
      expect(text).not.toContain(banned);
    }
  });
});
