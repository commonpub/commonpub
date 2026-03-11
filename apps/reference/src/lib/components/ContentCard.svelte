<script lang="ts">
  import type { ContentListItem } from '$lib/types';
  import { Badge } from '@snaplify/ui';
  import { typeToUrlSegment } from '$lib/utils/content-helpers';

  let { item }: { item: ContentListItem } = $props();

  const href = `/${typeToUrlSegment(item.type)}/${item.slug}`;
  const timeAgo = item.publishedAt ? new Date(item.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Draft';
  const difficultyDots: Record<string, number> = {
    beginner: 1,
    intermediate: 2,
    advanced: 3,
  };
</script>

<article class="content-card">
  <a {href} class="card-link">
    {#if item.coverImageUrl}
      <img src={item.coverImageUrl} alt="" class="card-cover" loading="lazy" />
    {:else}
      <div class="card-cover-placeholder">
        <span class="card-cover-type">{item.type}</span>
      </div>
    {/if}

    <div class="card-body">
      <div class="card-header">
        <span class="card-type">{item.type}</span>
        {#if item.difficulty}
          <span class="card-difficulty">
            {#each Array(difficultyDots[item.difficulty] ?? 1) as _}
              <span class="dot dot-filled"></span>
            {/each}
            {#each Array(3 - (difficultyDots[item.difficulty] ?? 1)) as _}
              <span class="dot"></span>
            {/each}
          </span>
        {/if}
      </div>

      <h3 class="card-title">{item.title}</h3>

      {#if item.description}
        <p class="card-description">{item.description}</p>
      {/if}

      <div class="card-footer">
        <div class="card-author">
          {#if item.author.avatarUrl}
            <img src={item.author.avatarUrl} alt="" class="card-avatar" width="20" height="20" />
          {/if}
          <span>{item.author.displayName ?? item.author.username}</span>
        </div>
        <div class="card-stats">
          <span>{timeAgo}</span>
          {#if item.likeCount > 0}
            <span>{item.likeCount}</span>
          {/if}
        </div>
      </div>
    </div>
  </a>
</article>

<style>
  .content-card {
    border: 1px solid var(--color-border, #272725);
    border-radius: var(--radius-md, 0.25rem);
    overflow: hidden;
    background: var(--color-surface-alt, #141413);
    transition: border-color var(--transition-default, 0.15s ease);
  }

  .content-card:hover {
    border-color: var(--color-border-strong, #333330);
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
    background: var(--color-surface-raised, #1c1c1a);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .card-cover-type {
    font-family: var(--font-mono, monospace);
    font-size: var(--text-xs, 0.6875rem);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--color-text-muted, #444440);
  }

  .card-body {
    padding: var(--space-3, 0.75rem);
  }

  .card-header {
    display: flex;
    align-items: center;
    gap: var(--space-2, 0.5rem);
    margin-bottom: var(--space-2, 0.5rem);
  }

  .card-type {
    font-family: var(--font-mono, monospace);
    font-size: var(--text-xs, 0.6875rem);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--color-primary, #5b9cf6);
    font-weight: var(--font-weight-medium, 500);
  }

  .card-difficulty {
    display: flex;
    gap: 2px;
    align-items: center;
  }

  .dot {
    width: 5px;
    height: 5px;
    border-radius: var(--radius-full, 50%);
    background: var(--color-border, #272725);
  }

  .dot-filled {
    background: var(--color-primary, #5b9cf6);
  }

  .card-title {
    font-size: var(--text-base, 0.875rem);
    font-weight: var(--font-weight-semibold, 600);
    margin: 0 0 var(--space-1, 0.25rem);
    color: var(--color-text, #d8d5cf);
    line-height: var(--leading-snug, 1.3);
  }

  .card-description {
    font-size: var(--text-sm, 0.75rem);
    color: var(--color-text-secondary, #888884);
    margin: 0 0 var(--space-2, 0.5rem);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    line-height: var(--leading-normal, 1.6);
  }

  .card-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: var(--text-xs, 0.6875rem);
    color: var(--color-text-muted, #444440);
  }

  .card-author {
    display: flex;
    align-items: center;
    gap: var(--space-1, 0.25rem);
  }

  .card-avatar {
    border-radius: var(--radius-full, 50%);
    object-fit: cover;
  }

  .card-stats {
    display: flex;
    gap: var(--space-2, 0.5rem);
    font-family: var(--font-mono, monospace);
  }
</style>
