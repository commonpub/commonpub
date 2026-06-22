import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/vue';
import { toLocalInput, fromLocalInput } from '../../utils/datetime';

// The SFC uses Nuxt/util auto-imports; provide them on globalThis for the unit
// test (test-setup globalizes vue's computed/ref). Use the REAL datetime helpers
// so the offset-correct conversion is actually exercised.
Object.assign(globalThis, {
  useId: () => 'tid',
  toLocalInput,
  fromLocalInput,
});

// eslint-disable-next-line import/first
import CpubDateTimeField from '../CpubDateTimeField.vue';

describe('CpubDateTimeField', () => {
  it('renders a label associated with the input', () => {
    const { getByText, container } = render(CpubDateTimeField, { props: { label: 'Starts', modelValue: null } });
    const label = getByText('Starts').closest('label')!;
    const input = container.querySelector('input')!;
    expect(label.getAttribute('for')).toBe(input.id);
    expect(input.id).toBeTruthy();
  });

  it('shows the model ISO as local wall-clock (no UTC shift)', () => {
    const iso = new Date(2026, 5, 15, 14, 30, 0, 0).toISOString(); // 2026-06-15 14:30 local
    const { container } = render(CpubDateTimeField, { props: { modelValue: iso } });
    const input = container.querySelector('input')!;
    expect(input.value).toBe('2026-06-15T14:30');
  });

  it('emits an ISO instant on input', async () => {
    const { container, emitted } = render(CpubDateTimeField, { props: { modelValue: null } });
    const input = container.querySelector('input')!;
    await fireEvent.update(input, '2026-06-15T14:30');
    const events = emitted()['update:modelValue'] as unknown[][];
    expect(events).toHaveLength(1);
    expect(events[0]![0]).toBe(new Date(2026, 5, 15, 14, 30, 0, 0).toISOString());
  });

  it('constrains the picker via min/max (ISO -> local)', () => {
    const min = new Date(2026, 5, 1, 9, 0).toISOString();
    const max = new Date(2026, 5, 30, 17, 0).toISOString();
    const { container } = render(CpubDateTimeField, { props: { modelValue: null, min, max } });
    const input = container.querySelector('input')!;
    expect(input.getAttribute('min')).toBe('2026-06-01T09:00');
    expect(input.getAttribute('max')).toBe('2026-06-30T17:00');
  });

  it('falls back to an aria-label when no visible label is given', () => {
    const { container } = render(CpubDateTimeField, { props: { modelValue: null } });
    const input = container.querySelector('input')!;
    expect(input.getAttribute('aria-label')).toBe('Date and time');
  });
});
