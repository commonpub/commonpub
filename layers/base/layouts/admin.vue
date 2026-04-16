<script setup lang="ts">
const { isAdmin } = useAuth();
const { admin: adminEnabled } = useFeatures();
const runtimeConfig = useRuntimeConfig();
const siteName = computed(() => (runtimeConfig.public.siteName as string) || 'CommonPub');
const sidebarOpen = ref(false);
</script>

<template>
  <div v-if="!adminEnabled" class="admin-denied">
    <h1>Not Available</h1>
    <p>The admin panel is not enabled on this instance.</p>
  </div>
  <div v-else class="admin-layout">
    <header class="admin-topbar">
      <div class="admin-topbar-inner">
        <button class="admin-menu-btn" aria-label="Toggle sidebar" @click="sidebarOpen = !sidebarOpen">
          <i :class="sidebarOpen ? 'fa-solid fa-xmark' : 'fa-solid fa-bars'"></i>
        </button>
        <NuxtLink to="/" class="admin-brand">{{ siteName }}</NuxtLink>
        <span class="admin-badge">Admin</span>
        <NuxtLink to="/" class="admin-back"><i class="fa-solid fa-arrow-left"></i> Back to site</NuxtLink>
      </div>
    </header>

    <div class="admin-body">
      <aside class="admin-sidebar" :class="{ open: sidebarOpen }" aria-label="Admin navigation">
        <nav class="admin-nav">
          <NuxtLink to="/admin" class="admin-nav-link" @click="sidebarOpen = false"><i class="fa-solid fa-gauge"></i> Dashboard</NuxtLink>
          <NuxtLink to="/admin/users" class="admin-nav-link" @click="sidebarOpen = false"><i class="fa-solid fa-users"></i> Users</NuxtLink>
          <NuxtLink to="/admin/content" class="admin-nav-link" @click="sidebarOpen = false"><i class="fa-solid fa-newspaper"></i> Content</NuxtLink>
          <NuxtLink to="/admin/categories" class="admin-nav-link" @click="sidebarOpen = false"><i class="fa-solid fa-tags"></i> Categories</NuxtLink>
          <NuxtLink to="/admin/reports" class="admin-nav-link" @click="sidebarOpen = false"><i class="fa-solid fa-flag"></i> Reports</NuxtLink>
          <NuxtLink to="/admin/audit" class="admin-nav-link" @click="sidebarOpen = false"><i class="fa-solid fa-clipboard-list"></i> Audit Log</NuxtLink>
          <NuxtLink to="/admin/theme" class="admin-nav-link" @click="sidebarOpen = false"><i class="fa-solid fa-palette"></i> Theme</NuxtLink>
          <NuxtLink to="/admin/homepage" class="admin-nav-link" @click="sidebarOpen = false"><i class="fa-solid fa-house"></i> Homepage</NuxtLink>
          <NuxtLink to="/admin/navigation" class="admin-nav-link" @click="sidebarOpen = false"><i class="fa-solid fa-bars"></i> Navigation</NuxtLink>
          <NuxtLink to="/admin/features" class="admin-nav-link" @click="sidebarOpen = false"><i class="fa-solid fa-toggle-on"></i> Features</NuxtLink>
          <NuxtLink to="/admin/federation" class="admin-nav-link" @click="sidebarOpen = false"><i class="fa-solid fa-globe"></i> Federation</NuxtLink>
          <NuxtLink to="/admin/settings" class="admin-nav-link" @click="sidebarOpen = false"><i class="fa-solid fa-gear"></i> Settings</NuxtLink>
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

.admin-menu-btn {
  display: none;
  width: 36px;
  height: 36px;
  background: none;
  border: var(--border-width-default) solid var(--border);
  color: var(--text-dim);
  font-size: 16px;
  cursor: pointer;
  align-items: center;
  justify-content: center;
}

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
  width: 200px;
  border-right: var(--border-width-default) solid var(--border);
  background: var(--surface);
  padding: var(--space-4) var(--space-2);
  flex-shrink: 0;
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
  transition: color 0.12s, background 0.12s;
}

.admin-nav-link i {
  width: 16px;
  text-align: center;
  font-size: 12px;
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
  .admin-menu-btn { display: flex; }
  .admin-sidebar {
    position: fixed;
    top: var(--nav-height);
    left: 0;
    bottom: 0;
    z-index: 40;
    transform: translateX(-100%);
    transition: transform 0.2s ease;
    box-shadow: none;
    width: 220px;
  }
  .admin-sidebar.open {
    transform: translateX(0);
    box-shadow: var(--shadow-lg);
  }
  .admin-main { padding: var(--space-4); }
}
</style>
