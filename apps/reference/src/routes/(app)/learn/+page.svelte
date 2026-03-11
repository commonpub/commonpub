<script lang="ts">
  import PathCard from '$lib/components/learning/PathCard.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const difficulties = ['all', 'beginner', 'intermediate', 'advanced'];
</script>

<svelte:head>
  <title>Learn — Snaplify</title>
  <meta name="description" content="Learning paths from the maker community." />
</svelte:head>

<div class="listing-page">
  <div class="listing-header">
    <h1 class="listing-title">Learning Paths</h1>
    <nav class="listing-sort" aria-label="Difficulty filter">
      {#each difficulties as d}
        <a
          href="/learn{d === 'all' ? '' : `?difficulty=${d}`}"
          class="sort-link"
          class:sort-link-active={d === 'all' ? !data.difficulty : data.difficulty === d}
          aria-current={d === 'all'
            ? !data.difficulty
              ? 'page'
              : undefined
            : data.difficulty === d
              ? 'page'
              : undefined}
        >
          {d.charAt(0).toUpperCase() + d.slice(1)}
        </a>
      {/each}
    </nav>
  </div>

  {#if data.items.length === 0}
    <div class="empty-state">
      <p>No learning paths published yet.</p>
    </div>
  {:else}
    <div class="content-grid">
      {#each data.items as path (path.id)}
        <PathCard {path} />
      {/each}
    </div>
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
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: var(--space-4, 1rem);
  }

  .empty-state {
    text-align: center;
    padding: var(--space-12, 3rem);
    color: var(--color-text-secondary, #888884);
  }
</style>
