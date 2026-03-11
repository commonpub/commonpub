<script lang="ts">
  import type { ContentListItem } from '$lib/types';
  import { typeToUrlSegment } from '$lib/utils/content-helpers';

  let { item }: { item: ContentListItem } = $props();

  const href = `/${typeToUrlSegment(item.type)}/${item.slug}`;
  const readTime = '12 min read';
</script>

<a {href} class="mag-hero">
  <div class="mag-img">
    {#if item.coverImageUrl}
      <img src={item.coverImageUrl} alt="" style="width:100%;height:100%;object-fit:cover;position:relative;z-index:1;" />
    {:else}
      <span>full-bleed cover image</span>
    {/if}
  </div>
  <div class="mag-body">
    <div class="mag-eyebrow">featured article</div>
    <div class="mag-title">{item.title}</div>
    {#if item.description}
      <div class="mag-excerpt">{item.description}</div>
    {/if}
    <div class="mag-meta">
      <div class="av av-sm">{(item.author.displayName ?? item.author.username ?? '?')[0].toUpperCase()}</div>
      <span>{item.author.displayName ?? item.author.username}</span>
      <span class="mag-read-time">{readTime}</span>
    </div>
  </div>
</a>

<style>
  a.mag-hero {
    text-decoration: none;
    color: inherit;
  }

  a.mag-hero:hover {
    border-color: var(--color-border-strong, #333330);
  }

  .mag-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    color: var(--color-text-secondary, #888884);
  }

  .mag-read-time {
    margin-left: auto;
    font-size: 10px;
    font-family: var(--font-mono, monospace);
  }
</style>
