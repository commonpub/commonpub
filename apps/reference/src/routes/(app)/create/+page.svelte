<script lang="ts">
  import { enhance } from '$app/forms';
  import { Select } from '@snaplify/ui';
  import ContentEditor from '$lib/components/ContentEditor.svelte';
  import type { ActionData } from './$types';

  let { form }: { form: ActionData } = $props();

  type FormWithData = ActionData & { title?: string; type?: string; description?: string };
  const formData = form as FormWithData | null;

  let title = $state(formData?.title ?? '');
  let type = $state(formData?.type ?? 'project');
  let description = $state(formData?.description ?? '');
  let tags = $state('');
  let contentBlocks = $state<unknown[]>([]);

  function handleEditorUpdate(blocks: unknown[]) {
    contentBlocks = blocks;
  }

  const typeOptions = [
    { value: 'project', label: 'Project' },
    { value: 'article', label: 'Article' },
    { value: 'guide', label: 'Guide' },
    { value: 'blog', label: 'Blog Post' },
    { value: 'explainer', label: 'Explainer' },
  ];
</script>

<svelte:head>
  <title>Create — Snaplify</title>
</svelte:head>

<div class="create-page">
  {#if form?.error}
    <div class="form-error" role="alert">{form.error}</div>
  {/if}

  <form method="POST" use:enhance class="create-form">
    <input type="hidden" name="type" value={type} />
    <input type="hidden" name="content" value={JSON.stringify(contentBlocks)} />

    <div class="create-topbar">
      <div class="topbar-left">
        <Select id="type-select" label="" options={typeOptions} bind:value={type} class="type-select" />
      </div>
      <div class="topbar-right">
        <button type="submit" name="action" value="draft" class="topbar-btn topbar-btn-ghost">Draft</button>
        <button type="submit" name="action" value="publish" class="topbar-btn topbar-btn-primary">Publish</button>
      </div>
    </div>

    <div class="create-body">
      <input
        class="title-input"
        name="title"
        type="text"
        bind:value={title}
        required
        placeholder="Title"
        maxlength="255"
      />

      <input
        class="description-input"
        name="description"
        type="text"
        bind:value={description}
        placeholder="Add a short description..."
        maxlength="2000"
      />

      <div class="editor-area">
        <ContentEditor onupdate={handleEditorUpdate} />
      </div>

      <div class="tags-bar">
        <input
          class="tags-input"
          name="tags"
          type="text"
          bind:value={tags}
          placeholder="Tags (comma-separated)"
        />
      </div>
    </div>
  </form>
</div>

<style>
  .create-page {
    max-width: 780px;
    margin: 0 auto;
    min-height: 80vh;
    display: flex;
    flex-direction: column;
  }

  .form-error {
    padding: var(--space-3, 0.75rem);
    background: rgba(248, 113, 113, 0.08);
    border: 1px solid var(--color-error, #f87171);
    color: var(--color-error, #f87171);
    border-radius: var(--radius-md, 0.25rem);
    font-size: var(--text-sm, 0.875rem);
    margin-bottom: var(--space-4, 1rem);
  }

  .create-form {
    display: flex;
    flex-direction: column;
    flex: 1;
  }

  .create-topbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-2, 0.5rem) 0;
    margin-bottom: var(--space-4, 1rem);
    border-bottom: 1px solid var(--color-border, #272725);
  }

  .topbar-left {
    display: flex;
    align-items: center;
  }

  .topbar-left :global(.snaplify-select-group) {
    flex-direction: row;
    gap: 0;
  }

  .topbar-left :global(.snaplify-select-label) {
    display: none;
  }

  .topbar-left :global(.snaplify-select-trigger) {
    font-family: var(--font-mono, monospace);
    font-size: var(--text-xs, 0.6875rem);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border: none;
    background: transparent;
    color: var(--color-text-muted, #444440);
    padding: var(--space-1, 0.25rem) var(--space-2, 0.5rem);
  }

  .topbar-right {
    display: flex;
    gap: var(--space-2, 0.5rem);
  }

  .topbar-btn {
    padding: var(--space-1, 0.25rem) var(--space-4, 1rem);
    border-radius: var(--radius-md, 0.25rem);
    font-size: var(--text-sm, 0.875rem);
    font-family: var(--font-body, sans-serif);
    cursor: pointer;
    border: 1px solid var(--color-border, #272725);
    transition: background var(--transition-fast, 0.1s ease);
  }

  .topbar-btn-ghost {
    background: transparent;
    color: var(--color-text-secondary, #888884);
  }

  .topbar-btn-ghost:hover {
    background: var(--color-surface-alt, #141413);
    color: var(--color-text, #d8d5cf);
  }

  .topbar-btn-primary {
    background: var(--color-primary, #5b9cf6);
    border-color: var(--color-primary, #5b9cf6);
    color: var(--color-on-primary, #0c0c0b);
    font-weight: var(--font-weight-medium, 500);
  }

  .topbar-btn-primary:hover {
    opacity: 0.9;
  }

  .create-body {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .title-input {
    font-size: var(--text-3xl, 2rem);
    font-weight: var(--font-weight-bold, 700);
    font-family: var(--font-heading, sans-serif);
    color: var(--color-text, #d8d5cf);
    background: transparent;
    border: none;
    outline: none;
    padding: 0;
    margin-bottom: var(--space-2, 0.5rem);
    width: 100%;
  }

  .title-input::placeholder {
    color: var(--color-text-muted, #444440);
  }

  .description-input {
    font-size: var(--text-md, 1rem);
    color: var(--color-text-secondary, #888884);
    background: transparent;
    border: none;
    outline: none;
    padding: 0;
    margin-bottom: var(--space-6, 2rem);
    width: 100%;
  }

  .description-input::placeholder {
    color: var(--color-text-muted, #444440);
  }

  .editor-area {
    flex: 1;
    min-height: 400px;
  }

  .editor-area :global(.content-editor) {
    min-height: 400px;
  }

  .editor-area :global(.editor-wrapper) {
    border: none;
    border-radius: 0;
    padding: 0;
    background: transparent;
    min-height: 400px;
  }

  .editor-area :global(.ProseMirror) {
    padding: 0 !important;
  }

  .tags-bar {
    margin-top: var(--space-6, 2rem);
    padding-top: var(--space-4, 1rem);
    border-top: 1px solid var(--color-border, #272725);
  }

  .tags-input {
    font-size: var(--text-sm, 0.875rem);
    color: var(--color-text-secondary, #888884);
    background: transparent;
    border: none;
    outline: none;
    padding: 0;
    width: 100%;
    font-family: var(--font-mono, monospace);
  }

  .tags-input::placeholder {
    color: var(--color-text-muted, #444440);
  }
</style>
