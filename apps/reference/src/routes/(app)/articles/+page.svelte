<script lang="ts">
  import ContentList from '$lib/components/ContentList.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>Articles — Snaplify</title>
  <meta name="description" content="Read articles from the maker community." />
</svelte:head>

<section>
  <h1 class="page-title">Articles</h1>
  <ContentList items={data.items} emptyMessage="No articles published yet." />
</section>

<style>
  .page-title {
    font-size: var(--font-size-2xl, 1.875rem);
    margin-bottom: var(--space-lg, 2rem);
    color: var(--color-text, #1a1a1a);
  }
</style>
