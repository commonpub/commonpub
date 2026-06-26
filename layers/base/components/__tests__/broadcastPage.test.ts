/**
 * Component test for the admin Broadcast composer (email Phase 3).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/vue';
import { ref } from 'vue';
import BroadcastPage from '../../pages/admin/broadcast.vue';

const $fetch = vi.fn(async (url: string, _opts?: unknown) => {
  if (String(url).includes('recipients')) return { count: 5 };
  if (String(url).endsWith('/api/admin/broadcast')) return { recipientCount: 5 };
  if (String(url).includes('/api/admin/users')) return { items: [{ id: 'u1', username: 'sam' }] };
  return {};
});
const toast = { success: vi.fn(), error: vi.fn() };

Object.assign(globalThis, {
  definePageMeta: () => {},
  useSeoMeta: () => {},
  useSiteName: () => 'Test',
  useToast: () => toast,
  useFetch: () => ({ data: ref([]), refresh: vi.fn(async () => {}) }),
  $fetch,
});

beforeEach(() => {
  $fetch.mockClear();
  toast.success.mockClear();
  toast.error.mockClear();
});

function sendCalls() {
  return $fetch.mock.calls.filter((c) => String(c[0]).endsWith('/api/admin/broadcast') && (c[1] as { method?: string })?.method === 'POST');
}

describe('admin broadcast composer', () => {
  it('fetches the recipient count for the default (all) audience on mount', async () => {
    render(BroadcastPage);
    await new Promise((r) => setTimeout(r, 350)); // debounced count
    expect($fetch).toHaveBeenCalledWith('/api/admin/broadcast/recipients', expect.objectContaining({ method: 'POST', body: 'all' }));
  });

  it('requires a confirm step before sending, then POSTs the composed payload', async () => {
    const { getByLabelText, getByText, container } = render(BroadcastPage);
    await fireEvent.update(getByLabelText('Subject'), 'Hello');
    await fireEvent.update(getByLabelText('Message'), 'Body text');

    // First click only arms the confirm — no send yet.
    await fireEvent.click(getByText(/Review .* send/));
    expect(sendCalls()).toHaveLength(0);
    expect(container.textContent).toMatch(/Send to .* recipient/);

    // Confirm actually sends.
    await fireEvent.click(getByText('Confirm send'));
    expect(sendCalls()).toHaveLength(1);
    expect(sendCalls()[0]![1]).toMatchObject({ body: { subject: 'Hello', bodyText: 'Body text', audience: 'all' } });
    expect(toast.success).toHaveBeenCalled();
  });

  it('disables send until subject + body are filled', async () => {
    const { getByText } = render(BroadcastPage);
    expect((getByText(/Review .* send/) as HTMLButtonElement).disabled).toBe(true);
  });
});
