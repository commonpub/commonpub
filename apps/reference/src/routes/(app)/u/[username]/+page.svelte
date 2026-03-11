<script lang="ts">
  import ContentCard from '$lib/components/ContentCard.svelte';
  import StatBar from '$lib/components/StatBar.svelte';
  import { Avatar } from '@snaplify/ui';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const tabs = [
    { key: 'projects', label: 'projects' },
    { key: 'guides', label: 'guides' },
    { key: 'explainers', label: 'explainers' },
    { key: 'articles', label: 'articles' },
    { key: 'followers', label: 'followers' },
  ];
</script>

<svelte:head>
  <title>{data.profile.displayName ?? data.profile.username} — Snaplify</title>
</svelte:head>

<div class="thumb thumb-21x9" style="max-height: 160px; border: none; border-bottom: 1px solid var(--color-border);">
  <span class="thumb-label">ProfileBanner</span>
</div>

<div class="page">
  <div class="profile-top">
    <div class="av av-xl profile-av">
      {(data.profile.displayName ?? data.profile.username ?? '?')[0].toUpperCase()}
    </div>
    <div class="profile-name-wrap">
      <div class="profile-name">{data.profile.displayName ?? data.profile.username}</div>
      <div class="profile-handle">@{data.profile.username}@[instance]</div>
    </div>
    <div class="profile-right">
      <span class="fed-badge"><span class="fed-dot"></span> AP Person &middot; federated identity</span>
      {#if data.isOwnProfile}
        <a href="/dashboard/settings" class="btn btn-sm">Edit Profile</a>
      {:else}
        <button class="btn btn-primary btn-sm">+ follow</button>
      {/if}
    </div>
  </div>

  {#if data.profile.bio}
    <p class="profile-bio">{data.profile.bio}</p>
  {/if}

  <StatBar stats={[
    { label: 'projects', value: data.profile.stats.projects },
    { label: 'guides', value: data.profile.stats.guides },
    { label: 'explainers', value: data.profile.stats.explainers },
    { label: 'followers', value: data.profile.stats.followers },
    { label: 'following', value: data.profile.stats.following },
  ]} />

  <nav class="profile-tabs" aria-label="Profile content tabs">
    {#each tabs as tab}
      <a
        href="/u/{data.profile.username}?tab={tab.key}"
        class="tab-link"
        class:active={data.tab === tab.key}
        aria-current={data.tab === tab.key ? 'page' : undefined}
      >
        {tab.label}
      </a>
    {/each}
  </nav>

  {#if data.items.length === 0}
    <div class="empty-state">No {data.tab} yet.</div>
  {:else}
    <div class="grid-3">
      {#each data.items as item (item.id)}
        <ContentCard {item} />
      {/each}
    </div>
  {/if}
</div>

<style>
  .profile-top {
    display: flex;
    align-items: flex-end;
    gap: 20px;
    margin-top: -36px;
    margin-bottom: 18px;
  }

  .profile-av {
    border: 2px solid var(--color-surface, #0c0c0b);
    background: var(--color-surface-raised, #1c1c1a);
  }

  .profile-name-wrap {
    padding-bottom: 4px;
  }

  .profile-name {
    font-size: 20px;
    font-weight: var(--font-weight-bold, 700);
  }

  .profile-handle {
    font-size: 12px;
    font-family: var(--font-mono, monospace);
    color: var(--color-text-secondary, #888884);
  }

  .profile-right {
    margin-left: auto;
    padding-bottom: 4px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .profile-bio {
    font-size: 13px;
    color: var(--color-text-secondary, #888884);
    line-height: 1.65;
    max-width: 520px;
    margin: 0 0 12px;
  }

  .profile-tabs {
    display: flex;
    gap: 0;
    border-bottom: 1px solid var(--color-border, #272725);
    margin: 22px 0 20px;
  }

  .tab-link {
    padding: 8px 12px;
    font-size: 12px;
    color: var(--color-text-secondary, #888884);
    text-decoration: none;
    border-bottom: 2px solid transparent;
    border-radius: 0;
  }

  .tab-link:hover { color: var(--color-text); }
  .tab-link.active {
    color: var(--color-accent, #5b9cf6);
    border-bottom-color: var(--color-accent, #5b9cf6);
  }

  .empty-state {
    text-align: center;
    padding: var(--space-12, 3rem);
    color: var(--color-text-secondary, #888884);
  }
</style>
