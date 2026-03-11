<script lang="ts">
  interface ActivityItem {
    id: string;
    type: string;
    actorUri: string;
    objectUri: string | null;
    direction: string;
    status: string;
    attempts: number;
    error: string | null;
    createdAt: Date;
  }

  let { items }: { items: ActivityItem[] } = $props();
</script>

{#if items.length === 0}
  <p class="empty">No federation activity yet.</p>
{:else}
  <div class="activity-log" role="table" aria-label="Federation activity log">
    <div class="header" role="row">
      <span role="columnheader">Direction</span>
      <span role="columnheader">Type</span>
      <span role="columnheader">Actor</span>
      <span role="columnheader">Status</span>
      <span role="columnheader">Time</span>
    </div>
    {#each items as item (item.id)}
      <div class="row" role="row">
        <span class="direction" role="cell" aria-label={item.direction}>
          {item.direction === 'inbound' ? '←' : '→'}
        </span>
        <span class="type" role="cell">{item.type}</span>
        <span class="actor" role="cell" title={item.actorUri}>
          {item.actorUri.replace(/^https?:\/\//, '').split('/')[0]}
        </span>
        <span class="status" role="cell" data-status={item.status}>
          {item.status}
        </span>
        <time role="cell" datetime={new Date(item.createdAt).toISOString()}>
          {new Date(item.createdAt).toLocaleString()}
        </time>
      </div>
    {/each}
  </div>
{/if}

<style>
  .activity-log {
    border: 1px solid var(--color-border, #272725);
    border-radius: var(--radius-md, 0.375rem);
    overflow: hidden;
  }

  .header {
    display: grid;
    grid-template-columns: 3rem 5rem 1fr 5rem 10rem;
    gap: var(--space-2, 0.5rem);
    padding: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
    background: var(--color-bg-subtle, #1c1c1a);
    font-weight: var(--font-semibold, 600);
    font-size: var(--text-sm, 0.875rem);
  }

  .row {
    display: grid;
    grid-template-columns: 3rem 5rem 1fr 5rem 10rem;
    gap: var(--space-2, 0.5rem);
    padding: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
    border-top: 1px solid var(--color-border, #272725);
    font-size: var(--text-sm, 0.875rem);
  }

  .direction {
    text-align: center;
  }

  .actor {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .status[data-status='delivered'],
  .status[data-status='processed'] {
    color: var(--color-success, #22c55e);
  }

  .status[data-status='failed'] {
    color: var(--color-error, #ef4444);
  }

  .status[data-status='pending'] {
    color: var(--color-warning, #f59e0b);
  }

  .empty {
    color: var(--color-text-secondary, #888884);
    font-style: italic;
  }
</style>
