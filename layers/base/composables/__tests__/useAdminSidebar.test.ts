/**
 * Tests for useAdminSidebar — the admin chrome sidebar state machine.
 *
 * After the audit-polish refactor (session 161 round 2), userPref persists
 * via `useCookie` (not localStorage) — this eliminates the SSR/CSR hydration
 * flash where the sidebar would start expanded then snap to collapsed on
 * the first client tick. Tests mock `useCookie` to a ref-backed shim.
 *
 * Coverage:
 *   - Default state (not collapsed) when no cookie + non-editor route
 *   - Cookie-backed userPref hydrates correctly on first render
 *   - Toggle on non-editor route updates the cookie (which Nuxt syncs)
 *   - Editor routes auto-collapse without writing the cookie
 *   - Session override on editor route survives within the route, resets
 *     on route change
 *   - Mobile drawer state independent of desktop collapse
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref, nextTick, type Ref } from 'vue';
import { useAdminSidebar } from '../useAdminSidebar';

// Nuxt auto-imports we shim: useRoute, useState, useCookie.
// (Vue's primitives come from test-setup.ts.)
const routePath = ref('/admin');
const useRouteMock = vi.fn(() => ({
  get path() { return routePath.value; },
}));

// useState is a globally-keyed singleton in Nuxt; tests need a fresh store
// per test so the composable doesn't carry state across cases. Hand back
// real Vue refs — `computed` only tracks real refs, not plain `{ value }`.
let stateStore: Map<string, Ref<unknown>>;
const useStateMock = vi.fn(<T>(key: string, init: () => T) => {
  if (!stateStore.has(key)) stateStore.set(key, ref(init()) as Ref<unknown>);
  return stateStore.get(key) as Ref<T>;
});

// useCookie shim: ref-backed, mirrors the Nuxt API surface we use
// (key + { default } → Ref). Cookie store reset per test.
let cookieStore: Map<string, Ref<unknown>>;
const useCookieMock = vi.fn(<T>(key: string, opts?: { default?: () => T }) => {
  if (!cookieStore.has(key)) {
    cookieStore.set(key, ref(opts?.default?.() ?? null) as Ref<unknown>);
  }
  return cookieStore.get(key) as Ref<T>;
});

const g = globalThis as Record<string, unknown>;

beforeEach(() => {
  stateStore = new Map();
  cookieStore = new Map();
  routePath.value = '/admin';
  g.useRoute = useRouteMock;
  g.useState = useStateMock;
  g.useCookie = useCookieMock;
});

afterEach(() => {
  // vi.clearAllMocks() — clears call history but preserves implementations.
  // vi.restoreAllMocks() would wipe the module-level mocks (vi.fn(impl)),
  // breaking every subsequent test in the file.
  vi.clearAllMocks();
  delete g.useRoute;
  delete g.useState;
  delete g.useCookie;
});

describe('useAdminSidebar — defaults', () => {
  it('is not collapsed on /admin with no cookie', () => {
    const s = useAdminSidebar();
    expect(s.desktopCollapsed.value).toBe(false);
    expect(s.isEditorRoute.value).toBe(false);
    expect(s.mobileOpen.value).toBe(false);
  });

  it('uses the cookie default function (false) when cookie not set', () => {
    const s = useAdminSidebar();
    expect(cookieStore.get('cpub-admin-sidebar-collapsed')?.value).toBe(false);
    expect(s.desktopCollapsed.value).toBe(false);
  });
});

describe('useAdminSidebar — cookie-backed userPref', () => {
  it('hydrates userPref=true from the cookie (no flash — SSR sees the value)', () => {
    // Pre-seed the cookie BEFORE constructing the composable, mimicking
    // a request that arrives with a Cookie: header.
    cookieStore.set('cpub-admin-sidebar-collapsed', ref(true));
    const s = useAdminSidebar();
    expect(s.desktopCollapsed.value).toBe(true);
  });

  it('hydrates userPref=false from the cookie', () => {
    cookieStore.set('cpub-admin-sidebar-collapsed', ref(false));
    const s = useAdminSidebar();
    expect(s.desktopCollapsed.value).toBe(false);
  });
});

describe('useAdminSidebar — toggle on non-editor route persists via cookie', () => {
  it('updates the cookie ref on toggle-to-collapsed', () => {
    const s = useAdminSidebar();
    expect(s.desktopCollapsed.value).toBe(false);
    s.toggleDesktop();
    expect(s.desktopCollapsed.value).toBe(true);
    expect(cookieStore.get('cpub-admin-sidebar-collapsed')?.value).toBe(true);
  });

  it('toggles back to false on the second click', () => {
    const s = useAdminSidebar();
    s.toggleDesktop(); // → true
    s.toggleDesktop(); // → false
    expect(s.desktopCollapsed.value).toBe(false);
    expect(cookieStore.get('cpub-admin-sidebar-collapsed')?.value).toBe(false);
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

  it('toggle on editor route uses session override, does NOT touch the cookie', () => {
    routePath.value = '/admin/layouts/L1';
    const s = useAdminSidebar();
    expect(s.desktopCollapsed.value).toBe(true); // auto-collapsed
    s.toggleDesktop(); // expand manually for this visit
    expect(s.desktopCollapsed.value).toBe(false);
    expect(cookieStore.get('cpub-admin-sidebar-collapsed')?.value).toBe(false); // still default
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
