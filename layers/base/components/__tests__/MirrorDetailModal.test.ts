/**
 * Component tests for MirrorDetailModal (Phase 2 federation admin UX).
 *
 * Locks: the one-directional explainer, the bounded depth picker, the two-step
 * delete confirm, the backfill call shape, role=dialog a11y, and an axe scan.
 *
 * MirrorDetailModal uses Nuxt auto-imports (useToast, useFocusTrap, $fetch) that the
 * layer test harness doesn't provide — stub them on globalThis before rendering.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/vue';
import { nextTick } from 'vue';
import axe from 'axe-core';
import MirrorDetailModal from '../MirrorDetailModal.vue';

const toastSuccess = vi.fn();
const toastError = vi.fn();
const fetchMock = vi.fn(() => Promise.resolve({ processed: 3, errors: 0, pages: 1, complete: true }));

Object.assign(globalThis, {
  useToast: () => ({ success: toastSuccess, error: toastError }),
  useFocusTrap: () => {},
  $fetch: fetchMock,
});

function makeMirror(overrides: Record<string, unknown> = {}) {
  return {
    id: 'mirror-1',
    remoteDomain: 'maker.example.com',
    remoteActorUri: 'https://maker.example.com/actor',
    status: 'active',
    direction: 'pull',
    filterContentTypes: ['project', 'blog'],
    filterTags: ['arduino'],
    contentCount: 42,
    errorCount: 0,
    lastError: null,
    lastSyncAt: '2026-06-01T00:00:00.000Z',
    backfillCursor: null,
    ...overrides,
  };
}

function mount(mirror = makeMirror()) {
  return render(MirrorDetailModal, { props: { mirror } });
}

beforeEach(() => {
  toastSuccess.mockClear();
  toastError.mockClear();
  fetchMock.mockClear();
});

describe('MirrorDetailModal — content', () => {
  it('shows the remote domain as the dialog title', () => {
    const { container } = mount();
    expect(container.querySelector('.cpub-modal-title')?.textContent).toContain('maker.example.com');
  });

  it('explains mirroring is one-directional', () => {
    const { container } = mount();
    expect(container.textContent?.toLowerCase()).toContain('one-directional');
    expect(container.textContent?.toLowerCase()).toContain('receive nothing from you');
  });

  it('renders filter chips for content types and tags', () => {
    const { container } = mount();
    const chips = Array.from(container.querySelectorAll('.cpub-mm-chip')).map((c) => c.textContent);
    expect(chips).toContain('project');
    expect(chips).toContain('blog');
    expect(chips).toContain('#arduino');
  });

  it('shows "all types"/"all tags" when unfiltered', () => {
    const { container } = mount(makeMirror({ filterContentTypes: null, filterTags: null }));
    expect(container.textContent).toContain('all types');
    expect(container.textContent).toContain('all tags');
  });

  it('offers a bounded depth picker (5 options) for re-backfill', () => {
    const { container } = mount();
    const opts = container.querySelectorAll('#cpub-mm-depth option');
    expect(opts.length).toBe(5);
  });
});

describe('MirrorDetailModal — a11y', () => {
  it('uses role=dialog with aria-modal + labelledby', () => {
    const { container } = mount();
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(dialog?.getAttribute('aria-labelledby')).toBe('cpub-mirror-modal-title');
  });

  it('has no axe violations', async () => {
    const { container } = mount();
    const results = await axe.run(container, {
      rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });
});

describe('MirrorDetailModal — actions', () => {
  it('backfill calls the bounded endpoint with the chosen depth (default last 30 days)', async () => {
    const { getByText } = mount();
    await fireEvent.click(getByText('Backfill'));
    await nextTick();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/admin/federation/mirrors/mirror-1/backfill'),
      expect.objectContaining({ method: 'POST', body: { sinceDays: 30 } }),
    );
  });

  it('delete is a two-step confirm', async () => {
    const { getByText, queryByText, emitted } = mount();
    // First click reveals the confirm; does NOT call DELETE.
    await fireEvent.click(getByText('Delete mirror'));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(queryByText('Confirm delete')).not.toBeNull();
    // Confirm calls DELETE + emits changed & close.
    await fireEvent.click(getByText('Confirm delete'));
    await nextTick();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/admin/federation/mirrors/mirror-1'),
      expect.objectContaining({ method: 'DELETE' }),
    );
    expect(emitted().changed).toBeTruthy();
    expect(emitted().close).toBeTruthy();
  });

  it('emits close when the backdrop is clicked', async () => {
    const { container, emitted } = mount();
    await fireEvent.click(container.querySelector('.cpub-modal-backdrop')!);
    expect(emitted().close).toBeTruthy();
  });
});
