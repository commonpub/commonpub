<script lang="ts">
  import { enhance } from '$app/forms';
  import { getRoleWeight } from '$lib/utils/community-permissions';

  let {
    slug,
    userId,
    currentRole,
    actorRole,
  }: {
    slug: string;
    userId: string;
    currentRole: string;
    actorRole: string;
  } = $props();

  const allRoles = ['member', 'moderator', 'admin'] as const;
  const availableRoles = allRoles.filter(
    (role) => getRoleWeight(actorRole) > getRoleWeight(role) && role !== currentRole,
  );
</script>

{#if availableRoles.length > 0 && currentRole !== 'owner'}
  <form
    method="POST"
    action="/communities/{slug}/settings?/changeRole"
    use:enhance
    class="role-selector"
  >
    <input type="hidden" name="userId" value={userId} />
    <select name="role" class="role-select" aria-label="Change role">
      <option value="" disabled selected>Change role...</option>
      {#each availableRoles as role}
        <option value={role}>{role}</option>
      {/each}
    </select>
    <button type="submit" class="btn btn-small" aria-label="Apply role change">Apply</button>
  </form>
{/if}

<style>
  .role-selector {
    display: flex;
    gap: var(--space-1, 0.25rem);
    align-items: center;
  }

  .role-select {
    padding: var(--space-1, 0.25rem) var(--space-2, 0.5rem);
    border: 1px solid var(--color-border, #272725);
    border-radius: var(--radius-sm, 4px);
    font-size: var(--text-xs, 0.75rem);
    background: var(--color-surface, #0c0c0b);
    color: var(--color-text, #d8d5cf);
  }

  .btn-small {
    padding: var(--space-1, 0.25rem) var(--space-2, 0.5rem);
    font-size: var(--text-xs, 0.75rem);
    background: var(--color-surface-alt, #1c1c1a);
    color: var(--color-text, #d8d5cf);
    border: 1px solid var(--color-border, #272725);
    border-radius: var(--radius-sm, 4px);
    cursor: pointer;
  }
</style>
