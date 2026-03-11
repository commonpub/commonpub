<script lang="ts">
  import ContentCard from '$lib/components/ContentCard.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const typeFilters = [
    { value: 'all', label: 'All' },
    { value: 'project', label: 'Projects' },
    { value: 'guide', label: 'Guides' },
    { value: 'explainer', label: 'Explainers' },
    { value: 'article', label: 'Articles' },
    { value: 'blog', label: 'Blog' },
  ];

  function buildUrl(params: Record<string, string>): string {
    const sp = new URLSearchParams();
    const q = params.q ?? data.query;
    const type = params.type ?? data.type;
    if (q) sp.set('q', q);
    if (type && type !== 'all') sp.set('type', type);
    if (params.page && params.page !== '1') sp.set('page', params.page);
    return `/search?${sp.toString()}`;
  }
</script>

<svelte:head>
  <title>{data.query ? `${data.query} — Search` : 'Search'} — Snaplify</title>
</svelte:head>

<div class="search-page">
  <form action="/search" method="GET" class="search-form">
    <div class="search-input-wrap">
      <svg class="search-icon" width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.5"/>
        <path d="M11 11L14 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
      <input
        type="search"
        name="q"
        value={data.query}
        placeholder="Search projects, guides, articles..."
        class="search-input"
        autofocus
      />
    </div>
  </form>

  {#if data.query}
    <div class="search-filters">
      {#each typeFilters as filter}
        <a
          href={buildUrl({ type: filter.value })}
          class="filter-chip"
          class:filter-chip-active={data.type === filter.value}
        >
          {filter.label}
        </a>
      {/each}
    </div>

    <div class="search-meta">
      <span class="result-count">{data.total} result{data.total !== 1 ? 's' : ''}</span>
    </div>

    {#if data.items.length === 0}
      <div class="empty-state">
        <p>No results found for "{data.query}"</p>
      </div>
    {:else}
      <div class="results-list">
        {#each data.items as item (item.id)}
          <ContentCard {item} />
        {/each}
      </div>
    {/if}
  {:else}
    <div class="empty-state">
      <p>Search for projects, guides, articles, and more.</p>
    </div>
  {/if}
</div>

<style>
  .search-page {
    max-width: 800px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-6, 1.5rem);
  }

  .search-form {
    margin-top: var(--space-4, 1rem);
  }

  .search-input-wrap {
    position: relative;
    display: flex;
    align-items: center;
  }

  .search-icon {
    position: absolute;
    left: var(--space-4, 1rem);
    color: var(--color-text-muted, #444440);
    pointer-events: none;
  }

  .search-input {
    width: 100%;
    padding: var(--space-4, 1rem) var(--space-4, 1rem) var(--space-4, 1rem) var(--space-10, 2.5rem);
    border: 1px solid var(--color-border, #272725);
    border-radius: var(--radius-lg, 0.5rem);
    font-size: var(--text-md, 1rem);
    background: var(--color-surface-alt, #141413);
    color: var(--color-text, #d8d5cf);
    outline: none;
    transition: border-color var(--transition-fast, 0.1s ease);
  }

  .search-input:focus {
    border-color: var(--color-primary, #5b9cf6);
    box-shadow: var(--focus-ring);
  }

  .search-input::placeholder {
    color: var(--color-text-muted, #444440);
  }

  .search-filters {
    display: flex;
    gap: var(--space-1, 0.25rem);
    flex-wrap: wrap;
  }

  .filter-chip {
    padding: var(--space-1, 0.25rem) var(--space-3, 0.75rem);
    border: 1px solid var(--color-border, #272725);
    border-radius: var(--radius-md, 0.25rem);
    font-size: var(--text-sm, 0.75rem);
    font-family: var(--font-mono, monospace);
    text-decoration: none;
    color: var(--color-text-secondary, #888884);
    transition: all var(--transition-fast, 0.1s ease);
  }

  .filter-chip:hover {
    border-color: var(--color-border-strong, #333330);
    color: var(--color-text, #d8d5cf);
  }

  .filter-chip-active {
    background: var(--color-surface-raised, #1c1c1a);
    border-color: var(--color-border-strong, #333330);
    color: var(--color-text, #d8d5cf);
  }

  .search-meta {
    font-family: var(--font-mono, monospace);
    font-size: var(--text-xs, 0.6875rem);
    color: var(--color-text-muted, #444440);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .results-list {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--space-4, 1rem);
  }

  .empty-state {
    text-align: center;
    padding: var(--space-12, 3rem);
    color: var(--color-text-secondary, #888884);
  }

  @media (max-width: 640px) {
    .results-list {
      grid-template-columns: 1fr;
    }
  }
</style>
