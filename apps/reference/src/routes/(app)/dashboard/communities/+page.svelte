<script lang="ts">
  import RoleBadge from '$lib/components/community/RoleBadge.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>My Communities — Dashboard — Snaplify</title>
</svelte:head>

<div class="dashboard-communities">
  <div class="page-header">
    <h1>My Communities</h1>
    <a href="/communities/create" class="btn btn-primary">Create Community</a>
  </div>

  {#if data.memberships.length === 0}
    <div class="empty-state">
      <p>You haven't joined any communities yet.</p>
      <a href="/communities">Browse communities</a>
    </div>
  {:else}
    <div class="memberships-list">
      {#each data.memberships as membership (membership.community.id)}
        <a href="/communities/{membership.community.slug}" class="membership-card">
          <div class="membership-info">
            {#if membership.community.iconUrl}
              <img
                src={membership.community.iconUrl}
                alt=""
                class="community-icon"
                width="40"
                height="40"
              />
            {:else}
              <span class="community-icon-placeholder"
                >{membership.community.name[0]?.toUpperCase()}</span
              >
            {/if}
            <div class="community-details">
              <span class="community-name">{membership.community.name}</span>
              <span class="community-stats"
                >{membership.community.memberCount} members · {membership.community.postCount} posts</span
              >
            </div>
          </div>
          <div class="membership-meta">
            <RoleBadge role={membership.role} />
            <time class="joined-date" datetime={new Date(membership.joinedAt).toISOString()}>
              Joined {new Date(membership.joinedAt).toLocaleDateString()}
            </time>
          </div>
        </a>
      {/each}
    </div>
  {/if}
</div>

<style>
  .dashboard-communities {
    max-width: var(--layout-content-width, 960px);
    margin: 0 auto;
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-6, 2rem);
  }

  .page-header h1 {
    font-size: var(--text-2xl, 1.875rem);
    color: var(--color-text, #d8d5cf);
  }

  .empty-state {
    text-align: center;
    padding: var(--space-12, 3rem);
    color: var(--color-text-secondary, #888884);
  }

  .empty-state a {
    color: var(--color-primary, #2563eb);
  }

  .memberships-list {
    display: flex;
    flex-direction: column;
    gap: 1px;
    background: var(--color-border, #272725);
    border: 1px solid var(--color-border, #272725);
    border-radius: var(--radius-md, 6px);
    overflow: hidden;
  }

  .membership-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-4, 1rem);
    background: var(--color-surface, #0c0c0b);
    text-decoration: none;
    color: inherit;
  }

  .membership-card:hover {
    background: var(--color-surface-hover, #1c1c1a);
  }

  .membership-info {
    display: flex;
    gap: var(--space-2, 0.5rem);
    align-items: center;
  }

  .community-icon {
    width: 40px;
    height: 40px;
    border-radius: var(--radius-md, 6px);
    object-fit: cover;
  }

  .community-icon-placeholder {
    width: 40px;
    height: 40px;
    border-radius: var(--radius-md, 6px);
    background: var(--color-primary, #2563eb);
    color: var(--color-on-primary, #ffffff);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-weight: var(--font-weight-bold, 700);
    font-size: var(--text-md, 1rem);
  }

  .community-details {
    display: flex;
    flex-direction: column;
  }

  .community-name {
    font-weight: var(--font-weight-medium, 500);
    color: var(--color-text, #d8d5cf);
  }

  .community-stats {
    font-size: var(--text-xs, 0.75rem);
    color: var(--color-text-secondary, #888884);
  }

  .membership-meta {
    display: flex;
    gap: var(--space-2, 0.5rem);
    align-items: center;
  }

  .joined-date {
    font-size: var(--text-xs, 0.75rem);
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
</style>
