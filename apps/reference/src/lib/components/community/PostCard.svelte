<script lang="ts">
  import { enhance } from '$app/forms';
  import type { CommunityPostItem } from '$lib/types';
  import { hasPermission } from '$lib/utils/community-permissions';

  let {
    post,
    slug,
    userRole = null,
  }: {
    post: CommunityPostItem;
    slug: string;
    userRole: string | null;
  } = $props();

  const canModerate = userRole ? hasPermission(userRole, 'pinPost') : false;
  const isAuthor = false; // Would need current user ID to determine
</script>

<article class="post-card" class:post-pinned={post.isPinned} class:post-locked={post.isLocked}>
  <div class="post-header">
    <div class="post-author">
      {#if post.author.avatarUrl}
        <img src={post.author.avatarUrl} alt="" class="author-avatar" width="32" height="32" />
      {:else}
        <span class="author-avatar-placeholder"
          >{post.author.displayName?.[0] ?? post.author.username[0]}</span
        >
      {/if}
      <div class="author-info">
        <span class="author-name">{post.author.displayName ?? post.author.username}</span>
        <time class="post-time" datetime={new Date(post.createdAt).toISOString()}>
          {new Date(post.createdAt).toLocaleDateString()}
        </time>
      </div>
    </div>

    <div class="post-badges">
      {#if post.isPinned}
        <span class="badge badge-pinned" aria-label="Pinned">Pinned</span>
      {/if}
      {#if post.isLocked}
        <span class="badge badge-locked" aria-label="Locked">Locked</span>
      {/if}
      {#if post.type !== 'text'}
        <span class="badge badge-type">{post.type}</span>
      {/if}
    </div>
  </div>

  <div class="post-content">
    {#if post.type === 'share' && post.sharedContent}
      <div class="shared-content">
        <span class="shared-label">Shared</span>
        <a href="/{post.sharedContent.type}/{post.sharedContent.slug}" class="shared-link">
          {post.sharedContent.title}
        </a>
      </div>
    {:else if post.type === 'poll'}
      {@const pollData = (() => { try { return JSON.parse(post.content); } catch { return null; } })()}
      {#if pollData}
        <div class="poll-container">
          <p class="poll-question">{pollData.question}</p>
          <div class="poll-options-list">
            {#each pollData.options as option, i}
              <form method="POST" action="/communities/{slug}?/votePoll" use:enhance class="poll-vote-form">
                <input type="hidden" name="postId" value={post.id} />
                <input type="hidden" name="optionIndex" value={i} />
                <button type="submit" class="poll-option-btn">
                  <span class="poll-option-text">{option.text}</span>
                  <span class="poll-option-votes">{option.votes}</span>
                </button>
              </form>
            {/each}
          </div>
          {#if pollData.multiSelect}
            <span class="poll-multi-note">Multiple selections allowed</span>
          {/if}
        </div>
      {:else}
        <p>{post.content}</p>
      {/if}
    {:else if post.type === 'link'}
      <a href={post.content} class="link-content" target="_blank" rel="noopener noreferrer">
        {post.content}
      </a>
    {:else}
      <p>{post.content}</p>
    {/if}
  </div>

  <div class="post-actions">
    <span class="action-stat">{post.likeCount} likes</span>
    <span class="action-stat">{post.replyCount} replies</span>

    {#if canModerate}
      <form method="POST" action="/communities/{slug}?/pinPost" use:enhance class="inline-form">
        <input type="hidden" name="postId" value={post.id} />
        <button
          type="submit"
          class="action-btn"
          aria-label={post.isPinned ? 'Unpin post' : 'Pin post'}
        >
          {post.isPinned ? 'Unpin' : 'Pin'}
        </button>
      </form>
      <form method="POST" action="/communities/{slug}?/lockPost" use:enhance class="inline-form">
        <input type="hidden" name="postId" value={post.id} />
        <button
          type="submit"
          class="action-btn"
          aria-label={post.isLocked ? 'Unlock post' : 'Lock post'}
        >
          {post.isLocked ? 'Unlock' : 'Lock'}
        </button>
      </form>
      <form method="POST" action="/communities/{slug}?/deletePost" use:enhance class="inline-form">
        <input type="hidden" name="postId" value={post.id} />
        <button type="submit" class="action-btn action-danger" aria-label="Delete post"
          >Delete</button
        >
      </form>
    {/if}
  </div>
</article>

<style>
  .post-card {
    padding: var(--space-4, 1rem);
    border: 1px solid var(--color-border, #272725);
    border-radius: var(--radius-md, 6px);
    background: var(--color-surface, #0c0c0b);
  }

  .post-pinned {
    border-color: var(--color-warning, #f59e0b);
    background: var(--color-warning-bg, #fffbeb);
  }

  .post-locked {
    opacity: 0.8;
  }

  .post-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-2, 0.5rem);
  }

  .post-author {
    display: flex;
    gap: var(--space-2, 0.5rem);
    align-items: center;
  }

  .author-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    object-fit: cover;
  }

  .author-avatar-placeholder {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--color-primary, #2563eb);
    color: var(--color-on-primary, #ffffff);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-weight: var(--font-weight-bold, 700);
    font-size: var(--text-sm, 0.875rem);
  }

  .author-info {
    display: flex;
    flex-direction: column;
  }

  .author-name {
    font-weight: var(--font-weight-medium, 500);
    color: var(--color-text, #d8d5cf);
    font-size: var(--text-sm, 0.875rem);
  }

  .post-time {
    font-size: var(--text-xs, 0.75rem);
    color: var(--color-text-secondary, #888884);
  }

  .post-badges {
    display: flex;
    gap: var(--space-1, 0.25rem);
  }

  .badge {
    padding: 0 var(--space-1, 0.25rem);
    border-radius: var(--radius-sm, 4px);
    font-size: var(--text-xs, 0.75rem);
    font-weight: var(--font-weight-medium, 500);
  }

  .badge-pinned {
    background: var(--color-warning-bg, #fffbeb);
    color: var(--color-warning, #f59e0b);
  }

  .badge-locked {
    background: var(--color-surface-alt, #1c1c1a);
    color: var(--color-text-secondary, #888884);
  }

  .badge-type {
    background: var(--color-info-bg, #eff6ff);
    color: var(--color-info, #3b82f6);
    text-transform: capitalize;
  }

  .post-content {
    margin-bottom: var(--space-2, 0.5rem);
    color: var(--color-text, #d8d5cf);
  }

  .post-content p {
    margin: 0;
    white-space: pre-wrap;
  }

  .shared-content {
    padding: var(--space-2, 0.5rem);
    border: 1px solid var(--color-border, #272725);
    border-radius: var(--radius-sm, 4px);
    background: var(--color-surface-alt, #1c1c1a);
  }

  .shared-label {
    font-size: var(--text-xs, 0.75rem);
    color: var(--color-text-secondary, #888884);
    margin-right: var(--space-1, 0.25rem);
  }

  .shared-link {
    color: var(--color-primary, #2563eb);
    font-weight: var(--font-weight-medium, 500);
  }

  .link-content {
    color: var(--color-primary, #2563eb);
    word-break: break-all;
  }

  .post-actions {
    display: flex;
    gap: var(--space-4, 1rem);
    align-items: center;
    padding-top: var(--space-2, 0.5rem);
    border-top: 1px solid var(--color-border, #272725);
  }

  .action-stat {
    font-size: var(--text-sm, 0.875rem);
    color: var(--color-text-secondary, #888884);
  }

  .action-btn {
    background: none;
    border: none;
    color: var(--color-text-secondary, #888884);
    font-size: var(--text-sm, 0.875rem);
    cursor: pointer;
    padding: 0;
  }

  .action-btn:hover {
    color: var(--color-primary, #2563eb);
  }

  .action-danger:hover {
    color: var(--color-error, #dc2626);
  }

  .inline-form {
    display: inline;
  }

  .poll-container {
    display: flex;
    flex-direction: column;
    gap: var(--space-2, 0.5rem);
  }

  .poll-question {
    margin: 0;
    font-weight: var(--font-weight-medium, 500);
  }

  .poll-options-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-1, 0.25rem);
  }

  .poll-vote-form {
    display: contents;
  }

  .poll-option-btn {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding: var(--space-2, 0.5rem);
    border: 1px solid var(--color-border, #272725);
    border-radius: var(--radius-sm, 4px);
    background: var(--color-surface, #0c0c0b);
    color: var(--color-text, #d8d5cf);
    cursor: pointer;
    font-size: var(--text-sm, 0.875rem);
  }

  .poll-option-btn:hover {
    border-color: var(--color-primary, #2563eb);
  }

  .poll-option-votes {
    font-size: var(--text-xs, 0.75rem);
    color: var(--color-text-secondary, #888884);
  }

  .poll-multi-note {
    font-size: var(--text-xs, 0.75rem);
    color: var(--color-text-secondary, #888884);
    font-style: italic;
  }
</style>
