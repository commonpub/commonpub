<script setup lang="ts">
const { isAdmin } = useAuth();
const { admin: adminEnabled, layoutEngine } = useFeatures();
const runtimeConfig = useRuntimeConfig();
const siteName = computed(() => (runtimeConfig.public.siteName as string) || 'CommonPub');

// Sidebar state (desktop collapse + mobile drawer) — see useAdminSidebar.ts.
// Editor routes (/admin/layouts/[id], /admin/theme/edit/[id]) auto-collapse
// so the editor canvas gets more horizontal room; user can override per visit.
const { desktopCollapsed, mobileOpen, toggleDesktop, toggleMobile, closeMobile } = useAdminSidebar();
</script>

<template>
  <div v-if="!adminEnabled" class="admin-denied">
    <h1>Not Available</h1>
    <p>The admin panel is not enabled on this instance.</p>
  </div>
  <div v-else class="admin-layout">
    <header class="admin-topbar">
      <div class="admin-topbar-inner">
        <button
          class="admin-menu-btn"
          :aria-label="mobileOpen ? 'Close menu' : 'Open menu'"
          :aria-expanded="mobileOpen"
          aria-controls="admin-sidebar-nav"
          @click="toggleMobile"
        >
          <i :class="mobileOpen ? 'fa-solid fa-xmark' : 'fa-solid fa-bars'"></i>
        </button>
        <button
          class="admin-collapse-btn"
          :aria-label="desktopCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
          :aria-expanded="!desktopCollapsed"
          aria-controls="admin-sidebar-nav"
          :title="desktopCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
          @click="toggleDesktop"
        >
          <i :class="desktopCollapsed ? 'fa-solid fa-angles-right' : 'fa-solid fa-angles-left'"></i>
        </button>
        <NuxtLink to="/" class="admin-brand">{{ siteName }}</NuxtLink>
        <span class="admin-badge">Admin</span>
        <NuxtLink to="/" class="admin-back"><i class="fa-solid fa-arrow-left"></i> Back to site</NuxtLink>
      </div>
    </header>

    <div class="admin-body">
      <aside
        id="admin-sidebar-nav"
        class="admin-sidebar"
        :class="{ 'admin-sidebar--collapsed': desktopCollapsed, 'admin-sidebar--mobile-open': mobileOpen }"
        aria-label="Admin navigation"
      >
        <nav class="admin-nav">
          <!--
            Nav link pattern: icon + visible label. When collapsed, label text
            stays in the DOM (clip-path) so screen readers still announce
            "Dashboard, link", the icon alone has no accessible name.
            `title` attr only set when collapsed → visual tooltip on hover.
          -->
          <NuxtLink to="/admin" class="admin-nav-link" :title="desktopCollapsed ? 'Dashboard' : undefined" @click="closeMobile">
            <i class="fa-solid fa-gauge"></i><span class="admin-nav-label">Dashboard</span>
          </NuxtLink>
          <NuxtLink to="/admin/users" class="admin-nav-link" :title="desktopCollapsed ? 'Users' : undefined" @click="closeMobile">
            <i class="fa-solid fa-users"></i><span class="admin-nav-label">Users</span>
          </NuxtLink>
          <NuxtLink to="/admin/roles" class="admin-nav-link" :title="desktopCollapsed ? 'Roles' : undefined" @click="closeMobile">
            <i class="fa-solid fa-user-shield"></i><span class="admin-nav-label">Roles</span>
          </NuxtLink>
          <NuxtLink to="/admin/content" class="admin-nav-link" :title="desktopCollapsed ? 'Content' : undefined" @click="closeMobile">
            <i class="fa-solid fa-newspaper"></i><span class="admin-nav-label">Content</span>
          </NuxtLink>
          <NuxtLink to="/admin/categories" class="admin-nav-link" :title="desktopCollapsed ? 'Categories' : undefined" @click="closeMobile">
            <i class="fa-solid fa-tags"></i><span class="admin-nav-label">Categories</span>
          </NuxtLink>
          <NuxtLink to="/admin/reports" class="admin-nav-link" :title="desktopCollapsed ? 'Reports' : undefined" @click="closeMobile">
            <i class="fa-solid fa-flag"></i><span class="admin-nav-label">Reports</span>
          </NuxtLink>
          <NuxtLink to="/admin/audit" class="admin-nav-link" :title="desktopCollapsed ? 'Audit Log' : undefined" @click="closeMobile">
            <i class="fa-solid fa-clipboard-list"></i><span class="admin-nav-label">Audit Log</span>
          </NuxtLink>
          <NuxtLink to="/admin/theme" class="admin-nav-link" :title="desktopCollapsed ? 'Theme' : undefined" @click="closeMobile">
            <i class="fa-solid fa-palette"></i><span class="admin-nav-label">Theme</span>
          </NuxtLink>
          <NuxtLink to="/admin/homepage" class="admin-nav-link" :title="desktopCollapsed ? 'Homepage' : undefined" @click="closeMobile">
            <i class="fa-solid fa-house"></i><span class="admin-nav-label">Homepage</span>
          </NuxtLink>
          <!-- Layouts editor — gated on layoutEngine feature flag (CLAUDE.md rule #2).
               Stays invisible until the operator flips the flag, then appears between
               the legacy /admin/homepage editor and Navigation. Phase 3a, session 160 audit. -->
          <NuxtLink v-if="layoutEngine" to="/admin/layouts" class="admin-nav-link" :title="desktopCollapsed ? 'Layouts' : undefined" @click="closeMobile">
            <i class="fa-solid fa-table-cells-large"></i><span class="admin-nav-label">Layouts</span>
          </NuxtLink>
          <NuxtLink to="/admin/navigation" class="admin-nav-link" :title="desktopCollapsed ? 'Navigation' : undefined" @click="closeMobile">
            <i class="fa-solid fa-bars"></i><span class="admin-nav-label">Navigation</span>
          </NuxtLink>
          <NuxtLink to="/admin/features" class="admin-nav-link" :title="desktopCollapsed ? 'Features' : undefined" @click="closeMobile">
            <i class="fa-solid fa-toggle-on"></i><span class="admin-nav-label">Features</span>
          </NuxtLink>
          <NuxtLink to="/admin/federation" class="admin-nav-link" :title="desktopCollapsed ? 'Federation' : undefined" @click="closeMobile">
            <i class="fa-solid fa-globe"></i><span class="admin-nav-label">Federation</span>
          </NuxtLink>
          <NuxtLink to="/admin/api-keys" class="admin-nav-link" :title="desktopCollapsed ? 'API Keys' : undefined" @click="closeMobile">
            <i class="fa-solid fa-key"></i><span class="admin-nav-label">API Keys</span>
          </NuxtLink>
          <NuxtLink to="/admin/settings" class="admin-nav-link" :title="desktopCollapsed ? 'Settings' : undefined" @click="closeMobile">
            <i class="fa-solid fa-gear"></i><span class="admin-nav-label">Settings</span>
          </NuxtLink>
        </nav>
      </aside>

      <main class="admin-main">
        <div v-if="isAdmin">
          <slot />
        </div>
        <div v-else class="admin-denied">
          <h1>Access Denied</h1>
          <p>You need admin privileges to access this area.</p>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.admin-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-sans);
}

.admin-topbar {
  height: var(--nav-height);
  border-bottom: var(--border-width-default) solid var(--border);
  background: var(--surface);
  display: flex;
  align-items: center;
  padding: 0 var(--space-4);
  position: sticky;
  top: 0;
  z-index: 50;
}

.admin-topbar-inner {
  display: flex;
  align-items: center;
  width: 100%;
  gap: var(--space-3);
}

.admin-menu-btn,
.admin-collapse-btn {
  width: 36px;
  height: 36px;
  background: none;
  border: var(--border-width-default) solid var(--border);
  color: var(--text-dim);
  font-size: 14px;
  cursor: pointer;
  align-items: center;
  justify-content: center;
  transition: color var(--transition-default), border-color var(--transition-default), background var(--transition-default);
}

.admin-menu-btn:hover,
.admin-collapse-btn:hover {
  color: var(--accent);
  border-color: var(--accent);
  background: var(--accent-bg);
}

.admin-menu-btn:focus-visible,
.admin-collapse-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

/* Mobile drawer toggle — desktop hides it, mobile media query reveals. */
.admin-menu-btn { display: none; }
/* Desktop collapse toggle — desktop shows it, mobile media query hides. */
.admin-collapse-btn { display: flex; }

.admin-brand {
  font-weight: var(--font-weight-bold);
  font-size: var(--text-lg);
  color: var(--text);
  text-decoration: none;
}

.admin-badge {
  padding: var(--space-1) var(--space-2);
  background: var(--accent);
  color: var(--color-on-primary);
  font-size: var(--text-xs);
  font-weight: var(--font-weight-bold);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
}

.admin-back {
  margin-left: auto;
  color: var(--text-dim);
  text-decoration: none;
  font-size: var(--text-sm);
  display: flex;
  align-items: center;
  gap: 6px;
}

.admin-back:hover {
  color: var(--accent);
}

.admin-body {
  display: flex;
  flex: 1;
}

.admin-sidebar {
  width: var(--sidebar-width);
  border-right: var(--border-width-default) solid var(--border);
  background: var(--surface);
  padding: var(--space-4) var(--space-2);
  flex-shrink: 0;
  transition: width var(--transition-default);
  overflow: hidden; /* clip the labels as the width transitions */
}

.admin-sidebar--collapsed {
  width: var(--sidebar-width-collapsed);
}

.admin-nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.admin-nav-link {
  color: var(--text-dim);
  text-decoration: none;
  font-size: var(--text-sm);
  padding: var(--space-2) var(--space-3);
  display: flex;
  align-items: center;
  gap: 10px;
  white-space: nowrap;
  transition: color 0.12s, background 0.12s;
}

.admin-nav-link i {
  width: 16px;
  text-align: center;
  font-size: 12px;
  flex-shrink: 0;
}

.admin-nav-label {
  /* Label fades out + width collapses when sidebar is collapsed. Kept in DOM
     (not display:none) so screen readers continue to announce the link name. */
  transition: opacity var(--transition-default), max-width var(--transition-default);
  max-width: 12rem;
  opacity: 1;
  overflow: hidden;
}

.admin-sidebar--collapsed .admin-nav-label {
  opacity: 0;
  max-width: 0;
}

.admin-nav-link:hover {
  color: var(--text);
  background: var(--surface2);
}

.admin-nav-link.router-link-exact-active {
  color: var(--accent);
  background: var(--accent-bg);
  font-weight: 600;
}

.admin-nav-link:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.admin-main {
  flex: 1;
  padding: var(--space-6);
  min-width: 0;
}

.admin-denied {
  text-align: center;
  padding: var(--space-10) 0;
  color: var(--text-dim);
}

.admin-denied h1 {
  font-size: var(--text-xl);
  margin-bottom: var(--space-2);
}

@media (max-width: 768px) {
  /* Mobile: hide the desktop collapse toggle, show the drawer hamburger. */
  .admin-collapse-btn { display: none; }
  .admin-menu-btn { display: flex; }

  .admin-sidebar {
    /* Reset desktop collapse semantics — mobile is a drawer, full width. */
    width: 220px !important;
    position: fixed;
    top: var(--nav-height);
    left: 0;
    bottom: 0;
    z-index: 40;
    transform: translateX(-100%);
    transition: transform 0.2s ease;
    box-shadow: none;
  }
  /* Mobile labels are always visible (drawer is either open or closed, not collapsed). */
  .admin-sidebar .admin-nav-label {
    opacity: 1 !important;
    max-width: 12rem !important;
  }
  .admin-sidebar--mobile-open {
    transform: translateX(0);
    box-shadow: var(--shadow-lg);
  }
  .admin-main { padding: var(--space-4); }
}
</style>
