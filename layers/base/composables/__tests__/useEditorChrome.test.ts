/**
 * Tests for useEditorChrome — palette + inspector visibility state.
 *
 * Same testing approach as useAdminSidebar — useCookie shim with a
 * ref-backed store. Each test gets a fresh store via beforeEach.
 *
 * Coverage:
 *   - Defaults: both panels visible (hidden=false)
 *   - Cookie hydration: pre-seeded cookie produces visible-correct state
 *     on first call (no flash)
 *   - togglePalette / toggleInspector mutate independently
 *   - Cookie keys are distinct (toggling palette doesn't affect inspector)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref, type Ref } from 'vue';
import { useEditorChrome } from '../useEditorChrome';

const g = globalThis as Record<string, unknown>;

let cookieStore: Map<string, Ref<unknown>>;
const useCookieMock = vi.fn(<T>(key: string, opts?: { default?: () => T }) => {
  if (!cookieStore.has(key)) {
    cookieStore.set(key, ref(opts?.default?.() ?? null) as Ref<unknown>);
  }
  return cookieStore.get(key) as Ref<T>;
});

beforeEach(() => {
  cookieStore = new Map();
  g.useCookie = useCookieMock;
});

afterEach(() => {
  vi.clearAllMocks();
  delete g.useCookie;
});

describe('useEditorChrome — defaults', () => {
  it('returns both panels visible (hidden=false) on first call', () => {
    const chrome = useEditorChrome();
    expect(chrome.paletteHidden.value).toBe(false);
    expect(chrome.inspectorHidden.value).toBe(false);
  });
});

describe('useEditorChrome — cookie hydration', () => {
  it('reads the palette cookie when set', () => {
    cookieStore.set('cpub-editor-palette-hidden', ref(true));
    const chrome = useEditorChrome();
    expect(chrome.paletteHidden.value).toBe(true);
    expect(chrome.inspectorHidden.value).toBe(false);
  });

  it('reads the inspector cookie when set', () => {
    cookieStore.set('cpub-editor-inspector-hidden', ref(true));
    const chrome = useEditorChrome();
    expect(chrome.paletteHidden.value).toBe(false);
    expect(chrome.inspectorHidden.value).toBe(true);
  });

  it('reads both when both cookies are set', () => {
    cookieStore.set('cpub-editor-palette-hidden', ref(true));
    cookieStore.set('cpub-editor-inspector-hidden', ref(true));
    const chrome = useEditorChrome();
    expect(chrome.paletteHidden.value).toBe(true);
    expect(chrome.inspectorHidden.value).toBe(true);
  });
});

describe('useEditorChrome — toggles', () => {
  it('togglePalette flips paletteHidden without touching inspectorHidden', () => {
    const chrome = useEditorChrome();
    chrome.togglePalette();
    expect(chrome.paletteHidden.value).toBe(true);
    expect(chrome.inspectorHidden.value).toBe(false);
    expect(cookieStore.get('cpub-editor-palette-hidden')?.value).toBe(true);
  });

  it('toggleInspector flips inspectorHidden without touching paletteHidden', () => {
    const chrome = useEditorChrome();
    chrome.toggleInspector();
    expect(chrome.inspectorHidden.value).toBe(true);
    expect(chrome.paletteHidden.value).toBe(false);
    expect(cookieStore.get('cpub-editor-inspector-hidden')?.value).toBe(true);
  });

  it('toggles flip back to false on second click', () => {
    const chrome = useEditorChrome();
    chrome.togglePalette();
    chrome.togglePalette();
    expect(chrome.paletteHidden.value).toBe(false);
  });

  it('toggling both leaves both hidden', () => {
    const chrome = useEditorChrome();
    chrome.togglePalette();
    chrome.toggleInspector();
    expect(chrome.paletteHidden.value).toBe(true);
    expect(chrome.inspectorHidden.value).toBe(true);
  });
});

describe('useEditorChrome — independence', () => {
  it('uses two distinct cookie keys (palette + inspector)', () => {
    const chrome = useEditorChrome();
    chrome.togglePalette();
    expect(cookieStore.has('cpub-editor-palette-hidden')).toBe(true);
    expect(cookieStore.has('cpub-editor-inspector-hidden')).toBe(true);
    // palette is true; inspector still default false
    expect(cookieStore.get('cpub-editor-palette-hidden')?.value).toBe(true);
    expect(cookieStore.get('cpub-editor-inspector-hidden')?.value).toBe(false);
  });
});
