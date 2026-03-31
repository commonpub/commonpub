<script setup lang="ts">
definePageMeta({ middleware: 'auth' });
useSeoMeta({ title: 'Settings — CommonPub' });

// Redirect bare /settings to /settings/profile on mount
onMounted(() => {
  const route = useRoute();
  if (route.path === '/settings') {
    navigateTo('/settings/profile', { replace: true });
  }
});
</script>

<template>
  <div class="cpub-settings-page">
    <div class="cpub-settings-layout">
      <aside class="cpub-settings-nav">
        <h2 class="cpub-sidebar-heading">Settings</h2>
        <nav>
          <NuxtLink to="/settings/profile" class="cpub-settings-link">
            <i class="fa-solid fa-user" style="width: 14px"></i> Profile
          </NuxtLink>
          <NuxtLink to="/settings/account" class="cpub-settings-link">
            <i class="fa-solid fa-shield-halved" style="width: 14px"></i> Account
          </NuxtLink>
          <NuxtLink to="/settings/notifications" class="cpub-settings-link">
            <i class="fa-solid fa-bell" style="width: 14px"></i> Notifications
          </NuxtLink>
          <NuxtLink to="/settings/appearance" class="cpub-settings-link">
            <i class="fa-solid fa-palette" style="width: 14px"></i> Appearance
          </NuxtLink>
        </nav>
      </aside>
      <div class="cpub-settings-content">
        <NuxtPage />
      </div>
    </div>
  </div>
</template>

<style scoped>
.cpub-settings-layout {
  display: grid;
  grid-template-columns: 200px 1fr;
  gap: 32px;
}

.cpub-settings-nav nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cpub-settings-link {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  font-size: 13px;
  color: var(--text-dim);
  text-decoration: none;
  border: 2px solid transparent;
}

.cpub-settings-link:hover {
  background: var(--surface2);
  color: var(--text);
}

.cpub-settings-link.router-link-active {
  background: var(--accent-bg);
  border-color: var(--accent-border);
  color: var(--accent);
}

@media (max-width: 768px) {
  .cpub-settings-layout {
    grid-template-columns: 1fr;
  }
}
</style>
