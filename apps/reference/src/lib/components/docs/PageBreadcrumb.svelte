<script lang="ts">
  import type { BreadcrumbItem } from '@snaplify/docs';

  let {
    items = [],
    siteSlug,
    class: className = '',
  }: {
    items: BreadcrumbItem[];
    siteSlug: string;
    class?: string;
  } = $props();
</script>

<nav class="page-breadcrumb {className}" aria-label="Breadcrumb">
  <ol class="page-breadcrumb-list">
    <li class="page-breadcrumb-item">
      <a href="/docs/{siteSlug}" class="page-breadcrumb-link">Docs</a>
    </li>
    {#each items as item, i}
      <li class="page-breadcrumb-item" aria-current={i === items.length - 1 ? 'page' : undefined}>
        <span class="page-breadcrumb-separator" aria-hidden="true">/</span>
        {#if i === items.length - 1}
          <span class="page-breadcrumb-current">{item.title}</span>
        {:else}
          <a href="/docs/{siteSlug}/{item.path}" class="page-breadcrumb-link">{item.title}</a>
        {/if}
      </li>
    {/each}
  </ol>
</nav>

<style>
  .page-breadcrumb-list {
    display: flex;
    align-items: center;
    list-style: none;
    padding: 0;
    margin: 0;
    gap: var(--space-1, 0.25rem);
  }

  .page-breadcrumb-item {
    display: flex;
    align-items: center;
    gap: var(--space-1, 0.25rem);
    font-size: var(--text-sm, 0.875rem);
  }

  .page-breadcrumb-link {
    color: var(--text-muted, #9ca3af);
    text-decoration: none;
  }

  .page-breadcrumb-link:hover {
    color: var(--text-primary, inherit);
  }

  .page-breadcrumb-separator {
    color: var(--text-muted, #9ca3af);
  }

  .page-breadcrumb-current {
    color: var(--text-primary, inherit);
    font-weight: var(--font-weight-medium, 500);
  }
</style>
