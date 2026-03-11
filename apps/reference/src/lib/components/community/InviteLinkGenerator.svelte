<script lang="ts">
  import { enhance } from '$app/forms';
  import type { CommunityInviteItem } from '$lib/types';

  let {
    slug,
    invites,
  }: {
    slug: string;
    invites: CommunityInviteItem[];
  } = $props();

  let copiedToken = $state<string | null>(null);

  function copyToClipboard(token: string) {
    const url = `${window.location.origin}/communities/${slug}?invite=${token}`;
    navigator.clipboard.writeText(url).then(() => {
      copiedToken = token;
      setTimeout(() => (copiedToken = null), 2000);
    });
  }
</script>

<div class="invite-section">
  <form
    method="POST"
    action="/communities/{slug}/settings?/createInvite"
    use:enhance
    class="invite-form"
  >
    <div class="form-row">
      <div class="form-field">
        <label for="invite-max-uses">Max uses (optional)</label>
        <input type="number" id="invite-max-uses" name="maxUses" min="1" placeholder="Unlimited" />
      </div>
      <div class="form-field">
        <label for="invite-expires">Expires (optional)</label>
        <input type="datetime-local" id="invite-expires" name="expiresAt" />
      </div>
      <button type="submit" class="btn btn-primary">Create Invite</button>
    </div>
  </form>

  {#if invites.length > 0}
    <div class="invites-list">
      {#each invites as invite (invite.id)}
        <div class="invite-row">
          <div class="invite-info">
            <code class="invite-token">{invite.token.slice(0, 8)}...</code>
            <span class="invite-uses"
              >{invite.useCount}{invite.maxUses ? `/${invite.maxUses}` : ''} uses</span
            >
            {#if invite.expiresAt}
              <span class="invite-expiry"
                >Expires: {new Date(invite.expiresAt).toLocaleDateString()}</span
              >
            {/if}
          </div>
          <div class="invite-actions">
            <button
              class="btn btn-small"
              onclick={() => copyToClipboard(invite.token)}
              aria-label="Copy invite link"
            >
              {copiedToken === invite.token ? 'Copied!' : 'Copy Link'}
            </button>
            <form
              method="POST"
              action="/communities/{slug}/settings?/revokeInvite"
              use:enhance
              class="inline-form"
            >
              <input type="hidden" name="inviteId" value={invite.id} />
              <button
                type="submit"
                class="btn btn-small btn-danger-outline"
                aria-label="Revoke invite"
              >
                Revoke
              </button>
            </form>
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <p class="empty-text">No invites yet.</p>
  {/if}
</div>

<style>
  .invite-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-4, 1rem);
  }

  .invite-form {
    margin-bottom: var(--space-2, 0.5rem);
  }

  .form-row {
    display: flex;
    gap: var(--space-2, 0.5rem);
    align-items: flex-end;
  }

  .form-field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1, 0.25rem);
    flex: 1;
  }

  .form-field label {
    font-size: var(--text-sm, 0.875rem);
    font-weight: var(--font-weight-medium, 500);
    color: var(--color-text, #d8d5cf);
  }

  .form-field input {
    padding: var(--space-2, 0.5rem);
    border: 1px solid var(--color-border, #272725);
    border-radius: var(--radius-sm, 4px);
    font-size: var(--text-sm, 0.875rem);
    background: var(--color-surface, #0c0c0b);
    color: var(--color-text, #d8d5cf);
  }

  .invites-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2, 0.5rem);
  }

  .invite-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-2, 0.5rem);
    border: 1px solid var(--color-border, #272725);
    border-radius: var(--radius-sm, 4px);
    background: var(--color-surface, #0c0c0b);
  }

  .invite-info {
    display: flex;
    gap: var(--space-2, 0.5rem);
    align-items: center;
  }

  .invite-token {
    font-size: var(--text-sm, 0.875rem);
    background: var(--color-surface-alt, #1c1c1a);
    padding: 0 var(--space-1, 0.25rem);
    border-radius: var(--radius-sm, 4px);
  }

  .invite-uses,
  .invite-expiry {
    font-size: var(--text-xs, 0.75rem);
    color: var(--color-text-secondary, #888884);
  }

  .invite-actions {
    display: flex;
    gap: var(--space-1, 0.25rem);
  }

  .empty-text {
    color: var(--color-text-secondary, #888884);
    font-size: var(--text-sm, 0.875rem);
  }

  .inline-form {
    display: inline;
  }

  .btn {
    padding: var(--space-2, 0.5rem) var(--space-4, 1rem);
    border: none;
    border-radius: var(--radius-md, 6px);
    font-size: var(--text-md, 1rem);
    cursor: pointer;
  }

  .btn-primary {
    background: var(--color-primary, #2563eb);
    color: var(--color-on-primary, #ffffff);
  }

  .btn-small {
    padding: var(--space-1, 0.25rem) var(--space-2, 0.5rem);
    font-size: var(--text-xs, 0.75rem);
    background: var(--color-surface-alt, #1c1c1a);
    color: var(--color-text, #d8d5cf);
    border: 1px solid var(--color-border, #272725);
  }

  .btn-danger-outline {
    color: var(--color-error, #dc2626);
    border-color: var(--color-error, #dc2626);
    background: transparent;
  }
</style>
