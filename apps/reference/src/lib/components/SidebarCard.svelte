<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    title = '',
    children,
  }: {
    title: string;
    children: Snippet;
  } = $props();
</script>

<div class="sb-card">
  <div class="sb-title">{title}</div>
  {@render children()}
</div>
