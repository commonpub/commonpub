/**
 * useAdminSidebar — state machine for the admin chrome's left sidebar.
 *
 * Two independent surfaces:
 *   1. Desktop (≥768px): width can collapse from 200px to ~56px (icons-only).
 *      The user's preference is persisted to localStorage. Editor routes
 *      (`/admin/layouts/[id]`, `/admin/theme/edit/[id]`) auto-collapse to
 *      give the canvas more room; the user can override that for the
 *      current page visit only.
 *   2. Mobile (<768px): drawer that slides in from the left, independent
 *      of the desktop collapse state. Closes when a nav link is clicked.
 *
 * Design (mirrors Linear/Figma/Notion editor-mode patterns):
 *   - userPref       — persisted boolean; the user's "default" collapsed state
 *   - sessionOverride — null | boolean; non-null only when the user manually
 *                       toggled while on an editor route. Resets on route
 *                       change so leaving the editor returns to userPref.
 *   - desktopCollapsed (computed):
 *       sessionOverride ?? (isEditorRoute ? true : userPref)
 *
 * Tests live in `__tests__/useAdminSidebar.test.ts` — cover hydration,
 * route-aware override, toggle persistence, and the mobile/desktop split.
 *
 * Wired into `layers/base/layouts/admin.vue` only.
 */

const STORAGE_KEY = 'cpub-admin-sidebar-collapsed';

const EDITOR_ROUTE_PATTERNS: RegExp[] = [
  /^\/admin\/layouts\/[^/]+$/, // /admin/layouts/[id] — Phase 3a layout editor
  /^\/admin\/theme\/edit\/[^/]+$/, // /admin/theme/edit/[id] — session 154+156 theme editor
];

export interface AdminSidebarApi {
  /** Final computed: is the desktop sidebar collapsed right now? */
  desktopCollapsed: ComputedRef<boolean>;
  /** Mobile drawer open state. Independent of desktop. */
  mobileOpen: Ref<boolean>;
  /** Whether the current route is one we auto-collapse for. Exposed for callers that want to label things. */
  isEditorRoute: ComputedRef<boolean>;
  /** Toggle desktop collapse. On editor routes: session-only. Off editor routes: persists to localStorage. */
  toggleDesktop: () => void;
  /** Toggle mobile drawer. */
  toggleMobile: () => void;
  /** Close mobile drawer (used by nav link click handlers). */
  closeMobile: () => void;
}

export function useAdminSidebar(): AdminSidebarApi {
  const route = useRoute();

  // Use Nuxt's useState so the layout's collapse + override survive page
  // navigations within the admin area (the layout itself stays mounted, but
  // useState makes the pattern explicit + testable).
  const userPref = useState<boolean>('cpub-admin-sidebar-pref', () => false);
  const sessionOverride = useState<boolean | null>('cpub-admin-sidebar-override', () => null);
  const mobileOpen = useState<boolean>('cpub-admin-sidebar-mobile-open', () => false);

  const isEditorRoute = computed<boolean>(() =>
    EDITOR_ROUTE_PATTERNS.some((p) => p.test(route.path))
  );

  const desktopCollapsed = computed<boolean>(() => {
    if (sessionOverride.value !== null) return sessionOverride.value;
    return isEditorRoute.value ? true : userPref.value;
  });

  // Hydrate userPref from localStorage on the client. Done in onMounted to
  // avoid the SSR/CSR hydration mismatch (server-rendered HTML always uses
  // the default `false`; first client tick reconciles).
  // Using `typeof window` rather than `import.meta.client` so the composable
  // works in vitest (where `import.meta.client` is undefined, not a built-in
  // Nuxt replacement) as well as in Nuxt SSR/CSR.
  onMounted(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === 'true') userPref.value = true;
      else if (stored === 'false') userPref.value = false;
    } catch {
      // localStorage can throw in private mode / iframe sandboxing — swallow
    }
  });

  // Route change clears the session override so leaving the editor route
  // returns the sidebar to the user's persistent preference.
  watch(() => route.path, () => {
    sessionOverride.value = null;
  });

  function toggleDesktop(): void {
    const next = !desktopCollapsed.value;
    if (isEditorRoute.value) {
      sessionOverride.value = next;
      return;
    }
    userPref.value = next;
    sessionOverride.value = null;
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // ignore — same reasoning as hydrate
      }
    }
  }

  function toggleMobile(): void {
    mobileOpen.value = !mobileOpen.value;
  }

  function closeMobile(): void {
    mobileOpen.value = false;
  }

  return { desktopCollapsed, mobileOpen, isEditorRoute, toggleDesktop, toggleMobile, closeMobile };
}
