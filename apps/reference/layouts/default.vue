<script setup lang="ts">
const { user, isAuthenticated, isAdmin, signOut, refreshSession } = useAuth();
const { themeId, setTheme } = useTheme();
const isDark = computed(() => themeId.value === 'dark');
function toggleDarkMode(): void { setTheme(isDark.value ? 'base' : 'dark'); }
const { count: unreadCount, connect: connectNotifications, disconnect: disconnectNotifications } = useNotifications();
const { hubs, learning, video, docs, contests, admin } = useFeatures();
const { enabledTypeMeta } = useContentTypes();

useHead({
  link: [
    { rel: 'alternate', type: 'application/rss+xml', title: 'devEco RSS', href: '/feed.xml' },
  ],
});

const userMenuOpen = ref(false);
const mobileMenuOpen = ref(false);

const searchQuery = ref('');
const searchInputRef = ref<HTMLInputElement | null>(null);

function handleGlobalKeydown(e: KeyboardEvent): void {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    searchInputRef.value?.focus();
  }
}

function handleSearchSubmit(): void {
  const q = searchQuery.value.trim();
  if (q) {
    navigateTo(`/search?q=${encodeURIComponent(q)}`);
    searchQuery.value = '';
    searchInputRef.value?.blur();
  }
}

function handleClickOutside(e: MouseEvent): void {
  const target = e.target as HTMLElement;
  if (!target.closest('.de-user-menu-wrapper')) userMenuOpen.value = false;
}

onMounted(async () => {
  await refreshSession();
  if (isAuthenticated.value) {
    connectNotifications();
  }
  document.addEventListener('keydown', handleGlobalKeydown);
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  disconnectNotifications();
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

const userUsername = computed(() => user.value?.username ?? '');
</script>

<template>
  <div class="de-layout">
    <!-- Top Banner -->
    <div class="de-top-banner">
      Backed by <a href="https://www.edgeaifoundation.org/" target="_blank" rel="noopener"><strong>EDGE AI FOUNDATION</strong></a> &middot; Part of the <a href="https://thedeveco.com/community" target="_blank" rel="noopener">Internet of Communities&trade;</a>
    </div>

    <!-- Top Nav -->
    <header class="de-topbar">
      <div class="de-topbar-inner">
        <NuxtLink to="/" class="de-topbar-logo">
          <DevEcoLogo variant="light-bg" size="sm" :show-text="true" />
        </NuxtLink>

        <nav class="de-topbar-nav" aria-label="Main navigation">
          <NuxtLink to="/" class="de-nav-link">Home</NuxtLink>
          <NuxtLink to="/project" class="de-nav-link">Projects</NuxtLink>
          <NuxtLink to="/blog" class="de-nav-link">Blog</NuxtLink>
          <NuxtLink v-if="hubs" to="/hubs" class="de-nav-link">Communities</NuxtLink>
          <NuxtLink v-if="contests" to="/contests" class="de-nav-link">Contests</NuxtLink>
          <NuxtLink v-if="isAdmin && admin" to="/admin" class="de-nav-link">Admin</NuxtLink>
        </nav>

        <div class="de-topbar-spacer" />

        <div class="de-topbar-actions">
          <NuxtLink to="/search" class="de-search-icon-mobile" aria-label="Search"><i class="fa-solid fa-magnifying-glass"></i></NuxtLink>
          <form class="de-search-form" @submit.prevent="handleSearchSubmit">
            <i class="fa-solid fa-magnifying-glass de-search-icon"></i>
            <input
              ref="searchInputRef"
              v-model="searchQuery"
              type="text"
              class="de-search-input"
              placeholder="Search..."
              aria-label="Search"
            />
            <kbd class="de-kbd">&#8984;K</kbd>
          </form>

          <template v-if="isAuthenticated">
            <NuxtLink to="/messages" class="de-icon-btn" title="Messages" aria-label="Messages">
              <i class="fa-solid fa-envelope"></i>
            </NuxtLink>
            <NuxtLink to="/notifications" class="de-icon-btn" title="Notifications" aria-label="Notifications">
              <i class="fa-solid fa-bell"></i>
              <span v-if="unreadCount > 0" class="de-notif-dot" />
            </NuxtLink>
            <NuxtLink to="/create" class="de-btn-primary" aria-label="Create new content">
              <i class="fa-solid fa-plus"></i> <span class="de-new-text">New</span>
            </NuxtLink>
            <div class="de-user-menu-wrapper">
              <button class="de-avatar-btn" aria-label="User menu" :aria-expanded="userMenuOpen" @click.stop="userMenuOpen = !userMenuOpen">
                <img v-if="user?.image" :src="user.image" alt="" class="de-user-avatar-img" />
                <span v-else class="de-user-avatar">{{ userInitial }}</span>
              </button>
              <div v-if="userMenuOpen" class="de-user-dropdown" role="menu">
                <NuxtLink :to="`/u/${userUsername}`" class="de-dropdown-item" role="menuitem" @click="userMenuOpen = false"><i class="fa-solid fa-user"></i> Profile</NuxtLink>
                <NuxtLink to="/dashboard" class="de-dropdown-item" role="menuitem" @click="userMenuOpen = false"><i class="fa-solid fa-gauge"></i> Dashboard</NuxtLink>
                <NuxtLink to="/settings" class="de-dropdown-item" role="menuitem" @click="userMenuOpen = false"><i class="fa-solid fa-gear"></i> Settings</NuxtLink>
                <button class="de-dropdown-item" role="menuitem" @click="toggleDarkMode"><i :class="isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon'"></i> {{ isDark ? 'Light Mode' : 'Dark Mode' }}</button>
                <div class="de-dropdown-divider" />
                <button class="de-dropdown-item" role="menuitem" @click="handleSignOut"><i class="fa-solid fa-right-from-bracket"></i> Sign out</button>
              </div>
            </div>
          </template>
          <template v-else>
            <NuxtLink to="/auth/login" class="de-btn-ghost">Log in</NuxtLink>
            <NuxtLink to="/auth/register" class="de-btn-primary">Sign up</NuxtLink>
          </template>

          <button class="de-mobile-toggle" aria-label="Toggle menu" @click="mobileMenuOpen = !mobileMenuOpen">
            <i :class="mobileMenuOpen ? 'fa-solid fa-xmark' : 'fa-solid fa-bars'"></i>
          </button>
        </div>
      </div>
    </header>

    <!-- Mobile menu -->
    <div v-if="mobileMenuOpen" class="de-mobile-menu" @click.self="mobileMenuOpen = false">
      <nav class="de-mobile-nav" aria-label="Mobile navigation">
        <NuxtLink to="/" class="de-mobile-link" @click="mobileMenuOpen = false"><i class="fa-solid fa-house"></i> Home</NuxtLink>
        <NuxtLink to="/project" class="de-mobile-link" @click="mobileMenuOpen = false"><i class="fa-solid fa-microchip"></i> Projects</NuxtLink>
        <NuxtLink to="/blog" class="de-mobile-link" @click="mobileMenuOpen = false"><i class="fa-solid fa-pen-nib"></i> Blog</NuxtLink>
        <NuxtLink v-if="hubs" to="/hubs" class="de-mobile-link" @click="mobileMenuOpen = false"><i class="fa-solid fa-users"></i> Communities</NuxtLink>
        <NuxtLink v-if="contests" to="/contests" class="de-mobile-link" @click="mobileMenuOpen = false"><i class="fa-solid fa-trophy"></i> Contests</NuxtLink>
        <NuxtLink to="/search" class="de-mobile-link" @click="mobileMenuOpen = false"><i class="fa-solid fa-magnifying-glass"></i> Search</NuxtLink>
        <NuxtLink v-if="isAdmin && admin" to="/admin" class="de-mobile-link" @click="mobileMenuOpen = false"><i class="fa-solid fa-shield-halved"></i> Admin</NuxtLink>
        <template v-if="isAuthenticated">
          <div class="de-mobile-divider" />
          <NuxtLink to="/create" class="de-mobile-link" @click="mobileMenuOpen = false"><i class="fa-solid fa-plus"></i> Create</NuxtLink>
          <NuxtLink to="/dashboard" class="de-mobile-link" @click="mobileMenuOpen = false"><i class="fa-solid fa-gauge"></i> Dashboard</NuxtLink>
          <NuxtLink to="/messages" class="de-mobile-link" @click="mobileMenuOpen = false"><i class="fa-solid fa-envelope"></i> Messages</NuxtLink>
          <NuxtLink to="/notifications" class="de-mobile-link" @click="mobileMenuOpen = false"><i class="fa-solid fa-bell"></i> Notifications</NuxtLink>
        </template>
      </nav>
    </div>

    <!-- Main -->
    <main id="main-content">
      <slot />
    </main>

    <AppToast />

    <!-- Footer -->
    <footer class="de-footer">
      <div class="de-footer-inner">
        <div class="de-footer-brand">
          <DevEcoLogo variant="dark-bg" size="sm" :show-text="true" />
          <p class="de-footer-tagline">The open platform for Edge AI projects, hardware, and communities. Built by developers, for developers.</p>
          <div class="de-footer-backer">Backed by <a href="https://www.edgeaifoundation.org/" target="_blank" rel="noopener"><strong>EDGE AI FOUNDATION</strong></a></div>
          <div class="de-footer-social">
            <a href="https://github.com/edge-ai-foundation" target="_blank" rel="noopener" class="de-footer-social-link" aria-label="GitHub"><i class="fa-brands fa-github"></i></a>
            <a href="https://discord.gg/deveco" target="_blank" rel="noopener" class="de-footer-social-link" aria-label="Discord"><i class="fa-brands fa-discord"></i></a>
            <a href="/feed.xml" class="de-footer-social-link" aria-label="RSS"><i class="fa-solid fa-rss"></i></a>
          </div>
        </div>
        <nav class="de-footer-col" aria-label="Content links">
          <h4 class="de-footer-col-title">Content</h4>
          <NuxtLink v-for="ct in enabledTypeMeta" :key="ct.type" :to="ct.route" class="de-footer-link">{{ ct.plural }}</NuxtLink>
        </nav>
        <nav class="de-footer-col" aria-label="Community links">
          <h4 class="de-footer-col-title">Community</h4>
          <NuxtLink v-if="hubs" to="/hubs" class="de-footer-link">Communities</NuxtLink>
          <NuxtLink v-if="contests" to="/contests" class="de-footer-link">Contests</NuxtLink>
          <NuxtLink to="/search" class="de-footer-link">Explore</NuxtLink>
        </nav>
        <nav class="de-footer-col" aria-label="Platform links">
          <h4 class="de-footer-col-title">Platform</h4>
          <NuxtLink to="/about" class="de-footer-link">About</NuxtLink>
          <a href="/feed.xml" class="de-footer-link">RSS Feed</a>
          <a href="/sitemap.xml" class="de-footer-link">Sitemap</a>
        </nav>
      </div>
      <div class="de-footer-bottom">
        <span>&copy; {{ new Date().getFullYear() }} devEco.io &middot; Part of <a href="https://www.edgeaifoundation.org/" target="_blank" rel="noopener">EDGE AI FOUNDATION</a></span>
        <span class="de-footer-ioc">
          <i class="fa-solid fa-globe"></i>
          <a href="https://thedeveco.com/community" target="_blank" rel="noopener">Internet of Communities&trade;</a>
        </span>
        <span class="de-powered">Powered by <a href="https://github.com/commonpub/commonpub" target="_blank" rel="noopener">CommonPub</a></span>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.de-layout { min-height: 100vh; display: flex; flex-direction: column; }

/* ---- TOP BANNER ---- */
.de-top-banner {
  background: var(--deveco-dark-green); color: rgba(255, 255, 255, 0.6);
  text-align: center; padding: 8px 12px;
  font-size: 0.75rem; font-weight: 500; line-height: 1.4;
}
.de-top-banner strong { color: var(--accent); }
.de-top-banner a { color: var(--accent); text-decoration: underline; }
.de-top-banner a:hover { color: #fff; }

/* ---- TOPBAR ---- */
.de-topbar {
  position: sticky; top: 0; left: 0; right: 0; height: 60px;
  background: var(--surface);
  border-bottom-left-radius: 12px; border-bottom-right-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  z-index: 100; backdrop-filter: blur(8px);
}

.de-topbar-inner {
  max-width: 1280px; margin: 0 auto; height: 100%;
  display: flex; align-items: center; padding: 0 24px; gap: 0;
}

.de-topbar-logo { display: flex; align-items: center; text-decoration: none; flex-shrink: 0; }

.de-topbar-nav { display: flex; align-items: center; gap: 2px; margin-left: 32px; }
.de-nav-link {
  font-size: 0.875rem; font-weight: 500; color: var(--text-dim);
  padding: 8px 14px; border-radius: 6px; text-decoration: none;
  transition: color 0.15s, background 0.15s;
}
.de-nav-link:hover { color: var(--text); background: var(--surface2); }
.de-nav-link.router-link-active { color: var(--deveco-dark-green); background: var(--accent-bg); font-weight: 600; }

.de-topbar-spacer { flex: 1; }
.de-topbar-actions { display: flex; align-items: center; gap: 8px; }

.de-search-form {
  display: flex; align-items: center; gap: 8px;
  padding: 0 14px; background: var(--surface2); border: 1px solid var(--border);
  border-radius: 8px; min-width: 220px; transition: border-color 0.15s, box-shadow 0.15s;
}
.de-search-form:focus-within { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(0, 231, 173, 0.12); }
.de-search-icon { font-size: 12px; color: var(--text-faint); flex-shrink: 0; }
.de-search-input {
  flex: 1; border: none; background: none; outline: none;
  padding: 8px 0; font-size: 0.8125rem; color: var(--text);
  font-family: var(--font-sans);
}
.de-search-input::placeholder { color: var(--text-faint); }
.de-kbd {
  margin-left: auto; font-size: 0.6875rem; font-family: var(--font-mono);
  padding: 2px 6px; background: var(--surface3); border: 1px solid var(--border);
  border-radius: 4px; color: var(--text-faint);
}

.de-icon-btn {
  width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;
  background: transparent; border: 1px solid transparent; border-radius: 8px;
  color: var(--text-dim); font-size: 14px; position: relative;
  transition: all 0.15s; text-decoration: none;
}
.de-icon-btn:hover { background: var(--surface2); border-color: var(--border); color: var(--text); }
.de-notif-dot { position: absolute; top: 6px; right: 6px; width: 7px; height: 7px; border-radius: 50%; background: var(--accent); border: 1.5px solid var(--surface); }

.de-btn-primary {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 10px 16px; min-height: 44px; background: var(--deveco-dark-green); border: none;
  border-radius: 8px; color: #fff; font-size: 0.8125rem; font-weight: 600;
  text-decoration: none; cursor: pointer; transition: all 0.15s;
}
.de-btn-primary:hover { background: var(--color-primary-hover); box-shadow: var(--shadow-md); }

.de-btn-ghost {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 10px 16px; min-height: 44px; background: transparent; border: none;
  border-radius: 8px; color: var(--text-dim); font-size: 0.8125rem; font-weight: 500;
  text-decoration: none; cursor: pointer; transition: color 0.15s;
}
.de-btn-ghost:hover { color: var(--text); }

.de-avatar-btn { background: none; border: none; padding: 0; cursor: pointer; }
.de-user-avatar-img {
  width: 32px; height: 32px; border-radius: 50%; object-fit: cover;
  border: 2px solid var(--accent);
}
.de-user-avatar {
  width: 32px; height: 32px; border-radius: 50%;
  background: var(--accent-bg); border: 2px solid var(--accent);
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 700; color: var(--deveco-dark-green);
  font-family: var(--font-sans);
}
.de-user-menu-wrapper { position: relative; }
.de-user-dropdown {
  position: absolute; top: calc(100% + 8px); right: 0; min-width: 200px;
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 12px; box-shadow: var(--shadow-lg);
  z-index: 200; display: flex; flex-direction: column; padding: 6px;
}
.de-dropdown-item {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 14px; min-height: 44px; font-size: 0.8125rem; color: var(--text-dim);
  text-decoration: none; background: none; border: none; border-radius: 8px;
  cursor: pointer; font-family: inherit; width: 100%; text-align: left;
  transition: all 0.12s;
}
.de-dropdown-item:hover { background: var(--surface2); color: var(--text); }
.de-dropdown-item i { width: 16px; text-align: center; font-size: 12px; }
.de-dropdown-divider { height: 1px; background: var(--border); margin: 4px 8px; }

.de-search-icon-btn {
  display: none; width: 36px; height: 36px;
  align-items: center; justify-content: center;
  background: var(--surface2); border: 1px solid var(--border); border-radius: 8px;
  color: var(--text-dim); font-size: 14px; text-decoration: none;
  transition: all 0.15s;
}
.de-search-icon-btn:hover { background: var(--surface3); color: var(--text); }

.de-search-icon-mobile {
  display: none; width: 40px; height: 40px;
  align-items: center; justify-content: center;
  background: var(--surface2); border: 1px solid var(--border); border-radius: 8px;
  color: var(--text-dim); font-size: 14px; text-decoration: none;
  transition: all 0.15s;
}
.de-search-icon-mobile:hover { background: var(--surface3); color: var(--text); }

.de-mobile-toggle {
  display: none; width: 44px; height: 44px;
  background: none; border: 1px solid transparent; border-radius: 8px;
  color: var(--text-dim); font-size: 18px; cursor: pointer;
  align-items: center; justify-content: center;
}
.de-mobile-menu {
  display: none; position: fixed; inset: 0; top: 60px;
  z-index: 99; background: rgba(0, 0, 0, 0.3); backdrop-filter: blur(4px);
}
.de-mobile-nav {
  background: var(--surface); border-bottom: 1px solid var(--border);
  padding: 8px 6px; display: flex; flex-direction: column;
  box-shadow: var(--shadow-lg);
}
.de-mobile-link {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 14px; min-height: 44px; font-size: 0.8125rem; color: var(--text-dim);
  text-decoration: none; border-radius: 6px; transition: background 0.1s;
}
.de-mobile-link:hover { background: var(--surface2); color: var(--text); }
.de-mobile-link i { width: 16px; text-align: center; font-size: 13px; }
.de-mobile-divider { height: 1px; background: var(--border); margin: 4px 14px; }

#main-content { flex: 1; }

/* ---- FOOTER ---- */
.de-footer {
  background: var(--deveco-dark-green); color: #fff; margin-top: auto;
}
.de-footer-inner {
  max-width: 1280px; margin: 0 auto; padding: 48px 32px 40px;
  display: grid; grid-template-columns: 1.5fr repeat(3, 1fr); gap: 40px;
}
.de-footer-brand { display: flex; flex-direction: column; gap: 12px; }
.de-footer-tagline { font-size: 0.8125rem; color: rgba(255, 255, 255, 0.6); line-height: 1.5; }
.de-footer-social { display: flex; gap: 10px; margin-top: 4px; }
.de-footer-social-link {
  width: 34px; height: 34px; background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  color: rgba(255, 255, 255, 0.7); font-size: 14px; text-decoration: none;
  transition: all 0.12s;
}
.de-footer-social-link:hover { background: var(--accent); color: var(--deveco-dark-green); border-color: var(--accent); }
.de-footer-col { display: flex; flex-direction: column; gap: 8px; }
.de-footer-col-title {
  font-family: var(--font-sans); font-size: 0.75rem; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.08em;
  color: rgba(255, 255, 255, 0.4); margin-bottom: 4px;
}
.de-footer-link {
  font-size: 0.8125rem; color: rgba(255, 255, 255, 0.7);
  text-decoration: none; transition: color 0.12s;
}
.de-footer-link:hover { color: var(--accent); }
.de-footer-bottom {
  max-width: 1280px; margin: 0 auto; padding: 16px 32px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  font-size: 0.75rem; color: rgba(255, 255, 255, 0.4);
  display: flex; justify-content: space-between; align-items: center;
}
.de-footer-bottom a { color: rgba(255, 255, 255, 0.5); text-decoration: none; }
.de-footer-bottom a:hover { color: var(--accent); }
.de-footer-backer {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 0.6875rem; color: rgba(255, 255, 255, 0.4);
  padding: 6px 10px; background: rgba(0, 231, 173, 0.08);
  border-radius: 4px; width: fit-content;
}
.de-footer-backer a { color: inherit; text-decoration: none; }
.de-footer-backer a:hover { text-decoration: underline; }
.de-footer-backer strong { color: var(--accent); }

.de-footer-ioc {
  display: flex; align-items: center; gap: 6px;
  color: #5865F2;
}
.de-footer-ioc a { color: #5865F2; text-decoration: none; }
.de-footer-ioc a:hover { text-decoration: underline; }
.de-footer-ioc i { font-size: 14px; }

.de-powered a { color: var(--accent); text-decoration: none; }
.de-powered a:hover { text-decoration: underline; }

@media (max-width: 768px) {
  .de-topbar-nav { display: none; }
  .de-topbar-spacer { display: none; }
  .de-topbar-actions { gap: 6px; margin-left: auto; }
  .de-search-form { display: none; }
  .de-search-icon-mobile { display: flex; }
  .de-kbd { display: none; }
  .de-new-text { display: none; }
  .de-btn-ghost { font-size: 0.8125rem; padding: 8px 12px; white-space: nowrap; }
  .de-btn-primary { font-size: 0.8125rem; padding: 8px 12px; white-space: nowrap; min-height: 40px; }
  .de-icon-btn { display: none; }
  .de-mobile-toggle { display: flex; }
  .de-mobile-menu { display: block; }
  .de-footer-inner { grid-template-columns: 1fr 1fr; gap: 28px; }
  .de-footer-bottom { flex-direction: column; gap: 6px; text-align: center; }
}
@media (max-width: 480px) {
  .de-topbar-inner { padding: 0 8px; }
  .de-footer-inner { grid-template-columns: 1fr; }
}
</style>
