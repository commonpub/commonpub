<script lang="ts">
  import type { Editor } from '@tiptap/core';

  let { editor }: { editor: Editor | null } = $props();

  let visible = $state(false);
  let position = $state({ top: 0, left: 0 });

  $effect(() => {
    if (!editor) return;

    const updateToolbar = () => {
      const { from, to } = editor!.state.selection;
      if (from === to) {
        visible = false;
        return;
      }

      visible = true;
      const { view } = editor!;
      const start = view.coordsAtPos(from);
      const end = view.coordsAtPos(to);
      position = {
        top: start.top - 48,
        left: (start.left + end.left) / 2,
      };
    };

    editor!.on('selectionUpdate', updateToolbar);
    return () => {
      editor!.off('selectionUpdate', updateToolbar);
    };
  });

  function toggleMark(mark: string) {
    editor?.chain().focus().toggleMark(mark).run();
  }

  function toggleHeading(level: 1 | 2 | 3) {
    editor?.chain().focus().toggleHeading({ level }).run();
  }
</script>

{#if visible && editor}
  <div
    class="floating-toolbar"
    style="top: {position.top}px; left: {position.left}px;"
    role="toolbar"
    aria-label="Text formatting"
  >
    <button
      class="toolbar-btn"
      class:active={editor.isActive('bold')}
      onclick={() => toggleMark('bold')}
      aria-label="Bold"
      aria-pressed={editor.isActive('bold')}
    >
      <strong>B</strong>
    </button>
    <button
      class="toolbar-btn"
      class:active={editor.isActive('italic')}
      onclick={() => toggleMark('italic')}
      aria-label="Italic"
      aria-pressed={editor.isActive('italic')}
    >
      <em>I</em>
    </button>
    <button
      class="toolbar-btn"
      class:active={editor.isActive('code')}
      onclick={() => toggleMark('code')}
      aria-label="Inline code"
      aria-pressed={editor.isActive('code')}
    >
      <code>&lt;/&gt;</code>
    </button>
    <span class="toolbar-separator" aria-hidden="true"></span>
    <button
      class="toolbar-btn"
      class:active={editor.isActive('heading', { level: 2 })}
      onclick={() => toggleHeading(2)}
      aria-label="Heading 2"
      aria-pressed={editor.isActive('heading', { level: 2 })}
    >
      H2
    </button>
    <button
      class="toolbar-btn"
      class:active={editor.isActive('heading', { level: 3 })}
      onclick={() => toggleHeading(3)}
      aria-label="Heading 3"
      aria-pressed={editor.isActive('heading', { level: 3 })}
    >
      H3
    </button>
  </div>
{/if}

<style>
  .floating-toolbar {
    position: fixed;
    display: flex;
    align-items: center;
    gap: 2px;
    padding: var(--space-xs, 0.25rem);
    background: var(--color-surface, #ffffff);
    border: 1px solid var(--color-border, #e5e5e5);
    border-radius: var(--radius-md, 6px);
    box-shadow: var(--shadow-md, 0 4px 12px rgba(0, 0, 0, 0.1));
    transform: translateX(-50%);
    z-index: 50;
  }

  .toolbar-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    border-radius: var(--radius-sm, 4px);
    background: transparent;
    color: var(--color-text, #1a1a1a);
    cursor: pointer;
    font-size: var(--font-size-sm, 0.875rem);
  }

  .toolbar-btn:hover {
    background: var(--color-surface-hover, #f5f5f5);
  }

  .toolbar-btn.active {
    background: var(--color-primary, #2563eb);
    color: var(--color-on-primary, #ffffff);
  }

  .toolbar-separator {
    width: 1px;
    height: 20px;
    background: var(--color-border, #e5e5e5);
    margin: 0 2px;
  }
</style>
