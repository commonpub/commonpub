/**
 * AdminLayoutsCanvas — Stage 2 consolidation: the canvas now previews the
 * layout through the shared <PageFrame> (full-width above; main + sidebar
 * side-by-side) instead of stacked equal-width zone boxes.
 *
 * This test locks the SLOT-MAPPING CONTRACT: each layout zone must land in
 * the matching PageFrame region (full-width → .cpub-page-frame-full, main →
 * .cpub-page-frame-main, sidebar → .cpub-page-frame-sidebar). That's the
 * structural half of the WYSIWYG fix — verifiable in jsdom. The VISUAL
 * arrangement (the actual side-by-side grid) + cross-zone drag are
 * real-browser-only (feedback-css-cascade-unit-test-blind-spot) and get an
 * editor smoke on deploy.
 *
 * LayoutSlot is stubbed (its real render pulls useLayout/dnd-kit); PageFrame
 * is the REAL component so the region mapping is genuinely exercised.
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/vue';
import type { LayoutRecord } from '@commonpub/server';
import AdminLayoutsCanvas from '../AdminLayoutsCanvas.vue';
import PageFrame from '../../../PageFrame.vue';

const LayoutSlotStub = {
  name: 'LayoutSlot',
  props: ['route', 'zone', 'previewOverride', 'editable', 'onSelect', 'selectedId', 'findRow', 'findZone', 'zoneSlugs', 'findFirstRowInZone', 'onRemoveRow', 'getDraft'],
  template: '<div class="stub-slot" :data-zone="zone" />',
};

function layoutWithZones(zones: string[]): LayoutRecord {
  return {
    id: 'l1',
    scope: { type: 'route', path: '/' },
    name: 'Home',
    pageMeta: null,
    state: 'draft',
    publishedVersionId: null,
    zones: zones.map((z) => ({ zone: z, rows: [] })),
    createdAt: '2026-05-29T00:00:00.000Z',
    updatedAt: '2026-05-29T00:00:00.000Z',
  };
}

function renderCanvas(layout: LayoutRecord | null) {
  return render(AdminLayoutsCanvas, {
    props: { layout, viewport: 'desktop', onAddRow: () => {} },
    global: { components: { PageFrame }, stubs: { LayoutSlot: LayoutSlotStub } },
  });
}

describe('AdminLayoutsCanvas — PageFrame zone mapping (Stage 2)', () => {
  it('maps each zone to the matching PageFrame region', () => {
    const { container } = renderCanvas(layoutWithZones(['full-width', 'main', 'sidebar']));
    // The canvas renders through PageFrame, not stacked boxes.
    expect(container.querySelector('.cpub-page-frame')).toBeTruthy();
    // full-width zone → full region (above the grid)
    expect(container.querySelector('.cpub-page-frame-full .stub-slot[data-zone="full-width"]')).toBeTruthy();
    // main zone → main region (the 1fr grid column)
    expect(container.querySelector('.cpub-page-frame-main .stub-slot[data-zone="main"]')).toBeTruthy();
    // sidebar zone → sidebar region (the fixed grid column)
    expect(container.querySelector('.cpub-page-frame-sidebar .stub-slot[data-zone="sidebar"]')).toBeTruthy();
    // the grid is the 2-col (with-sidebar) variant
    expect(container.querySelector('.cpub-page-frame-grid')?.getAttribute('data-with-sidebar')).toBe('yes');
  });

  it('renders a 1-col grid when there is no sidebar zone', () => {
    const { container } = renderCanvas(layoutWithZones(['full-width', 'main']));
    expect(container.querySelector('.cpub-page-frame-grid')?.getAttribute('data-with-sidebar')).toBe('no');
    expect(container.querySelector('.cpub-page-frame-sidebar')).toBeNull();
    expect(container.querySelector('.cpub-page-frame-main .stub-slot[data-zone="main"]')).toBeTruthy();
  });

  it('keeps the per-zone editor chrome (label + add-row) inside each region', () => {
    const { container, getByLabelText } = renderCanvas(layoutWithZones(['main']));
    expect(container.querySelector('.cpub-page-frame-main .cpub-admin-layouts-canvas-zone-label')).toBeTruthy();
    // add-row button is wired (onAddRow provided) + addresses the right zone
    expect(getByLabelText('Add row to main zone')).toBeTruthy();
  });

  it('shows the loading state (no PageFrame) when layout is null', () => {
    const { container } = renderCanvas(null);
    expect(container.querySelector('.cpub-admin-layouts-canvas-empty')).toBeTruthy();
    expect(container.querySelector('.cpub-page-frame')).toBeNull();
  });

  it('ignores unknown zones not in the frame (full-width/main/sidebar only)', () => {
    const { container } = renderCanvas(layoutWithZones(['main', 'mystery-zone']));
    expect(container.querySelector('.stub-slot[data-zone="main"]')).toBeTruthy();
    expect(container.querySelector('.stub-slot[data-zone="mystery-zone"]')).toBeNull();
  });
});
