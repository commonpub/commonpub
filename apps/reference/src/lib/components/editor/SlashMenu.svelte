<script lang="ts">
  import type { Editor } from '@tiptap/core';

  let { editor }: { editor: Editor | null } = $props();

  let visible = $state(false);
  let position = $state({ top: 0, left: 0 });
  let selectedIndex = $state(0);

  const items = [
    { type: 'paragraph', label: 'Text', description: 'Plain text block' },
    { type: 'heading2', label: 'Heading 2', description: 'Medium heading' },
    { type: 'heading3', label: 'Heading 3', description: 'Small heading' },
    { type: 'codeBlock', label: 'Code Block', description: 'Syntax-highlighted code' },
    { type: 'blockquote', label: 'Quote', description: 'Blockquote' },
    { type: 'image', label: 'Image', description: 'Image block' },
  ];

  function selectItem(index: number) {
    if (!editor) return;
    const item = items[index];
    if (!item) return;

    // Delete the slash character
    const { from } = editor.state.selection;
    editor.chain().focus().deleteRange({ from: from - 1, to: from }).run();

    switch (item.type) {
      case 'paragraph':
        editor.chain().focus().setParagraph().run();
        break;
      case 'heading2':
        editor.chain().focus().toggleHeading({ level: 2 }).run();
        break;
      case 'heading3':
        editor.chain().focus().toggleHeading({ level: 3 }).run();
        break;
      case 'codeBlock':
        editor.chain().focus().toggleCodeBlock().run();
        break;
      case 'blockquote':
        editor.chain().focus().toggleBlockquote().run();
        break;
      case 'image':
        // Placeholder — image upload deferred to Phase 5
        break;
    }

    visible = false;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!visible) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = (selectedIndex + 1) % items.length;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = (selectedIndex - 1 + items.length) % items.length;
    } else if (e.key === 'Enter') {
      e.preventDefault();
      selectItem(selectedIndex);
    } else if (e.key === 'Escape') {
      visible = false;
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if visible}
  <div
    class="slash-menu"
    style="top: {position.top}px; left: {position.left}px;"
    role="listbox"
    aria-label="Insert block"
  >
    {#each items as item, i}
      <button
        class="slash-menu-item"
        class:selected={i === selectedIndex}
        role="option"
        aria-selected={i === selectedIndex}
        onclick={() => selectItem(i)}
        onmouseenter={() => (selectedIndex = i)}
      >
        <span class="item-label">{item.label}</span>
        <span class="item-description">{item.description}</span>
      </button>
    {/each}
  </div>
{/if}

<style>
  .slash-menu {
    position: fixed;
    display: flex;
    flex-direction: column;
    min-width: 200px;
    background: var(--color-surface, #ffffff);
    border: 1px solid var(--color-border, #e5e5e5);
    border-radius: var(--radius-md, 6px);
    box-shadow: var(--shadow-md, 0 4px 12px rgba(0, 0, 0, 0.1));
    padding: var(--space-xs, 0.25rem);
    z-index: 50;
  }

  .slash-menu-item {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    padding: var(--space-sm, 0.5rem);
    border: none;
    border-radius: var(--radius-sm, 4px);
    background: transparent;
    cursor: pointer;
    text-align: left;
    width: 100%;
  }

  .slash-menu-item:hover,
  .slash-menu-item.selected {
    background: var(--color-surface-hover, #f5f5f5);
  }

  .item-label {
    font-weight: var(--font-weight-medium, 500);
    color: var(--color-text, #1a1a1a);
    font-size: var(--font-size-sm, 0.875rem);
  }

  .item-description {
    font-size: var(--font-size-xs, 0.75rem);
    color: var(--color-text-secondary, #666);
  }
</style>
