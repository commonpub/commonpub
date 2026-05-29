/**
 * PageFrame — slot-gating tests. The shared page frame renders each
 * region only when its slot has content; the grid carries
 * data-with-sidebar so CSS can pick the 2-col vs 1-col track.
 *
 * CSS cascade (max-width / grid tracks / responsive collapse) is NOT
 * asserted here — jsdom is cascade-blind (feedback-css-cascade-unit-test-
 * blind-spot); those are verified by real-browser smoke on adoption. This
 * file guards the DOM SHAPE contract that the CSS hangs off of.
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/vue';
import PageFrame from '../PageFrame.vue';

describe('PageFrame — slot gating', () => {
  it('renders only the full-width region when only that slot is given', () => {
    const { container } = render(PageFrame, {
      slots: { 'full-width': '<div data-test="fw">FW</div>' },
    });
    expect(container.querySelector('.cpub-page-frame-full')).toBeTruthy();
    expect(container.querySelector('[data-test="fw"]')).toBeTruthy();
    expect(container.querySelector('.cpub-page-frame-grid')).toBeNull();
  });

  it('renders a 1-col grid (no sidebar) when only main is given', () => {
    const { container } = render(PageFrame, {
      slots: { main: '<div data-test="m">M</div>' },
    });
    const grid = container.querySelector('.cpub-page-frame-grid');
    expect(grid).toBeTruthy();
    expect(grid?.getAttribute('data-with-sidebar')).toBe('no');
    expect(container.querySelector('.cpub-page-frame-main')).toBeTruthy();
    expect(container.querySelector('.cpub-page-frame-sidebar')).toBeNull();
    expect(container.querySelector('.cpub-page-frame-full')).toBeNull();
  });

  it('renders a 2-col grid (with sidebar) when main + sidebar are given', () => {
    const { container } = render(PageFrame, {
      slots: { main: '<div>M</div>', sidebar: '<div data-test="s">S</div>' },
    });
    const grid = container.querySelector('.cpub-page-frame-grid');
    expect(grid?.getAttribute('data-with-sidebar')).toBe('yes');
    expect(container.querySelector('.cpub-page-frame-main')).toBeTruthy();
    expect(container.querySelector('.cpub-page-frame-sidebar')).toBeTruthy();
  });

  it('renders all three regions when all slots are given', () => {
    const { container } = render(PageFrame, {
      slots: {
        'full-width': '<div>FW</div>',
        main: '<div>M</div>',
        sidebar: '<div>S</div>',
      },
    });
    expect(container.querySelector('.cpub-page-frame-full')).toBeTruthy();
    expect(container.querySelector('.cpub-page-frame-main')).toBeTruthy();
    expect(container.querySelector('.cpub-page-frame-sidebar')).toBeTruthy();
  });

  it('renders a sidebar-only grid (edge case) with data-with-sidebar=yes', () => {
    const { container } = render(PageFrame, {
      slots: { sidebar: '<div>S</div>' },
    });
    const grid = container.querySelector('.cpub-page-frame-grid');
    expect(grid).toBeTruthy();
    expect(grid?.getAttribute('data-with-sidebar')).toBe('yes');
    expect(container.querySelector('.cpub-page-frame-main')).toBeNull();
    expect(container.querySelector('.cpub-page-frame-sidebar')).toBeTruthy();
  });

  it('applies the --editable modifier class when editable', () => {
    const { container } = render(PageFrame, {
      props: { editable: true },
      slots: { main: '<div>M</div>' },
    });
    expect(container.querySelector('.cpub-page-frame--editable')).toBeTruthy();
  });
});
