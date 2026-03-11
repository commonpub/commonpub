<script lang="ts">
  import { enhance } from '$app/forms';
  import ContentEditor from '$lib/components/ContentEditor.svelte';
  import type { PageData, ActionData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let title = $state(data.item.title);
  let description = $state(data.item.description ?? '');
  let seoDescription = $state(data.item.seoDescription ?? '');
  let tags = $state(data.item.tags.map((t) => t.name).join(', '));
  let contentBlocks = $state<unknown[]>(
    Array.isArray(data.item.content) ? (data.item.content as unknown[]) : [],
  );

  function handleEditorUpdate(blocks: unknown[]) {
    contentBlocks = blocks;
  }
</script>

<svelte:head>
  <title>Edit: {data.item.title} — Snaplify</title>
</svelte:head>

<div class="edit-page">
  {#if form?.error}
    <div class="form-error" role="alert">{form.error}</div>
  {/if}

  <form method="POST" use:enhance class="edit-form">
    <input type="hidden" name="content" value={JSON.stringify(contentBlocks)} />

    <div class="edit-topbar">
      <span class="topbar-status">{data.item.status}</span>
      <div class="topbar-actions">
        <button type="submit" name="action" value="save" class="topbar-btn topbar-btn-ghost">
          {data.item.status === 'published' ? 'Update' : 'Save Draft'}
        </button>
        {#if data.item.status !== 'published'}
          <button type="submit" name="action" value="publish" class="topbar-btn topbar-btn-primary">
            Publish
          </button>
        {/if}
      </div>
    </div>

    <div class="edit-body">
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
        <ContentEditor content={data.item.content} onupdate={handleEditorUpdate} />
      </div>

      <div class="meta-section">
        <div class="meta-row">
          <label class="meta-label" for="tags">Tags</label>
          <input
            class="meta-input"
            id="tags"
            name="tags"
            type="text"
            bind:value={tags}
            placeholder="comma-separated"
          />
        </div>
        <div class="meta-row">
          <label class="meta-label" for="seo">SEO</label>
          <input
            class="meta-input"
            id="seo"
            name="seoDescription"
            type="text"
            bind:value={seoDescription}
            placeholder="Search engine description"
            maxlength="320"
          />
        </div>
      </div>
    </div>
  </form>
</div>

<style>
  .edit-page {
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

  .edit-form {
    display: flex;
    flex-direction: column;
    flex: 1;
  }

  .edit-topbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-2, 0.5rem) 0;
    margin-bottom: var(--space-4, 1rem);
    border-bottom: 1px solid var(--color-border, #272725);
  }

  .topbar-status {
    font-family: var(--font-mono, monospace);
    font-size: var(--text-xs, 0.6875rem);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-muted, #444440);
  }

  .topbar-actions {
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

  .edit-body {
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

  .meta-section {
    margin-top: var(--space-6, 2rem);
    padding-top: var(--space-4, 1rem);
    border-top: 1px solid var(--color-border, #272725);
    display: flex;
    flex-direction: column;
    gap: var(--space-3, 0.75rem);
  }

  .meta-row {
    display: flex;
    align-items: center;
    gap: var(--space-3, 0.75rem);
  }

  .meta-label {
    font-family: var(--font-mono, monospace);
    font-size: var(--text-xs, 0.6875rem);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-muted, #444440);
    min-width: 40px;
  }

  .meta-input {
    flex: 1;
    font-size: var(--text-sm, 0.875rem);
    color: var(--color-text-secondary, #888884);
    background: transparent;
    border: none;
    outline: none;
    padding: 0;
    font-family: var(--font-mono, monospace);
  }

  .meta-input::placeholder {
    color: var(--color-text-muted, #444440);
  }
</style>
