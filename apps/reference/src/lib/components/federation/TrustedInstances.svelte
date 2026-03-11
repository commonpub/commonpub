<script lang="ts">
  let { instances }: { instances: string[] } = $props();
</script>

{#if instances.length === 0}
  <p class="empty">No trusted instances configured.</p>
{:else}
  <ul class="instances" aria-label="Trusted instances">
    {#each instances as instance}
      <li class="instance">
        <span class="domain">{instance}</span>
        <span class="badge">Trusted</span>
      </li>
    {/each}
  </ul>
{/if}

<style>
  .instances {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .instance {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
    border: 1px solid var(--color-border, #272725);
    border-radius: var(--radius-md, 0.375rem);
    margin-bottom: var(--space-2, 0.5rem);
  }

  .domain {
    font-family: var(--font-mono, monospace);
    font-size: var(--text-sm, 0.875rem);
  }

  .badge {
    font-size: var(--text-xs, 0.75rem);
    padding: var(--space-1, 0.25rem) var(--space-2, 0.5rem);
    background: var(--color-bg-success, #dcfce7);
    color: var(--color-success, #22c55e);
    border-radius: var(--radius-full, 9999px);
    font-weight: var(--font-weight-medium, 500);
  }

  .empty {
    color: var(--color-text-secondary, #888884);
    font-style: italic;
  }
</style>
