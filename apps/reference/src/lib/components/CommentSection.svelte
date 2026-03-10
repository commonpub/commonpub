<script lang="ts">
  import { onMount } from 'svelte';
  import type { CommentItem } from '$lib/server/social';

  let {
    targetType,
    targetId,
  }: {
    targetType: string;
    targetId: string;
  } = $props();

  let comments = $state<CommentItem[]>([]);
  let newComment = $state('');
  let loading = $state(false);
  let submitting = $state(false);

  onMount(async () => {
    loading = true;
    try {
      const res = await fetch(
        `/api/social/comments?targetType=${encodeURIComponent(targetType)}&targetId=${encodeURIComponent(targetId)}`,
      );
      if (res.ok) {
        const data = await res.json();
        comments = data.comments;
      }
    } finally {
      loading = false;
    }
  });

  async function submitComment() {
    if (!newComment.trim() || submitting) return;
    submitting = true;

    try {
      const res = await fetch('/api/social/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType, targetId, content: newComment.trim() }),
      });

      if (res.ok) {
        const data = await res.json();
        comments = [data.comment, ...comments];
        newComment = '';
      }
    } finally {
      submitting = false;
    }
  }

  async function handleDelete(commentId: string) {
    const res = await fetch(`/api/social/comments?id=${encodeURIComponent(commentId)}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      comments = comments.filter((c) => c.id !== commentId);
    }
  }
</script>

<section class="comments" aria-label="Comments">
  <h2>Comments</h2>

  <form class="comment-form" onsubmit={(e) => { e.preventDefault(); submitComment(); }}>
    <textarea
      bind:value={newComment}
      placeholder="Write a comment..."
      rows="3"
      maxlength="10000"
      aria-label="Comment text"
    ></textarea>
    <button type="submit" class="btn btn-primary" disabled={submitting || !newComment.trim()}>
      {submitting ? 'Posting...' : 'Post Comment'}
    </button>
  </form>

  {#if loading}
    <p class="comments-loading">Loading comments...</p>
  {:else if comments.length === 0}
    <p class="comments-empty">No comments yet. Be the first!</p>
  {:else}
    <div class="comments-list">
      {#each comments as comment (comment.id)}
        <div class="comment">
          <div class="comment-header">
            {#if comment.author.avatarUrl}
              <img src={comment.author.avatarUrl} alt="" class="comment-avatar" width="32" height="32" />
            {:else}
              <span class="comment-avatar-placeholder">
                {comment.author.displayName?.[0] ?? comment.author.username[0]}
              </span>
            {/if}
            <div>
              <span class="comment-author">{comment.author.displayName ?? comment.author.username}</span>
              <time class="comment-date" datetime={comment.createdAt.toString()}>
                {new Date(comment.createdAt).toLocaleDateString()}
              </time>
            </div>
          </div>
          <p class="comment-content">{comment.content}</p>
          {#if comment.replies?.length}
            <div class="comment-replies">
              {#each comment.replies as reply (reply.id)}
                <div class="comment reply">
                  <div class="comment-header">
                    <span class="comment-author">{reply.author.displayName ?? reply.author.username}</span>
                    <time class="comment-date">{new Date(reply.createdAt).toLocaleDateString()}</time>
                  </div>
                  <p class="comment-content">{reply.content}</p>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</section>

<style>
  .comments {
    margin-top: var(--space-lg, 2rem);
  }

  .comments h2 {
    font-size: var(--font-size-lg, 1.25rem);
    margin-bottom: var(--space-md, 1rem);
    color: var(--color-text, #1a1a1a);
  }

  .comment-form {
    margin-bottom: var(--space-lg, 2rem);
  }

  .comment-form textarea {
    width: 100%;
    padding: var(--space-sm, 0.5rem);
    border: 1px solid var(--color-border, #e5e5e5);
    border-radius: var(--radius-sm, 4px);
    font-size: var(--font-size-md, 1rem);
    background: var(--color-surface, #ffffff);
    color: var(--color-text, #1a1a1a);
    resize: vertical;
    box-sizing: border-box;
    margin-bottom: var(--space-sm, 0.5rem);
  }

  .btn {
    padding: var(--space-xs, 0.25rem) var(--space-md, 1rem);
    border: none;
    border-radius: var(--radius-md, 6px);
    cursor: pointer;
    font-size: var(--font-size-sm, 0.875rem);
  }

  .btn-primary {
    background: var(--color-primary, #2563eb);
    color: var(--color-on-primary, #ffffff);
  }

  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .comments-loading,
  .comments-empty {
    color: var(--color-text-secondary, #666);
    font-size: var(--font-size-sm, 0.875rem);
  }

  .comments-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-md, 1rem);
  }

  .comment {
    padding: var(--space-md, 1rem);
    border: 1px solid var(--color-border, #e5e5e5);
    border-radius: var(--radius-md, 6px);
    background: var(--color-surface, #ffffff);
  }

  .comment-header {
    display: flex;
    align-items: center;
    gap: var(--space-sm, 0.5rem);
    margin-bottom: var(--space-xs, 0.25rem);
  }

  .comment-avatar {
    border-radius: 50%;
    object-fit: cover;
  }

  .comment-avatar-placeholder {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--color-primary, #2563eb);
    color: var(--color-on-primary, #ffffff);
    font-weight: var(--font-weight-bold, 700);
    font-size: var(--font-size-sm, 0.875rem);
  }

  .comment-author {
    font-weight: var(--font-weight-medium, 500);
    color: var(--color-text, #1a1a1a);
  }

  .comment-date {
    font-size: var(--font-size-xs, 0.75rem);
    color: var(--color-text-secondary, #666);
    margin-left: var(--space-xs, 0.25rem);
  }

  .comment-content {
    margin: var(--space-xs, 0.25rem) 0 0;
    color: var(--color-text, #1a1a1a);
    line-height: 1.5;
    white-space: pre-wrap;
  }

  .comment-replies {
    margin-top: var(--space-sm, 0.5rem);
    padding-left: var(--space-lg, 2rem);
    display: flex;
    flex-direction: column;
    gap: var(--space-sm, 0.5rem);
  }

  .reply {
    border-color: var(--color-border, #e5e5e5);
    background: var(--color-surface-secondary, #f9f9f9);
  }
</style>
