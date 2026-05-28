/**
 * Tests for AdminLayoutsToolbar — the editor's top strip.
 *
 * Audit-polish coverage (session 160 god-mode audit). Focus on the
 * state-derivation logic added in the audit: the Strapi 3-state
 * model (Draft / Modified / Published), dynamic Publish button copy
 * adapting to context, save indicator with relative timestamp, and
 * the visual-affordance computeds.
 *
 * Save indicator timestamp uses Date.now(); tests use fixed Date stubs
 * so the relative-time assertions are stable.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/vue';
import AdminLayoutsToolbar from '../AdminLayoutsToolbar.vue';

// Stub NuxtLink — auto-imported in Nuxt but absent in vitest. Without
// the stub, Vue warns "Failed to resolve component: NuxtLink" on every
// render (harmless but noisy).
const NuxtLinkStub = { template: '<a><slot /></a>', props: ['to'] };

function mount(props: Partial<{
  layoutName: string;
  state: 'draft' | 'published';
  viewport: 'mobile' | 'tablet' | 'desktop';
  saveStatus: 'idle' | 'saving' | 'saved' | 'error' | 'conflict';
  dirty: boolean;
  errorMessage: string | null;
  lastSavedAt: string | null;
  paletteHidden: boolean;
  inspectorHidden: boolean;
}> = {}) {
  return render(AdminLayoutsToolbar, {
    props: {
      layoutName: 'Homepage',
      state: 'draft',
      viewport: 'desktop',
      saveStatus: 'idle',
      dirty: false,
      errorMessage: null,
      lastSavedAt: null,
      paletteHidden: false,
      inspectorHidden: false,
      ...props,
    },
    global: {
      stubs: { NuxtLink: NuxtLinkStub },
    },
  });
}

describe('AdminLayoutsToolbar — Strapi 3-state model', () => {
  it('shows "draft" pill when state=draft (regardless of dirty)', () => {
    const { container } = mount({ state: 'draft', dirty: false });
    const pill = container.querySelector('.cpub-admin-layouts-toolbar-state');
    expect(pill?.getAttribute('data-state')).toBe('draft');
    expect(pill?.textContent?.trim()).toBe('draft');
  });

  it('shows "published" pill when state=published + clean', () => {
    const { container } = mount({ state: 'published', dirty: false });
    const pill = container.querySelector('.cpub-admin-layouts-toolbar-state');
    expect(pill?.getAttribute('data-state')).toBe('published');
    expect(pill?.textContent?.trim()).toBe('published');
  });

  it('shows "modified" pill when state=published + dirty (the Strapi 3rd state)', () => {
    const { container } = mount({ state: 'published', dirty: true });
    const pill = container.querySelector('.cpub-admin-layouts-toolbar-state');
    expect(pill?.getAttribute('data-state')).toBe('modified');
    expect(pill?.textContent?.trim()).toBe('modified');
  });

  it('still "draft" when state=draft + dirty (modified only applies to published)', () => {
    const { container } = mount({ state: 'draft', dirty: true });
    const pill = container.querySelector('.cpub-admin-layouts-toolbar-state');
    expect(pill?.getAttribute('data-state')).toBe('draft');
  });
});

describe('AdminLayoutsToolbar — dynamic Publish button copy', () => {
  function publishBtnText(container: Element): string | undefined {
    // Toolbar buttons in DOM order: Discard, Save, Publish.
    // R4 audit: Discard added (was Save, Publish only). Publish is 3rd.
    const btns = container.querySelectorAll('.cpub-admin-layouts-toolbar-btn');
    return btns[2]?.textContent?.trim().toLowerCase();
  }

  it('reads "Publish" for draft layouts', () => {
    const { container } = mount({ state: 'draft', dirty: false });
    expect(publishBtnText(container)).toContain('publish');
    expect(publishBtnText(container)).not.toContain('changes');
    expect(publishBtnText(container)).not.toContain('republish');
  });

  it('reads "Publish changes" for modified layouts', () => {
    const { container } = mount({ state: 'published', dirty: true });
    expect(publishBtnText(container)).toContain('publish changes');
  });

  it('reads "Republish" for published+clean layouts', () => {
    const { container } = mount({ state: 'published', dirty: false });
    expect(publishBtnText(container)).toContain('republish');
  });
});

describe('AdminLayoutsToolbar — Publish button disabled state', () => {
  function publishBtnDisabled(container: Element): boolean {
    // Publish is the 3rd button after R4's Discard addition.
    const btns = container.querySelectorAll('.cpub-admin-layouts-toolbar-btn');
    return (btns[2] as HTMLButtonElement | undefined)?.disabled ?? false;
  }

  it('Publish is enabled for draft state', () => {
    const { container } = mount({ state: 'draft', dirty: false });
    expect(publishBtnDisabled(container)).toBe(false);
  });

  it('Publish is enabled for modified state (has changes to publish)', () => {
    const { container } = mount({ state: 'published', dirty: true });
    expect(publishBtnDisabled(container)).toBe(false);
  });

  it('Publish is DISABLED for published+clean state (republish = no-op)', () => {
    const { container } = mount({ state: 'published', dirty: false });
    expect(publishBtnDisabled(container)).toBe(true);
  });

  it('Publish is disabled during a save in flight (regardless of state)', () => {
    const { container } = mount({ state: 'draft', dirty: true, saveStatus: 'saving' });
    expect(publishBtnDisabled(container)).toBe(true);
  });
});

describe('AdminLayoutsToolbar — save indicator', () => {
  beforeEach(() => {
    // Pin "now" so relative-time assertions are stable
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-28T12:00:00.000Z'));
  });
  afterEach(() => vi.useRealTimers());

  function indicatorText(container: Element): string | undefined {
    return container.querySelector('.cpub-admin-layouts-toolbar-indicator')?.textContent?.trim();
  }

  it('renders "Unsaved changes" when dirty + status idle', () => {
    const { container } = mount({ dirty: true, saveStatus: 'idle' });
    expect(indicatorText(container)).toContain('Unsaved changes');
  });

  it('renders "Saving…" when status=saving', () => {
    const { container } = mount({ dirty: true, saveStatus: 'saving' });
    expect(indicatorText(container)).toContain('Saving');
  });

  it('renders "Saved · 2m ago" with relative timestamp when clean + has lastSavedAt', () => {
    const twoMinAgo = new Date('2026-05-28T11:58:00.000Z').toISOString();
    const { container } = mount({ dirty: false, saveStatus: 'saved', lastSavedAt: twoMinAgo });
    expect(indicatorText(container)).toContain('Saved');
    expect(indicatorText(container)).toContain('2m ago');
  });

  it('renders "Saved · just now" for very recent saves (< 5s)', () => {
    const veryRecent = new Date('2026-05-28T11:59:58.000Z').toISOString();
    const { container } = mount({ dirty: false, saveStatus: 'saved', lastSavedAt: veryRecent });
    expect(indicatorText(container)).toContain('just now');
  });

  it('renders error message when status=error', () => {
    const { container } = mount({ saveStatus: 'error', errorMessage: 'Network exploded' });
    expect(indicatorText(container)).toContain('Network exploded');
  });

  it('renders "Conflict" when status=conflict', () => {
    const { container } = mount({ saveStatus: 'conflict', dirty: true });
    expect(indicatorText(container)).toContain('Conflict');
  });
});

describe('AdminLayoutsToolbar — viewport segmented control', () => {
  it('marks the active viewport button with aria-pressed=true', () => {
    const { container } = mount({ viewport: 'tablet' });
    const tabletBtn = container.querySelector('[aria-label="Tablet"]');
    expect(tabletBtn?.getAttribute('aria-pressed')).toBe('true');
    const mobileBtn = container.querySelector('[aria-label="Mobile"]');
    expect(mobileBtn?.getAttribute('aria-pressed')).toBe('false');
  });

  it('renders 3 viewport buttons (Mobile + Tablet + Desktop, no extras in v1)', () => {
    const { container } = mount({});
    const btns = container.querySelectorAll('.cpub-admin-layouts-toolbar-viewport-btn');
    expect(btns.length).toBe(3);
  });
});
