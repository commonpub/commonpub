<script lang="ts">
  import { hasPermission } from '$lib/utils/community-permissions';

  let {
    slug,
    active,
    role = null,
  }: {
    slug: string;
    active: string;
    role: string | null;
  } = $props();

  const showSettings = role ? hasPermission(role, 'editCommunity') : false;
</script>

<nav class="community-nav" aria-label="Community navigation">
  <a
    href="/communities/{slug}"
    class="nav-tab"
    class:nav-tab-active={active === 'feed'}
    aria-current={active === 'feed' ? 'page' : undefined}
  >
    Feed
  </a>
  <a
    href="/communities/{slug}/members"
    class="nav-tab"
    class:nav-tab-active={active === 'members'}
    aria-current={active === 'members' ? 'page' : undefined}
  >
    Members
  </a>
  {#if showSettings}
    <a
      href="/communities/{slug}/settings"
      class="nav-tab"
      class:nav-tab-active={active === 'settings'}
      aria-current={active === 'settings' ? 'page' : undefined}
    >
      Settings
    </a>
  {/if}
</nav>

<style>
  .community-nav {
    display: flex;
    gap: 0;
    border-bottom: 1px solid var(--color-border, #272725);
    margin-bottom: var(--space-6, 2rem);
  }

  .nav-tab {
    padding: var(--space-2, 0.5rem) var(--space-4, 1rem);
    text-decoration: none;
    color: var(--color-text-secondary, #888884);
    border-bottom: 2px solid transparent;
    font-size: var(--text-sm, 0.875rem);
  }

  .nav-tab:hover {
    color: var(--color-text, #d8d5cf);
  }

  .nav-tab-active {
    color: var(--color-primary, #2563eb);
    border-bottom-color: var(--color-primary, #2563eb);
    font-weight: var(--font-weight-medium, 500);
  }
</style>
