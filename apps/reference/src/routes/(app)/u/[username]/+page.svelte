<script lang="ts">
  import ContentCard from '$lib/components/ContentCard.svelte';
  import { Avatar, Badge, Button } from '@snaplify/ui';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const tabs = [
    { key: 'projects', label: 'Projects', count: data.profile.stats.projects },
    { key: 'guides', label: 'Guides', count: data.profile.stats.guides },
    { key: 'explainers', label: 'Explainers', count: data.profile.stats.explainers },
    { key: 'articles', label: 'Articles', count: data.profile.stats.articles },
  ];
</script>

<svelte:head>
  <title>{data.profile.displayName ?? data.profile.username} — Snaplify</title>
</svelte:head>

<div class="profile-page">
  <header class="profile-header">
    <div class="profile-banner"></div>
    <div class="profile-info">
      <div class="profile-avatar-wrap">
        <Avatar
          src={data.profile.avatarUrl ?? undefined}
          alt={data.profile.displayName ?? data.profile.username ?? ''}
          name={data.profile.displayName ?? data.profile.username ?? '?'}
          size="xl"
        />
      </div>
      <div class="profile-details">
        <div class="profile-name-row">
          <h1 class="profile-name">{data.profile.displayName ?? data.profile.username}</h1>
          {#if data.isOwnProfile}
            <a href="/dashboard/settings"><Button variant="secondary" size="sm">Edit Profile</Button></a>
          {:else}
            <Button variant="primary" size="sm">Follow</Button>
          {/if}
        </div>
        <span class="profile-handle">@{data.profile.username}</span>
        {#if data.profile.bio}
          <p class="profile-bio">{data.profile.bio}</p>
        {/if}
      </div>
    </div>
  </header>

  <div class="profile-stats">
    <div class="stat">
      <span class="stat-value">{data.profile.stats.projects}</span>
      <span class="stat-label">Projects</span>
    </div>
    <div class="stat">
      <span class="stat-value">{data.profile.stats.guides}</span>
      <span class="stat-label">Guides</span>
    </div>
    <div class="stat">
      <span class="stat-value">{data.profile.stats.explainers}</span>
      <span class="stat-label">Explainers</span>
    </div>
    <div class="stat">
      <span class="stat-value">{data.profile.stats.followers}</span>
      <span class="stat-label">Followers</span>
    </div>
    <div class="stat">
      <span class="stat-value">{data.profile.stats.following}</span>
      <span class="stat-label">Following</span>
    </div>
  </div>

  <nav class="profile-tabs" aria-label="Profile content tabs">
    {#each tabs as tab}
      <a
        href="/u/{data.profile.username}?tab={tab.key}"
        class="profile-tab"
        class:profile-tab-active={data.tab === tab.key}
        aria-current={data.tab === tab.key ? 'page' : undefined}
      >
        {tab.label}
        {#if tab.count > 0}
          <span class="tab-count">{tab.count}</span>
        {/if}
      </a>
    {/each}
  </nav>

  {#if data.items.length === 0}
    <div class="empty-state">
      <p>No {data.tab} yet.</p>
    </div>
  {:else}
    <div class="content-grid">
      {#each data.items as item (item.id)}
        <ContentCard {item} />
      {/each}
    </div>
  {/if}
</div>

<style>
  .profile-page {
    max-width: 960px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-6, 1.5rem);
  }

  .profile-header {
    position: relative;
  }

  .profile-banner {
    height: 160px;
    background: linear-gradient(135deg, var(--color-surface-raised, #1c1c1a), var(--color-surface-alt, #141413));
    border-radius: var(--radius-lg, 0.5rem);
    border: 1px solid var(--color-border, #272725);
  }

  .profile-info {
    display: flex;
    gap: var(--space-4, 1rem);
    padding: 0 var(--space-4, 1rem);
    margin-top: -40px;
  }

  .profile-avatar-wrap {
    flex-shrink: 0;
    border: 3px solid var(--color-surface, #0c0c0b);
    border-radius: var(--radius-full, 50%);
    overflow: hidden;
  }

  .profile-details {
    flex: 1;
    padding-top: 48px;
  }

  .profile-name-row {
    display: flex;
    align-items: center;
    gap: var(--space-3, 0.75rem);
  }

  .profile-name {
    font-size: var(--text-2xl, 1.5rem);
    font-weight: var(--font-weight-bold, 700);
    color: var(--color-text, #d8d5cf);
    margin: 0;
  }

  .profile-handle {
    font-family: var(--font-mono, monospace);
    font-size: var(--text-sm, 0.75rem);
    color: var(--color-text-muted, #444440);
  }

  .profile-bio {
    font-size: var(--text-sm, 0.75rem);
    color: var(--color-text-secondary, #888884);
    margin: var(--space-2, 0.5rem) 0 0;
    line-height: var(--leading-normal, 1.6);
  }

  .profile-stats {
    display: flex;
    gap: var(--space-6, 1.5rem);
    padding: var(--space-4, 1rem);
    border: 1px solid var(--color-border, #272725);
    border-radius: var(--radius-md, 0.25rem);
    background: var(--color-surface-alt, #141413);
  }

  .stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-1, 0.25rem);
  }

  .stat-value {
    font-size: var(--text-lg, 1.125rem);
    font-weight: var(--font-weight-bold, 700);
    color: var(--color-text, #d8d5cf);
  }

  .stat-label {
    font-family: var(--font-mono, monospace);
    font-size: var(--text-xs, 0.6875rem);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-muted, #444440);
  }

  .profile-tabs {
    display: flex;
    gap: 0;
    border-bottom: 1px solid var(--color-border, #272725);
  }

  .profile-tab {
    padding: var(--space-3, 0.75rem) var(--space-4, 1rem);
    text-decoration: none;
    color: var(--color-text-secondary, #888884);
    border-bottom: 2px solid transparent;
    font-size: var(--text-sm, 0.75rem);
    font-family: var(--font-mono, monospace);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    display: flex;
    align-items: center;
    gap: var(--space-2, 0.5rem);
    transition: color var(--transition-fast, 0.1s ease);
  }

  .profile-tab:hover {
    color: var(--color-text, #d8d5cf);
  }

  .profile-tab-active {
    color: var(--color-primary, #5b9cf6);
    border-bottom-color: var(--color-primary, #5b9cf6);
  }

  .tab-count {
    font-size: var(--text-xs, 0.6875rem);
    background: var(--color-surface-raised, #1c1c1a);
    padding: 0 var(--space-2, 0.5rem);
    border-radius: var(--radius-md, 0.25rem);
    color: var(--color-text-muted, #444440);
  }

  .content-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-4, 1rem);
  }

  .empty-state {
    text-align: center;
    padding: var(--space-12, 3rem);
    color: var(--color-text-secondary, #888884);
  }

  @media (max-width: 768px) {
    .content-grid {
      grid-template-columns: repeat(2, 1fr);
    }

    .profile-stats {
      flex-wrap: wrap;
      justify-content: center;
    }
  }

  @media (max-width: 480px) {
    .content-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
