<script lang="ts">
  import type { LearningPathListItem } from '$lib/types';

  let { path }: { path: LearningPathListItem } = $props();
</script>

<a href="/learn/{path.slug}" class="path-card">
  {#if path.coverImageUrl}
    <img src={path.coverImageUrl} alt="" class="card-cover" />
  {:else}
    <div class="card-cover-placeholder"></div>
  {/if}

  <div class="card-body">
    <h3 class="card-title">{path.title}</h3>
    {#if path.description}
      <p class="card-description">{path.description}</p>
    {/if}

    <div class="card-meta">
      {#if path.difficulty}
        <span class="badge difficulty-{path.difficulty}">{path.difficulty}</span>
      {/if}
      {#if path.estimatedHours}
        <span class="meta-text">{path.estimatedHours}h</span>
      {/if}
      <span class="meta-text">{path.enrollmentCount} enrolled</span>
    </div>

    <div class="card-author">
      <span>By {path.author.displayName ?? path.author.username}</span>
    </div>
  </div>
</a>

<style>
  .path-card {
    display: block;
    border: 1px solid var(--color-border, #272725);
    border-radius: var(--radius-md, 6px);
    overflow: hidden;
    text-decoration: none;
    color: inherit;
    transition: box-shadow 0.15s;
    background: var(--color-surface, #0c0c0b);
  }

  .path-card:hover {
    box-shadow: 0 2px 8px var(--color-shadow, rgba(0, 0, 0, 0.4));
  }

  .card-cover {
    width: 100%;
    aspect-ratio: 16 / 9;
    object-fit: cover;
  }

  .card-cover-placeholder {
    width: 100%;
    aspect-ratio: 16 / 9;
    background: var(--color-surface-alt, #141413);
  }

  .card-body {
    padding: var(--space-4, 1rem);
  }

  .card-title {
    font-size: var(--text-md, 1rem);
    font-weight: var(--font-weight-semibold, 600);
    color: var(--color-text, #d8d5cf);
    margin: 0 0 var(--space-1, 0.25rem);
  }

  .card-description {
    font-size: var(--text-sm, 0.875rem);
    color: var(--color-text-secondary, #888884);
    margin: 0 0 var(--space-2, 0.5rem);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .card-meta {
    display: flex;
    gap: var(--space-1, 0.25rem);
    font-size: var(--text-xs, 0.75rem);
    margin-bottom: var(--space-2, 0.5rem);
  }

  .badge {
    padding: 0 var(--space-1, 0.25rem);
    border-radius: var(--radius-sm, 4px);
    font-weight: var(--font-weight-medium, 500);
    text-transform: capitalize;
  }

  .difficulty-beginner {
    color: var(--color-success, #4ade80);
    background: var(--color-success-bg, rgba(74, 222, 128, 0.1));
  }
  .difficulty-intermediate {
    color: var(--color-warning, #fbbf24);
    background: var(--color-warning-bg, rgba(251, 191, 36, 0.1));
  }
  .difficulty-advanced {
    color: var(--color-error, #f87171);
    background: var(--color-error-bg, rgba(248, 113, 113, 0.1));
  }

  .meta-text {
    color: var(--color-text-secondary, #888884);
  }

  .card-author {
    font-size: var(--text-xs, 0.75rem);
    color: var(--color-text-secondary, #888884);
  }
</style>
