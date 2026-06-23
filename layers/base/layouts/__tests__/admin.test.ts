/**
 * Chrome-gating tests for the admin layout.
 *
 * The sidebar nav links are gated with useCan('<perm>') matching each route's
 * server requirePermission. With the RBAC flag OFF, useCan returns true for
 * admins (admin floor) so every link shows; a non-admin with a partial grant
 * set sees only the links they hold. These tests drive useCan directly with a
 * controllable permission set and assert the rendered links.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/vue';
import { defineComponent, h, ref, computed } from 'vue';

// Controllable permission set for the stubbed useCan.
let granted = new Set<string>();
let adminFloor = false;

Object.assign(globalThis, {
  useAuth: () => ({ isAdmin: ref(adminFloor) }),
  useFeatures: () => ({ admin: ref(true), layoutEngine: ref(true), publicApi: ref(true) }),
  useRuntimeConfig: () => ({ public: { siteName: 'Test Site' } }),
  useAdminSidebar: () => ({
    desktopCollapsed: ref(false),
    mobileOpen: ref(false),
    toggleDesktop: vi.fn(),
    toggleMobile: vi.fn(),
    closeMobile: vi.fn(),
  }),
  // Mirrors the real useCan contract: admin floor passes everything, else
  // membership in the granted set.
  useCan: (key: string) => computed(() => adminFloor || granted.has(key)),
});

import AdminLayout from '../admin.vue';

const NuxtLink = defineComponent({
  name: 'NuxtLink',
  props: { to: [String, Object], title: String, ariaLabel: String },
  setup(props, { slots }) {
    return () => h('a', { href: typeof props.to === 'string' ? props.to : '#' }, slots.default?.());
  },
});

function mountAdmin() {
  return render(AdminLayout, {
    global: { stubs: { NuxtLink } },
  });
}

describe('admin layout chrome gating', () => {
  beforeEach(() => {
    granted = new Set<string>();
    adminFloor = false;
  });

  it('hides a nav link when the viewer lacks its permission', () => {
    granted = new Set(['users.read']); // only Users
    mountAdmin();
    expect(screen.getByText('Users')).toBeInTheDocument();
    // Roles needs roles.manage, which is not granted → hidden.
    expect(screen.queryByText('Roles')).not.toBeInTheDocument();
    // Federation needs federation.manage → hidden.
    expect(screen.queryByText('Federation')).not.toBeInTheDocument();
  });

  it('shows a nav link when the viewer holds its permission', () => {
    granted = new Set(['roles.manage', 'federation.manage']);
    mountAdmin();
    expect(screen.getByText('Roles')).toBeInTheDocument();
    expect(screen.getByText('Federation')).toBeInTheDocument();
    // Users not granted → hidden.
    expect(screen.queryByText('Users')).not.toBeInTheDocument();
  });

  it('admin floor (useCan true for everything) shows the full chrome', () => {
    adminFloor = true;
    mountAdmin();
    for (const label of ['Dashboard', 'Users', 'Roles', 'Content', 'Categories', 'Video Categories', 'Reports', 'Audit Log', 'Theme', 'Homepage', 'Navigation', 'Features', 'Federation', 'Settings']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });
});
