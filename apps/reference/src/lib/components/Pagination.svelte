<script lang="ts">
  let {
    page = 1,
    totalPages = 1,
    buildUrl = (_p: number) => '#',
  }: {
    page: number;
    totalPages: number;
    buildUrl: (page: number) => string;
  } = $props();

  function getPages(): (number | '...')[] {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | '...')[] = [1];
    if (page > 3) pages.push('...');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
      pages.push(i);
    }
    if (page < totalPages - 2) pages.push('...');
    pages.push(totalPages);
    return pages;
  }
</script>

{#if totalPages > 1}
  <nav class="pager" aria-label="Pagination">
    {#if page > 1}
      <a href={buildUrl(page - 1)} class="btn btn-sm">prev</a>
    {/if}
    {#each getPages() as p}
      {#if p === '...'}
        <span class="pager-ellipsis">...</span>
      {:else}
        <a
          href={buildUrl(p)}
          class="btn btn-sm"
          class:btn-primary={p === page}
          aria-current={p === page ? 'page' : undefined}
        >
          {p}
        </a>
      {/if}
    {/each}
    {#if page < totalPages}
      <a href={buildUrl(page + 1)} class="btn btn-sm">next</a>
    {/if}
  </nav>
{/if}

<style>
  .pager-ellipsis {
    font-size: 12px;
    color: var(--color-text-muted, #444440);
    font-family: var(--font-mono, monospace);
  }
</style>
