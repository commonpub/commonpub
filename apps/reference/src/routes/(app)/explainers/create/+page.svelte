<script lang="ts">
  import { enhance } from '$app/forms';
  import ExplainerEditor from '$lib/components/explainer/ExplainerEditor.svelte';
  import { Input, Textarea } from '@snaplify/ui';
  import type { ExplainerSection } from '@snaplify/explainer';
  import type { ActionData } from './$types';

  let { form }: { form: ActionData } = $props();

  type FormWithData = ActionData & { title?: string; description?: string };
  const formData = form as FormWithData | null;

  let title = $state(formData?.title ?? '');
  let description = $state(formData?.description ?? '');
  let tags = $state('');
  let sections = $state<ExplainerSection[]>([]);

  function handleSectionsChange(updated: ExplainerSection[]) {
    sections = updated;
  }
</script>

<svelte:head>
  <title>Create Explainer — Snaplify</title>
</svelte:head>

<div class="create-page">
  <h1>Create Explainer</h1>

  {#if form?.error}
    <div class="form-error" role="alert">{form.error}</div>
  {/if}

  <form method="POST" use:enhance>
    <div class="form-field">
      <Input id="title" label="Title" name="title" bind:value={title} required maxlength={255} placeholder="Give your explainer a title" />
    </div>

    <div class="form-field">
      <Textarea id="description" label="Description (optional)" name="description" bind:value={description} maxlength={2000} rows={2} placeholder="A brief summary of what this explainer teaches" />
    </div>

    <div class="form-field">
      <label>Sections</label>
      <ExplainerEditor {sections} onsectionschange={handleSectionsChange} />
      <input type="hidden" name="sections" value={JSON.stringify(sections)} />
    </div>

    <div class="form-field">
      <Input id="tags" label="Tags (comma-separated)" name="tags" bind:value={tags} placeholder="javascript, beginner, tutorial" />
    </div>

    <div class="form-actions">
      <button type="submit" name="action" value="draft" class="btn btn-secondary">
        Save Draft
      </button>
      <button type="submit" name="action" value="publish" class="btn btn-primary"> Publish </button>
    </div>
  </form>
</div>

<style>
  .create-page {
    max-width: var(--layout-content-width, 768px);
    margin: 0 auto;
  }

  .create-page h1 {
    font-size: var(--text-2xl, 1.875rem);
    margin-bottom: var(--space-6, 2rem);
    color: var(--color-text, #d8d5cf);
  }

  .form-error {
    padding: var(--space-2, 0.5rem);
    margin-bottom: var(--space-4, 1rem);
    background: var(--color-error-bg, #fef2f2);
    color: var(--color-error, #dc2626);
    border-radius: var(--radius-sm, 4px);
  }

  .form-field {
    margin-bottom: var(--space-4, 1rem);
  }


  .form-actions {
    display: flex;
    gap: var(--space-2, 0.5rem);
    justify-content: flex-end;
    margin-top: var(--space-6, 2rem);
  }

  .btn {
    padding: var(--space-2, 0.5rem) var(--space-6, 2rem);
    border: none;
    border-radius: var(--radius-md, 6px);
    font-size: var(--text-md, 1rem);
    cursor: pointer;
  }

  .btn-primary {
    background: var(--color-primary, #2563eb);
    color: var(--color-on-primary, #ffffff);
  }

  .btn-secondary {
    background: var(--color-surface-alt, #1c1c1a);
    color: var(--color-text, #d8d5cf);
    border: 1px solid var(--color-border, #272725);
  }
</style>
