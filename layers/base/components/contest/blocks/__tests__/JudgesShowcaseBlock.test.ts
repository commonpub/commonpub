import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/vue';
import JudgesShowcaseBlock from '../JudgesShowcaseBlock.vue';

type Judge = { name: string; title?: string };
function lastUpdate(emitted: Record<string, unknown[]>): Record<string, unknown> {
  const evs = emitted['update'] as unknown[][];
  expect(evs?.length).toBeGreaterThan(0);
  return evs[evs.length - 1]![0] as Record<string, unknown>;
}

describe('JudgesShowcaseBlock (edit)', () => {
  it('adds a judge', async () => {
    const { getByRole, emitted } = render(JudgesShowcaseBlock, { props: { content: { judges: [] } } });
    await fireEvent.click(getByRole('button', { name: /Add person/ }));
    expect((lastUpdate(emitted()).judges as unknown[]).length).toBe(1);
  });

  it('edits a judge name', async () => {
    const { getByLabelText, emitted } = render(JudgesShowcaseBlock, { props: { content: { judges: [{ name: '' }] } } });
    await fireEvent.update(getByLabelText('Person 1 name'), 'Ada');
    expect((lastUpdate(emitted()).judges as Judge[])[0]!.name).toBe('Ada');
  });

  it('sets the section heading', async () => {
    const { getByLabelText, emitted } = render(JudgesShowcaseBlock, { props: { content: { judges: [] } } });
    await fireEvent.update(getByLabelText('Showcase heading'), 'Panel');
    expect(lastUpdate(emitted()).heading).toBe('Panel');
  });

  it('removes a judge', async () => {
    const { getByRole, emitted } = render(JudgesShowcaseBlock, { props: { content: { judges: [{ name: 'A' }, { name: 'B' }] } } });
    await fireEvent.click(getByRole('button', { name: 'Remove person 1' }));
    const u = lastUpdate(emitted());
    expect((u.judges as unknown[]).length).toBe(1);
    expect((u.judges as Judge[])[0]!.name).toBe('B');
  });
});
