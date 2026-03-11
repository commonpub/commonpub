<script lang="ts">
  import ContentCard from '$lib/components/ContentCard.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>Feed — Snaplify</title>
  <meta name="description" content="Recent activity from the community." />
</svelte:head>

<div class="feed-page">
  <h1 class="feed-title">Feed</h1>

  {#if data.items.length === 0}
    <div class="empty-state">
      <p>No activity yet. Follow makers and communities to see their content here.</p>
    </div>
  {:else}
    <div class="feed-grid">
      {#each data.items as item (item.id)}
        <ContentCard {item} />
      {/each}
    </div>
  {/if}
</div>

<style>
  .feed-page {
    max-width: 800px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-6, 1.5rem);
  }

  .feed-title {
    font-size: var(--text-2xl, 1.5rem);
    font-weight: var(--font-weight-bold, 700);
    color: var(--color-text, #d8d5cf);
    margin: 0;
  }

  .feed-grid {
    display: flex;
    flex-direction: column;
    gap: var(--space-4, 1rem);
  }

  .empty-state {
    text-align: center;
    padding: var(--space-12, 3rem);
    color: var(--color-text-secondary, #888884);
  }
</style>
