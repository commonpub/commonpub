<script lang="ts">
  import type { Snippet } from 'svelte';

  export interface BlockDef {
    type: string;
    label: string;
    icon: string;
    description: string;
  }

  export interface BlockCategory {
    label: string;
    blocks: BlockDef[];
  }

  export interface SectionItem {
    id: string;
    title: string;
    blockCount: number;
  }

  let {
    categories,
    oninsert,
    sections = [],
    assetsSlot,
  }: {
    categories: BlockCategory[];
    oninsert?: (type: string) => void;
    sections?: SectionItem[];
    assetsSlot?: Snippet;
  } = $props();

  let activeTab = $state<'modules' | 'structure' | 'assets'>('modules');
  let filter = $state('');

  let filteredCategories = $derived(
    filter
      ? categories
          .map((cat) => ({
            ...cat,
            blocks: cat.blocks.filter(
              (b) =>
                b.label.toLowerCase().includes(filter.toLowerCase()) ||
                b.type.toLowerCase().includes(filter.toLowerCase()),
            ),
          }))
          .filter((cat) => cat.blocks.length > 0)
      : categories,
  );
</script>

<div class="block-library">
  <div class="bl-tabs">
    <button class="bl-tab" class:active={activeTab === 'modules'} onclick={() => activeTab = 'modules'}>Modules</button>
    <button class="bl-tab" class:active={activeTab === 'structure'} onclick={() => activeTab = 'structure'}>Structure</button>
    <button class="bl-tab" class:active={activeTab === 'assets'} onclick={() => activeTab = 'assets'}>Assets</button>
  </div>

  {#if activeTab === 'modules'}
    <div class="bl-search">
      <input
        class="bl-search-input"
        type="text"
        placeholder="Filter blocks..."
        bind:value={filter}
        aria-label="Filter blocks"
      />
    </div>

    <div class="bl-scroll">
      {#each filteredCategories as category}
        <div class="bl-category">
          <span class="bl-category-label">{category.label}</span>
          <div class="bl-grid">
            {#each category.blocks as block}
              <button
                class="bl-item"
                onclick={() => oninsert?.(block.type)}
                title={block.description}
                aria-label="Insert {block.label}"
                draggable="true"
              >
                <span class="bl-item-icon">{block.icon}</span>
                <span class="bl-item-label">{block.label}</span>
              </button>
            {/each}
          </div>
        </div>
      {/each}

      {#if filteredCategories.length === 0}
        <p class="bl-empty">No blocks match "{filter}"</p>
      {/if}
    </div>

  {:else if activeTab === 'structure'}
    <div class="bl-scroll">
      <span class="bl-category-label" style="padding: 12px 0 8px; display: block;">Sections</span>
      {#if sections.length > 0}
        {#each sections as section, i}
          <div class="bl-section-item" draggable="true">
            <span class="bl-section-num">{i + 1}</span>
            <span class="bl-section-title">{section.title || 'Untitled'}</span>
            <span class="bl-section-badge">{section.blockCount}</span>
          </div>
        {/each}
      {:else}
        <p class="bl-empty">No sections yet</p>
      {/if}
    </div>

  {:else}
    <div class="bl-scroll">
      {#if assetsSlot}
        {@render assetsSlot()}
      {:else}
        <div class="bl-drop-zone">
          <span class="bl-drop-text">Drop files here</span>
          <span class="bl-drop-sub">Images, videos, documents</span>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .block-library {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .bl-tabs {
    display: flex;
    border-bottom: 1px solid var(--color-border, #272725);
  }

  .bl-tab {
    flex: 1;
    padding: 8px 0;
    font-family: var(--font-mono, monospace);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--color-text-muted, #444440);
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    text-align: center;
  }

  .bl-tab:hover { color: var(--color-text-secondary); }
  .bl-tab.active {
    color: var(--color-accent, #5b9cf6);
    border-bottom-color: var(--color-accent, #5b9cf6);
  }

  .bl-search {
    padding: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
  }

  .bl-search-input {
    width: 100%;
    height: 28px;
    padding: 0 var(--space-2, 0.5rem);
    border: 1px solid var(--color-border, #272725);
    border-radius: var(--radius-sm, 4px);
    background: var(--color-surface-alt, #141413);
    color: var(--color-text, #d8d5cf);
    font-family: var(--font-mono, monospace);
    font-size: var(--text-xs, 0.75rem);
    outline: none;
  }

  .bl-search-input:focus { border-color: var(--color-accent, #5b9cf6); }
  .bl-search-input::placeholder { color: var(--color-text-muted, #444440); }

  .bl-scroll {
    flex: 1;
    overflow-y: auto;
    padding: 0 var(--space-3, 0.75rem) var(--space-3, 0.75rem);
  }

  .bl-category { margin-bottom: var(--space-3, 0.75rem); }

  .bl-category-label {
    display: block;
    font-family: var(--font-mono, monospace);
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--color-text-muted, #444440);
    margin-bottom: var(--space-2, 0.5rem);
  }

  .bl-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
  }

  .bl-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: var(--space-2, 0.5rem) var(--space-1, 0.25rem);
    border: 1px solid var(--color-border, #272725);
    border-radius: var(--radius-sm, 4px);
    background: transparent;
    color: var(--color-text-secondary, #888884);
    cursor: grab;
    font-family: var(--font-body, system-ui, sans-serif);
    text-align: center;
  }

  .bl-item:hover {
    background: var(--color-surface-alt, #141413);
    color: var(--color-text, #d8d5cf);
    border-color: var(--color-accent, #5b9cf6);
  }

  .bl-item-icon {
    font-family: var(--font-mono, monospace);
    font-size: 11px;
    font-weight: 700;
    line-height: 1;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-sm, 4px);
    background: var(--color-accent-bg);
    border: 1px solid var(--color-accent-border);
    color: var(--color-accent, #5b9cf6);
  }

  .bl-item-label {
    font-size: 10px;
    line-height: 1.2;
  }

  .bl-section-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 0;
    border-bottom: 1px solid var(--color-border, #272725);
    cursor: grab;
  }

  .bl-section-num {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 1px solid var(--color-border-strong, #333330);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-family: var(--font-mono, monospace);
    color: var(--color-text-muted);
    flex-shrink: 0;
  }

  .bl-section-title {
    font-size: 12px;
    color: var(--color-text-secondary);
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .bl-section-badge {
    font-size: 9px;
    font-family: var(--font-mono, monospace);
    background: var(--color-surface-hover, #222220);
    color: var(--color-text-muted);
    padding: 1px 5px;
    border-radius: 2px;
  }

  .bl-drop-zone {
    border: 1px dashed var(--color-border, #272725);
    border-radius: var(--radius-md, 0.25rem);
    padding: 40px 20px;
    text-align: center;
    margin-top: 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .bl-drop-text {
    font-size: 12px;
    color: var(--color-text-secondary);
  }

  .bl-drop-sub {
    font-size: 10px;
    font-family: var(--font-mono, monospace);
    color: var(--color-text-muted);
  }

  .bl-empty {
    font-size: var(--text-xs, 0.75rem);
    color: var(--color-text-muted, #444440);
    text-align: center;
    padding: var(--space-4, 1rem) 0;
    margin: 0;
  }
</style>
