<script lang="ts">
  import type { ContentListItem } from '$lib/types';
  import { typeToUrlSegment } from '$lib/utils/content-helpers';

  let { item }: { item: ContentListItem } = $props();

  const href = `/${typeToUrlSegment(item.type)}/${item.slug}`;
  const timeAgo = item.publishedAt
    ? new Date(item.publishedAt).toLocaleDateString()
    : 'Draft';
</script>

<article class="content-card">
  <a {href} class="card-link">
    {#if item.coverImageUrl}
      <img src={item.coverImageUrl} alt="" class="card-cover" loading="lazy" />
    {:else}
      <div class="card-cover-placeholder"></div>
    {/if}

    <div class="card-body">
      <div class="card-header">
        <span class="card-type">{item.type}</span>
        {#if item.difficulty}
          <span class="card-difficulty">{item.difficulty}</span>
        {/if}
      </div>

      <h3 class="card-title">{item.title}</h3>

      {#if item.description}
        <p class="card-description">{item.description}</p>
      {/if}

      <div class="card-footer">
        <div class="card-author">
          {#if item.author.avatarUrl}
            <img src={item.author.avatarUrl} alt="" class="card-avatar" width="24" height="24" />
          {/if}
          <span>{item.author.displayName ?? item.author.username}</span>
        </div>
        <div class="card-stats">
          <span>{timeAgo}</span>
          {#if item.likeCount > 0}
            <span>{item.likeCount} likes</span>
          {/if}
          {#if item.commentCount > 0}
            <span>{item.commentCount} comments</span>
          {/if}
        </div>
      </div>
    </div>
  </a>
</article>

<style>
  .content-card {
    border: 1px solid var(--color-border, #e5e5e5);
    border-radius: var(--radius-md, 6px);
    overflow: hidden;
    background: var(--color-surface, #ffffff);
    transition: box-shadow 0.15s;
  }

  .content-card:hover {
    box-shadow: var(--shadow-md, 0 4px 12px rgba(0, 0, 0, 0.1));
  }

  .card-link {
    text-decoration: none;
    color: inherit;
    display: block;
  }

  .card-cover {
    width: 100%;
    aspect-ratio: 16 / 9;
    object-fit: cover;
  }

  .card-cover-placeholder {
    width: 100%;
    aspect-ratio: 16 / 9;
    background: var(--color-surface-secondary, #f5f5f5);
  }

  .card-body {
    padding: var(--space-md, 1rem);
  }

  .card-header {
    display: flex;
    gap: var(--space-xs, 0.25rem);
    margin-bottom: var(--space-xs, 0.25rem);
  }

  .card-type {
    font-size: var(--font-size-xs, 0.75rem);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-primary, #2563eb);
    font-weight: var(--font-weight-medium, 500);
  }

  .card-difficulty {
    font-size: var(--font-size-xs, 0.75rem);
    color: var(--color-text-secondary, #666);
  }

  .card-title {
    font-size: var(--font-size-md, 1rem);
    font-weight: var(--font-weight-semibold, 600);
    margin: 0 0 var(--space-xs, 0.25rem);
    color: var(--color-text, #1a1a1a);
    line-height: 1.3;
  }

  .card-description {
    font-size: var(--font-size-sm, 0.875rem);
    color: var(--color-text-secondary, #666);
    margin: 0 0 var(--space-sm, 0.5rem);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .card-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: var(--font-size-xs, 0.75rem);
    color: var(--color-text-secondary, #666);
  }

  .card-author {
    display: flex;
    align-items: center;
    gap: var(--space-xs, 0.25rem);
  }

  .card-avatar {
    border-radius: 50%;
    object-fit: cover;
  }

  .card-stats {
    display: flex;
    gap: var(--space-sm, 0.5rem);
  }
</style>
