<script setup lang="ts">
/**
 * The settings shell: one sidebar, one `<NuxtPage/>`.
 *
 * Profile used to be two sibling entries here, Profile and Profile Details,
 * which were two editors for one person writing the same `users` columns. They
 * are now one entry with its own tabs inside `pages/settings/profile.vue`, so
 * the `persona` flag no longer adds anything to this nav: it decides whether
 * the questions TAB exists, one level down. `/settings/persona` still resolves,
 * as a redirect to `/settings/profile/questions`.
 *
 * PRIVACY IS NOT FLAG GATED, and used to be. It hung off `dataSharingConsents`
 * while sharing consents were the only thing on the page. They are not: the
 * page also carries profile visibility, the subject-rights links, and the
 * statistics objection, which is the one control a member has over processing
 * that runs whether or not they agree. Hiding the entry when sharing is off
 * would leave the objection reachable only by typing the URL, which is the
 * opposite of what an Art. 21 right needs. The page gates its own sections.
 */
definePageMeta({ middleware: 'auth' });
useSeoMeta({ title: `Settings, ${useSiteName()}` });
const { referralLinks } = useFeatures();
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
          <NuxtLink to="/settings/privacy" class="cpub-settings-link">
            <i class="fa-solid fa-user-shield" style="width: 14px"></i> Privacy
          </NuxtLink>
          <NuxtLink to="/settings/notifications" class="cpub-settings-link">
            <i class="fa-solid fa-bell" style="width: 14px"></i> Notifications
          </NuxtLink>
          <NuxtLink to="/settings/appearance" class="cpub-settings-link">
            <i class="fa-solid fa-palette" style="width: 14px"></i> Appearance
          </NuxtLink>
          <NuxtLink v-if="referralLinks" to="/settings/referral-links" class="cpub-settings-link">
            <i class="fa-solid fa-link" style="width: 14px"></i> Referral Links
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
  border: var(--border-width-default) solid transparent;
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
