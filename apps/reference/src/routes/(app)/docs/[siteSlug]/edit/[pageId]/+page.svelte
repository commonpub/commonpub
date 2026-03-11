<script lang="ts">
  import { Input, Button } from '@snaplify/ui';
  import CodeMirrorEditor from '$lib/components/docs/CodeMirrorEditor.svelte';
  import type { PageData, ActionData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let content = $state(data.page.content);
  let title = $state(data.page.title);
</script>

<svelte:head>
  <title>Edit: {data.page.title} — Snaplify Docs</title>
</svelte:head>

<section class="edit-page">
  <div class="edit-header">
    <h1 class="page-title">Edit Page</h1>
    <a href="/docs/{data.site.slug}" class="back-link">Back to docs</a>
  </div>

  {#if form?.error}
    <div class="error-message" role="alert">{form.error}</div>
  {/if}
  {#if form?.success}
    <div class="success-message" role="status">Page saved.</div>
  {/if}

  <form method="POST" action="?/save" class="edit-form">
    <Input id="title" name="title" label="Title" bind:value={title} required />

    <Input id="slug" name="slug" label="Slug" value={data.page.slug} />

    <div class="editor-field">
      <label class="editor-label">Content (Markdown)</label>
      <CodeMirrorEditor bind:content class="editor" />
      <input type="hidden" name="content" value={content} />
    </div>

    <div class="form-actions">
      <Button variant="primary" size="md" type="submit">Save</Button>
    </div>
  </form>

  <form method="POST" action="?/delete" class="delete-form">
    <Button
      variant="danger"
      size="md"
      type="submit"
      onclick={(e) => {
        if (!confirm('Delete this page?')) e.preventDefault();
      }}>Delete Page</Button
    >
  </form>
</section>

<style>
  .edit-page {
    max-width: var(--layout-wide-width, 960px);
    margin: 0 auto;
    padding: var(--space-4, 1rem);
  }

  .edit-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-6, 2rem);
  }

  .page-title {
    font-size: var(--text-xl, 1.5rem);
    color: var(--color-text, inherit);
  }

  .back-link {
    font-size: var(--text-sm, 0.875rem);
    color: var(--color-primary, #3b82f6);
    text-decoration: none;
  }

  .error-message {
    padding: var(--space-2, 0.5rem);
    margin-bottom: var(--space-4, 1rem);
    border: 1px solid var(--color-danger, #ef4444);
    border-radius: var(--radius-sm, 0.25rem);
    color: var(--color-danger, #ef4444);
    font-size: var(--text-sm, 0.875rem);
  }

  .success-message {
    padding: var(--space-2, 0.5rem);
    margin-bottom: var(--space-4, 1rem);
    border: 1px solid var(--color-success, #22c55e);
    border-radius: var(--radius-sm, 0.25rem);
    color: var(--color-success, #22c55e);
    font-size: var(--text-sm, 0.875rem);
  }

  .edit-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-4, 1rem);
  }

  .editor-field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1, 0.25rem);
    min-height: 30rem;
  }

  .editor-label {
    font-size: var(--text-sm, 0.875rem);
    font-weight: var(--font-weight-medium, 500);
    color: var(--color-text, inherit);
  }

  .form-actions {
    display: flex;
    gap: var(--space-2, 0.5rem);
    align-items: center;
  }

  .delete-form {
    margin-top: var(--space-6, 2rem);
    padding-top: var(--space-4, 1rem);
    border-top: 1px solid var(--color-border, #e5e7eb);
  }
</style>
