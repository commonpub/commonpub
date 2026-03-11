<script lang="ts">
  import { enhance } from '$app/forms';
  import type { CommunityDetail } from '$lib/types';

  let { community }: { community: CommunityDetail } = $props();

  const policyLabels: Record<string, string> = {
    open: 'Open',
    approval: 'Approval',
    invite: 'Invite Only',
  };
</script>

<header class="community-header">
  {#if community.bannerUrl}
    <div class="header-banner">
      <img src={community.bannerUrl} alt="" class="banner-image" />
    </div>
  {/if}

  <div class="header-content">
    <div class="header-icon-row">
      {#if community.iconUrl}
        <img src={community.iconUrl} alt="" class="header-icon" width="64" height="64" />
      {:else}
        <div class="header-icon-placeholder" aria-hidden="true">
          {community.name[0]?.toUpperCase()}
        </div>
      {/if}
      <div class="header-info">
        <h1 class="header-name">{community.name}</h1>
        <div class="header-stats">
          <span>{community.memberCount} members</span>
          <span>{community.postCount} posts</span>
          <span class="header-policy"
            >{policyLabels[community.joinPolicy] ?? community.joinPolicy}</span
          >
        </div>
      </div>

      <div class="header-actions">
        {#if community.currentUserRole}
          <span class="role-badge role-{community.currentUserRole}"
            >{community.currentUserRole}</span
          >
          {#if community.currentUserRole !== 'owner'}
            <form method="POST" action="/communities/{community.slug}?/leave" use:enhance>
              <button type="submit" class="btn btn-secondary">Leave</button>
            </form>
          {/if}
        {:else if !community.isBanned}
          <form method="POST" action="/communities/{community.slug}?/join" use:enhance>
            <button type="submit" class="btn btn-primary">Join</button>
          </form>
        {/if}
      </div>
    </div>

    {#if community.description}
      <p class="header-description">{community.description}</p>
    {/if}
  </div>
</header>

<style>
  .community-header {
    margin-bottom: var(--space-6, 2rem);
  }

  .header-banner {
    height: 160px;
    overflow: hidden;
    border-radius: var(--radius-md, 6px) var(--radius-md, 6px) 0 0;
  }

  .banner-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .header-content {
    padding: var(--space-4, 1rem);
    border: 1px solid var(--color-border, #272725);
    border-radius: var(--radius-md, 6px);
    background: var(--color-surface, #0c0c0b);
  }

  .header-icon-row {
    display: flex;
    gap: var(--space-4, 1rem);
    align-items: center;
  }

  .header-icon {
    width: 64px;
    height: 64px;
    border-radius: var(--radius-md, 6px);
    object-fit: cover;
  }

  .header-icon-placeholder {
    width: 64px;
    height: 64px;
    border-radius: var(--radius-md, 6px);
    background: var(--color-primary, #2563eb);
    color: var(--color-on-primary, #ffffff);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: var(--font-weight-bold, 700);
    font-size: var(--text-xl, 1.5rem);
    flex-shrink: 0;
  }

  .header-info {
    flex: 1;
    min-width: 0;
  }

  .header-name {
    font-size: var(--text-xl, 1.5rem);
    color: var(--color-text, #d8d5cf);
    margin: 0;
  }

  .header-stats {
    display: flex;
    gap: var(--space-4, 1rem);
    font-size: var(--text-sm, 0.875rem);
    color: var(--color-text-secondary, #888884);
    margin-top: var(--space-1, 0.25rem);
  }

  .header-policy {
    padding: 0 var(--space-1, 0.25rem);
    background: var(--color-surface-alt, #1c1c1a);
    border-radius: var(--radius-sm, 4px);
  }

  .header-actions {
    display: flex;
    gap: var(--space-2, 0.5rem);
    align-items: center;
    flex-shrink: 0;
  }

  .header-description {
    margin-top: var(--space-4, 1rem);
    color: var(--color-text-secondary, #888884);
    font-size: var(--text-md, 1rem);
  }

  .role-badge {
    padding: var(--space-1, 0.25rem) var(--space-2, 0.5rem);
    border-radius: var(--radius-sm, 4px);
    font-size: var(--text-xs, 0.75rem);
    font-weight: var(--font-weight-medium, 500);
    text-transform: capitalize;
  }

  .role-owner {
    background: var(--color-warning-bg, #fffbeb);
    color: var(--color-warning, #f59e0b);
  }

  .role-admin {
    background: var(--color-error-bg, #fef2f2);
    color: var(--color-error, #dc2626);
  }

  .role-moderator {
    background: var(--color-info-bg, #eff6ff);
    color: var(--color-info, #3b82f6);
  }

  .role-member {
    background: var(--color-surface-alt, #1c1c1a);
    color: var(--color-text-secondary, #888884);
  }

  .btn {
    padding: var(--space-2, 0.5rem) var(--space-4, 1rem);
    border: none;
    border-radius: var(--radius-md, 6px);
    font-size: var(--text-md, 1rem);
    cursor: pointer;
    text-decoration: none;
  }

  .btn-primary {
    background: var(--color-primary, #2563eb);
    color: var(--color-on-primary, #ffffff);
  }

  .btn-secondary {
    background: var(--color-surface-alt, #1c1c1a);
    color: var(--color-text, #d8d5cf);
    border: 1px solid var(--color-border, #272725);
  }
</style>
