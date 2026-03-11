<script lang="ts">
  import { Button, Input } from '@snaplify/ui';
  import CommunityCard from '$lib/components/community/CommunityCard.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>Communities — Snaplify</title>
</svelte:head>

<div class="communities-page">
  <div class="page-header">
    <h1>Communities</h1>
    {#if data.communities.length > 0 || data.search || data.joinPolicy}
      <a href="/communities/create" class="btn btn-primary">Create Community</a>
    {/if}
  </div>

  <form class="filters" method="GET" action="/communities">
    <Input
      id="communities-search"
      label=""
      type="search"
      name="search"
      placeholder="Search communities..."
      value={data.search ?? ''}
      class="search-input"
    />
    <select name="joinPolicy" class="filter-select" aria-label="Filter by join policy">
      <option value="">All policies</option>
      <option value="open" selected={data.joinPolicy === 'open'}>Open</option>
      <option value="approval" selected={data.joinPolicy === 'approval'}>Approval</option>
      <option value="invite" selected={data.joinPolicy === 'invite'}>Invite only</option>
    </select>
    <Button variant="secondary" type="submit">Filter</Button>
  </form>

  {#if data.communities.length === 0}
    <div class="empty-state">
      <p>No communities found.</p>
      <a href="/communities/create">Create the first community</a>
    </div>
  {:else}
    <div class="community-grid">
      {#each data.communities as community (community.id)}
        <CommunityCard {community} />
      {/each}
    </div>

    {#if data.total > 20}
      <nav class="pagination" aria-label="Pagination">
        {#if data.page > 1}
          <a href="/communities?page={data.page - 1}" class="btn btn-small">Previous</a>
        {/if}
        <span class="page-info">Page {data.page} of {Math.ceil(data.total / 20)}</span>
        {#if data.page * 20 < data.total}
          <a href="/communities?page={data.page + 1}" class="btn btn-small">Next</a>
        {/if}
      </nav>
    {/if}
  {/if}
</div>

<style>
  .communities-page {
    max-width: var(--layout-content-width, 960px);
    margin: 0 auto;
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-6, 2rem);
  }

  .page-header h1 {
    font-size: var(--text-2xl, 1.875rem);
    color: var(--color-text, #d8d5cf);
  }

  .filters {
    display: flex;
    gap: var(--space-2, 0.5rem);
    margin-bottom: var(--space-6, 2rem);
  }


  .filter-select {
    padding: var(--space-2, 0.5rem) var(--space-4, 1rem);
    border: 1px solid var(--color-border, #272725);
    border-radius: var(--radius-md, 6px);
    background: var(--color-surface, #0c0c0b);
    color: var(--color-text, #d8d5cf);
  }

  .community-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: var(--space-4, 1rem);
  }

  .empty-state {
    text-align: center;
    padding: var(--space-12, 3rem);
    color: var(--color-text-secondary, #888884);
  }

  .empty-state a {
    color: var(--color-primary, #2563eb);
  }

  .pagination {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: var(--space-4, 1rem);
    margin-top: var(--space-6, 2rem);
  }

  .page-info {
    color: var(--color-text-secondary, #888884);
    font-size: var(--text-sm, 0.875rem);
  }

  .btn {
    padding: var(--space-2, 0.5rem) var(--space-4, 1rem);
    border: none;
    border-radius: var(--radius-md, 6px);
    font-size: var(--text-md, 1rem);
    cursor: pointer;
    text-decoration: none;
    display: inline-block;
  }

  .btn-primary {
    background: var(--color-primary, #2563eb);
    color: var(--color-on-primary, #ffffff);
  }


  .btn-small {
    padding: var(--space-1, 0.25rem) var(--space-2, 0.5rem);
    font-size: var(--text-sm, 0.875rem);
    background: var(--color-surface-alt, #1c1c1a);
    color: var(--color-text, #d8d5cf);
    border: 1px solid var(--color-border, #272725);
  }
</style>
