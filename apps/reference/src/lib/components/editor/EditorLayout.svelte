<script lang="ts">
  import type { Snippet } from 'svelte';
  import { getIsDirty, getIsSaving, getLastSaved } from '$lib/stores/editor.svelte';

  let {
    title = $bindable(''),
    type = 'article',
    status = 'draft',
    backHref = '/',
    leftPanel,
    children,
    rightPanel,
    topbarExtra,
    statusBar,
    onsave,
    onpublish,
    ondraft,
  }: {
    title?: string;
    type?: string;
    status?: 'draft' | 'published';
    backHref?: string;
    leftPanel?: Snippet;
    children: Snippet;
    rightPanel?: Snippet;
    topbarExtra?: Snippet;
    statusBar?: Snippet;
    onsave?: () => void;
    onpublish?: () => void;
    ondraft?: () => void;
  } = $props();

  let saving = $derived(getIsSaving());
  let dirty = $derived(getIsDirty());
  let lastSaved = $derived(getLastSaved());

  function formatSaved(): string {
    if (saving) return 'Saving…';
    if (!lastSaved) return dirty ? 'Unsaved' : '';
    const ago = Math.round((Date.now() - lastSaved.getTime()) / 1000);
    if (ago < 5) return 'Saved';
    if (ago < 60) return `Saved ${ago}s ago`;
    return `Saved ${Math.round(ago / 60)}m ago`;
  }
</script>

<div class="editor-layout">
  <!-- Topbar -->
  <header class="el-topbar">
    <div class="el-topbar-left">
      <a href={backHref} class="el-back" aria-label="Back">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </a>
      <span class="el-type-badge">{type}</span>
      <input
        class="el-title-input"
        type="text"
        bind:value={title}
        placeholder="Untitled"
        aria-label="Document title"
      />
      {#if status === 'published'}
        <span class="el-status el-status-published">Published</span>
      {:else if dirty}
        <span class="el-status el-status-unsaved">Unsaved</span>
      {:else}
        <span class="el-status">{formatSaved()}</span>
      {/if}
    </div>
    <div class="el-topbar-right">
      {#if topbarExtra}
        {@render topbarExtra()}
      {/if}
      {#if ondraft}
        <button class="el-btn el-btn-ghost" onclick={ondraft} disabled={saving}>Draft</button>
      {/if}
      {#if onsave}
        <button class="el-btn el-btn-ghost" onclick={onsave} disabled={saving}>Save</button>
      {/if}
      {#if onpublish}
        <button class="el-btn el-btn-primary" onclick={onpublish} disabled={saving}>Publish</button>
      {/if}
    </div>
  </header>

  <!-- Body: 3-column grid -->
  <div class="el-body" class:el-body-no-left={!leftPanel} class:el-body-no-right={!rightPanel}>
    {#if leftPanel}
      <aside class="el-left-panel">
        {@render leftPanel()}
      </aside>
    {/if}

    <div class="el-canvas">
      <div class="el-canvas-content">
        {@render children()}
      </div>
    </div>

    {#if rightPanel}
      <aside class="el-right-panel">
        {@render rightPanel()}
      </aside>
    {/if}
  </div>

  <!-- Status bar -->
  <footer class="el-statusbar">
    {#if statusBar}
      {@render statusBar()}
    {:else}
      <span class="el-statusbar-text">{formatSaved()}</span>
    {/if}
  </footer>
</div>

<style>
  .editor-layout {
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
    background: var(--color-surface, #0c0c0b);
    /* Override parent layout max-width */
    position: fixed;
    inset: 0;
    z-index: var(--z-fixed, 100);
  }

  /* === Topbar === */
  .el-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 44px;
    min-height: 44px;
    padding: 0 var(--space-3, 0.75rem);
    border-bottom: 1px solid var(--color-border, #272725);
    background: var(--color-surface, #0c0c0b);
    gap: var(--space-2, 0.5rem);
  }

  .el-topbar-left {
    display: flex;
    align-items: center;
    gap: var(--space-2, 0.5rem);
    flex: 1;
    min-width: 0;
  }

  .el-topbar-right {
    display: flex;
    align-items: center;
    gap: var(--space-2, 0.5rem);
    flex-shrink: 0;
  }

  .el-back {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: var(--radius-sm, 4px);
    color: var(--color-text-secondary, #888884);
    text-decoration: none;
    flex-shrink: 0;
  }

  .el-back:hover {
    background: var(--color-surface-alt, #141413);
    color: var(--color-text, #d8d5cf);
  }

  .el-type-badge {
    font-family: var(--font-mono, monospace);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--color-primary, #5b9cf6);
    background: rgba(91, 156, 246, 0.08);
    border: 1px solid rgba(91, 156, 246, 0.2);
    padding: 2px 8px;
    border-radius: var(--radius-sm, 4px);
    white-space: nowrap;
    flex-shrink: 0;
  }

  .el-title-input {
    font-family: var(--font-body, system-ui, sans-serif);
    font-size: var(--text-sm, 0.875rem);
    font-weight: var(--font-weight-medium, 500);
    color: var(--color-text, #d8d5cf);
    background: transparent;
    border: none;
    outline: none;
    padding: 0;
    flex: 1;
    min-width: 0;
  }

  .el-title-input::placeholder {
    color: var(--color-text-muted, #444440);
  }

  .el-status {
    font-family: var(--font-mono, monospace);
    font-size: 10px;
    color: var(--color-text-muted, #444440);
    white-space: nowrap;
    flex-shrink: 0;
  }

  .el-status-published {
    color: var(--color-success, #4ade80);
  }

  .el-status-unsaved {
    color: var(--color-warning, #fbbf24);
  }

  .el-btn {
    font-family: var(--font-mono, monospace);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 4px 14px;
    border-radius: var(--radius-sm, 4px);
    cursor: pointer;
    border: 1px solid var(--color-border, #272725);
    transition: background 0.1s ease, color 0.1s ease;
  }

  .el-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .el-btn-ghost {
    background: transparent;
    color: var(--color-text-secondary, #888884);
  }

  .el-btn-ghost:hover:not(:disabled) {
    background: var(--color-surface-alt, #141413);
    color: var(--color-text, #d8d5cf);
  }

  .el-btn-primary {
    background: var(--color-primary, #5b9cf6);
    border-color: var(--color-primary, #5b9cf6);
    color: var(--color-on-primary, #0c0c0b);
    font-weight: var(--font-weight-medium, 500);
  }

  .el-btn-primary:hover:not(:disabled) {
    opacity: 0.9;
  }

  /* === Body grid === */
  .el-body {
    display: grid;
    grid-template-columns: 256px 1fr 268px;
    flex: 1;
    overflow: hidden;
  }

  .el-body.el-body-no-left {
    grid-template-columns: 1fr 268px;
  }

  .el-body.el-body-no-right {
    grid-template-columns: 256px 1fr;
  }

  .el-body.el-body-no-left.el-body-no-right {
    grid-template-columns: 1fr;
  }

  /* === Left Panel === */
  .el-left-panel {
    border-right: 1px solid var(--color-border, #272725);
    background: var(--color-surface, #0c0c0b);
    overflow-y: auto;
    overflow-x: hidden;
  }

  /* === Canvas === */
  .el-canvas {
    overflow-y: auto;
    overflow-x: hidden;
    background: var(--color-surface-raised, #1c1c1a);
  }

  .el-canvas-content {
    max-width: 860px;
    margin: 0 auto;
    padding: var(--space-8, 2rem) var(--space-10, 3rem);
    min-height: 100%;
  }

  /* === Right Panel === */
  .el-right-panel {
    border-left: 1px solid var(--color-border, #272725);
    background: var(--color-surface, #0c0c0b);
    overflow-y: auto;
    overflow-x: hidden;
  }

  /* === Status Bar === */
  .el-statusbar {
    display: flex;
    align-items: center;
    height: 22px;
    min-height: 22px;
    padding: 0 var(--space-3, 0.75rem);
    border-top: 1px solid var(--color-border, #272725);
    background: var(--color-surface, #0c0c0b);
  }

  .el-statusbar-text {
    font-family: var(--font-mono, monospace);
    font-size: 10px;
    color: var(--color-text-muted, #444440);
  }

  /* === Responsive === */
  @media (max-width: 1279px) {
    .el-body {
      grid-template-columns: 1fr 268px;
    }

    .el-body.el-body-no-right {
      grid-template-columns: 1fr;
    }

    .el-left-panel {
      display: none;
    }
  }

  @media (max-width: 1023px) {
    .el-body,
    .el-body.el-body-no-left,
    .el-body.el-body-no-right,
    .el-body.el-body-no-left.el-body-no-right {
      grid-template-columns: 1fr;
    }

    .el-left-panel,
    .el-right-panel {
      display: none;
    }
  }
</style>
