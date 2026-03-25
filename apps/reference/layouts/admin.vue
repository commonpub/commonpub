<script setup lang="ts">
const { isAdmin } = useAuth();
const { admin: adminEnabled } = useFeatures();
</script>

<template>
  <div v-if="!adminEnabled" class="admin-denied">
    <h1>Not Available</h1>
    <p>The admin panel is not enabled on this instance.</p>
  </div>
  <div v-else class="admin-layout">
    <header class="admin-topbar">
      <div class="admin-topbar-inner">
        <NuxtLink to="/" class="admin-brand">CommonPub</NuxtLink>
        <span class="admin-badge">Admin</span>
        <NuxtLink to="/" class="admin-back">Back to site</NuxtLink>
      </div>
    </header>

    <div class="admin-body">
      <aside class="admin-sidebar" aria-label="Admin navigation">
        <nav class="admin-nav">
          <NuxtLink to="/admin" class="admin-nav-link">Dashboard</NuxtLink>
          <NuxtLink to="/admin/users" class="admin-nav-link">Users</NuxtLink>
          <NuxtLink to="/admin/content" class="admin-nav-link">Content</NuxtLink>
          <NuxtLink to="/admin/reports" class="admin-nav-link">Reports</NuxtLink>
          <NuxtLink to="/admin/audit" class="admin-nav-link">Audit Log</NuxtLink>
          <NuxtLink to="/admin/federation" class="admin-nav-link">Federation</NuxtLink>
          <NuxtLink to="/admin/settings" class="admin-nav-link">Settings</NuxtLink>
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
  border-bottom: 2px solid var(--border);
  background: var(--surface);
  display: flex;
  align-items: center;
  padding: 0 var(--space-4);
}

.admin-topbar-inner {
  display: flex;
  align-items: center;
  width: 100%;
  gap: var(--space-3);
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
  border-right: 1px solid var(--border);
  background: var(--surface);
  padding: var(--space-4);
}

.admin-nav {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.admin-nav-link {
  color: var(--text-dim);
  text-decoration: none;
  font-size: var(--text-sm);
  padding: var(--space-2) var(--space-3);
}

.admin-nav-link:hover {
  color: var(--text);
  background: var(--surface2);
}

.admin-nav-link:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.admin-main {
  flex: 1;
  padding: var(--space-6);
}

.admin-denied {
  text-align: center;
  padding: var(--space-10) 0;
  color: var(--text-dim);
}
</style>
