<script lang="ts">
  let {
    stats = [],
  }: {
    stats: { label: string; value: string | number }[];
  } = $props();
</script>

<div class="stat-bar">
  {#each stats as stat}
    <div class="stat-chip">
      <div class="n">{stat.value}</div>
      <div class="l">{stat.label}</div>
    </div>
  {/each}
</div>

<style>
  .stat-bar {
    display: flex;
    background: var(--color-surface-alt, #141413);
    border: 1px solid var(--color-border, #272725);
    border-radius: var(--radius-md, 0.25rem);
    overflow: hidden;
  }

  .stat-bar .stat-chip {
    border-right: 1px solid var(--color-border, #272725);
    flex: 1;
  }

  .stat-bar .stat-chip:last-child {
    border-right: none;
  }
</style>
