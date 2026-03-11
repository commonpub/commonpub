<script lang="ts">
  import AdminNav from '$lib/components/admin/AdminNav.svelte';
  import { page } from '$app/stores';
  import type { LayoutData } from './$types';

  let { data, children } = $props<{ data: LayoutData; children: import('svelte').Snippet }>();
</script>

<div class="admin-layout">
  <aside class="admin-layout__sidebar">
    <h2 class="admin-layout__title">Admin</h2>
    <AdminNav currentPath={$page.url.pathname} />
  </aside>
  <div class="admin-layout__content">
    {@render children()}
  </div>
</div>

<style>
  .admin-layout {
    display: flex;
    gap: var(--space-6, 1.5rem);
    min-height: calc(100vh - var(--nav-height, 4rem));
  }

  .admin-layout__sidebar {
    width: var(--sidebar-width, 17.5rem);
    flex-shrink: 0;
    padding: var(--space-4, 1rem);
    border-right: var(--border-width-thin, 1px) solid var(--color-border, #e5e7eb);
  }

  .admin-layout__title {
    font-family: var(--font-heading, sans-serif);
    font-size: var(--text-lg, 1.125rem);
    font-weight: var(--font-weight-bold, 700);
    color: var(--color-text, #d8d5cf);
    margin: 0 0 var(--space-4, 1rem);
    padding: 0 var(--space-3, 0.75rem);
  }

  .admin-layout__content {
    flex: 1;
    padding: var(--space-4, 1rem);
    min-width: 0;
  }
</style>
