<script setup lang="ts">
const { user, isAuthenticated, isAdmin, signOut, refreshSession } = useAuth();
const { count: unreadCount, connect: connectNotifications, disconnect: disconnectNotifications } = useNotifications();
const { count: unreadMessages, connect: connectMessages, disconnect: disconnectMessages } = useMessages();
const { hubs, learning, video, docs, contests, admin, federation } = useFeatures();
const { enabledTypeMeta } = useContentTypes();
const runtimeConfig = useRuntimeConfig();
const siteName = computed(() => (runtimeConfig.public.siteName as string) || 'CommonPub');

useHead({
  link: [
    { rel: 'alternate', type: 'application/rss+xml', title: `${siteName.value} RSS`, href: '/feed.xml' },
  ],
});

const userMenuOpen = ref(false);
const mobileMenuOpen = ref(false);

// Cmd+K / Ctrl+K → search
function handleGlobalKeydown(e: KeyboardEvent): void {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    navigateTo('/search');
  }
}

// Close menus on click outside
function handleClickOutside(e: MouseEvent): void {
  const target = e.target as HTMLElement;
  if (!target.closest('.cpub-user-menu-wrapper')) userMenuOpen.value = false;
}

onMounted(async () => {
  // Refresh session to detect expiry (SSR hydration may have stale auth state)
  await refreshSession();
  if (isAuthenticated.value) {
    connectNotifications();
    connectMessages();
  }
  document.addEventListener('keydown', handleGlobalKeydown);
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  disconnectNotifications();
  disconnectMessages();
  document.removeEventListener('keydown', handleGlobalKeydown);
  document.removeEventListener('click', handleClickOutside);
});

function handleSignOut(): void {
  userMenuOpen.value = false;
  signOut();
}

const userInitial = computed(() => {
  return (user.value?.name || user.value?.username || 'U').charAt(0).toUpperCase();
});
const userImage = computed(() => user.value?.image || null);

const userUsername = computed(() => user.value?.username ?? '');
</script>

<template>
  <div class="cpub-layout">
    <!-- ═══ TOP NAV ═══ -->
    <header class="cpub-topbar">
      <NuxtLink to="/" class="cpub-topbar-logo">
        <SiteLogo />
      </NuxtLink>

      <nav class="cpub-topbar-nav" aria-label="Main navigation">
        <NuxtLink to="/" class="cpub-nav-link"><i class="fa-solid fa-house"></i> Home</NuxtLink>
        <NuxtLink v-if="hubs" to="/hubs" class="cpub-nav-link"><i class="fa-solid fa-users"></i> Hubs</NuxtLink>
        <NuxtLink v-if="learning" to="/learn" class="cpub-nav-link"><i class="fa-solid fa-graduation-cap"></i> Learn</NuxtLink>
        <NuxtLink v-if="video" to="/videos" class="cpub-nav-link"><i class="fa-solid fa-video"></i> Videos</NuxtLink>
        <NuxtLink v-if="docs" to="/docs" class="cpub-nav-link"><i class="fa-solid fa-book"></i> Docs</NuxtLink>
        <NuxtLink v-if="contests" to="/contests" class="cpub-nav-link"><i class="fa-solid fa-trophy"></i> Contests</NuxtLink>
        <NuxtLink v-if="federation" to="/federation" class="cpub-nav-link"><i class="fa-solid fa-globe"></i> Fediverse</NuxtLink>
        <NuxtLink v-if="isAdmin && admin" to="/admin" class="cpub-nav-link"><i class="fa-solid fa-shield-halved"></i> Admin</NuxtLink>
      </nav>

      <div class="cpub-topbar-spacer" />

      <div class="cpub-topbar-actions">
        <NuxtLink to="/search" class="cpub-search-btn" aria-label="Search">
          <i class="fa-solid fa-magnifying-glass"></i>
          <span class="cpub-search-text">Search...</span>
          <span class="cpub-kbd">&lceil;K</span>
        </NuxtLink>

        <template v-if="isAuthenticated">
          <NuxtLink to="/messages" class="cpub-icon-btn" title="Messages" aria-label="Messages">
            <i class="fa-solid fa-envelope"></i>
            <span v-if="unreadMessages > 0" class="cpub-notif-dot" />
          </NuxtLink>
          <NuxtLink to="/notifications" class="cpub-icon-btn" title="Notifications" aria-label="Notifications">
            <i class="fa-solid fa-bell"></i>
            <span v-if="unreadCount > 0" class="cpub-notif-dot" />
          </NuxtLink>
          <NuxtLink to="/create" class="cpub-btn-new" aria-label="Create new content">
            <i class="fa-solid fa-plus"></i> <span class="cpub-new-text">New</span>
          </NuxtLink>
          <div class="cpub-user-menu-wrapper">
            <button class="cpub-avatar-btn" aria-label="User menu" :aria-expanded="userMenuOpen" @click.stop="userMenuOpen = !userMenuOpen">
              <span class="cpub-user-avatar">
                <img v-if="userImage" :src="userImage" :alt="user?.name || user?.username" class="cpub-user-avatar-img" />
                <span v-else>{{ userInitial }}</span>
              </span>
            </button>
            <div v-if="userMenuOpen" class="cpub-user-dropdown" role="menu">
              <NuxtLink :to="`/u/${userUsername}`" class="cpub-dropdown-item" role="menuitem" @click="userMenuOpen = false"><i class="fa-solid fa-user"></i> Profile</NuxtLink>
              <NuxtLink to="/dashboard" class="cpub-dropdown-item" role="menuitem" @click="userMenuOpen = false"><i class="fa-solid fa-gauge"></i> Dashboard</NuxtLink>
              <NuxtLink to="/settings" class="cpub-dropdown-item" role="menuitem" @click="userMenuOpen = false"><i class="fa-solid fa-gear"></i> Settings</NuxtLink>
              <div class="cpub-dropdown-divider" />
              <button class="cpub-dropdown-item" role="menuitem" @click="handleSignOut"><i class="fa-solid fa-right-from-bracket"></i> Sign out</button>
            </div>
          </div>
        </template>
        <NuxtLink v-else to="/auth/login" class="cpub-btn-new">Log in</NuxtLink>

        <button class="cpub-mobile-toggle" aria-label="Toggle menu" @click="mobileMenuOpen = !mobileMenuOpen">
          <i :class="mobileMenuOpen ? 'fa-solid fa-xmark' : 'fa-solid fa-bars'"></i>
        </button>
      </div>
    </header>

    <!-- Mobile menu -->
    <div v-if="mobileMenuOpen" class="cpub-mobile-menu" @click.self="mobileMenuOpen = false">
      <nav class="cpub-mobile-nav" aria-label="Mobile navigation">
        <NuxtLink to="/" class="cpub-mobile-link" @click="mobileMenuOpen = false"><i class="fa-solid fa-house"></i> Home</NuxtLink>
        <NuxtLink v-if="hubs" to="/hubs" class="cpub-mobile-link" @click="mobileMenuOpen = false"><i class="fa-solid fa-users"></i> Hubs</NuxtLink>
        <NuxtLink v-if="learning" to="/learn" class="cpub-mobile-link" @click="mobileMenuOpen = false"><i class="fa-solid fa-graduation-cap"></i> Learn</NuxtLink>
        <NuxtLink v-if="video" to="/videos" class="cpub-mobile-link" @click="mobileMenuOpen = false"><i class="fa-solid fa-video"></i> Videos</NuxtLink>
        <NuxtLink v-if="docs" to="/docs" class="cpub-mobile-link" @click="mobileMenuOpen = false"><i class="fa-solid fa-book"></i> Docs</NuxtLink>
        <NuxtLink v-if="contests" to="/contests" class="cpub-mobile-link" @click="mobileMenuOpen = false"><i class="fa-solid fa-trophy"></i> Contests</NuxtLink>
        <NuxtLink v-if="federation" to="/federation" class="cpub-mobile-link" @click="mobileMenuOpen = false"><i class="fa-solid fa-globe"></i> Fediverse</NuxtLink>
        <NuxtLink v-if="isAdmin && admin" to="/admin" class="cpub-mobile-link" @click="mobileMenuOpen = false"><i class="fa-solid fa-shield-halved"></i> Admin</NuxtLink>
        <NuxtLink to="/search" class="cpub-mobile-link" @click="mobileMenuOpen = false"><i class="fa-solid fa-magnifying-glass"></i> Search</NuxtLink>
        <template v-if="isAuthenticated">
          <div class="cpub-mobile-divider" />
          <NuxtLink to="/create" class="cpub-mobile-link" @click="mobileMenuOpen = false"><i class="fa-solid fa-plus"></i> Create</NuxtLink>
          <NuxtLink to="/dashboard" class="cpub-mobile-link" @click="mobileMenuOpen = false"><i class="fa-solid fa-gauge"></i> Dashboard</NuxtLink>
          <NuxtLink to="/messages" class="cpub-mobile-link" @click="mobileMenuOpen = false"><i class="fa-solid fa-envelope"></i> Messages</NuxtLink>
          <NuxtLink to="/notifications" class="cpub-mobile-link" @click="mobileMenuOpen = false"><i class="fa-solid fa-bell"></i> Notifications</NuxtLink>
        </template>
      </nav>
    </div>

    <!-- ═══ MAIN ═══ -->
    <main id="main-content">
      <slot />
    </main>

    <!-- Toast notifications -->
    <AppToast />

    <!-- ═══ FOOTER ═══ -->
    <footer class="cpub-footer">
      <div class="cpub-footer-inner">
        <div class="cpub-footer-brand">
          <span class="cpub-footer-logo"><SiteLogo /></span>
          <p class="cpub-footer-tagline">Powered by {{ siteName }}.</p>
          <div class="cpub-footer-social">
            <a href="https://github.com/commonpub" target="_blank" rel="noopener" class="cpub-footer-social-link" aria-label="GitHub"><i class="fa-brands fa-github"></i></a>
            <a href="https://discord.gg/uncPaJ5SwV" target="_blank" rel="noopener" class="cpub-footer-social-link" aria-label="Discord"><i class="fa-brands fa-discord"></i></a>
            <a href="/feed.xml" class="cpub-footer-social-link" aria-label="RSS"><i class="fa-solid fa-rss"></i></a>
          </div>
        </div>
        <nav class="cpub-footer-col" aria-label="Content links">
          <h4 class="cpub-footer-col-title">Content</h4>
          <NuxtLink v-for="ct in enabledTypeMeta" :key="ct.type" :to="ct.route" class="cpub-footer-link">{{ ct.plural }}</NuxtLink>
        </nav>
        <nav class="cpub-footer-col" aria-label="Community links">
          <h4 class="cpub-footer-col-title">Community</h4>
          <NuxtLink v-if="hubs" to="/hubs" class="cpub-footer-link">Hubs</NuxtLink>
          <NuxtLink v-if="contests" to="/contests" class="cpub-footer-link">Contests</NuxtLink>
          <NuxtLink v-if="learning" to="/learn" class="cpub-footer-link">Learning Paths</NuxtLink>
          <NuxtLink v-if="video" to="/videos" class="cpub-footer-link">Videos</NuxtLink>
          <NuxtLink to="/search" class="cpub-footer-link">Explore</NuxtLink>
        </nav>
        <nav class="cpub-footer-col" aria-label="Platform links">
          <h4 class="cpub-footer-col-title">Platform</h4>
          <NuxtLink to="/about" class="cpub-footer-link">About</NuxtLink>
          <NuxtLink v-if="docs" to="/docs" class="cpub-footer-link">Docs</NuxtLink>
          <NuxtLink to="/privacy" class="cpub-footer-link">Privacy Policy</NuxtLink>
          <NuxtLink to="/cookies" class="cpub-footer-link">Cookie Policy</NuxtLink>
          <NuxtLink to="/terms" class="cpub-footer-link">Terms of Service</NuxtLink>
          <a href="/feed.xml" class="cpub-footer-link">RSS Feed</a>
        </nav>
      </div>
      <div class="cpub-footer-bottom">
        <span>&copy; {{ new Date().getFullYear() }} {{ siteName }}. Open source under MIT.</span>
      </div>
    </footer>

    <!-- Cookie consent banner -->
    <CookieConsent />
  </div>
</template>

<style scoped>
.cpub-layout { min-height: 100vh; display: flex; flex-direction: column; }

/* ═══ TOPBAR ═══ */
.cpub-topbar {
  position: fixed; top: 0; left: 0; right: 0; height: 48px;
  background: var(--surface); border-bottom: var(--border-width-default) solid var(--border);
  display: flex; align-items: center; padding: 0 20px; gap: 0; z-index: 100;
}
.cpub-topbar-logo { display: flex; align-items: center; flex-shrink: 0; text-decoration: none; color: var(--text); }

.cpub-topbar-nav { display: flex; align-items: center; gap: 2px; margin-left: 24px; }
.cpub-nav-link { font-size: 12px; color: var(--text-dim); padding: 5px 12px; border: var(--border-width-default) solid transparent; background: none; text-decoration: none; transition: color 0.15s, background 0.15s; display: flex; align-items: center; gap: 6px; }
.cpub-nav-link i { font-size: 10px; }
.cpub-nav-link:hover { color: var(--text); background: var(--surface2); }
.cpub-nav-link.router-link-active { color: var(--text); background: var(--surface2); border-color: var(--border); }

.cpub-topbar-spacer { flex: 1; }
.cpub-topbar-actions { display: flex; align-items: center; gap: 6px; }

.cpub-search-btn { display: flex; align-items: center; gap: 8px; padding: 6px 12px; background: var(--surface2); border: var(--border-width-default) solid var(--border2); color: var(--text-dim); font-size: 12px; min-width: 180px; text-decoration: none; transition: border-color 0.15s; }
.cpub-search-btn:hover { border-color: var(--accent-border); color: var(--text); }
.cpub-search-btn i { font-size: 11px; }
.cpub-kbd { margin-left: auto; font-size: 10px; font-family: var(--font-mono); padding: 2px 6px; background: var(--surface3); border: var(--border-width-default) solid var(--border2); color: var(--text-faint); }

.cpub-icon-btn { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; background: transparent; border: var(--border-width-default) solid transparent; color: var(--text-dim); font-size: 13px; position: relative; transition: all 0.15s; text-decoration: none; }
.cpub-icon-btn:hover { background: var(--surface2); border-color: var(--border); color: var(--text); }
.cpub-notif-dot { position: absolute; top: 5px; right: 5px; width: 6px; height: 6px; border-radius: 50%; background: var(--accent); border: 1.5px solid var(--surface); }

.cpub-btn-new { display: flex; align-items: center; gap: 6px; padding: 6px 14px; background: var(--accent); border: var(--border-width-default) solid var(--border); color: var(--color-text-inverse); font-size: 12px; font-weight: 600; transition: all 0.15s; box-shadow: var(--shadow-sm); text-decoration: none; cursor: pointer; }
.cpub-btn-new:hover { box-shadow: var(--shadow-md); transform: translate(-1px, -1px); }

.cpub-avatar-btn { background: none; border: none; padding: 0; cursor: pointer; }
.cpub-user-avatar { width: 28px; height: 28px; border-radius: 50%; background: var(--purple-bg); border: var(--border-width-default) solid var(--purple); display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; color: var(--purple); font-family: var(--font-mono); overflow: hidden; }
.cpub-user-avatar-img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
.cpub-user-menu-wrapper { position: relative; }
.cpub-user-dropdown { position: absolute; top: calc(100% + 6px); right: 0; min-width: 180px; background: var(--surface); border: var(--border-width-default) solid var(--border); box-shadow: var(--shadow-md); z-index: 200; display: flex; flex-direction: column; padding: 4px 0; }
.cpub-dropdown-item { display: flex; align-items: center; gap: 8px; padding: 8px 16px; font-size: 12px; color: var(--text-dim); text-decoration: none; background: none; border: none; cursor: pointer; font-family: inherit; width: 100%; text-align: left; transition: all 0.15s; }
.cpub-dropdown-item:hover { background: var(--surface2); color: var(--text); }
.cpub-dropdown-item i { width: 14px; text-align: center; font-size: 11px; }
.cpub-dropdown-divider { height: 2px; background: var(--border2); margin: 4px 12px; }

.cpub-mobile-toggle { display: none; width: 32px; height: 32px; background: none; border: var(--border-width-default) solid transparent; color: var(--text-dim); font-size: 16px; cursor: pointer; align-items: center; justify-content: center; }
.cpub-mobile-menu { display: none; position: fixed; inset: 0; top: 48px; z-index: 99; background: var(--color-surface-overlay-light); }
.cpub-mobile-nav { background: var(--surface); border-bottom: var(--border-width-default) solid var(--border); padding: 8px 0; display: flex; flex-direction: column; box-shadow: var(--shadow-md); }
.cpub-mobile-link { display: flex; align-items: center; gap: 10px; padding: 10px 20px; font-size: 13px; color: var(--text-dim); text-decoration: none; transition: background 0.1s; }
.cpub-mobile-link:hover { background: var(--surface2); color: var(--text); }
.cpub-mobile-link i { width: 16px; text-align: center; font-size: 12px; }
.cpub-mobile-divider { height: 2px; background: var(--border2); margin: 4px 16px; }

#main-content { margin-top: 48px; flex: 1; }

/* ═══ FOOTER ═══ */
.cpub-footer { background: var(--surface); border-top: var(--border-width-default) solid var(--border); margin-top: auto; }
.cpub-footer-inner { max-width: 1200px; margin: 0 auto; padding: 40px 32px 32px; display: grid; grid-template-columns: 1.5fr repeat(3, 1fr); gap: 32px; }
.cpub-footer-brand { display: flex; flex-direction: column; gap: 8px; }
.cpub-footer-logo { font-family: var(--font-mono); font-size: 14px; font-weight: 700; color: var(--text); }
.cpub-footer-tagline { font-size: 12px; color: var(--text-dim); }
.cpub-footer-social { display: flex; gap: 8px; margin-top: 8px; }
.cpub-footer-social-link { width: 28px; height: 28px; background: var(--surface2); border: var(--border-width-default) solid var(--border); display: flex; align-items: center; justify-content: center; color: var(--text-dim); font-size: 12px; text-decoration: none; transition: all 0.12s; }
.cpub-footer-social-link:hover { background: var(--accent); color: var(--color-text-inverse); border-color: var(--accent); }
.cpub-footer-col { display: flex; flex-direction: column; gap: 6px; }
.cpub-footer-col-title { font-family: var(--font-mono); font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: var(--text-faint); margin-bottom: 4px; }
.cpub-footer-link { font-size: 12px; color: var(--text-dim); text-decoration: none; transition: color 0.12s; }
.cpub-footer-link:hover { color: var(--text); }
.cpub-footer-bottom { max-width: 1200px; margin: 0 auto; padding: 16px 32px; border-top: var(--border-width-default) solid var(--border); font-size: 10px; font-family: var(--font-mono); color: var(--text-faint); }

@media (max-width: 768px) {
  .cpub-topbar-nav { display: none; }
  .cpub-search-btn { min-width: auto; padding: 6px 8px; }
  .cpub-search-text, .cpub-kbd, .cpub-new-text { display: none; }
  .cpub-mobile-toggle { display: flex; }
  .cpub-mobile-menu { display: block; }
  .cpub-footer-inner { grid-template-columns: 1fr 1fr; gap: 24px; }
}
@media (max-width: 480px) { .cpub-footer-inner { grid-template-columns: 1fr; } }
</style>
