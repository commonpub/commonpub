<script lang="ts">
  import CommunityHeader from '$lib/components/community/CommunityHeader.svelte';
  import CommunityNav from '$lib/components/community/CommunityNav.svelte';
  import PostCard from '$lib/components/community/PostCard.svelte';
  import PostComposer from '$lib/components/community/PostComposer.svelte';
  import FilterBar from '$lib/components/FilterBar.svelte';
  import SidebarCard from '$lib/components/SidebarCard.svelte';
  import { Avatar, Badge } from '@snaplify/ui';
  import type { PageData, ActionData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  const feedFilterLabels = ['all posts', 'discussion', 'links', 'shared'];
  const feedFilterValues = ['', 'text', 'link', 'share'];
  let activeFilterIdx = $state(0);

  const filteredPosts = $derived(
    feedFilterValues[activeFilterIdx]
      ? data.posts.filter((p: { type: string }) => p.type === feedFilterValues[activeFilterIdx])
      : data.posts
  );
</script>

<svelte:head>
  <title>{data.community.name} — Snaplify</title>
</svelte:head>

<CommunityHeader community={data.community} />
<CommunityNav slug={data.community.slug} active="feed" role={data.community.currentUserRole} />

{#if form?.error}
  <div class="page"><div class="error-banner" role="alert">{form.error}</div></div>
{/if}

<div class="page">
  <div class="grid-sb">
    <div>
      {#if data.community.currentUserRole && !data.community.isBanned}
        <PostComposer slug={data.community.slug} />
      {/if}

      {#if data.community.isBanned}
        <div class="banned-banner" role="alert">You are banned from this community.</div>
      {/if}

      <FilterBar
        chips={feedFilterLabels}
        active={activeFilterIdx}
        onchange={(i) => activeFilterIdx = i}
      />

      {#if filteredPosts.length === 0}
        <div class="empty-state">No posts yet. Be the first to post!</div>
      {:else}
        {#each filteredPosts as post (post.id)}
          <PostCard {post} slug={data.community.slug} userRole={data.community.currentUserRole} />
        {/each}
      {/if}
    </div>

    <div>
      <SidebarCard title="members ({data.community.memberCount})">
        {#if data.members && data.members.length > 0}
          {#each data.members.slice(0, 8) as member}
            <div class="member-row">
              <div class="av av-sm">{(member.user.displayName ?? member.user.username ?? '?')[0].toUpperCase()}</div>
              <a href="/u/{member.user.username}" class="member-name-link">{member.user.displayName ?? member.user.username}</a>
              {#if member.role !== 'member'}
                <span class="member-role">{member.role}</span>
              {/if}
            </div>
          {/each}
          {#if data.members.length > 8}
            <a href="/communities/{data.community.slug}/members" class="view-all-link">view all members</a>
          {/if}
        {/if}
      </SidebarCard>

      <SidebarCard title="about">
        {#if data.community.description}
          <p class="about-text">{data.community.description}</p>
        {/if}
        <div class="about-meta">
          <span>{data.community.memberCount} members</span>
          <span>{data.community.postCount} posts</span>
          <span>{data.community.joinPolicy}</span>
        </div>
      </SidebarCard>
    </div>
  </div>
</div>

<style>
  .error-banner {
    padding: 10px 14px;
    background: var(--color-error-bg);
    border: 1px solid var(--color-error);
    color: var(--color-error);
    border-radius: var(--radius-md, 0.25rem);
    font-size: 12px;
    margin-bottom: 16px;
  }

  .banned-banner {
    padding: 10px 14px;
    background: var(--color-warning-bg);
    border: 1px solid var(--color-warning);
    color: var(--color-warning);
    border-radius: var(--radius-md, 0.25rem);
    font-size: 12px;
    margin-bottom: 16px;
  }

  .member-name-link {
    font-size: 12px;
    color: var(--color-text);
    text-decoration: none;
  }

  .member-name-link:hover {
    color: var(--color-accent, #5b9cf6);
  }

  .view-all-link {
    display: block;
    margin-top: 10px;
    font-size: 10px;
    font-family: var(--font-mono, monospace);
    color: var(--color-accent, #5b9cf6);
    text-decoration: none;
  }

  .about-text {
    font-size: 12px;
    color: var(--color-text-secondary, #888884);
    line-height: 1.65;
    margin: 0 0 12px;
  }

  .about-meta {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 11px;
    font-family: var(--font-mono, monospace);
    color: var(--color-text-muted, #444440);
  }

  .empty-state {
    text-align: center;
    padding: var(--space-12, 3rem);
    color: var(--color-text-secondary, #888884);
  }
</style>
