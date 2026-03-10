<script lang="ts">
  import { enhance } from '$app/forms';
  import ContentEditor from '$lib/components/ContentEditor.svelte';
  import type { ActionData } from './$types';

  let { form }: { form: ActionData } = $props();

  let title = $state(form?.title ?? '');
  let type = $state(form?.type ?? 'project');
  let description = $state(form?.description ?? '');
  let tags = $state('');
  let contentBlocks = $state<unknown[]>([]);

  function handleEditorUpdate(blocks: unknown[]) {
    contentBlocks = blocks;
  }
</script>

<svelte:head>
  <title>Create — Snaplify</title>
</svelte:head>

<div class="create-page">
  <h1>Create Content</h1>

  {#if form?.error}
    <div class="form-error" role="alert">{form.error}</div>
  {/if}

  <form method="POST" use:enhance>
    <div class="form-row">
      <div class="form-field">
        <label for="title">Title</label>
        <input
          id="title"
          name="title"
          type="text"
          bind:value={title}
          required
          maxlength="255"
          placeholder="Give your content a title"
        />
      </div>

      <div class="form-field form-field-type">
        <label for="type">Type</label>
        <select id="type" name="type" bind:value={type}>
          <option value="project">Project</option>
          <option value="article">Article</option>
          <option value="guide">Guide</option>
          <option value="blog">Blog Post</option>
        </select>
      </div>
    </div>

    <div class="form-field">
      <label for="description">Description <span class="optional">(optional)</span></label>
      <textarea
        id="description"
        name="description"
        bind:value={description}
        maxlength="2000"
        rows="2"
        placeholder="A brief summary of your content"
      ></textarea>
    </div>

    <div class="form-field">
      <label for="editor">Content</label>
      <ContentEditor onupdate={handleEditorUpdate} />
      <input type="hidden" name="content" value={JSON.stringify(contentBlocks)} />
    </div>

    <div class="form-field">
      <label for="tags">Tags <span class="optional">(comma-separated)</span></label>
      <input
        id="tags"
        name="tags"
        type="text"
        bind:value={tags}
        placeholder="svelte, electronics, beginner"
      />
    </div>

    <div class="form-actions">
      <button type="submit" name="action" value="draft" class="btn btn-secondary">
        Save Draft
      </button>
      <button type="submit" name="action" value="publish" class="btn btn-primary">
        Publish
      </button>
    </div>
  </form>
</div>

<style>
  .create-page {
    max-width: var(--layout-content-width, 768px);
    margin: 0 auto;
  }

  .create-page h1 {
    font-size: var(--font-size-2xl, 1.875rem);
    margin-bottom: var(--space-lg, 2rem);
    color: var(--color-text, #1a1a1a);
  }

  .form-error {
    padding: var(--space-sm, 0.5rem);
    margin-bottom: var(--space-md, 1rem);
    background: var(--color-error-bg, #fef2f2);
    color: var(--color-error, #dc2626);
    border-radius: var(--radius-sm, 4px);
  }

  .form-row {
    display: flex;
    gap: var(--space-md, 1rem);
  }

  .form-field {
    margin-bottom: var(--space-md, 1rem);
    flex: 1;
  }

  .form-field-type {
    flex: 0 0 180px;
  }

  .form-field label {
    display: block;
    margin-bottom: var(--space-xs, 0.25rem);
    font-size: var(--font-size-sm, 0.875rem);
    font-weight: var(--font-weight-medium, 500);
    color: var(--color-text, #1a1a1a);
  }

  .optional {
    font-weight: var(--font-weight-normal, 400);
    color: var(--color-text-secondary, #666);
  }

  .form-field input,
  .form-field select,
  .form-field textarea {
    width: 100%;
    padding: var(--space-sm, 0.5rem);
    border: 1px solid var(--color-border, #e5e5e5);
    border-radius: var(--radius-sm, 4px);
    font-size: var(--font-size-md, 1rem);
    background: var(--color-surface, #ffffff);
    color: var(--color-text, #1a1a1a);
    box-sizing: border-box;
  }

  .form-actions {
    display: flex;
    gap: var(--space-sm, 0.5rem);
    justify-content: flex-end;
    margin-top: var(--space-lg, 2rem);
  }

  .btn {
    padding: var(--space-sm, 0.5rem) var(--space-lg, 2rem);
    border: none;
    border-radius: var(--radius-md, 6px);
    font-size: var(--font-size-md, 1rem);
    cursor: pointer;
  }

  .btn-primary {
    background: var(--color-primary, #2563eb);
    color: var(--color-on-primary, #ffffff);
  }

  .btn-secondary {
    background: var(--color-surface-secondary, #f5f5f5);
    color: var(--color-text, #1a1a1a);
    border: 1px solid var(--color-border, #e5e5e5);
  }
</style>
