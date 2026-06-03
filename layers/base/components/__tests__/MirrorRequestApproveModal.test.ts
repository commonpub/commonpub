/**
 * Component tests for MirrorRequestApproveModal (Phase 3 — consent-based mirror requests).
 *
 * Locks: the depth picker (6 options incl. forward-only default), content-type/tag filters,
 * the approve call shape (bounded depth + filters), reject, role=dialog a11y, and an axe scan.
 *
 * Uses Nuxt auto-imports (useToast, useFocusTrap, $fetch) — stub on globalThis before render.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/vue';
import { nextTick } from 'vue';
import axe from 'axe-core';
import MirrorRequestApproveModal from '../MirrorRequestApproveModal.vue';

const toastSuccess = vi.fn();
const toastError = vi.fn();
const fetchMock = vi.fn(() => Promise.resolve({}));

Object.assign(globalThis, {
  useToast: () => ({ success: toastSuccess, error: toastError }),
  useFocusTrap: () => {},
  $fetch: fetchMock,
});

function makeRequest(overrides: Record<string, unknown> = {}) {
  return {
    id: 'req-1',
    remoteDomain: 'maker.example.com',
    remoteActorUri: 'https://maker.example.com/actor',
    createdAt: '2026-06-01T00:00:00.000Z',
    ...overrides,
  };
}

function mount(request = makeRequest()) {
  return render(MirrorRequestApproveModal, { props: { request } });
}

beforeEach(() => {
  toastSuccess.mockClear();
  toastError.mockClear();
  fetchMock.mockClear();
});

describe('MirrorRequestApproveModal — content', () => {
  it('names the requesting instance and explains the one-directional result', () => {
    const { container } = mount();
    expect(container.textContent).toContain('maker.example.com');
    expect(container.textContent?.toLowerCase()).toContain('pull mirror');
    expect(container.textContent?.toLowerCase()).toContain('they still receive nothing from you');
  });

  it('offers a 6-option depth picker defaulting to forward-only', () => {
    const { container } = mount();
    const opts = container.querySelectorAll('#cpub-mr-depth option');
    expect(opts.length).toBe(6);
    const select = container.querySelector('#cpub-mr-depth') as HTMLSelectElement;
    expect(select.value).toBe('0'); // forward-only default
  });

  it('offers content-type checkboxes and a tag input', () => {
    const { container } = mount();
    const checks = container.querySelectorAll('.cpub-mr-checks input[type="checkbox"]');
    expect(checks.length).toBe(3); // project, blog, explainer
    expect(container.querySelector('#cpub-mr-tags')).not.toBeNull();
  });
});

describe('MirrorRequestApproveModal — a11y', () => {
  it('uses role=dialog with aria-modal + labelledby', () => {
    const { container } = mount();
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(dialog?.getAttribute('aria-labelledby')).toBe('cpub-mr-modal-title');
  });

  it('has no axe violations', async () => {
    const { container } = mount();
    const results = await axe.run(container, {
      rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });
});

describe('MirrorRequestApproveModal — actions', () => {
  it('approve posts to the approve endpoint with forward-only body by default', async () => {
    const { getByText, emitted } = mount();
    await fireEvent.click(getByText('Approve & mirror'));
    await nextTick();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/admin/federation/mirror-requests/req-1/approve'),
      expect.objectContaining({ method: 'POST', body: {} }),
    );
    expect(emitted().changed).toBeTruthy();
    expect(emitted().close).toBeTruthy();
  });

  it('approve includes chosen depth + filters in the body', async () => {
    const { container, getByText } = mount();
    // pick "Last 30 days" (index 2) + check the first content type + add a tag
    const select = container.querySelector('#cpub-mr-depth') as HTMLSelectElement;
    await fireEvent.update(select, '2');
    const firstCheck = container.querySelector('.cpub-mr-checks input[type="checkbox"]') as HTMLInputElement;
    await fireEvent.click(firstCheck);
    await fireEvent.update(container.querySelector('#cpub-mr-tags') as HTMLInputElement, 'arduino, #robotics');

    await fireEvent.click(getByText('Approve & mirror'));
    await nextTick();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/approve'),
      expect.objectContaining({
        method: 'POST',
        body: expect.objectContaining({
          sinceDays: 30,
          filterContentTypes: ['project'],
          filterTags: ['arduino', 'robotics'],
        }),
      }),
    );
  });

  it('maps the "last 200 items" depth option to maxItems (not sinceDays)', async () => {
    const { container, getByText } = mount();
    const select = container.querySelector('#cpub-mr-depth') as HTMLSelectElement;
    await fireEvent.update(select, '4'); // index 4 = "Last 200 items"
    await fireEvent.click(getByText('Approve & mirror'));
    await nextTick();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/approve'),
      expect.objectContaining({ method: 'POST', body: { maxItems: 200 } }),
    );
  });

  it('reject posts to the reject endpoint and emits close', async () => {
    const { getByText, emitted } = mount();
    await fireEvent.click(getByText('Reject'));
    await nextTick();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/admin/federation/mirror-requests/req-1/reject'),
      expect.objectContaining({ method: 'POST' }),
    );
    expect(emitted().close).toBeTruthy();
  });

  it('emits close when the backdrop is clicked', async () => {
    const { container, emitted } = mount();
    await fireEvent.click(container.querySelector('.cpub-modal-backdrop')!);
    expect(emitted().close).toBeTruthy();
  });
});
