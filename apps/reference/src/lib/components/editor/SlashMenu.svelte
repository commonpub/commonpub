<script lang="ts">
  import type { Editor } from '@tiptap/core';

  let { editor }: { editor: Editor | null } = $props();

  let visible = $state(false);
  let position = $state({ top: 0, left: 0 });
  let selectedIndex = $state(0);
  let slashPos = $state(-1);

  const items = [
    { type: 'paragraph', label: 'Text', description: 'Plain text block' },
    { type: 'heading2', label: 'Heading 2', description: 'Medium heading' },
    { type: 'heading3', label: 'Heading 3', description: 'Small heading' },
    { type: 'codeBlock', label: 'Code Block', description: 'Syntax-highlighted code' },
    { type: 'blockquote', label: 'Quote', description: 'Blockquote' },
    { type: 'bulletList', label: 'Bullet List', description: 'Unordered list' },
    { type: 'orderedList', label: 'Numbered List', description: 'Ordered list' },
    { type: 'horizontalRule', label: 'Divider', description: 'Horizontal rule' },
  ];

  $effect(() => {
    if (!editor) return;

    const handleTransaction = () => {
      if (!editor) return;
      const { state } = editor;
      const resolvedPos = state.selection.$from;

      // Only trigger at the start of a block (slash is the only char on the line)
      const textBefore = resolvedPos.parent.textContent.slice(0, resolvedPos.parentOffset);
      if (textBefore === '/') {
        slashPos = resolvedPos.pos - 1;
        const coords = editor.view.coordsAtPos(resolvedPos.pos);
        position = { top: coords.bottom + 4, left: coords.left };
        selectedIndex = 0;
        visible = true;
      } else if (visible && !textBefore.startsWith('/')) {
        visible = false;
      }
    };

    editor.on('transaction', handleTransaction);
    return () => {
      editor!.off('transaction', handleTransaction);
    };
  });

  function selectItem(index: number) {
    if (!editor) return;
    const item = items[index];
    if (!item) return;

    // Delete the slash character
    if (slashPos >= 0) {
      editor.chain().focus().deleteRange({ from: slashPos, to: slashPos + 1 }).run();
    }

    const cmd = editor.chain().focus() as unknown as Record<string, (...args: unknown[]) => { run: () => void }>;

    switch (item.type) {
      case 'paragraph':
        cmd.setParagraph().run();
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
      case 'bulletList':
        cmd.toggleBulletList().run();
        break;
      case 'orderedList':
        cmd.toggleOrderedList().run();
        break;
      case 'horizontalRule':
        cmd.setHorizontalRule().run();
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
    min-width: 220px;
    background: var(--color-surface, #0c0c0b);
    border: 1px solid var(--color-border, #272725);
    border-radius: var(--radius-md, 6px);
    box-shadow: var(--shadow-lg, 0 8px 24px rgba(0, 0, 0, 0.25));
    padding: var(--space-1, 0.25rem);
    z-index: 50;
  }

  .slash-menu-item {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    padding: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
    border: none;
    border-radius: var(--radius-sm, 4px);
    background: transparent;
    cursor: pointer;
    text-align: left;
    width: 100%;
  }

  .slash-menu-item:hover,
  .slash-menu-item.selected {
    background: var(--color-surface-hover, #1c1c1a);
  }

  .item-label {
    font-weight: var(--font-weight-medium, 500);
    color: var(--color-text, #d8d5cf);
    font-size: var(--text-sm, 0.875rem);
  }

  .item-description {
    font-size: var(--text-xs, 0.75rem);
    color: var(--color-text-secondary, #888884);
  }
</style>
