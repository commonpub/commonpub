<script lang="ts">
  import { enhance } from '$app/forms';
  import { Input, Textarea, Button } from '@snaplify/ui';
  import type { ActionData } from './$types';

  let { form }: { form: ActionData & Record<string, unknown> } = $props();
</script>

<svelte:head>
  <title>Create Learning Path — Snaplify</title>
</svelte:head>

<div class="create-page">
  <h1>Create Learning Path</h1>

  {#if form?.error}
    <div class="form-error" role="alert">{form.error}</div>
  {/if}

  <form method="POST" use:enhance>
    <Input id="title" label="Title" name="title" value={String(form?.title ?? '')} required />

    <Textarea id="description" label="Description" name="description" rows={3} value={String(form?.description ?? '')} />

    <div class="form-row">
      <div class="form-field">
        <label for="difficulty">Difficulty</label>
        <select id="difficulty" name="difficulty">
          <option value="">Select...</option>
          <option value="beginner" selected={form?.difficulty === 'beginner'}>Beginner</option>
          <option value="intermediate" selected={form?.difficulty === 'intermediate'}
            >Intermediate</option
          >
          <option value="advanced" selected={form?.difficulty === 'advanced'}>Advanced</option>
        </select>
      </div>

      <Input id="estimatedHours" label="Estimated Hours" name="estimatedHours" type="number" />
    </div>

    <div class="form-actions">
      <Button variant="primary" type="submit">Create & Edit</Button>
    </div>
  </form>
</div>

<style>
  .create-page {
    max-width: var(--layout-content-width, 640px);
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

  .form-field label {
    display: block;
    margin-bottom: var(--space-1, 0.25rem);
    font-size: var(--text-sm, 0.875rem);
    font-weight: var(--font-weight-medium, 500);
    color: var(--color-text, #d8d5cf);
  }

  .form-field select {
    width: 100%;
    padding: var(--space-2, 0.5rem);
    border: 1px solid var(--color-border, #272725);
    border-radius: var(--radius-sm, 4px);
    font-size: var(--text-md, 1rem);
    background: var(--color-surface, #0c0c0b);
    color: var(--color-text, #d8d5cf);
    box-sizing: border-box;
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-4, 1rem);
  }

  .form-actions {
    margin-top: var(--space-6, 2rem);
  }

</style>
