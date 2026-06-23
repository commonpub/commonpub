import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/vue';
import axe from 'axe-core';
import CpubCriteriaBar from '../CpubCriteriaBar.vue';
import { criteriaBar, criteriaColorVar } from '../../utils/contestBlocks';

describe('criteriaBar (pure)', () => {
  it('returns a row per labeled item with proportional pcts; keeps 0-weight rows', () => {
    const { rows, total } = criteriaBar([
      { label: 'Innovation', weight: 35 },
      { label: 'Functionality', weight: 30 },
      { label: '', weight: 50 },        // blank label -> dropped entirely
      { label: 'Holistic', weight: 0 }, // 0 weight -> stays in rows (legend), but not the bar
      { label: 'Alignment', weight: 35 },
    ]);
    expect(total).toBe(100);
    expect(rows.map((r) => r.label)).toEqual(['Innovation', 'Functionality', 'Holistic', 'Alignment']);
    expect(rows.map((r) => r.pct)).toEqual([35, 30, 0, 35]);
    expect(rows[0]!.colorVar).toMatch(/^var\(--/);
  });
  it('normalizes pct when weights do not sum to 100', () => {
    const { rows } = criteriaBar([{ label: 'A', weight: 1 }, { label: 'B', weight: 3 }]);
    expect(rows.map((r) => r.pct)).toEqual([25, 75]);
  });
  it('palette is hue-spread and color resolves by key or index', () => {
    expect(criteriaColorVar('teal')).toBe('var(--teal)');
    expect(criteriaColorVar(undefined, 0)).toBe('var(--accent)');
    expect(criteriaColorVar(undefined, 1)).toBe('var(--yellow)'); // not another green next to accent
  });
});

describe('CpubCriteriaBar', () => {
  const items = [{ label: 'Innovation', weight: 35 }, { label: 'Impact', weight: 65 }];

  it('renders one seamless bar, a segment per positive criterion, proportional widths', () => {
    const { container } = render(CpubCriteriaBar, { props: { items } });
    const segs = [...container.querySelectorAll('.cpub-cbar-seg')];
    expect(segs.length).toBe(2);
    expect(segs.map((s) => (s as HTMLElement).style.width)).toEqual(['35%', '65%']);
  });

  it('puts NO text inside the bar segments (labels live in the legend)', () => {
    const { container } = render(CpubCriteriaBar, { props: { items } });
    for (const s of container.querySelectorAll('.cpub-cbar-seg')) expect(s.textContent).toBe('');
    expect(container.querySelectorAll('.cpub-cbar-li').length).toBe(2);
  });

  it('hides the legend when showLegend is false', () => {
    const { container } = render(CpubCriteriaBar, { props: { items, showLegend: false } });
    expect(container.querySelector('.cpub-cbar-legend')).toBeNull();
    expect(container.querySelector('.cpub-cbar-track')).toBeTruthy();
  });

  it('switches to a rows legend with descriptions when any item has one', () => {
    const { container, getByText } = render(CpubCriteriaBar, { props: { items: [{ label: 'Innovation', weight: 50, description: 'Originality of the idea.' }, { label: 'Impact', weight: 50 }] } });
    expect(container.querySelector('.cpub-cbar-legend--rows')).toBeTruthy();
    getByText('Originality of the idea.');
  });

  it('with no weights: no bar, legend lists the labels', () => {
    const { container, getByText } = render(CpubCriteriaBar, { props: { items: [{ label: 'Originality' }, { label: 'Execution' }] } });
    expect(container.querySelector('.cpub-cbar-track')).toBeNull();
    expect(container.querySelectorAll('.cpub-cbar-li').length).toBe(2);
    getByText('Originality');
  });

  it('renders nothing without labeled items', () => {
    const { container } = render(CpubCriteriaBar, { props: { items: [] } });
    expect(container.querySelector('.cpub-cbar')).toBeNull();
  });

  it('passes an axe scan', async () => {
    const { container } = render(CpubCriteriaBar, { props: { items, heading: 'Final evaluation' } });
    expect((await axe.run(container)).violations).toEqual([]);
  });
});
