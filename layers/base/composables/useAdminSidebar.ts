/**
 * useAdminSidebar — state machine for the admin chrome's left sidebar.
 *
 * Two independent surfaces:
 *   1. Desktop (≥768px): width can collapse from 200px to ~56px (icons-only).
 *      The user's preference is persisted to a cookie. Editor routes
 *      (`/admin/layouts/[id]`, `/admin/theme/edit/[id]`) auto-collapse to
 *      give the canvas more room; the user can override that for the
 *      current page visit only.
 *   2. Mobile (<768px): drawer that slides in from the left, independent
 *      of the desktop collapse state. Closes when a nav link is clicked.
 *
 * Design (mirrors Linear/Figma/Notion editor-mode patterns):
 *   - userPref       — persisted boolean (cookie); the user's "default"
 *                      collapsed state. Cookie chosen over localStorage
 *                      so SSR renders correctly first time — no
 *                      hydration flash where the sidebar starts expanded
 *                      and then snaps to collapsed once the client tick
 *                      reads storage. Matches `useTheme`'s pattern.
 *   - sessionOverride — null | boolean; non-null only when the user manually
 *                       toggled while on an editor route. Resets on route
 *                       change so leaving the editor returns to userPref.
 *   - desktopCollapsed (computed):
 *       sessionOverride ?? (isEditorRoute ? true : userPref)
 *
 * Tests live in `__tests__/useAdminSidebar.test.ts` — cover SSR-safe
 * hydration via mocked cookie, route-aware override, toggle persistence,
 * and the mobile/desktop split.
 *
 * Wired into `layers/base/layouts/admin.vue` only.
 *
 * Sub-route caveat: `EDITOR_ROUTE_PATTERNS` use `$` end-anchors so
 * `/admin/layouts/abc/preview` would NOT auto-collapse. Today no editor
 * has sub-routes; if Phase 3b+ adds them, extend the regexes or use
 * `startsWith` semantics.
 */

const COOKIE_KEY = 'cpub-admin-sidebar-collapsed';

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

  // Persistent user pref: cookie (server-readable → no hydration flash).
  // `useCookie` returns a Ref bound bidirectionally to the cookie; setting
  // `.value` writes Set-Cookie on the next SSR response or updates
  // document.cookie on the client. Default = false (expanded). The cookie
  // is only created when the user actually toggles (Nuxt useCookie doesn't
  // emit Set-Cookie for unchanged default values).
  const userPref = useCookie<boolean>(COOKIE_KEY, {
    default: () => false,
    maxAge: 60 * 60 * 24 * 365, // 1 year — sidebar pref is "forever"
    path: '/',
    sameSite: 'lax',
  });

  // Transient: useState so it survives in-layout navigation but doesn't
  // persist across page reloads (it's a per-visit override).
  const sessionOverride = useState<boolean | null>('cpub-admin-sidebar-override', () => null);
  const mobileOpen = useState<boolean>('cpub-admin-sidebar-mobile-open', () => false);

  const isEditorRoute = computed<boolean>(() =>
    EDITOR_ROUTE_PATTERNS.some((p) => p.test(route.path))
  );

  const desktopCollapsed = computed<boolean>(() => {
    if (sessionOverride.value !== null) return sessionOverride.value;
    return isEditorRoute.value ? true : userPref.value;
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
    // No explicit storage write — `useCookie` syncs automatically.
  }

  function toggleMobile(): void {
    mobileOpen.value = !mobileOpen.value;
  }

  function closeMobile(): void {
    mobileOpen.value = false;
  }

  return { desktopCollapsed, mobileOpen, isEditorRoute, toggleDesktop, toggleMobile, closeMobile };
}
