<script lang="ts">
  let {
    savedStatus = '',
    sectionCount = 0,
    blockCount = 0,
    moduleCount = 0,
    theme = 'generics',
    version = '1.0.0',
  }: {
    savedStatus?: string;
    sectionCount?: number;
    blockCount?: number;
    moduleCount?: number;
    theme?: string;
    version?: string;
  } = $props();
</script>

<footer class="editor-status-bar">
  <span class="esb-item">{savedStatus || 'ready'}</span>
  {#if sectionCount > 0}
    <span class="esb-sep">&middot;</span>
    <span class="esb-item">{sectionCount} sections</span>
  {/if}
  <span class="esb-sep">&middot;</span>
  <span class="esb-item">{blockCount} blocks</span>
  {#if moduleCount > 0}
    <span class="esb-sep">&middot;</span>
    <span class="esb-item">{moduleCount} modules</span>
  {/if}
  <span class="esb-right">
    <span class="esb-item">{theme}</span>
    <span class="esb-sep">&middot;</span>
    <span class="esb-item">v{version}</span>
  </span>
</footer>

<style>
  .editor-status-bar {
    display: flex;
    align-items: center;
    height: 22px;
    min-height: 22px;
    padding: 0 12px;
    border-top: 1px solid var(--color-border, #272725);
    background: var(--color-surface, #0c0c0b);
    gap: 4px;
  }

  .esb-item {
    font-family: var(--font-mono, monospace);
    font-size: 10px;
    color: var(--color-text-muted, #444440);
  }

  .esb-sep {
    font-size: 10px;
    color: var(--color-text-muted, #444440);
  }

  .esb-right {
    margin-left: auto;
    display: flex;
    gap: 4px;
    align-items: center;
  }
</style>
