import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/vue';
import ContestCriteriaEditor from '../ContestCriteriaEditor.vue';

type Crit = { label: string; weight?: number; description?: string };
function last(emitted: Record<string, unknown[]>): Crit[] {
  const evs = emitted['update:modelValue'] as unknown[][];
  expect(evs?.length).toBeGreaterThan(0);
  return evs[evs.length - 1]![0] as Crit[];
}

describe('ContestCriteriaEditor', () => {
  it('adds a criterion', async () => {
    const { getByRole, emitted } = render(ContestCriteriaEditor, { props: { modelValue: [] } });
    await fireEvent.click(getByRole('button', { name: /Add/ }));
    expect(last(emitted())).toHaveLength(1);
  });

  it('edits a criterion label', async () => {
    const { getByLabelText, emitted } = render(ContestCriteriaEditor, { props: { modelValue: [{ label: '' }] } });
    await fireEvent.update(getByLabelText('Criterion 1 label'), 'Feasibility');
    expect(last(emitted())[0]!.label).toBe('Feasibility');
  });

  it('clamps weight to 0–100 and omits when blank', async () => {
    const { getByLabelText, emitted } = render(ContestCriteriaEditor, { props: { modelValue: [{ label: 'X' }] } });
    await fireEvent.update(getByLabelText('Criterion 1 points'), '150');
    expect(last(emitted())[0]!.weight).toBe(100);
    await fireEvent.update(getByLabelText('Criterion 1 points'), '');
    expect(last(emitted())[0]!.weight).toBeUndefined();
  });

  it('removes a criterion', async () => {
    const { getByRole, emitted } = render(ContestCriteriaEditor, { props: { modelValue: [{ label: 'A' }, { label: 'B' }] } });
    await fireEvent.click(getByRole('button', { name: 'Remove criterion 1' }));
    const out = last(emitted());
    expect(out).toHaveLength(1);
    expect(out[0]!.label).toBe('B');
  });

  it('shows the points total', () => {
    const { getByText } = render(ContestCriteriaEditor, { props: { modelValue: [{ label: 'A', weight: 40 }, { label: 'B', weight: 60 }], showTotal: true } });
    expect(getByText('100 pts')).toBeTruthy();
  });
});
