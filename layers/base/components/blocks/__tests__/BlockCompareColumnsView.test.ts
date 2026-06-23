import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/vue';
import axe from 'axe-core';
import BlockCompareColumnsView from '../BlockCompareColumnsView.vue';

const columns = [
  { tone: 'positive', title: 'Encouraged', items: ['Edge AI for the five pillars', 'STEM projects', ''] },
  { tone: 'negative', title: 'Out of scope', items: ['Lethal autonomous weapons', 'Mass surveillance'] },
];

describe('BlockCompareColumnsView', () => {
  it('renders eyebrow, heading, columns with tone classes, and a note', () => {
    const { container, getByText } = render(BlockCompareColumnsView, {
      props: { content: { eyebrow: 'What is in scope', heading: 'Build to help', columns, note: 'Ask if in doubt.' } },
    });
    getByText('What is in scope');
    getByText('Build to help');
    getByText('Ask if in doubt.');
    expect(container.querySelector('.cpub-cmp-positive')).toBeTruthy();
    expect(container.querySelector('.cpub-cmp-negative')).toBeTruthy();
  });

  it('drops blank items and renders an icon per item', () => {
    const { container } = render(BlockCompareColumnsView, { props: { content: { columns } } });
    const cols = container.querySelectorAll('.cpub-cmp-col');
    expect(cols[0]!.querySelectorAll('.cpub-cmp-item').length).toBe(2); // blank dropped
    expect(cols[1]!.querySelectorAll('.cpub-cmp-item').length).toBe(2);
    // positive -> check icon, negative -> xmark icon
    expect(cols[0]!.querySelector('.cpub-cmp-item-icon')!.classList.contains('fa-circle-check')).toBe(true);
    expect(cols[1]!.querySelector('.cpub-cmp-item-icon')!.classList.contains('fa-circle-xmark')).toBe(true);
  });

  it('defaults an unknown/missing tone to neutral', () => {
    const { container } = render(BlockCompareColumnsView, { props: { content: { columns: [{ title: 'Notes', items: ['x'] }] } } });
    expect(container.querySelector('.cpub-cmp-neutral')).toBeTruthy();
  });

  it('renders nothing without usable columns', () => {
    const { container } = render(BlockCompareColumnsView, { props: { content: { columns: [{ tone: 'positive', title: '', items: ['', ''] }] } } });
    expect(container.querySelector('.cpub-cmp')).toBeNull();
  });

  it('passes an axe scan', async () => {
    const { container } = render(BlockCompareColumnsView, { props: { content: { eyebrow: 'Scope', heading: 'Build to help', columns, note: 'Ask if unsure.' } } });
    expect((await axe.run(container)).violations).toEqual([]);
  });
});
