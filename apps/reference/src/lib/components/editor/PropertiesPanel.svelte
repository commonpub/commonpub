<script lang="ts">
  import type { Snippet } from 'svelte';

  export interface BlockInfo {
    type: string;
    attrs: Record<string, unknown>;
    pos: number;
  }

  const LANGUAGES = [
    'javascript', 'typescript', 'python', 'rust', 'go',
    'html', 'css', 'json', 'bash', 'yaml', 'sql', 'markdown', 'plaintext',
  ];

  const CALLOUT_VARIANTS = [
    { value: 'info', label: 'Info', color: 'var(--color-info, #3b82f6)' },
    { value: 'tip', label: 'Tip', color: 'var(--color-success, #22c55e)' },
    { value: 'warning', label: 'Warning', color: 'var(--color-warning, #f59e0b)' },
    { value: 'danger', label: 'Danger', color: 'var(--color-error, #ef4444)' },
  ];

  const ALIGNMENT_OPTIONS = ['left', 'center', 'right'];

  const THEME_TOKENS = [
    { name: 'accent', var: 'var(--color-accent, #5b9cf6)' },
    { name: 'success', var: 'var(--color-success, #4ade80)' },
    { name: 'warning', var: 'var(--color-warning, #fbbf24)' },
    { name: 'error', var: 'var(--color-error, #f87171)' },
    { name: 'info', var: 'var(--color-info, #3b82f6)' },
    { name: 'text', var: 'var(--color-text, #d8d5cf)' },
    { name: 'muted', var: 'var(--color-text-muted, #444440)' },
    { name: 'surface', var: 'var(--color-surface-alt, #141413)' },
  ];

  /** Interactive module types that support output binding */
  const BINDABLE_TYPES = [
    'range_slider', 'rangeSlider',
    'comparison_toggle', 'comparisonToggle',
    'tick_simulation', 'tickSimulation',
    'reveal_grid', 'revealGrid',
    'live_calculator', 'liveCalculator',
    'draw_canvas', 'drawCanvas',
  ];

  let {
    selectedBlock = null,
    meta,
    extraFields,
    onblockattr,
    onmetachange,
    ondeleteblock,
  }: {
    selectedBlock?: BlockInfo | null;
    meta?: { title?: string; description?: string; tags?: string; coverImageUrl?: string; seoTitle?: string; seoDescription?: string; [key: string]: unknown };
    extraFields?: Snippet;
    onblockattr?: (attr: string, value: unknown) => void;
    onmetachange?: (field: string, value: string) => void;
    ondeleteblock?: () => void;
  } = $props();

  let expandedSections = $state<Record<string, boolean>>({
    content: true,
    binding: false,
    appearance: false,
    layout: false,
    blockId: false,
    meta: true,
    seo: false,
  });

  function toggleSection(key: string) {
    expandedSections = { ...expandedSections, [key]: !expandedSections[key] };
  }

  let isBindable = $derived(
    selectedBlock ? BINDABLE_TYPES.includes(selectedBlock.type) : false,
  );

  function blockLabel(type: string): string {
    const map: Record<string, string> = {
      code_block: 'Code Block',
      codeBlock: 'Code Block',
      heading: 'Heading',
      paragraph: 'Paragraph',
      image: 'Image',
      callout: 'Callout',
      blockquote: 'Blockquote',
      bullet_list: 'Bullet List',
      ordered_list: 'Ordered List',
      horizontal_rule: 'Divider',
      range_slider: 'Range Slider',
      rangeSlider: 'Range Slider',
      comparison_toggle: 'Comparison Toggle',
      comparisonToggle: 'Comparison Toggle',
      tick_simulation: 'Tick Simulation',
      tickSimulation: 'Tick Simulation',
      reveal_grid: 'Reveal Grid',
      revealGrid: 'Reveal Grid',
      live_calculator: 'Live Calculator',
      liveCalculator: 'Live Calculator',
      draw_canvas: 'Draw Canvas',
      drawCanvas: 'Draw Canvas',
      bar_chart: 'Bar Chart',
      barChart: 'Bar Chart',
      network_graph: 'Network Graph',
      networkGraph: 'Network Graph',
      do_dont: "Do / Don't",
      doDont: "Do / Don't",
      section_header: 'Section Header',
      sectionHeader: 'Section Header',
      section_divider: 'Section Divider',
      sectionDivider: 'Section Divider',
      section_nav: 'Section Nav',
      sectionNav: 'Section Nav',
      quiz_block: 'Quiz Block',
      quizBlock: 'Quiz Block',
    };
    return map[type] ?? type;
  }

  function blockIcon(type: string): string {
    const map: Record<string, string> = {
      code_block: '</>',     codeBlock: '</>',
      heading: 'H',          paragraph: 'P',
      image: 'IMG',          callout: '!',
      blockquote: '"',        bullet_list: '•',
      ordered_list: '1.',     horizontal_rule: '—',
      range_slider: '◈',     rangeSlider: '◈',
      comparison_toggle: '⇄', comparisonToggle: '⇄',
      tick_simulation: '⟳',  tickSimulation: '⟳',
      reveal_grid: '◫',      revealGrid: '◫',
      live_calculator: '∑',  liveCalculator: '∑',
      draw_canvas: '✎',      drawCanvas: '✎',
      bar_chart: '▊',        barChart: '▊',
      network_graph: '◉',    networkGraph: '◉',
      do_dont: '±',           doDont: '±',
      section_header: '§',    sectionHeader: '§',
      section_divider: '---', sectionDivider: '---',
      section_nav: '↕',      sectionNav: '↕',
      quiz_block: '?',        quizBlock: '?',
    };
    return map[type] ?? '□';
  }
</script>

<div class="props-panel">
  <!-- Block Header -->
  {#if selectedBlock}
    <div class="pp-block-header">
      <span class="pp-block-icon">{blockIcon(selectedBlock.type)}</span>
      <span class="pp-block-name">{blockLabel(selectedBlock.type)}</span>
    </div>

    <!-- Content Section -->
    <div class="pp-section">
      <button class="pp-section-header" onclick={() => toggleSection('content')}>
        <span class="pp-section-title">Content</span>
        <span class="pp-chevron" class:pp-chevron-open={expandedSections.content}>▸</span>
      </button>

      {#if expandedSections.content}
        <div class="pp-section-body">
          {#if selectedBlock.type === 'code_block' || selectedBlock.type === 'codeBlock'}
            <div class="pp-row">
              <label class="pp-label" for="pp-lang">Language</label>
              <select
                id="pp-lang"
                class="pp-select"
                value={String(selectedBlock.attrs.language ?? '')}
                onchange={(e) => onblockattr?.('language', (e.target as HTMLSelectElement).value)}
              >
                <option value="">Auto</option>
                {#each LANGUAGES as lang}
                  <option value={lang}>{lang}</option>
                {/each}
              </select>
            </div>

          {:else if selectedBlock.type === 'callout'}
            <div class="pp-row">
              <span class="pp-label">Variant</span>
              <div class="pp-toggle-group">
                {#each CALLOUT_VARIANTS as v}
                  <button
                    class="pp-toggle-btn"
                    class:pp-toggle-active={selectedBlock.attrs.variant === v.value}
                    onclick={() => onblockattr?.('variant', v.value)}
                    title={v.label}
                  >
                    <span class="pp-color-dot" style="background: {v.color};"></span>
                    {v.label}
                  </button>
                {/each}
              </div>
            </div>

          {:else if selectedBlock.type === 'image'}
            <div class="pp-row pp-row-col">
              <label class="pp-label" for="pp-img-src">URL</label>
              <input
                id="pp-img-src"
                class="pp-input"
                type="url"
                placeholder="Image source URL"
                value={String(selectedBlock.attrs.src ?? '')}
                onblur={(e) => onblockattr?.('src', (e.target as HTMLInputElement).value)}
              />
            </div>
            <div class="pp-row pp-row-col">
              <label class="pp-label" for="pp-img-alt">Alt text</label>
              <input
                id="pp-img-alt"
                class="pp-input"
                type="text"
                placeholder="Describe the image"
                value={String(selectedBlock.attrs.alt ?? '')}
                onblur={(e) => onblockattr?.('alt', (e.target as HTMLInputElement).value)}
              />
            </div>
            <div class="pp-row pp-row-col">
              <label class="pp-label" for="pp-img-cap">Caption</label>
              <input
                id="pp-img-cap"
                class="pp-input"
                type="text"
                placeholder="Caption"
                value={String(selectedBlock.attrs.caption ?? '')}
                onblur={(e) => onblockattr?.('caption', (e.target as HTMLInputElement).value)}
              />
            </div>

          {:else if selectedBlock.type === 'heading'}
            <div class="pp-row">
              <label class="pp-label" for="pp-level">Level</label>
              <select
                id="pp-level"
                class="pp-select"
                value={String(selectedBlock.attrs.level ?? 2)}
                onchange={(e) => onblockattr?.('level', Number((e.target as HTMLSelectElement).value))}
              >
                <option value="2">Heading 2</option>
                <option value="3">Heading 3</option>
              </select>
            </div>

          {:else if selectedBlock.type === 'blockquote'}
            <div class="pp-row pp-row-col">
              <label class="pp-label" for="pp-attr">Attribution</label>
              <input
                id="pp-attr"
                class="pp-input"
                type="text"
                placeholder="Who said it?"
                value={String(selectedBlock.attrs.attribution ?? '')}
                onblur={(e) => onblockattr?.('attribution', (e.target as HTMLInputElement).value)}
              />
            </div>

          {:else if selectedBlock.type === 'range_slider' || selectedBlock.type === 'rangeSlider'}
            <div class="pp-row">
              <label class="pp-label" for="pp-min">Min</label>
              <input
                id="pp-min"
                class="pp-input pp-input-sm"
                type="number"
                value={String(selectedBlock.attrs.min ?? 0)}
                onblur={(e) => onblockattr?.('min', Number((e.target as HTMLInputElement).value))}
              />
            </div>
            <div class="pp-row">
              <label class="pp-label" for="pp-max">Max</label>
              <input
                id="pp-max"
                class="pp-input pp-input-sm"
                type="number"
                value={String(selectedBlock.attrs.max ?? 100)}
                onblur={(e) => onblockattr?.('max', Number((e.target as HTMLInputElement).value))}
              />
            </div>
            <div class="pp-row">
              <label class="pp-label" for="pp-step">Step</label>
              <input
                id="pp-step"
                class="pp-input pp-input-sm"
                type="number"
                value={String(selectedBlock.attrs.step ?? 1)}
                onblur={(e) => onblockattr?.('step', Number((e.target as HTMLInputElement).value))}
              />
            </div>
            <div class="pp-row pp-row-col">
              <label class="pp-label" for="pp-slider-label">Label</label>
              <input
                id="pp-slider-label"
                class="pp-input"
                type="text"
                placeholder="Slider label"
                value={String(selectedBlock.attrs.label ?? '')}
                onblur={(e) => onblockattr?.('label', (e.target as HTMLInputElement).value)}
              />
            </div>

          {:else if selectedBlock.type === 'comparison_toggle' || selectedBlock.type === 'comparisonToggle'}
            <div class="pp-row pp-row-col">
              <label class="pp-label" for="pp-label-a">Label A</label>
              <input
                id="pp-label-a"
                class="pp-input"
                type="text"
                placeholder="Before / Option A"
                value={String(selectedBlock.attrs.labelA ?? '')}
                onblur={(e) => onblockattr?.('labelA', (e.target as HTMLInputElement).value)}
              />
            </div>
            <div class="pp-row pp-row-col">
              <label class="pp-label" for="pp-label-b">Label B</label>
              <input
                id="pp-label-b"
                class="pp-input"
                type="text"
                placeholder="After / Option B"
                value={String(selectedBlock.attrs.labelB ?? '')}
                onblur={(e) => onblockattr?.('labelB', (e.target as HTMLInputElement).value)}
              />
            </div>

          {:else if selectedBlock.type === 'quiz_block' || selectedBlock.type === 'quizBlock'}
            <div class="pp-row pp-row-col">
              <label class="pp-label" for="pp-question">Question</label>
              <textarea
                id="pp-question"
                class="pp-textarea"
                placeholder="Enter question"
                rows={2}
                value={String(selectedBlock.attrs.question ?? '')}
                onblur={(e) => onblockattr?.('question', (e.target as HTMLTextAreaElement).value)}
              ></textarea>
            </div>

          {:else}
            <p class="pp-hint">No editable properties for this block type.</p>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Output Binding Section (interactive modules only) -->
    {#if isBindable}
      <div class="pp-section">
        <button class="pp-section-header" onclick={() => toggleSection('binding')}>
          <span class="pp-section-title">Output Binding</span>
          <span class="pp-chevron" class:pp-chevron-open={expandedSections.binding}>▸</span>
        </button>

        {#if expandedSections.binding}
          <div class="pp-section-body">
            <div class="pp-row pp-row-col">
              <label class="pp-label" for="pp-output-key">Output key</label>
              <input
                id="pp-output-key"
                class="pp-input pp-input-mono"
                type="text"
                placeholder="e.g. sliderValue"
                value={String(selectedBlock.attrs.outputKey ?? '')}
                onblur={(e) => onblockattr?.('outputKey', (e.target as HTMLInputElement).value)}
              />
            </div>
            <div class="pp-row pp-row-col">
              <label class="pp-label" for="pp-default-val">Default value</label>
              <input
                id="pp-default-val"
                class="pp-input pp-input-mono"
                type="text"
                placeholder="Initial value"
                value={String(selectedBlock.attrs.defaultValue ?? '')}
                onblur={(e) => onblockattr?.('defaultValue', (e.target as HTMLInputElement).value)}
              />
            </div>
            <p class="pp-hint">Bind this module's output to a variable other blocks can reference.</p>
          </div>
        {/if}
      </div>
    {/if}

    <!-- Appearance Section -->
    <div class="pp-section">
      <button class="pp-section-header" onclick={() => toggleSection('appearance')}>
        <span class="pp-section-title">Appearance</span>
        <span class="pp-chevron" class:pp-chevron-open={expandedSections.appearance}>▸</span>
      </button>

      {#if expandedSections.appearance}
        <div class="pp-section-body">
          <div class="pp-row">
            <span class="pp-label">Color</span>
            <div class="pp-swatch-row">
              <button
                class="pp-swatch"
                class:pp-swatch-active={!selectedBlock.attrs.accentColor}
                style="background: var(--color-text-muted, #444440);"
                onclick={() => onblockattr?.('accentColor', '')}
                title="Default"
                aria-label="Default color"
              ></button>
              {#each THEME_TOKENS.slice(0, 5) as token}
                <button
                  class="pp-swatch"
                  class:pp-swatch-active={selectedBlock.attrs.accentColor === token.name}
                  style="background: {token.var};"
                  onclick={() => onblockattr?.('accentColor', token.name)}
                  title={token.name}
                  aria-label="{token.name} color"
                ></button>
              {/each}
            </div>
          </div>
          <div class="pp-row">
            <label class="pp-label" for="pp-bg-style">Background</label>
            <select
              id="pp-bg-style"
              class="pp-select"
              value={String(selectedBlock.attrs.bgStyle ?? 'default')}
              onchange={(e) => onblockattr?.('bgStyle', (e.target as HTMLSelectElement).value)}
            >
              <option value="default">Default</option>
              <option value="surface">Surface</option>
              <option value="raised">Raised</option>
              <option value="transparent">Transparent</option>
            </select>
          </div>
        </div>
      {/if}
    </div>

    <!-- Layout Section -->
    <div class="pp-section">
      <button class="pp-section-header" onclick={() => toggleSection('layout')}>
        <span class="pp-section-title">Layout</span>
        <span class="pp-chevron" class:pp-chevron-open={expandedSections.layout}>▸</span>
      </button>

      {#if expandedSections.layout}
        <div class="pp-section-body">
          <div class="pp-row">
            <span class="pp-label">Align</span>
            <div class="pp-toggle-group">
              {#each ALIGNMENT_OPTIONS as align}
                <button
                  class="pp-toggle-btn"
                  class:pp-toggle-active={(selectedBlock.attrs.align ?? 'left') === align}
                  onclick={() => onblockattr?.('align', align)}
                >
                  {align}
                </button>
              {/each}
            </div>
          </div>
          <div class="pp-row">
            <label class="pp-label" for="pp-width">Width</label>
            <select
              id="pp-width"
              class="pp-select"
              value={String(selectedBlock.attrs.width ?? 'full')}
              onchange={(e) => onblockattr?.('width', (e.target as HTMLSelectElement).value)}
            >
              <option value="full">Full</option>
              <option value="wide">Wide</option>
              <option value="narrow">Narrow</option>
              <option value="auto">Auto</option>
            </select>
          </div>
          <div class="pp-row">
            <label class="pp-label" for="pp-spacing">Spacing</label>
            <select
              id="pp-spacing"
              class="pp-select"
              value={String(selectedBlock.attrs.spacing ?? 'normal')}
              onchange={(e) => onblockattr?.('spacing', (e.target as HTMLSelectElement).value)}
            >
              <option value="none">None</option>
              <option value="tight">Tight</option>
              <option value="normal">Normal</option>
              <option value="loose">Loose</option>
            </select>
          </div>
        </div>
      {/if}
    </div>

    <!-- Block ID Section -->
    <div class="pp-section">
      <button class="pp-section-header" onclick={() => toggleSection('blockId')}>
        <span class="pp-section-title">Block ID</span>
        <span class="pp-chevron" class:pp-chevron-open={expandedSections.blockId}>▸</span>
      </button>

      {#if expandedSections.blockId}
        <div class="pp-section-body">
          <div class="pp-row pp-row-col">
            <label class="pp-label" for="pp-bid">ID</label>
            <input
              id="pp-bid"
              class="pp-input pp-input-mono"
              type="text"
              placeholder="Auto-generated"
              value={String(selectedBlock.attrs.id ?? `pos-${selectedBlock.pos}`)}
              onblur={(e) => onblockattr?.('id', (e.target as HTMLInputElement).value)}
            />
          </div>
          <p class="pp-hint">Use this ID to reference the block from other blocks or CSS.</p>
        </div>
      {/if}
    </div>

    <!-- Theme Token Chips -->
    <div class="pp-token-strip">
      <span class="pp-token-label">tokens</span>
      <div class="pp-tokens">
        {#each THEME_TOKENS as token}
          <span class="pp-token-chip" title={token.name}>
            <span class="pp-token-dot" style="background: {token.var};"></span>
            {token.name}
          </span>
        {/each}
      </div>
    </div>

    <!-- Delete Button -->
    <div class="pp-delete-zone">
      <button class="pp-delete-btn" onclick={ondeleteblock} aria-label="Delete selected block">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M2 3h8M4 3V2h4v1M3 3v7a1 1 0 001 1h4a1 1 0 001-1V3" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Delete Block
      </button>
    </div>
  {:else}
    <!-- No block selected — show document meta -->
    <div class="pp-block-header pp-block-header-empty">
      <span class="pp-block-name">No selection</span>
    </div>
  {/if}

  <!-- Document Metadata -->
  {#if meta}
    <div class="pp-section">
      <button class="pp-section-header" onclick={() => toggleSection('meta')}>
        <span class="pp-section-title">Metadata</span>
        <span class="pp-chevron" class:pp-chevron-open={expandedSections.meta}>▸</span>
      </button>

      {#if expandedSections.meta}
        <div class="pp-section-body">
          <div class="pp-row pp-row-col">
            <label class="pp-label" for="pp-desc">Description</label>
            <textarea
              id="pp-desc"
              class="pp-textarea"
              placeholder="Brief description"
              rows={2}
              value={meta.description ?? ''}
              onblur={(e) => onmetachange?.('description', (e.target as HTMLTextAreaElement).value)}
            ></textarea>
          </div>
          <div class="pp-row pp-row-col">
            <label class="pp-label" for="pp-tags">Tags</label>
            <input
              id="pp-tags"
              class="pp-input"
              type="text"
              placeholder="Comma-separated tags"
              value={meta.tags ?? ''}
              onblur={(e) => onmetachange?.('tags', (e.target as HTMLInputElement).value)}
            />
          </div>
          <div class="pp-row pp-row-col">
            <label class="pp-label" for="pp-cover">Cover Image</label>
            <input
              id="pp-cover"
              class="pp-input"
              type="url"
              placeholder="Cover image URL"
              value={meta.coverImageUrl ?? ''}
              onblur={(e) => onmetachange?.('coverImageUrl', (e.target as HTMLInputElement).value)}
            />
          </div>

          {#if extraFields}
            {@render extraFields()}
          {/if}
        </div>
      {/if}
    </div>

    <!-- SEO Section -->
    <div class="pp-section">
      <button class="pp-section-header" onclick={() => toggleSection('seo')}>
        <span class="pp-section-title">SEO</span>
        <span class="pp-chevron" class:pp-chevron-open={expandedSections.seo}>▸</span>
      </button>

      {#if expandedSections.seo}
        <div class="pp-section-body">
          <div class="pp-row pp-row-col">
            <label class="pp-label" for="pp-seo-title">SEO Title</label>
            <input
              id="pp-seo-title"
              class="pp-input"
              type="text"
              placeholder="Override page title"
              value={meta.seoTitle ?? ''}
              onblur={(e) => onmetachange?.('seoTitle', (e.target as HTMLInputElement).value)}
            />
          </div>
          <div class="pp-row pp-row-col">
            <label class="pp-label" for="pp-seo-desc">SEO Description</label>
            <textarea
              id="pp-seo-desc"
              class="pp-textarea"
              placeholder="Search engine description"
              rows={2}
              value={meta.seoDescription ?? ''}
              onblur={(e) => onmetachange?.('seoDescription', (e.target as HTMLTextAreaElement).value)}
            ></textarea>
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .props-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  /* Block Header */
  .pp-block-header {
    display: flex;
    align-items: center;
    gap: var(--space-2, 0.5rem);
    padding: var(--space-3, 0.75rem);
    border-bottom: 1px solid var(--color-border, #272725);
    background: var(--color-surface-alt, #141413);
  }

  .pp-block-header-empty {
    background: transparent;
  }

  .pp-block-icon {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-sm, 4px);
    background: var(--color-accent-bg);
    border: 1px solid var(--color-accent-border);
    color: var(--color-accent, #5b9cf6);
    font-family: var(--font-mono, monospace);
    font-size: 11px;
    font-weight: 700;
    flex-shrink: 0;
  }

  .pp-block-name {
    font-family: var(--font-mono, monospace);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--color-text, #d8d5cf);
  }

  /* Section */
  .pp-section {
    border-bottom: 1px solid var(--color-border, #272725);
  }

  .pp-section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
    border: none;
    background: transparent;
    cursor: pointer;
    color: var(--color-text, #d8d5cf);
  }

  .pp-section-header:hover {
    background: var(--color-surface-alt, #141413);
  }

  .pp-section-title {
    font-family: var(--font-mono, monospace);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--color-text-secondary, #888884);
  }

  .pp-chevron {
    font-size: 10px;
    color: var(--color-text-muted, #444440);
    transition: transform 0.12s ease;
  }

  .pp-chevron-open {
    transform: rotate(90deg);
  }

  .pp-section-body {
    padding: 0 var(--space-3, 0.75rem) var(--space-3, 0.75rem);
    display: flex;
    flex-direction: column;
    gap: var(--space-2, 0.5rem);
  }

  /* Rows */
  .pp-row {
    display: flex;
    align-items: center;
    gap: var(--space-2, 0.5rem);
  }

  .pp-row-col {
    flex-direction: column;
    align-items: stretch;
  }

  .pp-label {
    font-size: var(--text-xs, 0.75rem);
    color: var(--color-text-secondary, #888884);
    white-space: nowrap;
    min-width: 56px;
  }

  .pp-hint {
    font-size: 10px;
    color: var(--color-text-muted, #444440);
    margin: 0;
    line-height: 1.4;
  }

  /* Inputs */
  .pp-input,
  .pp-select,
  .pp-textarea {
    width: 100%;
    padding: 4px var(--space-2, 0.5rem);
    border: 1px solid var(--color-border, #272725);
    border-radius: var(--radius-sm, 4px);
    background: var(--color-surface-alt, #141413);
    color: var(--color-text, #d8d5cf);
    font-size: var(--text-xs, 0.75rem);
    font-family: var(--font-body, system-ui, sans-serif);
    outline: none;
  }

  .pp-input:focus,
  .pp-select:focus,
  .pp-textarea:focus {
    border-color: var(--color-accent, #5b9cf6);
  }

  .pp-input::placeholder,
  .pp-textarea::placeholder {
    color: var(--color-text-muted, #444440);
  }

  .pp-input-sm {
    width: 72px;
    flex-shrink: 0;
  }

  .pp-input-mono {
    font-family: var(--font-mono, monospace);
    font-size: 11px;
    letter-spacing: 0.02em;
  }

  .pp-textarea {
    resize: vertical;
    min-height: 48px;
  }

  .pp-select {
    cursor: pointer;
    font-family: var(--font-mono, monospace);
  }

  /* Toggle group (alignment, callout variants) */
  .pp-toggle-group {
    display: flex;
    gap: 1px;
    background: var(--color-border, #272725);
    border-radius: var(--radius-sm, 4px);
    overflow: hidden;
  }

  .pp-toggle-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    border: none;
    background: var(--color-surface, #0c0c0b);
    color: var(--color-text-secondary, #888884);
    cursor: pointer;
    font-size: 10px;
    font-family: var(--font-mono, monospace);
    text-transform: capitalize;
    height: 24px;
  }

  .pp-toggle-btn:hover {
    color: var(--color-text, #d8d5cf);
  }

  .pp-toggle-active {
    background: var(--color-surface-alt, #141413);
    color: var(--color-accent, #5b9cf6);
  }

  .pp-color-dot {
    width: 8px;
    height: 8px;
    border-radius: var(--radius-full, 50%);
    flex-shrink: 0;
  }

  /* Color swatches */
  .pp-swatch-row {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }

  .pp-swatch {
    width: 20px;
    height: 20px;
    border-radius: var(--radius-sm, 4px);
    border: 2px solid transparent;
    cursor: pointer;
    padding: 0;
  }

  .pp-swatch:hover {
    border-color: var(--color-border-strong, #333330);
  }

  .pp-swatch-active {
    border-color: var(--color-text, #d8d5cf);
  }

  /* Theme token chips */
  .pp-token-strip {
    padding: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
    border-bottom: 1px solid var(--color-border, #272725);
  }

  .pp-token-label {
    font-family: var(--font-mono, monospace);
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--color-text-muted, #444440);
    display: block;
    margin-bottom: var(--space-1, 0.25rem);
  }

  .pp-tokens {
    display: flex;
    flex-wrap: wrap;
    gap: 3px;
  }

  .pp-token-chip {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 1px 6px;
    border: 1px solid var(--color-border, #272725);
    border-radius: 2px;
    background: var(--color-surface-alt, #141413);
    font-family: var(--font-mono, monospace);
    font-size: 9px;
    color: var(--color-text-muted, #444440);
    cursor: default;
  }

  .pp-token-dot {
    width: 6px;
    height: 6px;
    border-radius: var(--radius-full, 50%);
    flex-shrink: 0;
  }

  /* Delete zone */
  .pp-delete-zone {
    padding: var(--space-3, 0.75rem);
    border-bottom: 1px solid var(--color-border, #272725);
  }

  .pp-delete-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    width: 100%;
    padding: 6px 0;
    border: 1px solid var(--color-border, #272725);
    border-radius: var(--radius-sm, 4px);
    background: transparent;
    color: var(--color-text-muted, #444440);
    font-family: var(--font-mono, monospace);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    cursor: pointer;
  }

  .pp-delete-btn:hover {
    color: var(--color-error, #f87171);
    border-color: var(--color-error, #f87171);
    background: rgba(248, 113, 113, 0.06);
  }
</style>
