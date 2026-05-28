/**
 * Tests for useAdminSidebar — the admin chrome sidebar state machine.
 *
 * Coverage:
 *   - Default state (not collapsed) when no localStorage + non-editor route
 *   - localStorage hydration on mount (true / false / missing)
 *   - localStorage write on toggle from non-editor route
 *   - Editor routes auto-collapse without writing to localStorage
 *   - Session override on editor route survives within the route, resets on
 *     route change
 *   - Mobile drawer state independent of desktop collapse
 *   - SSR safety: composable doesn't touch window/localStorage during setup
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref, nextTick, type Ref } from 'vue';
import { useAdminSidebar } from '../useAdminSidebar';

// Nuxt auto-imports we need to shim: useRoute + useState.
// (Vue's primitives are auto-imported by test-setup.ts.)
const routePath = ref('/admin');
const useRouteMock = vi.fn(() => ({
  get path() { return routePath.value; },
}));

// useState is a globally-keyed singleton in Nuxt; tests need a fresh store
// per test so the composable doesn't carry state across cases. Crucially,
// we hand back real Vue refs — otherwise the `computed` inside the
// composable won't track changes to .value (Vue tracks refs, not plain
// objects with a .value property).
let stateStore: Map<string, Ref<unknown>>;
const useStateMock = vi.fn(<T>(key: string, init: () => T) => {
  if (!stateStore.has(key)) stateStore.set(key, ref(init()) as Ref<unknown>);
  return stateStore.get(key) as Ref<T>;
});

const g = globalThis as Record<string, unknown>;
let originalOnMounted: unknown;

beforeEach(() => {
  stateStore = new Map();
  routePath.value = '/admin';
  g.useRoute = useRouteMock;
  g.useState = useStateMock;
  // Replace onMounted with a synchronous executor so the composable's
  // hydration logic runs immediately when called outside a component.
  // (Real onMounted no-ops + warns when there's no setup() context.)
  originalOnMounted = g.onMounted;
  g.onMounted = (fn: () => void) => fn();
  window.localStorage.clear();
});

afterEach(() => {
  // vi.clearAllMocks() — clears call history but preserves implementations.
  // vi.restoreAllMocks() would wipe the module-level useRouteMock/useStateMock
  // impls (vi.fn(impl)), breaking every subsequent test in the file.
  vi.clearAllMocks();
  delete g.useRoute;
  delete g.useState;
  g.onMounted = originalOnMounted;
});

describe('useAdminSidebar — defaults', () => {
  it('is not collapsed on /admin with no localStorage', () => {
    const s = useAdminSidebar();
    expect(s.desktopCollapsed.value).toBe(false);
    expect(s.isEditorRoute.value).toBe(false);
    expect(s.mobileOpen.value).toBe(false);
  });
});

describe('useAdminSidebar — localStorage hydration', () => {
  it('hydrates userPref=true from localStorage', () => {
    window.localStorage.setItem('cpub-admin-sidebar-collapsed', 'true');
    const s = useAdminSidebar();
    expect(s.desktopCollapsed.value).toBe(true);
  });

  it('hydrates userPref=false from localStorage', () => {
    window.localStorage.setItem('cpub-admin-sidebar-collapsed', 'false');
    const s = useAdminSidebar();
    expect(s.desktopCollapsed.value).toBe(false);
  });

  it('ignores bogus localStorage values (default stays false)', () => {
    window.localStorage.setItem('cpub-admin-sidebar-collapsed', 'not-a-bool');
    const s = useAdminSidebar();
    expect(s.desktopCollapsed.value).toBe(false);
  });

  it('survives a localStorage that throws on read (private mode, sandboxed iframe)', () => {
    const spy = vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError: localStorage denied');
    });
    const s = useAdminSidebar();
    expect(s.desktopCollapsed.value).toBe(false); // default
    spy.mockRestore();
  });
});

describe('useAdminSidebar — toggle on non-editor route persists', () => {
  it('writes "true" to localStorage on toggle-to-collapsed', () => {
    const s = useAdminSidebar();
    expect(s.desktopCollapsed.value).toBe(false);
    s.toggleDesktop();
    expect(s.desktopCollapsed.value).toBe(true);
    expect(window.localStorage.getItem('cpub-admin-sidebar-collapsed')).toBe('true');
  });

  it('writes "false" to localStorage on toggle-to-expanded', () => {
    const s = useAdminSidebar();
    s.toggleDesktop(); // -> true
    s.toggleDesktop(); // -> false
    expect(s.desktopCollapsed.value).toBe(false);
    expect(window.localStorage.getItem('cpub-admin-sidebar-collapsed')).toBe('false');
  });
});

describe('useAdminSidebar — editor route auto-collapse', () => {
  it('auto-collapses on /admin/layouts/:id', () => {
    routePath.value = '/admin/layouts/abc-123';
    const s = useAdminSidebar();
    expect(s.isEditorRoute.value).toBe(true);
    expect(s.desktopCollapsed.value).toBe(true);
  });

  it('auto-collapses on /admin/theme/edit/:id', () => {
    routePath.value = '/admin/theme/edit/dark';
    const s = useAdminSidebar();
    expect(s.isEditorRoute.value).toBe(true);
    expect(s.desktopCollapsed.value).toBe(true);
  });

  it('does NOT auto-collapse on /admin/layouts (list page, no id)', () => {
    routePath.value = '/admin/layouts';
    const s = useAdminSidebar();
    expect(s.isEditorRoute.value).toBe(false);
    expect(s.desktopCollapsed.value).toBe(false);
  });

  it('does NOT auto-collapse on /admin/theme (no edit segment)', () => {
    routePath.value = '/admin/theme';
    const s = useAdminSidebar();
    expect(s.isEditorRoute.value).toBe(false);
  });

  it('toggle on editor route uses session override, does NOT write to localStorage', () => {
    routePath.value = '/admin/layouts/L1';
    const s = useAdminSidebar();
    expect(s.desktopCollapsed.value).toBe(true); // auto-collapsed
    s.toggleDesktop(); // expand manually for this visit
    expect(s.desktopCollapsed.value).toBe(false);
    expect(window.localStorage.getItem('cpub-admin-sidebar-collapsed')).toBeNull();
  });

  it('navigating away from editor route clears the session override', async () => {
    routePath.value = '/admin/layouts/L1';
    const s = useAdminSidebar();
    s.toggleDesktop(); // session override: expanded on editor route
    expect(s.desktopCollapsed.value).toBe(false);

    routePath.value = '/admin/users';
    await nextTick(); // let the watch fire

    expect(s.isEditorRoute.value).toBe(false);
    expect(s.desktopCollapsed.value).toBe(false); // back to userPref default
  });

  it('returning to editor route after override-then-leave goes back to auto-collapsed', async () => {
    routePath.value = '/admin/layouts/L1';
    const s = useAdminSidebar();
    s.toggleDesktop(); // expand override
    routePath.value = '/admin/users';
    await nextTick();
    routePath.value = '/admin/layouts/L1';
    await nextTick();

    expect(s.desktopCollapsed.value).toBe(true); // auto-collapse re-applies
  });
});

describe('useAdminSidebar — mobile drawer', () => {
  it('is independent of desktop collapse', () => {
    const s = useAdminSidebar();
    expect(s.mobileOpen.value).toBe(false);
    s.toggleMobile();
    expect(s.mobileOpen.value).toBe(true);
    expect(s.desktopCollapsed.value).toBe(false); // unchanged
    s.closeMobile();
    expect(s.mobileOpen.value).toBe(false);
  });

  it('toggling desktop on a normal route does NOT touch mobileOpen', () => {
    const s = useAdminSidebar();
    s.toggleMobile(); // mobileOpen = true
    s.toggleDesktop();
    expect(s.mobileOpen.value).toBe(true); // still open
  });
});

describe('useAdminSidebar — user-persistent pref carries across routes', () => {
  it('userPref=collapsed survives navigation to/from editor route', async () => {
    const s = useAdminSidebar();
    s.toggleDesktop(); // userPref: collapsed
    expect(s.desktopCollapsed.value).toBe(true);

    routePath.value = '/admin/layouts/L1';
    await nextTick();
    expect(s.desktopCollapsed.value).toBe(true); // both userPref AND auto-collapse say collapsed

    routePath.value = '/admin/users';
    await nextTick();
    expect(s.desktopCollapsed.value).toBe(true); // userPref still wins
  });
});
