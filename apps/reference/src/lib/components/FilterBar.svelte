<script lang="ts">
  let {
    chips = [],
    active = 0,
    onchange = (_index: number) => {},
  }: {
    chips: string[];
    active: number;
    onchange: (index: number) => void;
  } = $props();
</script>

<div class="filter-bar" role="tablist" aria-label="Filter">
  {#each chips as chip, i}
    <button
      class="fchip"
      class:active={i === active}
      role="tab"
      aria-selected={i === active}
      onclick={() => onchange(i)}
    >
      {chip}
    </button>
  {/each}
</div>
