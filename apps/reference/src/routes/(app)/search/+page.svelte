<script lang="ts">
  import SearchResult from '$lib/components/SearchResult.svelte';
  import Pagination from '$lib/components/Pagination.svelte';
  import { typeToUrlSegment } from '$lib/utils/content-helpers';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const typeFilters = ['all', 'project', 'guide', 'explainer', 'article', 'blog'];

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

<div class="page">
  <div class="search-bar">
    <form action="/search" method="GET" style="width:100%;">
      <input
        type="search"
        name="q"
        value={data.query}
        placeholder="Search projects, guides, articles..."
        class="search-input"
        autofocus
      />
      {#if data.type && data.type !== 'all'}
        <input type="hidden" name="type" value={data.type} />
      {/if}
    </form>
    {#if data.query}
      <div class="search-type-row">
        <span class="type-label">type:</span>
        {#each typeFilters as t}
          <a
            href={buildUrl({ type: t, page: '1' })}
            class="fchip"
            class:active={data.type === t}
          >
            {t}
          </a>
        {/each}
        <span class="result-count">{data.total} result{data.total !== 1 ? 's' : ''}</span>
      </div>
    {/if}
  </div>

  {#if data.query && data.items.length > 0}
    {#each data.items as item (item.id)}
      <SearchResult
        type={item.type}
        title={item.title}
        excerpt={item.description ?? ''}
        author={item.author.displayName ?? item.author.username ?? ''}
        href={`/${typeToUrlSegment(item.type)}/${item.slug}`}
      />
    {/each}

    <Pagination
      page={data.page}
      totalPages={data.totalPages}
      buildUrl={(p) => buildUrl({ page: String(p) })}
    />
  {:else if data.query}
    <div class="empty-state">No results found for "{data.query}"</div>
  {:else}
    <div class="empty-state">Search for projects, guides, articles, and more.</div>
  {/if}
</div>

<style>
  .search-bar {
    margin-bottom: 20px;
  }

  .search-input {
    width: 100%;
    background: var(--color-surface-alt, #141413);
    border: 1px solid var(--color-border-strong, #333330);
    border-radius: var(--radius-md, 0.25rem);
    padding: 10px 16px;
    font-size: 14px;
    color: var(--color-text);
    outline: none;
    font-family: inherit;
  }

  .search-input:focus {
    border-color: var(--color-accent, #5b9cf6);
  }

  .search-input::placeholder {
    color: var(--color-text-muted, #444440);
  }

  .search-type-row {
    display: flex;
    gap: 8px;
    margin-top: 10px;
    align-items: center;
    flex-wrap: wrap;
  }

  .type-label {
    font-size: 11px;
    font-family: var(--font-mono, monospace);
    color: var(--color-text-muted, #444440);
  }

  .result-count {
    margin-left: auto;
    font-size: 11px;
    font-family: var(--font-mono, monospace);
    color: var(--color-text-muted, #444440);
  }

  .empty-state {
    text-align: center;
    padding: var(--space-12, 3rem);
    color: var(--color-text-secondary, #888884);
  }
</style>
