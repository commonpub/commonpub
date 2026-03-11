<script lang="ts">
  import type { CommunityListItem } from '$lib/types';

  let { community }: { community: CommunityListItem } = $props();

  const policyLabels: Record<string, string> = {
    open: 'Open',
    approval: 'Approval',
    invite: 'Invite Only',
  };
</script>

<a href="/communities/{community.slug}" class="community-card" aria-label="Visit {community.name}">
  {#if community.iconUrl}
    <img src={community.iconUrl} alt="" class="card-icon" width="48" height="48" />
  {:else}
    <div class="card-icon-placeholder" aria-hidden="true">{community.name[0]?.toUpperCase()}</div>
  {/if}

  <div class="card-content">
    <h3 class="card-name">{community.name}</h3>
    {#if community.description}
      <p class="card-description">{community.description}</p>
    {/if}
    <div class="card-meta">
      <span class="card-members">{community.memberCount} members</span>
      <span class="card-policy">{policyLabels[community.joinPolicy] ?? community.joinPolicy}</span>
      {#if community.isOfficial}
        <span class="card-official">Official</span>
      {/if}
    </div>
  </div>
</a>

<style>
  .community-card {
    display: flex;
    gap: var(--space-4, 1rem);
    padding: var(--space-4, 1rem);
    border: 1px solid var(--color-border, #272725);
    border-radius: var(--radius-md, 6px);
    text-decoration: none;
    color: inherit;
    background: var(--color-surface, #0c0c0b);
    transition: border-color 0.15s;
  }

  .community-card:hover {
    border-color: var(--color-primary, #2563eb);
  }

  .card-icon {
    width: 48px;
    height: 48px;
    border-radius: var(--radius-md, 6px);
    object-fit: cover;
    flex-shrink: 0;
  }

  .card-icon-placeholder {
    width: 48px;
    height: 48px;
    border-radius: var(--radius-md, 6px);
    background: var(--color-primary, #2563eb);
    color: var(--color-on-primary, #ffffff);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: var(--font-weight-bold, 700);
    font-size: var(--text-lg, 1.25rem);
    flex-shrink: 0;
  }

  .card-content {
    min-width: 0;
    flex: 1;
  }

  .card-name {
    font-size: var(--text-md, 1rem);
    font-weight: var(--font-weight-medium, 500);
    color: var(--color-text, #d8d5cf);
    margin: 0;
  }

  .card-description {
    font-size: var(--text-sm, 0.875rem);
    color: var(--color-text-secondary, #888884);
    margin: var(--space-1, 0.25rem) 0 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .card-meta {
    display: flex;
    gap: var(--space-2, 0.5rem);
    font-size: var(--text-xs, 0.75rem);
    color: var(--color-text-secondary, #888884);
    margin-top: var(--space-1, 0.25rem);
  }

  .card-policy {
    padding: 0 var(--space-1, 0.25rem);
    background: var(--color-surface-alt, #1c1c1a);
    border-radius: var(--radius-sm, 4px);
  }

  .card-official {
    padding: 0 var(--space-1, 0.25rem);
    background: var(--color-success-bg, #f0fdf4);
    color: var(--color-success, #22c55e);
    border-radius: var(--radius-sm, 4px);
    font-weight: var(--font-weight-medium, 500);
  }
</style>
