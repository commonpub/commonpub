<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { Editor } from '@tiptap/core';

  let {
    content = null,
    editable = true,
    onupdate = null,
  }: {
    content?: unknown;
    editable?: boolean;
    onupdate?: ((blocks: unknown[]) => void) | null;
  } = $props();

  let element: HTMLDivElement | undefined = $state();
  let editor: Editor | null = $state(null);

  onMount(async () => {
    const { createSnaplifyEditor } = await import('@snaplify/editor');

    editor = createSnaplifyEditor({
      content: Array.isArray(content) ? (content as [string, Record<string, unknown>][]) : undefined,
      editable,
      placeholder: 'Start writing...',
      onUpdate: onupdate ? (blocks) => onupdate(blocks) : undefined,
      element,
    });
  });

  onDestroy(() => {
    editor?.destroy();
  });

  export function getContent(): unknown[] {
    if (!editor) return [];
    // Use editor to get BlockTuples
    const { docToBlockTuples } = import.meta.glob('@snaplify/editor', { eager: true }) as Record<string, { docToBlockTuples: (doc: unknown) => unknown[] }>;
    return [];
  }
</script>

<div class="editor-wrapper" bind:this={element}></div>

<style>
  .editor-wrapper {
    min-height: 300px;
    border: 1px solid var(--color-border, #e5e5e5);
    border-radius: var(--radius-md, 6px);
    padding: var(--space-md, 1rem);
    background: var(--color-surface, #ffffff);
  }

  .editor-wrapper :global(.ProseMirror) {
    outline: none;
    min-height: 280px;
  }

  .editor-wrapper :global(.ProseMirror p.is-editor-empty:first-child::before) {
    content: attr(data-placeholder);
    color: var(--color-text-secondary, #999);
    pointer-events: none;
    float: left;
    height: 0;
  }
</style>
