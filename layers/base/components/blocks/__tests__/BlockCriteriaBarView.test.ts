import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/vue';
import BlockCriteriaBarView from '../BlockCriteriaBarView.vue';
import CpubCriteriaBar from '../../CpubCriteriaBar.vue';

// The block view delegates to the shared CpubCriteriaBar (a Nuxt auto-import);
// register it so it resolves in the bare render. Its full behavior + the criteriaBar
// helper are covered by components/__tests__/CpubCriteriaBar.test.ts.
const g = { components: { CpubCriteriaBar } };

describe('BlockCriteriaBarView', () => {
  it('renders the shared criteria bar from block content', () => {
    const { container } = render(BlockCriteriaBarView, { props: { content: { heading: 'Final', items: [{ label: 'A', weight: 40 }, { label: 'B', weight: 60 }] } }, global: g });
    const segs = [...container.querySelectorAll('.cpub-cbar-seg')];
    expect(segs.length).toBe(2);
    expect(segs.map((s) => (s as HTMLElement).style.width)).toEqual(['40%', '60%']);
    expect(container.querySelector('.cpub-cbar-heading')?.textContent).toContain('Final');
  });

  it('passes showLegend:false through', () => {
    const { container } = render(BlockCriteriaBarView, { props: { content: { items: [{ label: 'A', weight: 1 }], showLegend: false } }, global: g });
    expect(container.querySelector('.cpub-cbar-legend')).toBeNull();
  });

  it('renders nothing without items', () => {
    const { container } = render(BlockCriteriaBarView, { props: { content: { items: [] } }, global: g });
    expect(container.querySelector('.cpub-cbar')).toBeNull();
  });
});
