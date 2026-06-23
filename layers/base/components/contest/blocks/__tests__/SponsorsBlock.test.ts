import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/vue';
import axe from 'axe-core';
import SponsorsBlock from '../SponsorsBlock.vue';
import { UPLOAD_HANDLER_KEY } from '@commonpub/editor/vue';

const base = { content: { heading: 'Sponsors', logos: [{ src: 'https://cdn.test/a.png', alt: 'Qualcomm' }] } };
const lastUpdate = (emitted: Record<string, unknown[][]>) => (emitted.update?.at(-1) as [Record<string, unknown>])[0];

describe('SponsorsBlock', () => {
  it('renders a row per logo with a thumbnail', () => {
    const { container } = render(SponsorsBlock, { props: base });
    expect(container.querySelectorAll('.cpub-spedit-row').length).toBe(1);
    expect(container.querySelector('.cpub-spedit-thumb img')).toBeTruthy();
  });

  it('emits update with a new logo on Add', async () => {
    const { getByText, emitted } = render(SponsorsBlock, { props: base });
    await fireEvent.click(getByText(/Add logo/));
    expect((lastUpdate(emitted()).logos as unknown[]).length).toBe(2);
  });

  it('emits update when the alt name changes', async () => {
    const { container, emitted } = render(SponsorsBlock, { props: base });
    await fireEvent.update(container.querySelector('[aria-label="Logo 1 name"]') as HTMLInputElement, 'Arduino');
    expect((lastUpdate(emitted()).logos as { alt: string }[])[0]!.alt).toBe('Arduino');
  });

  it('shows the upload control only when an upload handler is provided', () => {
    const without = render(SponsorsBlock, { props: base });
    expect(without.container.querySelector('.cpub-spedit-upload')).toBeNull();

    const withHandler = render(SponsorsBlock, {
      props: base,
      global: { provide: { [UPLOAD_HANDLER_KEY as symbol]: vi.fn(async () => ({ url: 'https://cdn.test/up.png' })) } },
    });
    expect(withHandler.container.querySelector('.cpub-spedit-upload')).toBeTruthy();
  });

  it('passes an axe scan', async () => {
    const { container } = render(SponsorsBlock, { props: base });
    expect((await axe.run(container)).violations).toEqual([]);
  });
});
