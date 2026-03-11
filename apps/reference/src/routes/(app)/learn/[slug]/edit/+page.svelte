<script lang="ts">
  import { enhance } from '$app/forms';
  import { Button } from '@snaplify/ui';
  import PathEditor from '$lib/components/learning/PathEditor.svelte';
  import ModuleEditor from '$lib/components/learning/ModuleEditor.svelte';
  import type { PageData, ActionData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head>
  <title>Edit: {data.path.title} — Snaplify</title>
</svelte:head>

<div class="edit-page">
  <div class="edit-header">
    <h1>Edit Learning Path</h1>
    <div class="header-actions">
      <a href="/learn/{data.path.slug}" class="btn btn-secondary">View</a>
      {#if data.path.status !== 'published'}
        <form method="POST" action="?/publish" use:enhance class="inline-form">
          <Button variant="primary" type="submit">Publish</Button>
        </form>
      {:else}
        <span class="status-badge status-published">Published</span>
      {/if}
    </div>
  </div>

  {#if form?.error}
    <div class="form-error" role="alert">{form.error}</div>
  {/if}

  <section class="edit-section">
    <h2>Path Details</h2>
    <PathEditor path={data.path} />
  </section>

  <section class="edit-section">
    <h2>Modules & Lessons</h2>
    <ModuleEditor modules={data.path.modules} pathSlug={data.path.slug} />
  </section>
</div>

<style>
  .edit-page {
    max-width: var(--layout-content-width, 960px);
    margin: 0 auto;
  }

  .edit-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-6, 2rem);
  }

  .edit-header h1 {
    font-size: var(--text-2xl, 1.875rem);
    color: var(--color-text, #d8d5cf);
  }

  .header-actions {
    display: flex;
    gap: var(--space-2, 0.5rem);
    align-items: center;
  }

  .inline-form {
    display: inline;
  }

  .form-error {
    padding: var(--space-2, 0.5rem);
    margin-bottom: var(--space-4, 1rem);
    background: var(--color-error-bg, #fef2f2);
    color: var(--color-error, #dc2626);
    border-radius: var(--radius-sm, 4px);
  }

  .edit-section {
    margin-bottom: var(--space-12, 3rem);
    padding: var(--space-6, 2rem);
    border: 1px solid var(--color-border, #272725);
    border-radius: var(--radius-md, 6px);
    background: var(--color-surface, #0c0c0b);
  }

  .edit-section h2 {
    font-size: var(--text-lg, 1.25rem);
    margin-bottom: var(--space-4, 1rem);
    color: var(--color-text, #d8d5cf);
  }

  .btn {
    padding: var(--space-2, 0.5rem) var(--space-4, 1rem);
    border: none;
    border-radius: var(--radius-md, 6px);
    font-size: var(--text-sm, 0.875rem);
    cursor: pointer;
    text-decoration: none;
  }

  .btn-secondary {
    background: var(--color-surface-alt, #1c1c1a);
    color: var(--color-text, #d8d5cf);
    border: 1px solid var(--color-border, #272725);
  }

  .status-badge {
    padding: var(--space-1, 0.25rem) var(--space-2, 0.5rem);
    border-radius: var(--radius-sm, 4px);
    font-size: var(--text-xs, 0.75rem);
    font-weight: var(--font-weight-medium, 500);
  }

  .status-published {
    background: var(--color-success-bg, #f0fdf4);
    color: var(--color-success, #22c55e);
  }
</style>
