<script lang="ts">
  import CommunityHeader from '$lib/components/community/CommunityHeader.svelte';
  import CommunityNav from '$lib/components/community/CommunityNav.svelte';
  import PostCard from '$lib/components/community/PostCard.svelte';
  import PostComposer from '$lib/components/community/PostComposer.svelte';
  import { Avatar, Badge, Button } from '@snaplify/ui';
  import type { PageData, ActionData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  const feedFilters = [
    { value: '', label: 'All' },
    { value: 'text', label: 'Discussion' },
    { value: 'link', label: 'Links' },
    { value: 'share', label: 'Shared' },
  ];

  let activeFilter = $state('');

  const filteredPosts = $derived(
    activeFilter
      ? data.posts.filter((p: { type: string }) => p.type === activeFilter)
      : data.posts
  );
</script>

<svelte:head>
  <title>{data.community.name} — Snaplify</title>
</svelte:head>

<div class="community-page">
  <CommunityHeader community={data.community} />
  <CommunityNav slug={data.community.slug} active="feed" role={data.community.currentUserRole} />

  {#if form?.error}
    <div class="error-banner" role="alert">{form.error}</div>
  {/if}

  <div class="community-layout">
    <div class="community-main">
      {#if data.community.currentUserRole && !data.community.isBanned}
        <PostComposer slug={data.community.slug} />
      {/if}

      {#if data.community.isBanned}
        <div class="banned-banner" role="alert">You are banned from this community.</div>
      {/if}

      <div class="feed-filters">
        {#each feedFilters as filter}
          <button
            class="feed-pill"
            class:feed-pill-active={activeFilter === filter.value}
            onclick={() => (activeFilter = filter.value)}
          >
            {filter.label}
          </button>
        {/each}
      </div>

      <div class="posts-feed">
        {#if filteredPosts.length === 0}
          <div class="empty-state">
            <p>No posts yet. Be the first to post!</p>
          </div>
        {:else}
          {#each filteredPosts as post (post.id)}
            <PostCard {post} slug={data.community.slug} userRole={data.community.currentUserRole} />
          {/each}
        {/if}
      </div>
    </div>

    <aside class="community-sidebar">
      <div class="sidebar-card">
        <h3 class="sidebar-card-title">About</h3>
        {#if data.community.description}
          <p class="sidebar-description">{data.community.description}</p>
        {/if}
        <dl class="sidebar-meta">
          <dt>Members</dt>
          <dd>{data.community.memberCount}</dd>
          <dt>Posts</dt>
          <dd>{data.community.postCount}</dd>
          <dt>Policy</dt>
          <dd>{data.community.joinPolicy}</dd>
        </dl>
      </div>

      {#if data.members && data.members.length > 0}
        <div class="sidebar-card">
          <h3 class="sidebar-card-title">Members</h3>
          <div class="member-list">
            {#each data.members.slice(0, 8) as member}
              <a href="/u/{member.user.username}" class="member-item">
                <Avatar
                  src={member.user.avatarUrl ?? undefined}
                  alt={member.user.displayName ?? member.user.username ?? ''}
                  name={member.user.displayName ?? member.user.username ?? '?'}
                  size="sm"
                />
                <div class="member-info">
                  <span class="member-name">{member.user.displayName ?? member.user.username}</span>
                  {#if member.role !== 'member'}
                    <Badge variant={member.role === 'owner' ? 'primary' : member.role === 'admin' ? 'success' : 'default'} size="sm" text={member.role} />
                  {/if}
                </div>
              </a>
            {/each}
          </div>
          {#if data.members.length > 8}
            <a href="/communities/{data.community.slug}/members" class="sidebar-link">View all members</a>
          {/if}
        </div>
      {/if}
    </aside>
  </div>
</div>

<style>
  .community-page {
    max-width: 1100px;
    margin: 0 auto;
  }

  .community-layout {
    display: grid;
    grid-template-columns: 1fr 280px;
    gap: var(--space-6, 1.5rem);
    align-items: start;
    margin-top: var(--space-4, 1rem);
  }

  .community-main {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-4, 1rem);
  }

  .error-banner {
    padding: var(--space-3, 0.75rem);
    background: rgba(248, 113, 113, 0.1);
    border: 1px solid var(--color-error, #f87171);
    color: var(--color-error, #f87171);
    border-radius: var(--radius-md, 0.25rem);
    font-size: var(--text-sm, 0.75rem);
    margin-bottom: var(--space-4, 1rem);
  }

  .banned-banner {
    padding: var(--space-3, 0.75rem);
    background: rgba(251, 191, 36, 0.1);
    border: 1px solid var(--color-warning, #fbbf24);
    color: var(--color-warning, #fbbf24);
    border-radius: var(--radius-md, 0.25rem);
    font-size: var(--text-sm, 0.75rem);
  }

  .feed-filters {
    display: flex;
    gap: var(--space-1, 0.25rem);
  }

  .feed-pill {
    padding: var(--space-1, 0.25rem) var(--space-3, 0.75rem);
    border: 1px solid var(--color-border, #272725);
    border-radius: var(--radius-md, 0.25rem);
    font-size: var(--text-sm, 0.75rem);
    font-family: var(--font-mono, monospace);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-secondary, #888884);
    background: transparent;
    cursor: pointer;
    transition: all var(--transition-fast, 0.1s ease);
  }

  .feed-pill:hover {
    border-color: var(--color-border-strong, #333330);
    color: var(--color-text, #d8d5cf);
  }

  .feed-pill-active {
    background: var(--color-surface-raised, #1c1c1a);
    border-color: var(--color-border-strong, #333330);
    color: var(--color-text, #d8d5cf);
  }

  .posts-feed {
    display: flex;
    flex-direction: column;
    gap: var(--space-3, 0.75rem);
  }

  .empty-state {
    text-align: center;
    padding: var(--space-12, 3rem);
    color: var(--color-text-secondary, #888884);
  }

  /* Sidebar */
  .community-sidebar {
    position: sticky;
    top: calc(var(--nav-height, 4rem) + var(--space-4, 1rem));
    display: flex;
    flex-direction: column;
    gap: var(--space-4, 1rem);
  }

  .sidebar-card {
    border: 1px solid var(--color-border, #272725);
    border-radius: var(--radius-md, 0.25rem);
    padding: var(--space-4, 1rem);
    background: var(--color-surface-alt, #141413);
  }

  .sidebar-card-title {
    font-family: var(--font-mono, monospace);
    font-size: var(--text-xs, 0.6875rem);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--color-text-secondary, #888884);
    margin: 0 0 var(--space-3, 0.75rem);
  }

  .sidebar-description {
    font-size: var(--text-sm, 0.75rem);
    color: var(--color-text-secondary, #888884);
    margin: 0 0 var(--space-3, 0.75rem);
    line-height: var(--leading-normal, 1.6);
  }

  .sidebar-meta {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: var(--space-1, 0.25rem) var(--space-3, 0.75rem);
    margin: 0;
    font-size: var(--text-sm, 0.75rem);
  }

  .sidebar-meta dt {
    color: var(--color-text-muted, #444440);
    font-family: var(--font-mono, monospace);
    font-size: var(--text-xs, 0.6875rem);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .sidebar-meta dd {
    margin: 0;
    color: var(--color-text, #d8d5cf);
  }

  .member-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2, 0.5rem);
  }

  .member-item {
    display: flex;
    align-items: center;
    gap: var(--space-2, 0.5rem);
    text-decoration: none;
    color: inherit;
    padding: var(--space-1, 0.25rem) 0;
  }

  .member-item:hover .member-name {
    color: var(--color-primary, #5b9cf6);
  }

  .member-info {
    display: flex;
    align-items: center;
    gap: var(--space-2, 0.5rem);
    min-width: 0;
  }

  .member-name {
    font-size: var(--text-sm, 0.75rem);
    color: var(--color-text, #d8d5cf);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sidebar-link {
    display: block;
    margin-top: var(--space-3, 0.75rem);
    font-size: var(--text-xs, 0.6875rem);
    color: var(--color-primary, #5b9cf6);
    text-decoration: none;
    font-family: var(--font-mono, monospace);
  }

  @media (max-width: 768px) {
    .community-layout {
      grid-template-columns: 1fr;
    }

    .community-sidebar {
      position: static;
    }
  }
</style>
