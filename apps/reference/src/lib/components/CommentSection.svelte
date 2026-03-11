<script lang="ts">
  import { onMount } from 'svelte';
  import type { CommentItem } from '$lib/types';

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

  <form
    class="comment-form"
    onsubmit={(e) => {
      e.preventDefault();
      submitComment();
    }}
  >
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
              <img
                src={comment.author.avatarUrl}
                alt=""
                class="comment-avatar"
                width="32"
                height="32"
              />
            {:else}
              <span class="comment-avatar-placeholder">
                {comment.author.displayName?.[0] ?? comment.author.username[0]}
              </span>
            {/if}
            <div>
              <span class="comment-author"
                >{comment.author.displayName ?? comment.author.username}</span
              >
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
                    <span class="comment-author"
                      >{reply.author.displayName ?? reply.author.username}</span
                    >
                    <time class="comment-date"
                      >{new Date(reply.createdAt).toLocaleDateString()}</time
                    >
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
    margin-top: var(--space-6, 2rem);
  }

  .comments h2 {
    font-size: var(--text-lg, 1.25rem);
    margin-bottom: var(--space-4, 1rem);
    color: var(--color-text, #d8d5cf);
  }

  .comment-form {
    margin-bottom: var(--space-6, 2rem);
  }

  .comment-form textarea {
    width: 100%;
    padding: var(--space-2, 0.5rem);
    border: 1px solid var(--color-border, #272725);
    border-radius: var(--radius-sm, 4px);
    font-size: var(--text-md, 1rem);
    background: var(--color-surface, #0c0c0b);
    color: var(--color-text, #d8d5cf);
    resize: vertical;
    box-sizing: border-box;
    margin-bottom: var(--space-2, 0.5rem);
  }

  .btn {
    padding: var(--space-1, 0.25rem) var(--space-4, 1rem);
    border: none;
    border-radius: var(--radius-md, 6px);
    cursor: pointer;
    font-size: var(--text-sm, 0.875rem);
  }

  .btn-primary {
    background: var(--color-primary, #5b9cf6);
    color: var(--color-on-primary, #0c0c0b);
  }

  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .comments-loading,
  .comments-empty {
    color: var(--color-text-secondary, #888884);
    font-size: var(--text-sm, 0.875rem);
  }

  .comments-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-4, 1rem);
  }

  .comment {
    padding: var(--space-4, 1rem);
    border: 1px solid var(--color-border, #272725);
    border-radius: var(--radius-md, 6px);
    background: var(--color-surface, #0c0c0b);
  }

  .comment-header {
    display: flex;
    align-items: center;
    gap: var(--space-2, 0.5rem);
    margin-bottom: var(--space-1, 0.25rem);
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
    background: var(--color-primary, #5b9cf6);
    color: var(--color-on-primary, #0c0c0b);
    font-weight: var(--font-weight-bold, 700);
    font-size: var(--text-sm, 0.875rem);
  }

  .comment-author {
    font-weight: var(--font-weight-medium, 500);
    color: var(--color-text, #d8d5cf);
  }

  .comment-date {
    font-size: var(--text-xs, 0.75rem);
    color: var(--color-text-secondary, #888884);
    margin-left: var(--space-1, 0.25rem);
  }

  .comment-content {
    margin: var(--space-1, 0.25rem) 0 0;
    color: var(--color-text, #d8d5cf);
    line-height: 1.5;
    white-space: pre-wrap;
  }

  .comment-replies {
    margin-top: var(--space-2, 0.5rem);
    padding-left: var(--space-6, 2rem);
    display: flex;
    flex-direction: column;
    gap: var(--space-2, 0.5rem);
  }

  .reply {
    border-color: var(--color-border, #272725);
    background: var(--color-surface-alt, #141413);
  }
</style>
