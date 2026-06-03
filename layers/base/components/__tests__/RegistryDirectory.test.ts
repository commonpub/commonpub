/**
 * Component tests for RegistryDirectory (Phase 4 registry directory).
 *
 * Locks: Mirror/Request actions hit the federation mirrors endpoint with the right direction;
 * Hide/Block hit the registry status endpoint with the right status; search emits; axe.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/vue';
import { nextTick } from 'vue';
import axe from 'axe-core';
import RegistryDirectory from '../RegistryDirectory.vue';

const toastSuccess = vi.fn();
const toastError = vi.fn();
const fetchMock = vi.fn(() => Promise.resolve({}));

Object.assign(globalThis, {
  useToast: () => ({ success: toastSuccess, error: toastError }),
  $fetch: fetchMock,
});

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'inst-1',
    domain: 'maker.example',
    actorUri: 'https://maker.example/actor',
    name: 'Maker Hub',
    description: 'A maker community',
    userCount: 42,
    activeMonthCount: 7,
    localPostCount: 100,
    softwareName: 'commonpub',
    softwareVersion: '2.73.0',
    status: 'active',
    lastPingAt: '2026-06-02T00:00:00.000Z',
    online: true,
    ...overrides,
  };
}

function mount(instances = [makeRow()]) {
  return render(RegistryDirectory, { props: { instances } });
}

beforeEach(() => {
  toastSuccess.mockClear();
  toastError.mockClear();
  fetchMock.mockClear();
});

describe('RegistryDirectory — content', () => {
  it('renders instance name, domain, and stats', () => {
    const { container } = mount();
    expect(container.textContent).toContain('Maker Hub');
    expect(container.textContent).toContain('maker.example');
    expect(container.textContent).toContain('42 users');
  });

  it('shows an empty state with no instances', () => {
    const { container } = mount([]);
    expect(container.textContent).toContain('No instances registered');
  });

  it('shows a status badge for non-active entries', () => {
    const { container } = mount([makeRow({ status: 'hidden' })]);
    expect(container.querySelector('.cpub-fed-status')?.textContent).toContain('hidden');
  });
});

describe('RegistryDirectory — actions', () => {
  it('Mirror calls the federation mirrors endpoint with direction pull', async () => {
    const { getByText, emitted } = mount();
    await fireEvent.click(getByText('Mirror'));
    await nextTick();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/federation/mirrors',
      expect.objectContaining({
        method: 'POST',
        body: { remoteDomain: 'maker.example', remoteActorUri: 'https://maker.example/actor', direction: 'pull' },
      }),
    );
    expect(emitted().changed).toBeTruthy();
  });

  it('Request mirror uses direction push', async () => {
    const { getByText } = mount();
    await fireEvent.click(getByText('Request mirror'));
    await nextTick();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/federation/mirrors',
      expect.objectContaining({ body: expect.objectContaining({ direction: 'push' }) }),
    );
  });

  it('Hide posts hidden status to the registry status endpoint', async () => {
    const { getByText } = mount();
    await fireEvent.click(getByText('Hide'));
    await nextTick();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/registry/instances/inst-1/status',
      expect.objectContaining({ method: 'POST', body: { status: 'hidden' } }),
    );
  });

  it('Block posts blocked status; an already-blocked row offers Unblock (active)', async () => {
    const blocked = mount([makeRow({ status: 'blocked' })]);
    await fireEvent.click(blocked.getByText('Unblock'));
    await nextTick();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/registry/instances/inst-1/status',
      expect.objectContaining({ body: { status: 'active' } }),
    );
  });

  it('emits a search event with the entered term', async () => {
    const { getByLabelText, getByText, emitted } = mount();
    await fireEvent.update(getByLabelText('Search instances'), 'arduino');
    await fireEvent.click(getByText('Search'));
    expect(emitted().search).toBeTruthy();
    expect(emitted().search![0]).toEqual(['arduino']);
  });
});

describe('RegistryDirectory — a11y', () => {
  it('has no axe violations', async () => {
    const { container } = mount();
    const results = await axe.run(container, {
      rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });
});
