/**
 * Tests for useContestEditor — the shared form model behind the contest editor
 * shell (create + edit). The composable owns refs + functions + two watchers (no
 * lifecycle hooks), so it's called directly with `$fetch` stubbed and the context
 * callbacks as spies (mirrors useDocsSiteSettings).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { nextTick } from 'vue';
import { useContestEditor, slugifyContest, type UseContestEditorOptions } from '../useContestEditor';

function makeOpts(over: Partial<UseContestEditorOptions> = {}): {
  opts: UseContestEditorOptions;
  toast: ReturnType<typeof vi.fn>;
  navigate: ReturnType<typeof vi.fn>;
  refresh: ReturnType<typeof vi.fn>;
} {
  const toast = vi.fn();
  const navigate = vi.fn(async () => {});
  const refresh = vi.fn(async () => {});
  const opts: UseContestEditorOptions = {
    mode: 'edit',
    slug: () => 'my-contest',
    toast,
    extractError: (e) => (e instanceof Error ? e.message : 'err'),
    navigate,
    refresh,
    ...over,
  };
  return { opts, toast, navigate, refresh };
}

describe('slugifyContest', () => {
  it('lowercases, hyphenates, and trims edge hyphens', () => {
    expect(slugifyContest('  My Cool Contest! ')).toBe('my-cool-contest');
    expect(slugifyContest('--A__B--')).toBe('a-b');
  });
});

describe('useContestEditor — dateError', () => {
  it('flags end <= start and judging-end < end', () => {
    const { opts } = makeOpts();
    const e = useContestEditor(opts);
    e.startDate.value = '2026-06-10T00:00:00.000Z';
    e.endDate.value = '2026-06-09T00:00:00.000Z';
    expect(e.dateError.value).toMatch(/after the start date/);
    e.endDate.value = '2026-06-20T00:00:00.000Z';
    expect(e.dateError.value).toBe('');
    e.judgingEndDate.value = '2026-06-15T00:00:00.000Z';
    expect(e.dateError.value).toMatch(/on or after the end date/);
  });
});

describe('useContestEditor — canSubmit', () => {
  it('create needs title + both dates + no date error', () => {
    const { opts } = makeOpts({ mode: 'create' });
    const e = useContestEditor(opts);
    expect(e.canSubmit.value).toBe(false);
    e.title.value = 'X';
    e.startDate.value = '2026-06-10T00:00:00.000Z';
    e.endDate.value = '2026-06-20T00:00:00.000Z';
    expect(e.canSubmit.value).toBe(true);
    e.endDate.value = '2026-06-01T00:00:00.000Z'; // end < start
    expect(e.canSubmit.value).toBe(false);
  });

  it('edit needs title + dirty', async () => {
    const { opts } = makeOpts({ mode: 'edit' });
    const e = useContestEditor(opts);
    e.hydrate({ title: 'Existing' });
    await nextTick();
    expect(e.canSubmit.value).toBe(false); // pristine
    e.subheading.value = 'changed';
    await nextTick();
    expect(e.formDirty.value).toBe(true);
    expect(e.canSubmit.value).toBe(true);
  });
});

describe('useContestEditor — create-mode slug derive', () => {
  it('auto-derives the slug from the title until touched', async () => {
    const { opts } = makeOpts({ mode: 'create' });
    const e = useContestEditor(opts);
    e.title.value = 'Maker Challenge 2026';
    await nextTick();
    expect(e.slugInput.value).toBe('maker-challenge-2026');
    e.slugTouched.value = true;
    e.title.value = 'Renamed';
    await nextTick();
    expect(e.slugInput.value).toBe('maker-challenge-2026'); // frozen after touch
  });

  it('edit mode never auto-derives the slug', async () => {
    const { opts } = makeOpts({ mode: 'edit' });
    const e = useContestEditor(opts);
    e.hydrate({ title: 'A', slug: 'fixed-slug' });
    await nextTick();
    e.title.value = 'Totally Different';
    await nextTick();
    expect(e.slugInput.value).toBe('fixed-slug');
  });
});

describe('useContestEditor — hydrate', () => {
  it('stores ISO dates verbatim (no local conversion) and maps fields', async () => {
    const { opts } = makeOpts();
    const e = useContestEditor(opts);
    e.hydrate({
      title: 'Robot Wars',
      slug: 'robot-wars',
      startDate: '2026-06-10T08:30:00.000Z',
      endDate: '2026-06-20T08:30:00.000Z',
      descriptionBlocks: [['heading', { level: 2, content: 'Hi' }]],
      visibility: 'private',
      visibleToRoles: ['staff'],
      showPrizes: false,
      prizes: [{ place: 1, title: 'Gold' }],
      judgingCriteria: [{ label: 'Docs', weight: 20 }],
    });
    expect(e.startDate.value).toBe('2026-06-10T08:30:00.000Z');
    expect(e.descriptionBlocks.value).toEqual([['heading', { level: 2, content: 'Hi' }]]);
    expect(e.visibility.value).toBe('private');
    expect(e.showPrizes.value).toBe(false);
    expect(e.prizes.value[0]).toEqual({ place: 1, category: '', title: 'Gold', description: '', value: '' });
    expect(e.criteria.value[0]).toEqual({ label: 'Docs', weight: 20, description: undefined });
    await nextTick();
    expect(e.formDirty.value).toBe(false); // hydration is not a user edit
  });
});

describe('useContestEditor — image meta (hydrate)', () => {
  it('maps bannerMeta, coverMeta, and coverPlacement from the source', () => {
    const { opts } = makeOpts();
    const e = useContestEditor(opts);
    e.hydrate({
      title: 'Framed',
      bannerUrl: 'https://x/banner.png',
      bannerMeta: { zoom: 0.5, x: 25, y: 75 },
      coverImageUrl: 'https://x/cover.png',
      coverMeta: { zoom: 0, x: 50, y: 50 },
      coverPlacement: 'hero',
    });
    expect(e.bannerMeta.value).toEqual({ zoom: 0.5, x: 25, y: 75 });
    expect(e.coverMeta.value).toEqual({ zoom: 0, x: 50, y: 50 });
    expect(e.coverPlacement.value).toBe('hero');
  });

  it('defaults the three framing fields to null when absent', () => {
    const { opts } = makeOpts();
    const e = useContestEditor(opts);
    e.hydrate({ title: 'Plain' });
    expect(e.bannerMeta.value).toBeNull();
    expect(e.coverMeta.value).toBeNull();
    expect(e.coverPlacement.value).toBeNull();
  });
});

describe('useContestEditor — image meta (buildPayload clear-on-remove)', () => {
  it('sends the framing meta when the image is present', () => {
    const { opts } = makeOpts();
    const e = useContestEditor(opts);
    e.title.value = 'C';
    e.bannerUrl.value = 'https://x/banner.png';
    e.bannerMeta.value = { zoom: 1, x: 10, y: 20 };
    e.coverImageUrl.value = 'https://x/cover.png';
    e.coverMeta.value = { zoom: 0, x: 50, y: 50 };
    e.coverPlacement.value = 'about';
    const p = e.buildPayload();
    expect(p.bannerMeta).toEqual({ zoom: 1, x: 10, y: 20 });
    expect(p.coverMeta).toEqual({ zoom: 0, x: 50, y: 50 });
    expect(p.coverPlacement).toBe('about');
  });

  it('clears bannerMeta to null when the banner image is removed (meta lingers)', () => {
    const { opts } = makeOpts();
    const e = useContestEditor(opts);
    e.title.value = 'C';
    e.bannerUrl.value = ''; // removed
    e.bannerMeta.value = { zoom: 1, x: 10, y: 20 }; // stale framing left over
    const p = e.buildPayload();
    expect(p.bannerMeta).toBeNull();
  });

  it('clears coverMeta AND coverPlacement to null when the cover image is removed', () => {
    const { opts } = makeOpts();
    const e = useContestEditor(opts);
    e.title.value = 'C';
    e.coverImageUrl.value = ''; // removed
    e.coverMeta.value = { zoom: 0.3, x: 40, y: 60 };
    e.coverPlacement.value = 'hero';
    const p = e.buildPayload();
    expect(p.coverMeta).toBeNull();
    expect(p.coverPlacement).toBeNull();
  });

  it('omits the framing (undefined) when the image is present but unframed', () => {
    const { opts } = makeOpts();
    const e = useContestEditor(opts);
    e.title.value = 'C';
    e.bannerUrl.value = 'https://x/banner.png';
    e.bannerMeta.value = null; // never adjusted -> leave server value as-is
    e.coverImageUrl.value = 'https://x/cover.png';
    e.coverMeta.value = null;
    e.coverPlacement.value = null;
    const p = e.buildPayload();
    expect(p.bannerMeta).toBeUndefined();
    expect(p.coverMeta).toBeUndefined();
    expect(p.coverPlacement).toBeUndefined();
  });
});

describe('useContestEditor — buildPayload', () => {
  it('passes ISO dates through and gates visibleToRoles on private', () => {
    const { opts } = makeOpts();
    const e = useContestEditor(opts);
    e.title.value = 'C';
    e.slugInput.value = 'C Slug';
    e.startDate.value = '2026-06-10T08:30:00.000Z';
    e.visibility.value = 'public';
    e.visibleToRoles.value = ['staff'];
    const p = e.buildPayload();
    expect(p.slug).toBe('c-slug');
    expect(p.startDate).toBe('2026-06-10T08:30:00.000Z'); // not re-converted
    expect(p.visibleToRoles).toEqual([]); // dropped because not private
  });

  it('filters empty prize + criteria rows', () => {
    const { opts } = makeOpts();
    const e = useContestEditor(opts);
    e.prizes.value = [
      { place: null, category: '', title: '', description: '', value: '' }, // empty -> dropped
      { place: 1, category: '', title: 'Gold', description: '', value: '$5' },
    ];
    e.criteria.value = [
      { label: '   ', weight: 5 }, // blank label -> dropped
      { label: 'Docs', weight: 20, description: '' },
    ];
    const p = e.buildPayload();
    expect(p.prizes).toEqual([{ place: 1, category: undefined, title: 'Gold', description: undefined, value: '$5' }]);
    expect(p.judgingCriteria).toEqual([{ label: 'Docs', weight: 20, description: undefined }]);
  });
});

describe('useContestEditor — save', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('create POSTs the payload and navigates to the new contest', async () => {
    const fetchMock = vi.fn(async () => ({ slug: 'new-one' }));
    vi.stubGlobal('$fetch', fetchMock);
    const { opts, toast, navigate } = makeOpts({ mode: 'create' });
    const e = useContestEditor(opts);
    e.title.value = 'New';
    e.startDate.value = '2026-06-10T00:00:00.000Z';
    e.endDate.value = '2026-06-20T00:00:00.000Z';

    await e.save();

    expect(fetchMock).toHaveBeenCalledWith('/api/contests', expect.objectContaining({ method: 'POST' }));
    expect(toast).toHaveBeenCalledWith('Contest created', 'success');
    expect(navigate).toHaveBeenCalledWith('/contests/new-one');
    expect(e.saving.value).toBe(false);
  });

  it('create is a no-op without title + dates (no fetch)', async () => {
    const fetchMock = vi.fn(async () => ({ slug: 'x' }));
    vi.stubGlobal('$fetch', fetchMock);
    const { opts } = makeOpts({ mode: 'create' });
    const e = useContestEditor(opts);
    e.title.value = 'New'; // missing dates
    await e.save();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('edit PUTs to the slug and refreshes when the slug is unchanged', async () => {
    const fetchMock = vi.fn(async () => ({ slug: 'my-contest' }));
    vi.stubGlobal('$fetch', fetchMock);
    const { opts, toast, navigate, refresh } = makeOpts({ mode: 'edit' });
    const e = useContestEditor(opts);
    e.title.value = 'Edited';

    await e.save();

    expect(fetchMock).toHaveBeenCalledWith('/api/contests/my-contest', expect.objectContaining({ method: 'PUT' }));
    expect(toast).toHaveBeenCalledWith('Contest updated', 'success');
    expect(e.formDirty.value).toBe(false);
    expect(refresh).toHaveBeenCalledOnce();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('edit navigates to the renamed contest when the slug changes', async () => {
    const fetchMock = vi.fn(async () => ({ slug: 'renamed' }));
    vi.stubGlobal('$fetch', fetchMock);
    const { opts, navigate, refresh } = makeOpts({ mode: 'edit' });
    const e = useContestEditor(opts);
    e.title.value = 'Edited';

    await e.save();

    expect(navigate).toHaveBeenCalledWith('/contests/renamed');
    expect(refresh).not.toHaveBeenCalled();
  });

  it('surfaces the API error and clears the saving flag', async () => {
    vi.stubGlobal('$fetch', vi.fn(async () => { throw new Error('boom'); }));
    const { opts, toast } = makeOpts({ mode: 'edit' });
    const e = useContestEditor(opts);
    e.title.value = 'Edited';

    await e.save();

    expect(toast).toHaveBeenCalledWith('boom', 'error');
    expect(e.saving.value).toBe(false);
  });

  it('blocks save and toasts when there is a date error', async () => {
    const fetchMock = vi.fn(async () => ({ slug: 'x' }));
    vi.stubGlobal('$fetch', fetchMock);
    const { opts, toast } = makeOpts({ mode: 'edit' });
    const e = useContestEditor(opts);
    e.startDate.value = '2026-06-20T00:00:00.000Z';
    e.endDate.value = '2026-06-10T00:00:00.000Z'; // end < start

    await e.save();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.stringMatching(/after the start date/), 'error');
  });
});

describe('useContestEditor — silent save (autosave)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('PUTs and clears dirty but skips the toast, refresh, and navigation', async () => {
    const fetchMock = vi.fn(async () => ({ slug: 'my-contest' }));
    vi.stubGlobal('$fetch', fetchMock);
    const { opts, toast, navigate, refresh } = makeOpts({ mode: 'edit' });
    const e = useContestEditor(opts);
    e.title.value = 'Edited';

    await e.save({ silent: true });

    expect(fetchMock).toHaveBeenCalledWith('/api/contests/my-contest', expect.objectContaining({ method: 'PUT' }));
    expect(e.formDirty.value).toBe(false);
    expect(toast).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('renames in place via onRenamed (not navigate) when the slug changes', async () => {
    const fetchMock = vi.fn(async () => ({ slug: 'renamed' }));
    vi.stubGlobal('$fetch', fetchMock);
    const onRenamed = vi.fn();
    const { opts, navigate } = makeOpts({ mode: 'edit', onRenamed });
    const e = useContestEditor(opts);
    e.title.value = 'Edited';

    await e.save({ silent: true });

    expect(onRenamed).toHaveBeenCalledWith('renamed');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('rethrows on failure without toasting (the status machine handles it)', async () => {
    vi.stubGlobal('$fetch', vi.fn(async () => { throw new Error('boom'); }));
    const { opts, toast } = makeOpts({ mode: 'edit' });
    const e = useContestEditor(opts);
    e.title.value = 'Edited';

    await expect(e.save({ silent: true })).rejects.toThrow('boom');
    expect(toast).not.toHaveBeenCalled();
    expect(e.saving.value).toBe(false);
  });

  it('does not fetch or toast on a date error', async () => {
    const fetchMock = vi.fn(async () => ({ slug: 'x' }));
    vi.stubGlobal('$fetch', fetchMock);
    const { opts, toast } = makeOpts({ mode: 'edit' });
    const e = useContestEditor(opts);
    e.startDate.value = '2026-06-20T00:00:00.000Z';
    e.endDate.value = '2026-06-10T00:00:00.000Z';

    await e.save({ silent: true });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();
  });
});

describe('useContestEditor — applyTemplate (create-mode seeding)', () => {
  it('seeds stages, rubric, and body blocks without flagging the form dirty', async () => {
    const { opts } = makeOpts({ mode: 'create' });
    const e = useContestEditor(opts);
    e.applyTemplate({
      stages: [{ id: 's1', name: 'Proposals', kind: 'submission' }],
      currentStageId: null,
      judgingCriteria: [{ label: 'Innovation', weight: 40 }],
      descriptionBlocks: [['markdown', { content: '## About' }]],
      rulesBlocks: [['markdown', { content: '## Rules' }]],
      prizesBlocks: [],
    });
    expect(e.stages.value).toHaveLength(1);
    expect(e.criteria.value[0]?.label).toBe('Innovation');
    expect(e.descriptionBlocks.value).toHaveLength(1);
    await nextTick();
    // A freshly seeded create page must read "no unsaved changes".
    expect(e.formDirty.value).toBe(false);
  });

  it('re-arms dirty tracking after seeding (a later edit marks dirty)', async () => {
    const { opts } = makeOpts({ mode: 'create' });
    const e = useContestEditor(opts);
    e.applyTemplate({
      stages: [{ id: 's1', name: 'Proposals', kind: 'submission' }],
      currentStageId: null,
      judgingCriteria: [],
      descriptionBlocks: [],
      rulesBlocks: [],
      prizesBlocks: [],
    });
    await nextTick();
    expect(e.formDirty.value).toBe(false);
    e.title.value = 'My contest';
    await nextTick();
    expect(e.formDirty.value).toBe(true);
  });
});
