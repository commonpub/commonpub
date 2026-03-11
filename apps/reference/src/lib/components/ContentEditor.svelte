<script lang="ts" module>
  import type { BlockTuple } from '@snaplify/editor';
  export type { BlockTuple };
</script>

<script lang="ts">
  import type { Editor } from '@tiptap/core';
  import { onMount, onDestroy } from 'svelte';
  import FloatingToolbar from './editor/FloatingToolbar.svelte';
  import SlashMenu from './editor/SlashMenu.svelte';

  let {
    content = null,
    editable = true,
    onupdate = null,
    class: className = '',
  }: {
    content?: unknown;
    editable?: boolean;
    onupdate?: ((blocks: BlockTuple[]) => void) | null;
    class?: string;
  } = $props();

  let element: HTMLDivElement | undefined = $state();
  let editor: Editor | null = $state(null);
  let docToBlockTuplesFn: ((doc: unknown) => BlockTuple[]) | null = null;

  onMount(() => {
    import('@snaplify/editor').then((editorModule) => {
      docToBlockTuplesFn = editorModule.docToBlockTuples as (doc: unknown) => BlockTuple[];

      editor = editorModule.createSnaplifyEditor({
        content: Array.isArray(content) ? (content as BlockTuple[]) : undefined,
        editable,
        placeholder: 'Start writing... (type / for commands)',
        onUpdate: onupdate ? (blocks: BlockTuple[]) => onupdate(blocks) : undefined,
        element,
      });
    });
  });

  onDestroy(() => {
    editor?.destroy();
  });

  export function getContent(): BlockTuple[] {
    if (!editor || !docToBlockTuplesFn) return [];
    return docToBlockTuplesFn(editor.state.doc);
  }
</script>

<div class={['content-editor', className].filter(Boolean).join(' ')}>
  <div class="editor-wrapper" bind:this={element}></div>
  {#if editable}
    <FloatingToolbar {editor} />
    <SlashMenu {editor} />
  {/if}
</div>

<style>
  .content-editor {
    position: relative;
  }

  .editor-wrapper {
    min-height: 300px;
  }

  .editor-wrapper :global(.ProseMirror) {
    outline: none;
    min-height: 280px;
    padding: var(--space-4, 1rem);
  }

  .editor-wrapper :global(.ProseMirror p.is-editor-empty:first-child::before) {
    content: attr(data-placeholder);
    color: var(--color-text-muted, #444440);
    pointer-events: none;
    float: left;
    height: 0;
    font-style: italic;
  }

  .editor-wrapper :global(.ProseMirror h2) {
    font-size: var(--text-xl, 1.25rem);
    font-weight: var(--font-weight-bold, 700);
    color: var(--color-text, #d8d5cf);
    margin: var(--space-6, 2rem) 0 var(--space-2, 0.5rem);
  }

  .editor-wrapper :global(.ProseMirror h3) {
    font-size: var(--text-lg, 1.125rem);
    font-weight: var(--font-weight-semibold, 600);
    color: var(--color-text, #d8d5cf);
    margin: var(--space-4, 1rem) 0 var(--space-2, 0.5rem);
  }

  .editor-wrapper :global(.ProseMirror p) {
    color: var(--color-text, #d8d5cf);
    line-height: 1.7;
    margin: 0 0 var(--space-2, 0.5rem);
  }

  .editor-wrapper :global(.ProseMirror ul),
  .editor-wrapper :global(.ProseMirror ol) {
    padding-left: var(--space-6, 2rem);
    margin: 0 0 var(--space-2, 0.5rem);
    color: var(--color-text, #d8d5cf);
  }

  .editor-wrapper :global(.ProseMirror li) {
    margin-bottom: var(--space-1, 0.25rem);
  }

  .editor-wrapper :global(.ProseMirror blockquote) {
    border-left: 3px solid var(--color-border, #272725);
    padding-left: var(--space-4, 1rem);
    margin: var(--space-3, 0.75rem) 0;
    color: var(--color-text-secondary, #888884);
    font-style: italic;
  }

  .editor-wrapper :global(.ProseMirror pre) {
    background: var(--color-surface-alt, #141413);
    border: 1px solid var(--color-border, #272725);
    border-radius: var(--radius-md, 6px);
    padding: var(--space-3, 0.75rem) var(--space-4, 1rem);
    overflow-x: auto;
    margin: var(--space-3, 0.75rem) 0;
  }

  .editor-wrapper :global(.ProseMirror pre code) {
    font-family: var(--font-mono, monospace);
    font-size: var(--text-sm, 0.875rem);
    color: var(--color-text, #d8d5cf);
    background: none;
    padding: 0;
  }

  .editor-wrapper :global(.ProseMirror code) {
    font-family: var(--font-mono, monospace);
    font-size: 0.9em;
    background: var(--color-surface-alt, #141413);
    padding: 0.15em 0.3em;
    border-radius: var(--radius-sm, 4px);
    color: var(--color-accent, #f59e0b);
  }

  .editor-wrapper :global(.ProseMirror hr) {
    border: none;
    border-top: 1px solid var(--color-border, #272725);
    margin: var(--space-6, 2rem) 0;
  }

  .editor-wrapper :global(.ProseMirror a) {
    color: var(--color-primary, #5b9cf6);
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .editor-wrapper :global(.ProseMirror s) {
    text-decoration: line-through;
    color: var(--color-text-secondary, #888884);
  }

  .editor-wrapper :global(.ProseMirror strong) {
    font-weight: var(--font-weight-bold, 700);
  }

  .editor-wrapper :global(.ProseMirror img) {
    max-width: 100%;
    border-radius: var(--radius-md, 6px);
    margin: var(--space-3, 0.75rem) 0;
  }
</style>
