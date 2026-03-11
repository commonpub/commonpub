<script lang="ts">
  import type { CommunityMemberItem } from '$lib/types';
  import RoleBadge from './RoleBadge.svelte';

  let { member }: { member: CommunityMemberItem } = $props();
</script>

<div class="member-card">
  <div class="member-info">
    {#if member.user.avatarUrl}
      <img src={member.user.avatarUrl} alt="" class="member-avatar" width="36" height="36" />
    {:else}
      <span class="member-avatar-placeholder"
        >{member.user.displayName?.[0] ?? member.user.username[0]}</span
      >
    {/if}
    <div class="member-details">
      <span class="member-name">{member.user.displayName ?? member.user.username}</span>
      <span class="member-username">@{member.user.username}</span>
    </div>
  </div>
  <div class="member-meta">
    <RoleBadge role={member.role} />
    <time class="member-joined" datetime={new Date(member.joinedAt).toISOString()}>
      Joined {new Date(member.joinedAt).toLocaleDateString()}
    </time>
  </div>
</div>

<style>
  .member-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-2, 0.5rem) var(--space-4, 1rem);
    background: var(--color-surface, #0c0c0b);
  }

  .member-info {
    display: flex;
    gap: var(--space-2, 0.5rem);
    align-items: center;
  }

  .member-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    object-fit: cover;
  }

  .member-avatar-placeholder {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: var(--color-primary, #2563eb);
    color: var(--color-on-primary, #ffffff);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-weight: var(--font-weight-bold, 700);
    font-size: var(--text-sm, 0.875rem);
  }

  .member-details {
    display: flex;
    flex-direction: column;
  }

  .member-name {
    font-weight: var(--font-weight-medium, 500);
    color: var(--color-text, #d8d5cf);
    font-size: var(--text-sm, 0.875rem);
  }

  .member-username {
    font-size: var(--text-xs, 0.75rem);
    color: var(--color-text-secondary, #888884);
  }

  .member-meta {
    display: flex;
    gap: var(--space-2, 0.5rem);
    align-items: center;
  }

  .member-joined {
    font-size: var(--text-xs, 0.75rem);
    color: var(--color-text-secondary, #888884);
  }
</style>
