<script lang="ts">
  import type { CommunityReplyItem } from '$lib/types';

  let {
    replies,
    slug,
    postId,
  }: {
    replies: CommunityReplyItem[];
    slug: string;
    postId: string;
  } = $props();
</script>

<div class="reply-thread">
  {#each replies as reply (reply.id)}
    <div class="reply-item">
      <div class="reply-header">
        {#if reply.author.avatarUrl}
          <img src={reply.author.avatarUrl} alt="" class="reply-avatar" width="24" height="24" />
        {:else}
          <span class="reply-avatar-placeholder"
            >{reply.author.displayName?.[0] ?? reply.author.username[0]}</span
          >
        {/if}
        <span class="reply-author">{reply.author.displayName ?? reply.author.username}</span>
        <time class="reply-time" datetime={new Date(reply.createdAt).toISOString()}>
          {new Date(reply.createdAt).toLocaleDateString()}
        </time>
      </div>

      <p class="reply-content">{reply.content}</p>

      <div class="reply-meta">
        <span>{reply.likeCount} likes</span>
      </div>

      {#if reply.replies && reply.replies.length > 0}
        <div class="nested-replies">
          <svelte:self replies={reply.replies} {slug} {postId} />
        </div>
      {/if}
    </div>
  {/each}
</div>

<style>
  .reply-thread {
    display: flex;
    flex-direction: column;
    gap: var(--space-2, 0.5rem);
  }

  .reply-item {
    padding: var(--space-2, 0.5rem);
    border-left: 2px solid var(--color-border, #272725);
    padding-left: var(--space-4, 1rem);
  }

  .reply-header {
    display: flex;
    align-items: center;
    gap: var(--space-1, 0.25rem);
    margin-bottom: var(--space-1, 0.25rem);
  }

  .reply-avatar {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    object-fit: cover;
  }

  .reply-avatar-placeholder {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--color-primary, #2563eb);
    color: var(--color-on-primary, #ffffff);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-weight: var(--font-weight-bold, 700);
    font-size: var(--text-xs, 0.75rem);
  }

  .reply-author {
    font-weight: var(--font-weight-medium, 500);
    font-size: var(--text-sm, 0.875rem);
    color: var(--color-text, #d8d5cf);
  }

  .reply-time {
    font-size: var(--text-xs, 0.75rem);
    color: var(--color-text-secondary, #888884);
  }

  .reply-content {
    margin: 0;
    font-size: var(--text-sm, 0.875rem);
    color: var(--color-text, #d8d5cf);
    white-space: pre-wrap;
  }

  .reply-meta {
    font-size: var(--text-xs, 0.75rem);
    color: var(--color-text-secondary, #888884);
    margin-top: var(--space-1, 0.25rem);
  }

  .nested-replies {
    margin-top: var(--space-2, 0.5rem);
  }
</style>
