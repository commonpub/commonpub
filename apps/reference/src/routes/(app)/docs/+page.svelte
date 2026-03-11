<script lang="ts">
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>Documentation — Snaplify</title>
  <meta name="description" content="Browse documentation sites." />
</svelte:head>

<section class="docs-list-page">
  <h1 class="page-title">Documentation</h1>

  {#if data.sites.length === 0}
    <div class="empty-state">
      <p>No documentation sites yet.</p>
    </div>
  {:else}
    <div class="docs-grid">
      {#each data.sites as site (site.id)}
        <a href="/docs/{site.slug}" class="docs-card">
          <h2 class="docs-card-title">{site.name}</h2>
          {#if site.description}
            <p class="docs-card-desc">{site.description}</p>
          {/if}
          <span class="docs-card-owner">by {site.owner.displayName ?? site.owner.username}</span>
        </a>
      {/each}
    </div>
  {/if}
</section>

<style>
  .docs-list-page {
    max-width: var(--layout-max-width, 1200px);
    margin: 0 auto;
    padding: var(--space-4, 1rem);
  }

  .page-title {
    font-size: var(--text-2xl, 1.875rem);
    margin-bottom: var(--space-6, 2rem);
    color: var(--color-text, inherit);
  }

  .docs-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: var(--space-4, 1rem);
  }

  .docs-card {
    display: block;
    padding: var(--space-4, 1rem);
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: var(--radius-md, 0.375rem);
    text-decoration: none;
    color: var(--color-text, inherit);
  }

  .docs-card:hover {
    border-color: var(--color-primary, #3b82f6);
    background: var(--color-bg-hover, #f9fafb);
  }

  .docs-card-title {
    font-size: var(--text-lg, 1.125rem);
    font-weight: var(--font-weight-semibold, 600);
    margin-bottom: var(--space-1, 0.25rem);
  }

  .docs-card-desc {
    font-size: var(--text-sm, 0.875rem);
    color: var(--color-text-secondary, #6b7280);
    margin-bottom: var(--space-2, 0.5rem);
  }

  .docs-card-owner {
    font-size: var(--text-xs, 0.75rem);
    color: var(--color-text-muted, #9ca3af);
  }

  .empty-state {
    text-align: center;
    padding: var(--space-12, 3rem);
    color: var(--color-text-secondary, #6b7280);
  }
</style>
