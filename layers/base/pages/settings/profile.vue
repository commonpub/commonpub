<script setup lang="ts">
/**
 * `/settings/profile` — the PARENT of the profile editor (plan R3.1 D7).
 *
 * This file used to be a 990-line form. It is now sub-navigation plus
 * `<NuxtPage/>`: because `pages/settings/profile/` shares this file's name,
 * Nuxt makes this the layout for every child route under it, so the tab strip
 * renders once and each tab owns its own form and its own save.
 *
 * ---------------------------------------------------------------------------
 * WHY THE SPLIT, AND WHAT LIVES WHERE
 * ---------------------------------------------------------------------------
 * There used to be two editors for the same person: `/settings/profile` and
 * `/settings/persona` both wrote `users.display_name`, `headline`, `location`,
 * `pronouns` and `bio`, sat as adjacent tabs, and gave a member no hint they
 * were the same answer. The merge is the fix, and it is only finished when the
 * duplicate inputs are DELETED rather than hidden (plan R3.5).
 *
 *   basics       avatar, banner, display name, headline, location, pronouns, bio
 *   links        website and the platforms the member lists
 *   experience   roles and history, plus skills
 *   questions    the operator's own sections (flag: `persona`)
 *
 * Each tab owns exactly one slice of `PUT /api/profile`, which applies only the
 * keys it is given (`updateUserProfile` tests every key for `undefined` before
 * it writes), so a partial body from one tab cannot blank another tab's fields.
 * No field is rendered by two tabs; `settingsProfileTabs.test.ts` sweeps the
 * directory and fails if one ever is.
 *
 * ---------------------------------------------------------------------------
 * ROUTES
 * ---------------------------------------------------------------------------
 * `/settings/profile` itself renders `profile/index.vue`, which redirects to
 * `/settings/profile/basics`, so every existing link into `/settings/profile`
 * still lands somewhere real. `/settings/persona` redirects to
 * `/settings/profile/questions` for the same reason (D8): the invitation
 * banner, the public-profile empty state and the e2e specs all point at it.
 */
definePageMeta({ middleware: 'auth' });
useSeoMeta({ title: `Profile, ${useSiteName()}` });

const { persona } = useFeatures();
const route = useRoute();

/**
 * The operator names their own questions, so the tab that holds them should
 * carry the operator's word. There is no `persona.tabLabel` in
 * `@commonpub/config` today (`config.persona` is accepted opaquely), so this is
 * the plan's default rather than a config read. When that key lands, this is
 * the one line that changes.
 */
const QUESTIONS_TAB_LABEL = 'About you';

interface ProfileTab {
  to: string;
  label: string;
  icon: string;
}

const tabs = computed<ProfileTab[]>(() => {
  const items: ProfileTab[] = [
    { to: '/settings/profile/basics', label: 'Basics', icon: 'fa-solid fa-user' },
    { to: '/settings/profile/links', label: 'Links', icon: 'fa-solid fa-link' },
    { to: '/settings/profile/experience', label: 'Experience', icon: 'fa-solid fa-briefcase' },
  ];
  // Off by default on every instance. A tab pointing at a page that renders
  // only a "not enabled" notice is worse than no tab.
  if (persona.value) {
    items.push({ to: '/settings/profile/questions', label: QUESTIONS_TAB_LABEL, icon: 'fa-solid fa-id-card' });
  }
  return items;
});

/**
 * `aria-current="page"` is set explicitly rather than left to `NuxtLink`'s own
 * exact-active behaviour: this is the only signal a screen reader gets about
 * which tab is open, and it should not depend on router internals or survive
 * only in a browser.
 */
function isCurrent(to: string): boolean {
  return route.path === to;
}
</script>

<template>
  <div class="cpub-profile-settings">
    <h1 class="cpub-page-title">Profile</h1>

    <nav class="cpub-profile-settings-tabs" aria-label="Profile sections">
      <NuxtLink
        v-for="tab in tabs"
        :key="tab.to"
        :to="tab.to"
        class="cpub-profile-settings-tab"
        :aria-current="isCurrent(tab.to) ? 'page' : undefined"
      >
        <i :class="tab.icon" aria-hidden="true"></i>
        {{ tab.label }}
      </NuxtLink>
    </nav>

    <NuxtPage />
  </div>
</template>

<style scoped>
.cpub-profile-settings {
  max-width: 640px;
  padding: var(--space-6);
}

.cpub-page-title {
  font-size: var(--text-xl);
  font-weight: var(--font-weight-bold);
  margin-bottom: var(--space-4);
}

/*
 * Named `cpub-profile-settings-*`, not `cpub-profile-tabs`: the public profile
 * at `/u/:username` already owns that class, and two views sharing one layout
 * class is how a style change to one silently redraws the other.
 *
 * Not the global `.cpub-tab-bar` either: that one is `position: sticky` against
 * `--nav-height`, which is right for a full-width page header and wrong inside
 * the settings content column.
 */
.cpub-profile-settings-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  border-bottom: var(--border-width-default) solid var(--border);
  margin-bottom: var(--space-6);
}

.cpub-profile-settings-tab {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-sm);
  /* --text-dim, not --text-faint: an inactive tab is still readable text and
     must clear AA against --bg in both themes. */
  color: var(--text-dim);
  text-decoration: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
}

.cpub-profile-settings-tab:hover {
  color: var(--text);
}

.cpub-profile-settings-tab:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.cpub-profile-settings-tab[aria-current='page'] {
  color: var(--accent);
  border-bottom-color: var(--accent);
  font-weight: var(--font-weight-medium);
}

@media (max-width: 768px) {
  .cpub-profile-settings {
    padding: var(--space-4) var(--space-2);
  }
}
</style>
