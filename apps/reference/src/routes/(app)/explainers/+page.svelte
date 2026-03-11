<script lang="ts">
  import ContentCard from '$lib/components/ContentCard.svelte';
  import Pagination from '$lib/components/Pagination.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const sortOptions = [
    { value: 'recent', label: 'Recent' },
    { value: 'popular', label: 'Popular' },
  ];

  function buildPageUrl(p: number): string {
    const params = new URLSearchParams();
    if (p > 1) params.set('page', String(p));
    if (data.sort !== 'recent') params.set('sort', data.sort);
    const qs = params.toString();
    return `/explainers${qs ? `?${qs}` : ''}`;
  }
</script>

<svelte:head>
  <title>Explainers — Snaplify</title>
  <meta name="description" content="Interactive learning experiences from the maker community." />
</svelte:head>

<div class="page">
  <div class="filter-bar">
    <h1 class="sec-head-title">Explainers</h1>
    {#each sortOptions as opt}
      <a
        href="/explainers{opt.value !== 'recent' ? `?sort=${opt.value}` : ''}"
        class="fchip"
        class:active={data.sort === opt.value}
      >
        {opt.label}
      </a>
    {/each}
  </div>

  {#if data.items.length === 0}
    <div class="empty-state"><p>No explainers published yet.</p></div>
  {:else}
    <div class="grid-3">
      {#each data.items as item (item.id)}
        <ContentCard {item} />
      {/each}
    </div>
  {/if}

  <Pagination page={data.page} totalPages={data.totalPages} buildUrl={buildPageUrl} />
</div>

<style>
  .sec-head-title {
    font-size: 14px;
    font-weight: var(--font-weight-semibold, 600);
    margin-right: auto;
  }

  .empty-state {
    text-align: center;
    padding: var(--space-12, 3rem);
    color: var(--color-text-secondary, #888884);
  }
</style>
