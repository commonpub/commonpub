<script lang="ts">
  import type { ContentDetail } from '$lib/types';

  let { item }: { item: ContentDetail } = $props();

  const publishDate = item.publishedAt
    ? new Date(item.publishedAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;
</script>

<div class="content-meta">
  <div class="meta-author">
    {#if item.author.avatarUrl}
      <img src={item.author.avatarUrl} alt="" class="meta-avatar" width="40" height="40" />
    {:else}
      <span class="meta-avatar-placeholder">
        {item.author.displayName?.[0] ?? item.author.username[0]}
      </span>
    {/if}
    <div>
      <span class="meta-author-name">{item.author.displayName ?? item.author.username}</span>
      <div class="meta-details">
        {#if publishDate}
          <time datetime={item.publishedAt?.toString()}>{publishDate}</time>
        {/if}
        {#if item.difficulty}
          <span class="meta-difficulty">{item.difficulty}</span>
        {/if}
        {#if item.buildTime}
          <span>{item.buildTime}</span>
        {/if}
        <span>{item.viewCount} views</span>
      </div>
    </div>
  </div>
</div>

<style>
  .content-meta {
    margin: var(--space-md, 1rem) 0;
  }

  .meta-author {
    display: flex;
    align-items: center;
    gap: var(--space-sm, 0.5rem);
  }

  .meta-avatar {
    border-radius: 50%;
    object-fit: cover;
  }

  .meta-avatar-placeholder {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--color-primary, #2563eb);
    color: var(--color-on-primary, #ffffff);
    font-weight: var(--font-weight-bold, 700);
  }

  .meta-author-name {
    font-weight: var(--font-weight-medium, 500);
    color: var(--color-text, #1a1a1a);
  }

  .meta-details {
    display: flex;
    gap: var(--space-sm, 0.5rem);
    font-size: var(--font-size-sm, 0.875rem);
    color: var(--color-text-secondary, #666);
  }

  .meta-details span::before,
  .meta-details time + span::before {
    content: '·';
    margin-right: var(--space-xs, 0.25rem);
  }

  .meta-difficulty {
    text-transform: capitalize;
  }
</style>
