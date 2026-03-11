<script lang="ts">
  import ContentCard from '$lib/components/ContentCard.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const difficulties = [
    { value: '', label: 'All Levels' },
    { value: 'beginner', label: 'Beginner' },
    { value: 'intermediate', label: 'Intermediate' },
    { value: 'advanced', label: 'Advanced' },
  ];

  const sortOptions = [
    { value: 'recent', label: 'Recent' },
    { value: 'popular', label: 'Popular' },
    { value: 'featured', label: 'Featured' },
  ];

  function buildUrl(params: Record<string, string>): string {
    const sp = new URLSearchParams();
    const sort = params.sort ?? data.sort;
    const difficulty = params.difficulty ?? data.difficulty ?? '';
    if (sort && sort !== 'recent') sp.set('sort', sort);
    if (difficulty) sp.set('difficulty', difficulty);
    if (params.page && params.page !== '1') sp.set('page', params.page);
    const qs = sp.toString();
    return `/projects${qs ? `?${qs}` : ''}`;
  }
</script>

<svelte:head>
  <title>Projects — Snaplify</title>
  <meta name="description" content="Browse maker projects from the community." />
</svelte:head>

<div class="browse-page">
  <div class="browse-header">
    <h1 class="browse-title">Projects</h1>
    <span class="browse-count">{data.total} projects</span>
  </div>

  <div class="browse-filters">
    <div class="filter-pills">
      <a
        href={buildUrl({ difficulty: '' })}
        class="filter-pill"
        class:filter-pill-active={!data.difficulty}
      >
        All
      </a>
      {#each difficulties.slice(1) as d}
        <a
          href={buildUrl({ difficulty: d.value })}
          class="filter-pill"
          class:filter-pill-active={data.difficulty === d.value}
        >
          {d.label}
        </a>
      {/each}
    </div>

    <div class="filter-sort">
      {#each sortOptions as opt}
        <a
          href={buildUrl({ sort: opt.value })}
          class="sort-link"
          class:sort-link-active={data.sort === opt.value}
        >
          {opt.label}
        </a>
      {/each}
    </div>
  </div>

  {#if data.items.length === 0}
    <div class="empty-state">
      <p>No projects found.</p>
    </div>
  {:else}
    <div class="content-grid">
      {#each data.items as item (item.id)}
        <ContentCard {item} />
      {/each}
    </div>
  {/if}

  {#if data.totalPages > 1}
    <nav class="pagination" aria-label="Pagination">
      {#if data.page > 1}
        <a href={buildUrl({ page: String(data.page - 1) })} class="page-link">Previous</a>
      {/if}
      {#each Array.from({ length: data.totalPages }, (_, i) => i + 1) as p}
        <a
          href={buildUrl({ page: String(p) })}
          class="page-link"
          class:page-link-active={data.page === p}
          aria-current={data.page === p ? 'page' : undefined}
        >
          {p}
        </a>
      {/each}
      {#if data.page < data.totalPages}
        <a href={buildUrl({ page: String(data.page + 1) })} class="page-link">Next</a>
      {/if}
    </nav>
  {/if}
</div>

<style>
  .browse-page {
    display: flex;
    flex-direction: column;
    gap: var(--space-6, 1.5rem);
  }

  .browse-header {
    display: flex;
    align-items: baseline;
    gap: var(--space-3, 0.75rem);
  }

  .browse-title {
    font-size: var(--text-2xl, 1.5rem);
    font-weight: var(--font-weight-bold, 700);
    color: var(--color-text, #d8d5cf);
    margin: 0;
  }

  .browse-count {
    font-family: var(--font-mono, monospace);
    font-size: var(--text-xs, 0.6875rem);
    color: var(--color-text-muted, #444440);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .browse-filters {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-3, 0.75rem);
  }

  .filter-pills {
    display: flex;
    gap: var(--space-1, 0.25rem);
    flex-wrap: wrap;
  }

  .filter-pill {
    padding: var(--space-1, 0.25rem) var(--space-3, 0.75rem);
    border: 1px solid var(--color-border, #272725);
    border-radius: var(--radius-md, 0.25rem);
    font-size: var(--text-sm, 0.75rem);
    font-family: var(--font-mono, monospace);
    text-decoration: none;
    color: var(--color-text-secondary, #888884);
    transition: all var(--transition-fast, 0.1s ease);
  }

  .filter-pill:hover {
    border-color: var(--color-border-strong, #333330);
    color: var(--color-text, #d8d5cf);
  }

  .filter-pill-active {
    background: var(--color-surface-raised, #1c1c1a);
    border-color: var(--color-border-strong, #333330);
    color: var(--color-text, #d8d5cf);
  }

  .filter-sort {
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
    transition: color var(--transition-fast, 0.1s ease);
  }

  .sort-link:hover {
    color: var(--color-text-secondary, #888884);
  }

  .sort-link-active {
    color: var(--color-primary, #5b9cf6);
  }

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
    padding-top: var(--space-6, 1.5rem);
  }

  .page-link {
    padding: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
    border: 1px solid var(--color-border, #272725);
    border-radius: var(--radius-md, 0.25rem);
    font-size: var(--text-sm, 0.75rem);
    font-family: var(--font-mono, monospace);
    text-decoration: none;
    color: var(--color-text-secondary, #888884);
    transition: all var(--transition-fast, 0.1s ease);
  }

  .page-link:hover {
    border-color: var(--color-border-strong, #333330);
    color: var(--color-text, #d8d5cf);
  }

  .page-link-active {
    background: var(--color-primary, #5b9cf6);
    border-color: var(--color-primary, #5b9cf6);
    color: var(--color-primary-text, #0c0c0b);
  }

  @media (max-width: 1024px) {
    .content-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (max-width: 640px) {
    .content-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
