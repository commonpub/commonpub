/**
 * Priority-nav fit computation — how many top-level nav items fit in the
 * bar's allocated width before the rest collapse into the "More" dropdown.
 * Pure so it's unit-testable; NavRenderer feeds it measured pixel widths.
 */
import type { NavItem } from '@commonpub/server';

/**
 * Greedy fit: if everything fits, show everything; otherwise reserve room
 * for the More trigger and take items in order until the next one would
 * overflow. Zero/unmeasured widths (SSR, jsdom) mean "show everything" —
 * the client re-measures after hydration.
 */
export function computeVisibleCount(
  itemWidths: number[],
  containerWidth: number,
  moreWidth: number,
  gap = 2,
): number {
  if (itemWidths.length === 0) return 0;
  if (containerWidth <= 0 || itemWidths.every((w) => w <= 0)) return itemWidths.length;

  let total = 0;
  for (let i = 0; i < itemWidths.length; i++) total += itemWidths[i]! + (i > 0 ? gap : 0);
  if (total <= containerWidth) return itemWidths.length;

  let used = moreWidth;
  let count = 0;
  for (const w of itemWidths) {
    const next = used + gap + w;
    if (next > containerWidth) break;
    used = next;
    count++;
  }
  return count;
}

/**
 * Collapse the overflowed tail into a single synthetic dropdown item.
 * Top-level links become children; an overflowed dropdown contributes its
 * children directly (the panel re-checks feature/auth gates per child, so
 * spreading is safe). Returns null when nothing overflows.
 */
export function buildMoreItem(overflow: NavItem[]): NavItem | null {
  if (overflow.length === 0) return null;
  const children: NavItem[] = [];
  for (const item of overflow) {
    if (item.type === 'dropdown') {
      children.push(...(item.children ?? []));
    } else {
      children.push(item);
    }
  }
  if (children.length === 0) return null;
  return { id: '__more', type: 'dropdown', label: 'More', icon: '', children } as NavItem;
}
