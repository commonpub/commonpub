import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/vue';
import { UPLOAD_HANDLER_KEY } from '@commonpub/editor/vue';
import JudgesShowcaseBlock from '../JudgesShowcaseBlock.vue';
import { CONTEST_JUDGES_KEY, type ContestPanelJudge } from '../../../../utils/contestBlocks';

type Judge = { name: string; title?: string; avatarUrl?: string };
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

  it('reorders judges (move down)', async () => {
    const { getByRole, emitted } = render(JudgesShowcaseBlock, { props: { content: { judges: [{ name: 'A' }, { name: 'B' }] } } });
    await fireEvent.click(getByRole('button', { name: 'Move person 1 down' }));
    expect((lastUpdate(emitted()).judges as Judge[]).map((j) => j.name)).toEqual(['B', 'A']);
  });

  it('uploads an avatar via the inject handler', async () => {
    const uploadHandler = vi.fn(async () => ({ url: 'https://cdn/x.png' }));
    const { getByLabelText, emitted } = render(JudgesShowcaseBlock, {
      props: { content: { judges: [{ name: 'A' }] } },
      global: { provide: { [UPLOAD_HANDLER_KEY as symbol]: uploadHandler } },
    });
    const file = new File(['x'], 'x.png', { type: 'image/png' });
    await fireEvent.change(getByLabelText('Upload photo for person 1'), { target: { files: [file] } });
    await Promise.resolve();
    expect(uploadHandler).toHaveBeenCalled();
    expect((lastUpdate(emitted()).judges as Judge[])[0]!.avatarUrl).toBe('https://cdn/x.png');
  });

  it('imports panel judges, skipping names already shown', async () => {
    const panel: ContestPanelJudge[] = [
      { name: 'Ada Lovelace', avatarUrl: 'https://cdn/ada.png' },
      { name: 'Existing', avatarUrl: 'https://cdn/e.png' },
    ];
    const loader = vi.fn(async () => panel);
    const { getByRole, emitted } = render(JudgesShowcaseBlock, {
      props: { content: { judges: [{ name: 'Existing' }] } },
      global: { provide: { [CONTEST_JUDGES_KEY as symbol]: loader } },
    });
    await fireEvent.click(getByRole('button', { name: /Import panel judges/ }));
    await Promise.resolve();
    await Promise.resolve();
    const names = (lastUpdate(emitted()).judges as Judge[]).map((j) => j.name);
    expect(names).toEqual(['Existing', 'Ada Lovelace']);
  });

  it('hides the import button when no judges loader is provided', () => {
    const { queryByRole } = render(JudgesShowcaseBlock, { props: { content: { judges: [] } } });
    expect(queryByRole('button', { name: /Import panel judges/ })).toBeNull();
  });
});
