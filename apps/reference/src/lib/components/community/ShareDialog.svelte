<script lang="ts">
  import type { CommunityListItem } from '$lib/types';

  let {
    communities,
    contentId,
    onclose,
  }: {
    communities: CommunityListItem[];
    contentId: string;
    onclose: () => void;
  } = $props();

  let sharing = $state(false);
  let error = $state<string | null>(null);
  let success = $state(false);

  async function shareTo(communityId: string) {
    sharing = true;
    error = null;

    try {
      const res = await fetch('/api/social/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ communityId, contentId }),
      });

      if (!res.ok) {
        const data = await res.json();
        error = data.error ?? 'Failed to share';
      } else {
        success = true;
        setTimeout(() => onclose(), 1500);
      }
    } catch {
      error = 'Failed to share';
    } finally {
      sharing = false;
    }
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  class="dialog-overlay"
  role="dialog"
  aria-label="Share to community"
  aria-modal="true"
  onkeydown={(e) => e.key === 'Escape' && onclose()}
>
  <div class="dialog-content">
    <div class="dialog-header">
      <h3>Share to Community</h3>
      <button class="close-btn" onclick={onclose} aria-label="Close">&#x2715;</button>
    </div>

    {#if error}
      <div class="error-banner" role="alert">{error}</div>
    {/if}

    {#if success}
      <div class="success-banner" role="status">Shared successfully!</div>
    {:else}
      <div class="community-list">
        {#each communities as community (community.id)}
          <button
            class="community-option"
            onclick={() => shareTo(community.id)}
            disabled={sharing}
            aria-label="Share to {community.name}"
          >
            {#if community.iconUrl}
              <img src={community.iconUrl} alt="" class="option-icon" width="32" height="32" />
            {:else}
              <span class="option-icon-placeholder">{community.name[0]?.toUpperCase()}</span>
            {/if}
            <span class="option-name">{community.name}</span>
            <span class="option-members">{community.memberCount} members</span>
          </button>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .dialog-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .dialog-content {
    background: var(--color-surface, #0c0c0b);
    border-radius: var(--radius-md, 6px);
    padding: var(--space-6, 2rem);
    max-width: 480px;
    width: 100%;
    max-height: 80vh;
    overflow-y: auto;
  }

  .dialog-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-4, 1rem);
  }

  .dialog-header h3 {
    font-size: var(--text-lg, 1.25rem);
    color: var(--color-text, #d8d5cf);
    margin: 0;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: var(--text-lg, 1.25rem);
    cursor: pointer;
    color: var(--color-text-secondary, #888884);
    padding: var(--space-1, 0.25rem);
  }

  .error-banner {
    padding: var(--space-2, 0.5rem);
    background: var(--color-error-bg, #fef2f2);
    color: var(--color-error, #dc2626);
    border-radius: var(--radius-sm, 4px);
    margin-bottom: var(--space-2, 0.5rem);
  }

  .success-banner {
    padding: var(--space-2, 0.5rem);
    background: var(--color-success-bg, #f0fdf4);
    color: var(--color-success, #22c55e);
    border-radius: var(--radius-sm, 4px);
    text-align: center;
  }

  .community-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-1, 0.25rem);
  }

  .community-option {
    display: flex;
    align-items: center;
    gap: var(--space-2, 0.5rem);
    padding: var(--space-2, 0.5rem);
    border: 1px solid var(--color-border, #272725);
    border-radius: var(--radius-sm, 4px);
    background: var(--color-surface, #0c0c0b);
    cursor: pointer;
    text-align: left;
    width: 100%;
  }

  .community-option:hover:not(:disabled) {
    border-color: var(--color-primary, #2563eb);
  }

  .community-option:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .option-icon {
    width: 32px;
    height: 32px;
    border-radius: var(--radius-sm, 4px);
    object-fit: cover;
  }

  .option-icon-placeholder {
    width: 32px;
    height: 32px;
    border-radius: var(--radius-sm, 4px);
    background: var(--color-primary, #2563eb);
    color: var(--color-on-primary, #ffffff);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-weight: var(--font-weight-bold, 700);
  }

  .option-name {
    flex: 1;
    font-weight: var(--font-weight-medium, 500);
    color: var(--color-text, #d8d5cf);
  }

  .option-members {
    font-size: var(--text-xs, 0.75rem);
    color: var(--color-text-secondary, #888884);
  }
</style>
