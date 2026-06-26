/**
 * Component test for the public unsubscribe page (email Phase 1b).
 * Lives under components/__tests__ (bracket-free) so packaging excludes it.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/vue';
import { defineComponent, h } from 'vue';
import UnsubscribePage from '../../pages/unsubscribe.vue';

const NuxtLink = defineComponent({
  name: 'NuxtLink',
  props: { to: String },
  setup: (props, { slots }) => () => h('a', { href: props.to }, slots.default?.()),
});

const $fetch = vi.fn(async () => ({ ok: true }));
let query: Record<string, string> = { token: 'tok123' };

Object.assign(globalThis, {
  useRoute: () => ({ query }),
  useSiteName: () => 'Test',
  useSeoMeta: () => {},
  $fetch,
});

beforeEach(() => {
  $fetch.mockClear();
  query = { token: 'tok123' };
});

function mount() {
  return render(UnsubscribePage, { global: { stubs: { NuxtLink } } });
}

describe('unsubscribe page', () => {
  it('offers digest + all options when a token is present, and unsubscribes from all', async () => {
    const { container, getByText } = mount();
    expect(getByText(/Unsubscribe from all emails/i)).toBeTruthy();

    await fireEvent.click(getByText(/Unsubscribe from all emails/i));
    expect($fetch).toHaveBeenCalledWith('/api/unsubscribe', { method: 'POST', body: { token: 'tok123', scope: 'all' } });
    expect(container.textContent).toMatch(/unsubscribed from all emails/i);
  });

  it('unsubscribes from digests only with the digest scope', async () => {
    const { getByText, container } = mount();
    await fireEvent.click(getByText(/Unsubscribe from digest emails/i));
    expect($fetch).toHaveBeenCalledWith('/api/unsubscribe', { method: 'POST', body: { token: 'tok123', scope: 'digest' } });
    expect(container.textContent).toMatch(/unsubscribed from digest emails/i);
  });

  it('shows an error state when the token is missing', () => {
    query = {};
    const { container } = mount();
    expect(container.textContent).toMatch(/invalid or has expired/i);
  });
});
