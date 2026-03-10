<script lang="ts">
  import ContentCard from './ContentCard.svelte';
  import type { ContentListItem } from '$lib/types';

  let { items = [], emptyMessage = 'No content yet.' }: {
    items: ContentListItem[];
    emptyMessage?: string;
  } = $props();
</script>

{#if items.length === 0}
  <div class="content-empty">
    <p>{emptyMessage}</p>
  </div>
{:else}
  <div class="content-grid">
    {#each items as item (item.id)}
      <ContentCard {item} />
    {/each}
  </div>
{/if}

<style>
  .content-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: var(--space-md, 1rem);
  }

  .content-empty {
    text-align: center;
    padding: var(--space-xl, 3rem);
    color: var(--color-text-secondary, #666);
  }
</style>
