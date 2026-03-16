<script setup lang="ts">
const { user, isAuthenticated, signOut } = useAuth();

const userMenuOpen = ref(false);

// Notification count polling
const { data: notifData } = useFetch<{ count: number }>('/api/notifications/count', {
  default: () => ({ count: 0 }),
  server: false,
});

let notifInterval: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  notifInterval = setInterval(async () => {
    try {
      const res = await $fetch<{ count: number }>('/api/notifications/count');
      if (res && typeof res.count === 'number') {
        notifData.value = res;
      }
    } catch {
      // silently ignore polling errors
    }
  }, 30_000);
});
onUnmounted(() => {
  if (notifInterval) clearInterval(notifInterval);
});

const unreadCount = computed(() => notifData.value?.count ?? 0);

// Cmd+K / Ctrl+K shortcut → navigate to search
function handleGlobalKeydown(e: KeyboardEvent): void {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    navigateTo('/search');
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleGlobalKeydown);
});
onUnmounted(() => {
  document.removeEventListener('keydown', handleGlobalKeydown);
});

// Close user menu on click outside
function handleClickOutside(e: MouseEvent): void {
  const target = e.target as HTMLElement;
  if (!target.closest('.cpub-user-menu-wrapper')) {
    userMenuOpen.value = false;
  }
}
onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});
onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});

function handleSignOut(): void {
  userMenuOpen.value = false;
  signOut();
}

const userInitial = computed(() => {
  const u = user.value as Record<string, string> | null;
  return (u?.displayName || u?.username || 'U').charAt(0).toUpperCase();
});

const userUsername = computed(() => {
  const u = user.value as Record<string, string> | null;
  return u?.username ?? '';
});
</script>

<template>
  <div class="cpub-layout">
    <!-- Topbar — matches mockup 01 exactly -->
    <header class="cpub-topbar">
      <NuxtLink to="/" class="cpub-topbar-logo">
        <span class="cpub-logo-bracket">[</span>C<span class="cpub-logo-bracket">]</span>
        <span class="cpub-logo-name">CommonPub</span>
      </NuxtLink>

      <nav class="cpub-topbar-nav" aria-label="Main navigation">
        <NuxtLink to="/" class="cpub-nav-link">Explore</NuxtLink>
        <NuxtLink to="/learn" class="cpub-nav-link">Learn</NuxtLink>
        <NuxtLink to="/create" class="cpub-nav-link">Create</NuxtLink>
        <NuxtLink to="/communities" class="cpub-nav-link">Community</NuxtLink>
      </nav>

      <div class="cpub-topbar-spacer" />

      <div class="cpub-topbar-actions">
        <NuxtLink to="/search" class="cpub-search-btn">
          <i class="fa-solid fa-magnifying-glass"></i>
          <span class="cpub-search-text">Search content&hellip;</span>
          <span class="cpub-kbd">&lceil;K</span>
        </NuxtLink>

        <template v-if="isAuthenticated">
          <NuxtLink to="/notifications" class="cpub-icon-btn" title="Notifications" aria-label="Notifications">
            <i class="fa-solid fa-bell"></i>
            <span v-if="unreadCount > 0" class="cpub-notif-dot" />
          </NuxtLink>

          <NuxtLink to="/create" class="cpub-btn-new">
            <i class="fa-solid fa-plus"></i> New
          </NuxtLink>

          <div class="cpub-user-menu-wrapper">
            <button
              class="cpub-avatar-btn"
              aria-label="User menu"
              :aria-expanded="userMenuOpen"
              @click.stop="userMenuOpen = !userMenuOpen"
            >
              <span class="cpub-user-avatar">{{ userInitial }}</span>
            </button>
            <div v-if="userMenuOpen" class="cpub-user-dropdown" role="menu">
              <NuxtLink :to="`/u/${userUsername}`" class="cpub-dropdown-item" role="menuitem" @click="userMenuOpen = false">
                <i class="fa-solid fa-user"></i> Profile
              </NuxtLink>
              <NuxtLink to="/settings" class="cpub-dropdown-item" role="menuitem" @click="userMenuOpen = false">
                <i class="fa-solid fa-gear"></i> Settings
              </NuxtLink>
              <button class="cpub-dropdown-item" role="menuitem" @click="handleSignOut">
                <i class="fa-solid fa-right-from-bracket"></i> Sign out
              </button>
            </div>
          </div>
        </template>
        <NuxtLink v-else to="/auth/login" class="cpub-btn-new">Log in</NuxtLink>
      </div>
    </header>

    <!-- Main content — no sidebar, full width -->
    <main id="main-content">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.cpub-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/* ─── TOPBAR ─── */
.cpub-topbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 48px;
  background: var(--surface);
  border-bottom: 2px solid var(--border);
  display: flex;
  align-items: center;
  padding: 0 20px;
  gap: 0;
  z-index: 100;
}

.cpub-topbar-logo {
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 13px;
  font-weight: 700;
  font-family: var(--font-mono);
  color: var(--text);
  white-space: nowrap;
  flex-shrink: 0;
  text-decoration: none;
}

.cpub-logo-bracket {
  color: var(--accent);
  font-size: 15px;
}

.cpub-logo-name {
  margin-left: 2px;
}

.cpub-topbar-nav {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-left: 24px;
}

.cpub-nav-link {
  font-size: 12px;
  color: var(--text-dim);
  padding: 5px 12px;
  border: 2px solid transparent;
  background: none;
  text-decoration: none;
  transition: color 0.15s, background 0.15s;
}

.cpub-nav-link:hover {
  color: var(--text);
  background: var(--surface2);
}

.cpub-nav-link.router-link-active {
  color: var(--text);
  background: var(--surface2);
  border-color: var(--border);
}

.cpub-topbar-spacer {
  flex: 1;
}

.cpub-topbar-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* ─── SEARCH BUTTON ─── */
.cpub-search-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: var(--surface2);
  border: 2px solid var(--border2);
  color: var(--text-dim);
  font-size: 12px;
  min-width: 180px;
  text-decoration: none;
  transition: border-color 0.15s, color 0.15s;
}

.cpub-search-btn:hover {
  border-color: var(--accent-border);
  color: var(--text);
}

.cpub-search-btn i {
  font-size: 11px;
}

.cpub-kbd {
  margin-left: auto;
  font-size: 10px;
  font-family: var(--font-mono);
  padding: 2px 6px;
  background: var(--surface3);
  border: 2px solid var(--border2);
  color: var(--text-faint);
}

/* ─── ICON BUTTON ─── */
.cpub-icon-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 2px solid transparent;
  color: var(--text-dim);
  font-size: 13px;
  position: relative;
  transition: all 0.15s;
  text-decoration: none;
}

.cpub-icon-btn:hover {
  background: var(--surface2);
  border-color: var(--border);
  color: var(--text);
}

.cpub-notif-dot {
  position: absolute;
  top: 5px;
  right: 5px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
  border: 1.5px solid var(--surface);
}

/* ─── NEW BUTTON ─── */
.cpub-btn-new {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: var(--accent);
  border: 2px solid var(--border);
  color: var(--color-text-inverse);
  font-size: 12px;
  font-weight: 600;
  transition: all 0.15s;
  box-shadow: 2px 2px 0 var(--border);
  text-decoration: none;
  cursor: pointer;
}

.cpub-btn-new:hover {
  box-shadow: 4px 4px 0 var(--border);
  transform: translate(-1px, -1px);
}

/* ─── USER AVATAR ─── */
.cpub-avatar-btn {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
}

.cpub-user-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--purple-bg);
  border: 2px solid var(--purple);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
  color: var(--purple);
  font-family: var(--font-mono);
}

.cpub-user-menu-wrapper {
  position: relative;
}

.cpub-user-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  min-width: 180px;
  background: var(--surface);
  border: 2px solid var(--border);
  box-shadow: 4px 4px 0 var(--border);
  z-index: 200;
  display: flex;
  flex-direction: column;
  padding: 4px 0;
}

.cpub-dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  font-size: 12px;
  color: var(--text-dim);
  text-decoration: none;
  background: none;
  border: none;
  cursor: pointer;
  font-family: inherit;
  width: 100%;
  text-align: left;
  transition: all 0.15s;
}

.cpub-dropdown-item:hover {
  background: var(--surface2);
  color: var(--text);
}

.cpub-dropdown-item i {
  width: 14px;
  text-align: center;
  font-size: 11px;
}

/* ─── MAIN ─── */
#main-content {
  margin-top: 48px;
}

/* ─── RESPONSIVE ─── */
@media (max-width: 768px) {
  .cpub-topbar-nav {
    display: none;
  }

  .cpub-search-btn {
    min-width: auto;
    padding: 6px 8px;
  }

  .cpub-search-text {
    display: none;
  }

  .cpub-kbd {
    display: none;
  }
}
</style>
