<script lang="ts">
  let {
    targetType,
    targetId,
    bookmarked = false,
  }: {
    targetType: string;
    targetId: string;
    bookmarked: boolean;
  } = $props();

  let optimisticBookmarked = $state(bookmarked);
  let loading = $state(false);

  async function toggle() {
    if (loading) return;
    loading = true;
    optimisticBookmarked = !optimisticBookmarked;

    try {
      const res = await fetch('/api/social/bookmark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType, targetId }),
      });

      if (!res.ok) {
        optimisticBookmarked = !optimisticBookmarked;
      }
    } catch {
      optimisticBookmarked = !optimisticBookmarked;
    } finally {
      loading = false;
    }
  }
</script>

<button
  class="bookmark-button"
  class:bookmarked={optimisticBookmarked}
  onclick={toggle}
  aria-label={optimisticBookmarked ? 'Remove bookmark' : 'Bookmark'}
  aria-pressed={optimisticBookmarked}
  disabled={loading}
>
  <svg width="20" height="20" viewBox="0 0 24 24" fill={optimisticBookmarked ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2" aria-hidden="true">
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
  </svg>
</button>

<style>
  .bookmark-button {
    display: inline-flex;
    align-items: center;
    padding: var(--space-xs, 0.25rem) var(--space-sm, 0.5rem);
    border: 1px solid var(--color-border, #e5e5e5);
    border-radius: var(--radius-sm, 4px);
    background: var(--color-surface, #ffffff);
    color: var(--color-text-secondary, #666);
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s;
  }

  .bookmark-button:hover {
    color: var(--color-primary, #2563eb);
    border-color: var(--color-primary, #2563eb);
  }

  .bookmark-button.bookmarked {
    color: var(--color-primary, #2563eb);
    border-color: var(--color-primary, #2563eb);
  }

  .bookmark-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
</style>
