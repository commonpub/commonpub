/**
 * Regression tests for the theme editor preview pane.
 *
 * Locks the session-157 hotfix for the Light/Dark toggle that did
 * nothing in 0.22.0 (data-theme was hardcoded to parentTheme, ignoring
 * the toggle's previewMode state). These tests fail if the regression
 * is re-introduced — assertion is on the actual data-theme attribute
 * the surface div renders, not on internal state.
 *
 * Per docs/plans/layout-and-pages.md §10.2: real tests exercise the
 * component, assert observable DOM, cover the failure mode.
 */
import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/vue';
import AdminThemePreviewPane from '../admin/theme/AdminThemePreviewPane.vue';

// Stub the scenes so they don't drag in their full implementations
// (they use var(--*) and would render fine, but stubs make assertions
// easier + avoid hydration noise in the test output).
const stubs = {
  AdminThemeSceneGallery: { template: '<div data-testid="scene-gallery" />' },
  AdminThemeSceneProse: { template: '<div data-testid="scene-prose" />' },
  AdminThemeSceneAdmin: { template: '<div data-testid="scene-admin" />' },
};

function mountPane(props: { tokens?: Record<string, string>; parentTheme: string; isDark: boolean }) {
  return render(AdminThemePreviewPane, {
    props: { tokens: {}, ...props },
    global: { stubs },
  });
}

function surface(container: HTMLElement): HTMLElement {
  const el = container.querySelector('.theme-preview-surface');
  if (!el) throw new Error('.theme-preview-surface not found');
  return el as HTMLElement;
}

function modeButton(container: HTMLElement, label: 'Light' | 'Dark'): HTMLElement {
  const btns = container.querySelectorAll('.theme-preview-mode-btn');
  for (const b of Array.from(btns)) {
    if ((b.textContent ?? '').includes(label)) return b as HTMLElement;
  }
  throw new Error(`Mode button "${label}" not found`);
}

// ---- The session-157 light/dark regression tests --------------------

describe('AdminThemePreviewPane — Light/Dark toggle (session-157 regression)', () => {
  it('initial render: parentTheme="base" + isDark=false → surface has no data-theme attr', () => {
    const { container } = mountPane({ parentTheme: 'base', isDark: false });
    // The `applyThemeToElement` convention elsewhere: base = omit the attr.
    expect(surface(container).hasAttribute('data-theme')).toBe(false);
  });

  it('initial render: parentTheme="base" + isDark=true → surface has data-theme="dark"', () => {
    const { container } = mountPane({ parentTheme: 'base', isDark: true });
    expect(surface(container).getAttribute('data-theme')).toBe('dark');
  });

  it('clicking the Dark mode button SWAPS data-theme from absent → "dark"', async () => {
    // The 0.22.0 bug: the click updated previewMode ref but data-theme
    // stayed hardcoded to parentTheme. This test would have FAILED on 0.22.0.
    const { container } = mountPane({ parentTheme: 'base', isDark: false });
    expect(surface(container).hasAttribute('data-theme')).toBe(false);

    await fireEvent.click(modeButton(container, 'Dark'));
    expect(surface(container).getAttribute('data-theme')).toBe('dark');
  });

  it('clicking the Light mode button SWAPS data-theme from "dark" → absent', async () => {
    const { container } = mountPane({ parentTheme: 'base', isDark: true });
    expect(surface(container).getAttribute('data-theme')).toBe('dark');

    await fireEvent.click(modeButton(container, 'Light'));
    expect(surface(container).hasAttribute('data-theme')).toBe(false);
  });

  it('agora family: Light → "agora", Dark → "agora-dark"', async () => {
    const { container } = mountPane({ parentTheme: 'agora', isDark: false });
    expect(surface(container).getAttribute('data-theme')).toBe('agora');

    await fireEvent.click(modeButton(container, 'Dark'));
    expect(surface(container).getAttribute('data-theme')).toBe('agora-dark');

    await fireEvent.click(modeButton(container, 'Light'));
    expect(surface(container).getAttribute('data-theme')).toBe('agora');
  });

  it('agora-dark parent: Light → "agora" (the family\'s light variant)', () => {
    // Editing a dark theme — the Light preview should show the family's
    // light variant. Same toggle, opposite direction.
    const { container } = mountPane({ parentTheme: 'agora-dark', isDark: true });
    expect(surface(container).getAttribute('data-theme')).toBe('agora-dark');
  });

  it('agora-dark parent + Light click → "agora" (family-aware swap)', async () => {
    const { container } = mountPane({ parentTheme: 'agora-dark', isDark: true });
    await fireEvent.click(modeButton(container, 'Light'));
    expect(surface(container).getAttribute('data-theme')).toBe('agora');
  });

  it('generics family: light and dark both → "generics" (single-variant)', async () => {
    const { container } = mountPane({ parentTheme: 'generics', isDark: true });
    expect(surface(container).getAttribute('data-theme')).toBe('generics');

    await fireEvent.click(modeButton(container, 'Light'));
    expect(surface(container).getAttribute('data-theme')).toBe('generics');
  });

  it('unknown parent (e.g. cpub-custom-foo) falls back to base/dark variants', async () => {
    const { container } = mountPane({ parentTheme: 'cpub-custom-foo', isDark: false });
    // Custom-theme parent — map lookup falls back to base. Light = no attr.
    expect(surface(container).hasAttribute('data-theme')).toBe(false);

    await fireEvent.click(modeButton(container, 'Dark'));
    expect(surface(container).getAttribute('data-theme')).toBe('dark');
  });

  it('mode toggle reflects active state visually (aria-checked + class)', async () => {
    const { container } = mountPane({ parentTheme: 'base', isDark: false });
    const lightBtn = modeButton(container, 'Light');
    const darkBtn = modeButton(container, 'Dark');

    expect(lightBtn.getAttribute('aria-checked')).toBe('true');
    expect(darkBtn.getAttribute('aria-checked')).toBe('false');
    expect(lightBtn.classList.contains('active')).toBe(true);

    await fireEvent.click(darkBtn);

    expect(lightBtn.getAttribute('aria-checked')).toBe('false');
    expect(darkBtn.getAttribute('aria-checked')).toBe('true');
    expect(darkBtn.classList.contains('active')).toBe(true);
  });
});

// ---- Token-style override application -------------------------------

describe('AdminThemePreviewPane — inline token application', () => {
  it('user tokens render as inline CSS custom properties on the surface', () => {
    const { container } = mountPane({
      parentTheme: 'base',
      isDark: false,
      tokens: { accent: '#ff00ff', bg: '#fafafa' },
    });
    const style = surface(container).getAttribute('style') ?? '';
    expect(style).toContain('--accent: #ff00ff');
    expect(style).toContain('--bg: #fafafa');
  });

  it('non-string token values are dropped defensively (no NaN/undefined in style)', () => {
    const { container } = mountPane({
      parentTheme: 'base',
      isDark: false,
      tokens: { accent: '#ff00ff', bad: 42 as unknown as string },
    });
    const style = surface(container).getAttribute('style') ?? '';
    expect(style).toContain('--accent: #ff00ff');
    expect(style).not.toContain('--bad');
  });

  it('disallowed characters in token key are stripped', () => {
    const { container } = mountPane({
      parentTheme: 'base',
      isDark: false,
      tokens: { 'accent;color:red': '#ff00ff' } as Record<string, string>,
    });
    const style = surface(container).getAttribute('style') ?? '';
    // Sanitized to `--accentcolorred`
    expect(style).toContain('--accentcolorred');
    expect(style).not.toContain(';color:red');
  });
});

// ---- Scene picker ---------------------------------------------------

describe('AdminThemePreviewPane — scene picker', () => {
  it('renders Components scene by default', () => {
    const { getByTestId, queryByTestId } = mountPane({ parentTheme: 'base', isDark: false });
    expect(getByTestId('scene-gallery')).toBeTruthy();
    expect(queryByTestId('scene-prose')).toBeNull();
    expect(queryByTestId('scene-admin')).toBeNull();
  });

  it('clicking Article tab swaps to prose scene', async () => {
    const { container, getByTestId, queryByTestId } = mountPane({ parentTheme: 'base', isDark: false });
    const tabs = container.querySelectorAll('.theme-preview-scene-tab');
    // Tabs are: Components / Article / Admin shell — Article is index 1
    await fireEvent.click(tabs[1]!);
    expect(getByTestId('scene-prose')).toBeTruthy();
    expect(queryByTestId('scene-gallery')).toBeNull();
  });

  it('clicking Admin shell tab swaps to admin scene', async () => {
    const { container, getByTestId, queryByTestId } = mountPane({ parentTheme: 'base', isDark: false });
    const tabs = container.querySelectorAll('.theme-preview-scene-tab');
    await fireEvent.click(tabs[2]!);
    expect(getByTestId('scene-admin')).toBeTruthy();
    expect(queryByTestId('scene-gallery')).toBeNull();
  });
});
