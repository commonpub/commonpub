import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/vue';
import axe from 'axe-core';
import BlockCriteriaBarView from '../BlockCriteriaBarView.vue';
import { criteriaSegments, criteriaColorVar } from '../../../utils/contestBlocks';

describe('criteriaSegments (pure)', () => {
  it('computes proportional pcts and drops blank/zero rows', () => {
    const { segments, total } = criteriaSegments([
      { label: 'Innovation', weight: 35 },
      { label: 'Functionality', weight: 30 },
      { label: '', weight: 50 },          // blank label -> dropped
      { label: 'Zero', weight: 0 },        // zero weight -> dropped
      { label: 'Alignment', weight: 35 },
    ]);
    expect(total).toBe(100);
    expect(segments.map((s) => s.label)).toEqual(['Innovation', 'Functionality', 'Alignment']);
    expect(segments.map((s) => s.pct)).toEqual([35, 30, 35]);
    expect(segments[0]!.colorVar).toMatch(/^var\(--/);
  });
  it('normalizes when weights do not sum to 100', () => {
    const { segments } = criteriaSegments([{ label: 'A', weight: 1 }, { label: 'B', weight: 3 }]);
    expect(segments.map((s) => s.pct)).toEqual([25, 75]);
  });
  it('criteriaColorVar honors a palette key, else rotates by index', () => {
    expect(criteriaColorVar('teal')).toBe('var(--teal)');
    expect(criteriaColorVar('not-a-color', 0)).toBe('var(--accent)');
    expect(criteriaColorVar(undefined, 1)).toBe('var(--teal)');
  });
});

describe('BlockCriteriaBarView', () => {
  const content = { heading: 'Final evaluation', items: [{ label: 'Innovation', weight: 35 }, { label: 'Impact', weight: 65 }] };

  it('renders one stacked bar with a segment per criterion + a legend', () => {
    const { container, getByText } = render(BlockCriteriaBarView, { props: { content } });
    expect(container.querySelectorAll('.cpub-cbar-seg').length).toBe(2);
    expect(container.querySelectorAll('.cpub-cbar-legend-item').length).toBe(2);
    getByText('Final evaluation');
    // proportional widths set inline
    const widths = [...container.querySelectorAll('.cpub-cbar-seg')].map((s) => (s as HTMLElement).style.width);
    expect(widths).toEqual(['35%', '65%']);
  });
  it('hides the legend when showLegend is false', () => {
    const { container } = render(BlockCriteriaBarView, { props: { content: { ...content, showLegend: false } } });
    expect(container.querySelector('.cpub-cbar-legend')).toBeNull();
  });
  it('renders nothing without valid items', () => {
    const { container } = render(BlockCriteriaBarView, { props: { content: { items: [] } } });
    expect(container.querySelector('.cpub-cbar')).toBeNull();
  });
  it('passes an axe scan', async () => {
    const { container } = render(BlockCriteriaBarView, { props: { content } });
    expect((await axe.run(container)).violations).toEqual([]);
  });
});
