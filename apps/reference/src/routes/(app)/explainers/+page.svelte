<script lang="ts">
  import ContentCard from '$lib/components/ContentCard.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const sortOptions = [
    { value: 'recent', label: 'Recent' },
    { value: 'popular', label: 'Popular' },
  ];
</script>

<svelte:head>
  <title>Explainers — Snaplify</title>
  <meta name="description" content="Interactive learning experiences from the maker community." />
</svelte:head>

<div class="listing-page">
  <div class="listing-header">
    <h1 class="listing-title">Explainers</h1>
    <div class="listing-sort">
      {#each sortOptions as opt}
        <a
          href="/explainers{opt.value !== 'recent' ? `?sort=${opt.value}` : ''}"
          class="sort-link"
          class:sort-link-active={data.sort === opt.value}
        >
          {opt.label}
        </a>
      {/each}
    </div>
  </div>

  {#if data.items.length === 0}
    <div class="empty-state"><p>No explainers published yet.</p></div>
  {:else}
    <div class="content-grid">
      {#each data.items as item (item.id)}
        <ContentCard {item} />
      {/each}
    </div>
  {/if}

  {#if data.totalPages > 1}
    <nav class="pagination" aria-label="Pagination">
      {#each Array.from({ length: data.totalPages }, (_, i) => i + 1) as p}
        <a
          href="/explainers?page={p}{data.sort !== 'recent' ? `&sort=${data.sort}` : ''}"
          class="page-link"
          class:page-link-active={data.page === p}
          aria-current={data.page === p ? 'page' : undefined}
        >{p}</a>
      {/each}
    </nav>
  {/if}
</div>

<style>
  .listing-page {
    display: flex;
    flex-direction: column;
    gap: var(--space-6, 1.5rem);
  }

  .listing-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }

  .listing-title {
    font-size: var(--text-2xl, 1.5rem);
    font-weight: var(--font-weight-bold, 700);
    color: var(--color-text, #d8d5cf);
    margin: 0;
  }

  .listing-sort {
    display: flex;
    gap: var(--space-1, 0.25rem);
  }

  .sort-link {
    padding: var(--space-1, 0.25rem) var(--space-2, 0.5rem);
    font-size: var(--text-xs, 0.6875rem);
    font-family: var(--font-mono, monospace);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    text-decoration: none;
    color: var(--color-text-muted, #444440);
  }

  .sort-link:hover { color: var(--color-text-secondary, #888884); }
  .sort-link-active { color: var(--color-primary, #5b9cf6); }

  .content-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-4, 1rem);
  }

  .empty-state {
    text-align: center;
    padding: var(--space-12, 3rem);
    color: var(--color-text-secondary, #888884);
  }

  .pagination {
    display: flex;
    justify-content: center;
    gap: var(--space-1, 0.25rem);
  }

  .page-link {
    padding: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
    border: 1px solid var(--color-border, #272725);
    border-radius: var(--radius-md, 0.25rem);
    font-size: var(--text-sm, 0.75rem);
    font-family: var(--font-mono, monospace);
    text-decoration: none;
    color: var(--color-text-secondary, #888884);
  }

  .page-link:hover { border-color: var(--color-border-strong, #333330); color: var(--color-text, #d8d5cf); }
  .page-link-active { background: var(--color-primary, #5b9cf6); border-color: var(--color-primary); color: var(--color-primary-text, #0c0c0b); }

  @media (max-width: 1024px) { .content-grid { grid-template-columns: repeat(2, 1fr); } }
  @media (max-width: 640px) { .content-grid { grid-template-columns: 1fr; } }
</style>
