<script lang="ts">
  let {
    onviewchange = (_view: string) => {},
  }: {
    onviewchange?: (view: string) => void;
  } = $props();

  let activeView = $state('desktop');
  const views = [
    { key: 'desktop', label: 'Desktop', width: '860px' },
    { key: 'tablet', label: 'Tablet', width: '768px' },
    { key: 'mobile', label: 'Mobile', width: '390px' },
  ];
</script>

<div class="canvas-toolbar">
  <span class="ct-label">insert block:</span>
  <slot name="insertButtons" />
  <div class="tool-sep"></div>
  <div class="ct-views">
    {#each views as view}
      <button
        class="tool-btn"
        class:active={activeView === view.key}
        onclick={() => { activeView = view.key; onviewchange(view.key); }}
      >
        {view.label}
      </button>
    {/each}
  </div>
</div>

<style>
  .canvas-toolbar {
    background: var(--color-surface-alt, #141413);
    border-bottom: 1px solid var(--color-border, #272725);
    padding: 8px 16px;
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
  }

  .ct-label {
    font-size: 10px;
    font-family: var(--font-mono, monospace);
    color: var(--color-text-muted, #444440);
    margin-right: 6px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .ct-views {
    display: flex;
    gap: 2px;
    margin-left: auto;
  }
</style>
