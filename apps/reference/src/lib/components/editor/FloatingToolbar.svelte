<script lang="ts">
  import type { Editor } from '@tiptap/core';

  let { editor }: { editor: Editor | null } = $props();

  let visible = $state(false);
  let position = $state({ top: 0, left: 0 });
  let linkInputVisible = $state(false);
  let linkUrl = $state('');

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

  function toggleStrike() {
    editor?.chain().focus().toggleMark('strike').run();
  }

  // TipTap extension commands aren't typed on base ChainedCommands
  function cmd(): Record<string, (...args: unknown[]) => { run: () => void }> {
    return editor?.chain().focus() as unknown as Record<string, (...args: unknown[]) => { run: () => void }>;
  }

  function toggleLink() {
    if (editor?.isActive('link')) {
      cmd().unsetLink().run();
    } else {
      linkInputVisible = true;
    }
  }

  function confirmLink() {
    if (linkUrl) {
      cmd().setLink({ href: linkUrl }).run();
    }
    linkInputVisible = false;
    linkUrl = '';
  }

  function toggleBulletList() {
    cmd().toggleBulletList().run();
  }

  function toggleOrderedList() {
    cmd().toggleOrderedList().run();
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
    <button
      class="toolbar-btn"
      class:active={editor.isActive('strike')}
      onclick={toggleStrike}
      aria-label="Strikethrough"
      aria-pressed={editor.isActive('strike')}
    >
      <s>S</s>
    </button>
    <button
      class="toolbar-btn"
      class:active={editor.isActive('link')}
      onclick={toggleLink}
      aria-label="Link"
      aria-pressed={editor.isActive('link')}
    >
      <span style="font-size: 0.75rem;">Link</span>
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
    <span class="toolbar-separator" aria-hidden="true"></span>
    <button
      class="toolbar-btn"
      class:active={editor.isActive('bulletList')}
      onclick={toggleBulletList}
      aria-label="Bullet list"
      aria-pressed={editor.isActive('bulletList')}
    >
      UL
    </button>
    <button
      class="toolbar-btn"
      class:active={editor.isActive('orderedList')}
      onclick={toggleOrderedList}
      aria-label="Ordered list"
      aria-pressed={editor.isActive('orderedList')}
    >
      OL
    </button>
    {#if linkInputVisible}
      <div class="link-input-wrapper">
        <input
          class="link-input"
          type="url"
          placeholder="Enter URL..."
          bind:value={linkUrl}
          onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); confirmLink(); } else if (e.key === 'Escape') { linkInputVisible = false; linkUrl = ''; } }}
        />
        <button class="toolbar-btn" onclick={confirmLink} aria-label="Confirm link">
          OK
        </button>
      </div>
    {/if}
  </div>
{/if}

<style>
  .floating-toolbar {
    position: fixed;
    display: flex;
    align-items: center;
    gap: 2px;
    padding: var(--space-1, 0.25rem);
    background: var(--color-surface, #0c0c0b);
    border: 1px solid var(--color-border, #272725);
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
    color: var(--color-text, #d8d5cf);
    cursor: pointer;
    font-size: var(--text-sm, 0.875rem);
  }

  .toolbar-btn:hover {
    background: var(--color-surface-hover, #1c1c1a);
  }

  .toolbar-btn.active {
    background: var(--color-primary, #2563eb);
    color: var(--color-on-primary, #ffffff);
  }

  .toolbar-separator {
    width: 1px;
    height: 20px;
    background: var(--color-border, #272725);
    margin: 0 2px;
  }

  .link-input-wrapper {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 0 var(--space-1, 0.25rem);
  }

  .link-input {
    width: 160px;
    height: 28px;
    padding: 0 var(--space-1, 0.25rem);
    border: 1px solid var(--color-border, #272725);
    border-radius: var(--radius-sm, 4px);
    background: var(--color-surface, #0c0c0b);
    color: var(--color-text, #d8d5cf);
    font-size: var(--text-xs, 0.75rem);
  }
</style>
