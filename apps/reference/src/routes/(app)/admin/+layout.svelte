<script lang="ts">
  import AdminNav from '$lib/components/admin/AdminNav.svelte';
  import { page } from '$app/stores';
  import type { LayoutData } from './$types';

  let { data, children } = $props<{ data: LayoutData; children: import('svelte').Snippet }>();
</script>

<div class="admin-layout">
  <aside class="admin-sidebar">
    <div class="admin-sidebar-header">
      <span class="admin-sidebar-label">admin</span>
      <span class="admin-sidebar-ver">v1.0.0</span>
    </div>
    <AdminNav currentPath={$page.url.pathname} />
  </aside>
  <div class="admin-content">
    {@render children()}
  </div>
</div>

<style>
  .admin-layout {
    display: flex;
    min-height: calc(100vh - 48px);
  }

  .admin-sidebar {
    width: 200px;
    flex-shrink: 0;
    padding: var(--space-4, 1rem) 0;
    border-right: 1px solid var(--color-border, #272725);
    background: var(--color-surface, #0c0c0b);
  }

  .admin-sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 var(--space-3, 0.75rem) var(--space-3, 0.75rem);
    border-bottom: 1px solid var(--color-border, #272725);
    margin-bottom: var(--space-3, 0.75rem);
  }

  .admin-sidebar-label {
    font-family: var(--font-mono, monospace);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--color-text, #d8d5cf);
    font-weight: 700;
  }

  .admin-sidebar-ver {
    font-family: var(--font-mono, monospace);
    font-size: 9px;
    color: var(--color-text-muted, #444440);
  }

  .admin-content {
    flex: 1;
    padding: var(--space-6, 1.5rem) var(--space-8, 2rem);
    min-width: 0;
    max-width: 960px;
  }
</style>
