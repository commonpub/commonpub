<script lang="ts">
  interface FollowRequest {
    id: string;
    followerActorUri: string;
    status: string;
    createdAt: Date;
  }

  let { requests, domain }: { requests: FollowRequest[]; domain: string } = $props();

  async function respond(id: string, action: 'accept' | 'reject') {
    await fetch(`/api/federation/follow/${id}/${action}`, { method: 'POST' });
    // Remove from list optimistically
    requests = requests.filter((r) => r.id !== id);
  }
</script>

{#if requests.length === 0}
  <p class="empty">No pending follow requests.</p>
{:else}
  <ul class="requests" aria-label="Pending follow requests">
    {#each requests as req (req.id)}
      <li class="request">
        <span class="actor">{req.followerActorUri}</span>
        <div class="actions">
          <button
            class="accept"
            onclick={() => respond(req.id, 'accept')}
            aria-label="Accept follow from {req.followerActorUri}"
          >
            Accept
          </button>
          <button
            class="reject"
            onclick={() => respond(req.id, 'reject')}
            aria-label="Reject follow from {req.followerActorUri}"
          >
            Reject
          </button>
        </div>
      </li>
    {/each}
  </ul>
{/if}

<style>
  .requests {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .request {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-3, 0.75rem);
    border: 1px solid var(--color-border, #272725);
    border-radius: var(--radius-md, 0.375rem);
    margin-bottom: var(--space-2, 0.5rem);
  }

  .actor {
    font-size: var(--text-sm, 0.875rem);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .actions {
    display: flex;
    gap: var(--space-2, 0.5rem);
  }

  button {
    padding: var(--space-1, 0.25rem) var(--space-3, 0.75rem);
    border: none;
    border-radius: var(--radius-md, 0.375rem);
    font-size: var(--text-sm, 0.875rem);
    cursor: pointer;
  }

  .accept {
    background: var(--color-success, #22c55e);
    color: var(--color-text-on-success, #fff);
  }

  .reject {
    background: var(--color-error, #ef4444);
    color: var(--color-text-on-error, #fff);
  }

  button:focus-visible {
    outline: 2px solid var(--color-focus, #0066cc);
    outline-offset: 2px;
  }

  .empty {
    color: var(--color-text-secondary, #888884);
    font-style: italic;
  }
</style>
