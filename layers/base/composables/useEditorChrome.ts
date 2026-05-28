/**
 * useEditorChrome — palette + inspector visibility for the layout editor.
 *
 * User-reported: the editor's 3-column shell (palette ~280px / canvas /
 * inspector ~320px) squishes the canvas to ~tablet width even on a wide
 * desktop. Content cards in the preview clipped mid-word ("VIDEO/AYBACK
 * SYSTE"). Fix is to let the admin hide either pane independently.
 *
 * Each visibility flag persists via cookie (matches `useAdminSidebar` +
 * `useTheme` — no SSR/CSR hydration flash; Nuxt's `useCookie` reads the
 * cookie on the server). Cookie is only emitted when the user toggles —
 * Nuxt skips Set-Cookie for unchanged defaults.
 *
 * Wired into `pages/admin/layouts/[id].vue` (the editor shell) + the
 * toggle buttons in `components/admin/layouts/AdminLayoutsToolbar.vue`.
 *
 * Pattern: v-show on the panels themselves (preserves component state +
 * scroll/focus across toggles) + a `cpub-admin-layouts-editor-body--*`
 * class on the parent grid (re-flows `grid-template-columns`).
 */

const PALETTE_COOKIE = 'cpub-editor-palette-hidden';
const INSPECTOR_COOKIE = 'cpub-editor-inspector-hidden';

export interface EditorChromeApi {
  paletteHidden: Ref<boolean>;
  inspectorHidden: Ref<boolean>;
  togglePalette: () => void;
  toggleInspector: () => void;
}

export function useEditorChrome(): EditorChromeApi {
  const paletteHidden = useCookie<boolean>(PALETTE_COOKIE, {
    default: () => false,
    maxAge: 60 * 60 * 24 * 365, // 1 year
    path: '/',
    sameSite: 'lax',
  });

  const inspectorHidden = useCookie<boolean>(INSPECTOR_COOKIE, {
    default: () => false,
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
    sameSite: 'lax',
  });

  function togglePalette(): void {
    paletteHidden.value = !paletteHidden.value;
  }

  function toggleInspector(): void {
    inspectorHidden.value = !inspectorHidden.value;
  }

  return { paletteHidden, inspectorHidden, togglePalette, toggleInspector };
}
