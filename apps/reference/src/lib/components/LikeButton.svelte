<script lang="ts">
  let {
    targetType,
    targetId,
    count = 0,
    liked = false,
  }: {
    targetType: string;
    targetId: string;
    count: number;
    liked: boolean;
  } = $props();

  let optimisticLiked = $state(liked);
  let optimisticCount = $state(count);
  let loading = $state(false);

  async function toggle() {
    if (loading) return;
    loading = true;

    // Optimistic update
    optimisticLiked = !optimisticLiked;
    optimisticCount += optimisticLiked ? 1 : -1;

    try {
      const res = await fetch('/api/social/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType, targetId }),
      });

      if (!res.ok) {
        // Revert on failure
        optimisticLiked = !optimisticLiked;
        optimisticCount += optimisticLiked ? 1 : -1;
      }
    } catch {
      optimisticLiked = !optimisticLiked;
      optimisticCount += optimisticLiked ? 1 : -1;
    } finally {
      loading = false;
    }
  }
</script>

<button
  class="like-button"
  class:liked={optimisticLiked}
  onclick={toggle}
  aria-label={optimisticLiked ? 'Unlike' : 'Like'}
  aria-pressed={optimisticLiked}
  disabled={loading}
>
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill={optimisticLiked ? 'currentColor' : 'none'}
    stroke="currentColor"
    stroke-width="2"
    aria-hidden="true"
  >
    <path
      d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
    />
  </svg>
  <span>{optimisticCount}</span>
</button>

<style>
  .like-button {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1, 0.25rem);
    padding: var(--space-1, 0.25rem) var(--space-2, 0.5rem);
    border: 1px solid var(--color-border, #272725);
    border-radius: var(--radius-sm, 4px);
    background: var(--color-surface, #0c0c0b);
    color: var(--color-text-secondary, #888884);
    cursor: pointer;
    font-size: var(--text-sm, 0.875rem);
    transition:
      color 0.15s,
      border-color 0.15s;
  }

  .like-button:hover {
    color: var(--color-error, #f87171);
    border-color: var(--color-error, #f87171);
  }

  .like-button.liked {
    color: var(--color-error, #f87171);
    border-color: var(--color-error, #f87171);
  }

  .like-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
</style>
