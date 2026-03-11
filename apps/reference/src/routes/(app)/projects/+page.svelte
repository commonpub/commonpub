<script lang="ts">
  import ContentCard from '$lib/components/ContentCard.svelte';
  import Pagination from '$lib/components/Pagination.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const tagChips = ['all', 'esp32', 'raspberry pi', 'arduino', 'lora', 'ble', 'mqtt', 'edge ai', 'rust', 'cellular'];

  function buildUrl(params: Record<string, string>): string {
    const sp = new URLSearchParams();
    const sort = params.sort ?? data.sort;
    const difficulty = params.difficulty ?? data.difficulty ?? '';
    const tag = params.tag ?? data.tag ?? '';
    if (sort && sort !== 'recent') sp.set('sort', sort);
    if (difficulty) sp.set('difficulty', difficulty);
    if (tag && tag !== 'all') sp.set('tag', tag);
    if (params.page && params.page !== '1') sp.set('page', params.page);
    const qs = sp.toString();
    return `/projects${qs ? `?${qs}` : ''}`;
  }
</script>

<svelte:head>
  <title>Projects — Snaplify</title>
  <meta name="description" content="Browse maker projects from the community." />
</svelte:head>

<div class="page-wide">
  <div class="filter-bar">
    {#each tagChips as chip}
      <a
        href={buildUrl({ tag: chip, page: '1' })}
        class="fchip"
        class:active={(!data.tag && chip === 'all') || data.tag === chip}
      >
        {chip}
      </a>
    {/each}
  </div>

  <div class="sort-row">
    <span class="sort-label">sort:</span>
    <select
      class="sort-select"
      onchange={(e) => {
        const target = e.currentTarget as HTMLSelectElement;
        window.location.href = buildUrl({ sort: target.value, page: '1' });
      }}
    >
      <option value="recent" selected={data.sort === 'recent'}>recent</option>
      <option value="popular" selected={data.sort === 'popular'}>popular</option>
      <option value="featured" selected={data.sort === 'featured'}>featured</option>
    </select>
    <span class="sort-label">difficulty:</span>
    <select
      class="sort-select"
      onchange={(e) => {
        const target = e.currentTarget as HTMLSelectElement;
        window.location.href = buildUrl({ difficulty: target.value, page: '1' });
      }}
    >
      <option value="" selected={!data.difficulty}>all</option>
      <option value="beginner" selected={data.difficulty === 'beginner'}>beginner</option>
      <option value="intermediate" selected={data.difficulty === 'intermediate'}>intermediate</option>
      <option value="advanced" selected={data.difficulty === 'advanced'}>advanced</option>
    </select>
    <span class="sort-count">{data.total.toLocaleString()} projects</span>
  </div>

  {#if data.items.length === 0}
    <div class="empty-state">
      <p>No projects found.</p>
    </div>
  {:else}
    <div class="grid-3">
      {#each data.items as item (item.id)}
        <ContentCard {item} />
      {/each}
    </div>
  {/if}

  <Pagination
    page={data.page}
    totalPages={data.totalPages}
    buildUrl={(p) => buildUrl({ page: String(p) })}
  />
</div>

<style>
  .sort-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
  }

  .sort-label {
    font-size: 11px;
    font-family: var(--font-mono, monospace);
    color: var(--color-text-muted, #444440);
  }

  .sort-select {
    background: var(--color-surface-raised, #1c1c1a);
    border: 1px solid var(--color-border, #272725);
    color: var(--color-text-secondary, #888884);
    padding: 4px 8px;
    border-radius: var(--radius-md, 0.25rem);
    font-size: 11px;
    font-family: inherit;
  }

  .sort-count {
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
