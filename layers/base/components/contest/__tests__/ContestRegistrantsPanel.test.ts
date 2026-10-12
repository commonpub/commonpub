/**
 * Registrants panel (session 260): addresses render as mailing lines, not the
 * stored JSON; a shipping view and shipping CSV exist for personal-data holders;
 * search filters both views. Data is stubbed at the useLazyAsyncData seam.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/vue';
import { defineComponent, h, ref } from 'vue';
import axe from 'axe-core';
import ContestRegistrantsPanel from '../ContestRegistrantsPanel.vue';

const NuxtLink = defineComponent({
  name: 'NuxtLink',
  props: { to: String },
  setup(props, { slots }) { return () => h('a', { href: props.to }, slots.default?.()); },
});

const TEMPLATE = [
  { key: 'name', label: 'Full Official Name', type: 'text', required: true },
  { key: 'email', label: 'Email Address', type: 'email', required: true, pii: true },
  { key: 'track', label: 'Challenge Track', type: 'select', required: true, options: [] },
  { key: 'recipient', label: 'Recipient / Attention', type: 'text', required: true, pii: true },
  { key: 'phone', label: 'Phone Number', type: 'tel', required: true, pii: true },
  { key: 'ship', label: 'Shipping Address', type: 'address', required: true },
  { key: 'rules', label: 'Rules', type: 'agreement', required: true, mustAccept: true, terms: 'x' },
];
const reg = (u: string, name: string, addr: Record<string, string>) => ({
  userId: `id-${u}`, username: u, displayName: name, registeredAt: '2026-09-01T00:00:00Z', consentCount: 1,
  fields: { name, track: 'water' },
  privateFields: { email: `${u}@example.com`, recipient: name, phone: '720-643-9134', ship: JSON.stringify(addr) },
});
let payload: Record<string, unknown>;

Object.assign(globalThis, {
  useLazyAsyncData: vi.fn(() => ({ data: ref(payload), pending: ref(false), error: ref(null) })),
  formatLocalDate: (s: string) => s.slice(0, 10),
});

beforeEach(() => {
  payload = {
    total: 2, includePii: true, template: TEMPLATE,
    items: [
      reg('jasiah', 'Jasiah Jones', { line1: '1039 South Fair Play Way', city: 'Aurora', region: 'CO', postal: '80012', country: 'USA' }),
      reg('pierre', 'Pierre Dubouilh', { line1: '18 Furstenwalder Str.', city: 'Berlin', postal: '10243', country: 'Germany' }),
    ],
  };
});

const mount = () => render(ContestRegistrantsPanel, { props: { slug: 'demo' }, global: { components: { NuxtLink } } });

describe('ContestRegistrantsPanel', () => {
  it('renders addresses as mailing lines, never the stored JSON', () => {
    const { container } = mount();
    expect(container.textContent).not.toContain('{"line1"');
    const first = container.querySelector('.cpub-rp-address');
    expect(Array.from(first!.querySelectorAll('span')).map((s) => s.textContent)).toEqual(['1039 South Fair Play Way', 'Aurora, CO 80012', 'USA']);
  });

  it('offers a shipping CSV and a shipping view to personal-data holders', async () => {
    const { container, getByRole } = mount();
    const ship = Array.from(container.querySelectorAll('a')).find((a) => a.textContent?.includes('Shipping list'));
    expect(ship?.getAttribute('href')).toBe('/api/contests/demo/registrants-export?format=shipping');
    await fireEvent.click(getByRole('button', { name: 'Shipping' }));
    const cards = container.querySelectorAll('.cpub-rp-card');
    expect(cards).toHaveLength(2);
    expect(cards[0]!.textContent).toContain('Recipient / Attention');
    expect(cards[0]!.textContent).toContain('720-643-9134');
    expect(cards[0]!.textContent).not.toContain('Challenge Track'); // not a contact field
  });

  it('search narrows the list by any answer, including the city', async () => {
    const { container } = mount();
    const input = container.querySelector('input[type="search"]') as HTMLInputElement;
    await fireEvent.update(input, 'berlin');
    expect(container.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(container.textContent).toContain('Pierre Dubouilh');
    expect(container.textContent).toContain('1 of 2');
  });

  it('without personal-data permission: says why, and offers no shipping list', () => {
    payload = { ...payload, includePii: false, items: (payload.items as Array<Record<string, unknown>>).map((r) => ({ ...r, privateFields: null })) };
    const { container } = mount();
    expect(container.textContent).toContain('can’t see entrants’ personal data');
    expect(Array.from(container.querySelectorAll('a')).some((a) => a.textContent?.includes('Shipping list'))).toBe(false);
    expect(container.querySelector('.cpub-rp-address')).toBeNull();
  });

  it('has no axe violations in the shipping view', async () => {
    const { container, getByRole } = mount();
    await fireEvent.click(getByRole('button', { name: 'Shipping' }));
    const res = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(res.violations.map((v) => v.id)).toEqual([]);
  });
});
