<script setup lang="ts">
const { user, isAuthenticated, isAdmin, signOut } = useAuth();
</script>

<template>
  <div class="app-layout">
    <header class="topbar">
      <div class="topbar-inner">
        <NuxtLink to="/" class="topbar-brand">CommonPub</NuxtLink>
        <nav class="topbar-nav" aria-label="Main navigation">
          <NuxtLink to="/dashboard">Dashboard</NuxtLink>
          <NuxtLink to="/search">Search</NuxtLink>
          <NuxtLink to="/communities">Communities</NuxtLink>
          <NuxtLink to="/learn">Learn</NuxtLink>
          <NuxtLink to="/docs">Docs</NuxtLink>
          <NuxtLink v-if="isAdmin" to="/admin">Admin</NuxtLink>
        </nav>
        <div class="topbar-actions">
          <template v-if="isAuthenticated">
            <NuxtLink :to="`/u/${(user as any)?.username}`" class="topbar-user">
              {{ (user as any)?.displayName || (user as any)?.username || 'Account' }}
            </NuxtLink>
            <button class="topbar-signout" @click="signOut">Sign out</button>
          </template>
          <NuxtLink v-else to="/auth/login" class="topbar-login">Log in</NuxtLink>
        </div>
      </div>
    </header>

    <div class="app-body">
      <aside class="sidebar" aria-label="Sidebar">
        <nav class="sidebar-nav">
          <NuxtLink to="/">Home</NuxtLink>
          <NuxtLink to="/feed">Feed</NuxtLink>
          <NuxtLink to="/project">Projects</NuxtLink>
          <NuxtLink to="/article">Articles</NuxtLink>
          <NuxtLink to="/guide">Guides</NuxtLink>
          <NuxtLink to="/blog">Blog</NuxtLink>
        </nav>
      </aside>

      <main class="main-content">
        <slot />
      </main>
    </div>
  </div>
</template>

<style scoped>
.app-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-sans);
}

.topbar {
  height: var(--nav-height);
  border-bottom: 2px solid var(--border);
  background: var(--surface);
  display: flex;
  align-items: center;
  padding: 0 var(--space-4);
  position: sticky;
  top: 0;
  z-index: var(--z-sticky);
}

.topbar-inner {
  display: flex;
  align-items: center;
  width: 100%;
  max-width: var(--content-wide-max-width);
  margin: 0 auto;
  gap: var(--space-4);
}

.topbar-brand {
  font-weight: var(--font-weight-bold);
  font-size: var(--text-lg);
  color: var(--text);
  text-decoration: none;
}

.topbar-nav {
  display: flex;
  gap: var(--space-3);
}

.topbar-nav a {
  color: var(--text-dim);
  text-decoration: none;
  font-size: var(--text-sm);
}

.topbar-nav a:hover {
  color: var(--accent);
}

.topbar-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.topbar-login {
  color: var(--accent);
  text-decoration: none;
  font-size: var(--text-sm);
  font-weight: var(--font-weight-medium);
}

.app-body {
  display: flex;
  flex: 1;
}

.sidebar {
  width: 200px;
  border-right: 1px solid var(--border);
  background: var(--surface);
  padding: var(--space-4);
  flex-shrink: 0;
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.sidebar-nav a {
  color: var(--text-dim);
  text-decoration: none;
  font-size: var(--text-sm);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
}

.sidebar-nav a:hover {
  color: var(--text);
  background: var(--surface2);
}

.main-content {
  flex: 1;
  max-width: var(--content-max-width);
  padding: var(--space-6);
}

.topbar-nav a:focus-visible,
.sidebar-nav a:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.topbar-user {
  color: var(--text);
  text-decoration: none;
  font-size: var(--text-sm);
  font-weight: var(--font-weight-medium);
}

.topbar-user:hover {
  color: var(--accent);
}

.topbar-signout {
  background: none;
  border: none;
  color: var(--text-dim);
  font-size: var(--text-sm);
  font-family: var(--font-sans);
  cursor: pointer;
  padding: 0;
}

.topbar-signout:hover {
  color: var(--accent);
}

.topbar-signout:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
</style>
