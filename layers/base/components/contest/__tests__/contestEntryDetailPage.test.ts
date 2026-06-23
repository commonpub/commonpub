/**
 * Component tests for the contest entry-detail page (artifact timeline).
 *
 * Locks: the content summary card, the stage-ordered artifact timeline with
 * template-labelled fields, url fields rendered as safe links, orphaned values
 * (template field later removed) still rendering, artifact section hidden when
 * the server stripped artifacts (unprivileged viewer), and an axe scan.
 *
 * Page uses Nuxt auto-imports (useRoute, useLazyFetch, useSeoMeta, useSiteName,
 * plus the auto-imported contestStages utils) — stub them on globalThis.
 *
 * Lives under components/contest/__tests__ (NOT next to the page): npm's
 * ignore globs treat the `[slug]`/`[entryId]` route dirs as character
 * classes, so a test under a bracketed pages path silently survives the
 * package.json files-array __tests__ exclusion and ships in the layer
 * tarball, where it red-flags every consumer typecheck (vitest isn't a
 * consumer dep).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/vue';
import { defineComponent, h, ref } from 'vue';
import axe from 'axe-core';
import EntryDetailPage from '../../../pages/contests/[slug]/entries/[entryId].vue';
import { normalizeStages, currentStageId } from '../../../utils/contestStages';

const NuxtLink = defineComponent({
  name: 'NuxtLink',
  props: { to: String },
  setup(props, { slots }) {
    return () => h('a', { href: props.to }, slots.default?.());
  },
});
// The PII viewer is a Nuxt auto-import the page renders behind `v-if="privateData"`
// (only when contestPii is on + the /private fetch returns data) — stub it so it
// resolves in the bare VTU render.
const ContestEntryPrivateData = defineComponent({ name: 'ContestEntryPrivateData', setup: () => () => h('div') });
const stubs = { NuxtLink, ContestEntryPrivateData };

const STAGES = [
  { id: 'prop', name: 'Proposals', kind: 'submission', submissionTemplate: [
    { key: 'summary', label: 'Summary', type: 'textarea', required: true },
  ] },
  { id: 'rev1', name: 'Screening', kind: 'review' },
  { id: 'proto', name: 'Prototype', kind: 'submission', submissionTemplate: [
    { key: 'repo_url', label: 'Repository URL', type: 'url', required: true },
  ] },
];

function makeContest(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Resilient America',
    status: 'active',
    startDate: '2026-04-01T00:00:00.000Z',
    endDate: '2026-08-01T00:00:00.000Z',
    judgingEndDate: null,
    stages: STAGES,
    currentStageId: 'proto',
    ...overrides,
  };
}

function makeEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: 'e1',
    contestId: 'c1',
    contentId: 'ct1',
    userId: 'u1',
    score: 88,
    rank: 2,
    stageState: [{ stageId: 'rev1', status: 'advanced' }],
    eliminated: false,
    stageSubmissions: [
      // Deliberately out of stage order — the timeline must sort by stage.
      { stageId: 'proto', fields: { repo_url: 'https://github.com/x/y' }, submittedAt: '2026-07-01T12:00:00.000Z' },
      { stageId: 'prop', fields: { summary: 'A mesh network.', legacy_field: 'kept' }, submittedAt: '2026-05-01T12:00:00.000Z' },
    ],
    submittedAt: '2026-04-20T12:00:00.000Z',
    contentTitle: 'Solar Mesh Node',
    contentSlug: 'solar-mesh-node',
    contentType: 'project',
    contentCoverImageUrl: null,
    authorName: 'Ada Maker',
    authorUsername: 'ada',
    authorAvatarUrl: null,
  };
}

let contestData: Record<string, unknown> | null = makeContest();
let entryData: Record<string, unknown> | null = makeEntry();

Object.assign(globalThis, {
  useRoute: () => ({ params: { slug: 'resilient', entryId: 'e1' } }),
  useLazyFetch: vi.fn((url: string) => ({
    data: ref(String(url).includes('/entries/') ? entryData : contestData),
    error: ref(null),
  })),
  useSeoMeta: () => {},
  useSiteName: () => 'Test',
  // PII viewer gate: default OFF so the client-only /private fetch never fires in
  // these tests (the viewer has its own dedicated test).
  useFeatures: () => ({ contestPii: ref(false) }),
  normalizeStages,
  currentStageId,
});

function mount() {
  return render(EntryDetailPage, { global: { stubs } });
}

beforeEach(() => {
  contestData = makeContest();
  entryData = makeEntry();
});

describe('entry detail page', () => {
  it('shows the content summary with author, status badges, and a project link', () => {
    const { container } = mount();
    expect(container.querySelector('.cpub-ed-title')?.textContent).toBe('Solar Mesh Node');
    expect(container.textContent).toContain('Ada Maker');
    expect(container.textContent).toContain('Advanced');
    expect(container.textContent).toContain('#2');
    expect(container.textContent).toContain('Score 88');
    const projectLink = Array.from(container.querySelectorAll('a')).find((a) => a.textContent?.includes('View the project'));
    expect(projectLink?.getAttribute('href')).toBe('/u/ada/project/solar-mesh-node');
  });

  it('renders the artifact timeline in stage order with template labels', () => {
    const { container } = mount();
    const names = Array.from(container.querySelectorAll('.cpub-ed-stagename')).map((n) => n.textContent);
    expect(names).toEqual(['Proposals', 'Prototype']); // stage order, not submit order
    expect(container.textContent).toContain('Summary');
    expect(container.textContent).toContain('A mesh network.');
  });

  it('renders url fields as hardened external links', () => {
    const { container } = mount();
    const link = Array.from(container.querySelectorAll('.cpub-ed-fields a')).find((a) => a.textContent === 'https://github.com/x/y');
    expect(link).toBeTruthy();
    expect(link!.getAttribute('rel')).toContain('noopener');
  });

  it('still renders values whose template field was later removed (never drop data)', () => {
    const { container } = mount();
    expect(container.textContent).toContain('legacy_field');
    expect(container.textContent).toContain('kept');
  });

  it('hides the artifact section entirely when the server stripped artifacts', () => {
    // The route handler `delete`s the key for unprivileged viewers — mirror that.
    const stripped = makeEntry();
    delete (stripped as Record<string, unknown>).stageSubmissions;
    entryData = stripped;
    const { container } = mount();
    expect(container.querySelector('.cpub-ed-stages')).toBeNull();
    // The content card still shows — the page is useful to the public.
    expect(container.querySelector('.cpub-ed-title')?.textContent).toBe('Solar Mesh Node');
  });

  it('passes an axe scan', async () => {
    const { container } = mount();
    const results = await axe.run(container);
    expect(results.violations).toEqual([]);
  });
});
