<script lang="ts">
  let {
    type = '',
    title = '',
    excerpt = '',
    author = '',
    href = '#',
  }: {
    type: string;
    title: string;
    excerpt: string;
    author: string;
    href?: string;
  } = $props();
</script>

<a {href} class="search-result">
  <div class="res-chip {type}">{type}</div>
  <div>
    <div class="res-title">{title}</div>
    <div class="res-excerpt">{excerpt}</div>
    <div class="res-author">{author}</div>
  </div>
</a>

<style>
  a.search-result {
    text-decoration: none;
    color: inherit;
  }

  a.search-result:hover {
    background: var(--color-surface-alt, #141413);
  }

  .res-author {
    font-size: 10px;
    font-family: var(--font-mono, monospace);
    color: var(--color-text-muted, #444440);
  }
</style>
