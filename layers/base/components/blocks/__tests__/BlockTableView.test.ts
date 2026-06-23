import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/vue';
import axe from 'axe-core';
import BlockTableView from '../BlockTableView.vue';

const content = { caption: 'Key dates', header: ['Milestone', 'Date'], rows: [['Launch', 'Jul 31'], ['Deadline', 'Aug 10']] };

describe('BlockTableView', () => {
  it('renders header + body cells with a caption', () => {
    const { container, getByText } = render(BlockTableView, { props: { content } });
    expect(container.querySelectorAll('thead th').length).toBe(2);
    expect(container.querySelectorAll('tbody tr').length).toBe(2);
    getByText('Key dates');
    getByText('Milestone');
    getByText('Deadline');
  });

  it('escapes HTML in cells (no injection)', () => {
    const { container } = render(BlockTableView, { props: { content: { header: ['H'], rows: [['<img src=x onerror=alert(1)>']] } } });
    expect(container.querySelector('td img')).toBeNull();
    expect(container.querySelector('td')?.textContent).toContain('<img');
  });

  it('renders nothing when empty', () => {
    const { container } = render(BlockTableView, { props: { content: { header: [], rows: [] } } });
    expect(container.querySelector('.cpub-tbl')).toBeNull();
  });

  it('passes an axe scan', async () => {
    const { container } = render(BlockTableView, { props: { content } });
    expect((await axe.run(container)).violations).toEqual([]);
  });
});
