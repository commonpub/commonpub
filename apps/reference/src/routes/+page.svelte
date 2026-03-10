<script lang="ts">
  import ContentList from '$lib/components/ContentList.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>Snaplify</title>
  <meta name="description" content="Discover projects, articles, and guides from the maker community." />
</svelte:head>

<section>
  <h1 class="page-title">Latest Content</h1>
  <ContentList items={data.items} emptyMessage="No published content yet. Be the first to create something!" />
</section>

<style>
  .page-title {
    font-size: var(--font-size-2xl, 1.875rem);
    margin-bottom: var(--space-lg, 2rem);
    color: var(--color-text, #1a1a1a);
  }
</style>
