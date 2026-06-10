/**
 * Priority-nav fit math — the pure core of the topbar's "More" overflow.
 * The regression this guards: links pushing search/Log in off-screen when
 * the bar is narrower than the link row (all three instances, 769–1100px).
 */
import { describe, it, expect } from 'vitest';
import { computeVisibleCount, buildMoreItem } from '../navOverflow';
import type { NavItem } from '@commonpub/server';

describe('computeVisibleCount', () => {
  it('shows everything when it fits', () => {
    expect(computeVisibleCount([100, 100, 100], 320, 90)).toBe(3);
  });

  it('shows everything when widths are unmeasured (SSR / jsdom zeros)', () => {
    expect(computeVisibleCount([0, 0, 0], 0, 90)).toBe(3);
    expect(computeVisibleCount([0, 0], 500, 90)).toBe(2);
  });

  it('collapses the tail and reserves room for the More trigger', () => {
    // 4×100 (+gaps) into 320: all 4 = 406 > 320. With More (90) reserved:
    // 90 +102+102 = 294 fits, +102 = 396 > 320 → 2 visible.
    expect(computeVisibleCount([100, 100, 100, 100], 320, 90)).toBe(2);
  });

  it('can collapse everything when the bar is extremely tight', () => {
    expect(computeVisibleCount([200, 200], 150, 90)).toBe(0);
  });

  it('exact-fit boundary goes to visible, off-by-one goes to More', () => {
    // 2 items, gap 2: total = 202.
    expect(computeVisibleCount([100, 100], 202, 90)).toBe(2);
    expect(computeVisibleCount([100, 100], 201, 90)).toBe(1); // 90+2+100=192 fits; +102=294 no
  });

  it('handles the empty nav', () => {
    expect(computeVisibleCount([], 500, 90)).toBe(0);
  });
});

describe('buildMoreItem', () => {
  const link = (id: string): NavItem => ({ id, type: 'link', label: id, route: `/${id}` } as NavItem);

  it('returns null when nothing overflows', () => {
    expect(buildMoreItem([])).toBeNull();
  });

  it('wraps overflowed links as children', () => {
    const more = buildMoreItem([link('events'), link('hubs')])!;
    expect(more.id).toBe('__more');
    expect(more.type).toBe('dropdown');
    expect(more.children?.map((c) => c.id)).toEqual(['events', 'hubs']);
  });

  it('spreads an overflowed dropdown into its children (no nested menus)', () => {
    const dd: NavItem = {
      id: 'learn', type: 'dropdown', label: 'Learn',
      children: [link('paths'), link('docs')],
    } as NavItem;
    const more = buildMoreItem([dd, link('events')])!;
    expect(more.children?.map((c) => c.id)).toEqual(['paths', 'docs', 'events']);
  });

  it('returns null when overflow is only empty dropdowns', () => {
    const dd: NavItem = { id: 'x', type: 'dropdown', label: 'X', children: [] } as NavItem;
    expect(buildMoreItem([dd])).toBeNull();
  });
});
