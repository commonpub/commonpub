<script lang="ts">
  import { Textarea, Button } from '@snaplify/ui';
  import type { PageData, ActionData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();
  let structureText = $state(JSON.stringify(data.nav, null, 2));
</script>

<svelte:head>
  <title>Edit Navigation — {data.site.name} Docs</title>
</svelte:head>

<section class="nav-editor-page">
  <h1 class="page-title">Navigation Editor</h1>
  <p class="page-desc">
    Edit the sidebar navigation structure as JSON. Each item needs <code>id</code>,
    <code>title</code>, and optionally <code>pageId</code> and <code>children</code>.
  </p>

  {#if form?.error}
    <div class="error-message" role="alert">{form.error}</div>
  {/if}
  {#if form?.success}
    <div class="success-message" role="status">Navigation saved.</div>
  {/if}

  <form method="POST" class="nav-form">
    <Textarea id="structure" name="structure" label="Navigation Structure (JSON)" rows={20} bind:value={structureText} class="code" />

    <div class="page-reference">
      <h3 class="ref-title">Available Pages</h3>
      <ul class="ref-list">
        {#each data.pages as page}
          <li class="ref-item"><code>{page.id}</code> — {page.title} (/{page.slug})</li>
        {/each}
      </ul>
    </div>

    <Button variant="primary" size="md" type="submit">Save Navigation</Button>
  </form>
</section>

<style>
  .nav-editor-page {
    max-width: var(--layout-narrow-width, 640px);
    margin: 0 auto;
    padding: var(--space-4, 1rem);
  }

  .page-title {
    font-size: var(--text-xl, 1.5rem);
    margin-bottom: var(--space-1, 0.25rem);
    color: var(--color-text, inherit);
  }

  .page-desc {
    font-size: var(--text-sm, 0.875rem);
    color: var(--color-text-secondary, #6b7280);
    margin-bottom: var(--space-6, 2rem);
  }

  .error-message,
  .success-message {
    padding: var(--space-2, 0.5rem);
    margin-bottom: var(--space-4, 1rem);
    border-radius: var(--radius-sm, 0.25rem);
    font-size: var(--text-sm, 0.875rem);
  }

  .error-message {
    border: 1px solid var(--color-danger, #ef4444);
    color: var(--color-danger, #ef4444);
  }

  .success-message {
    border: 1px solid var(--color-success, #22c55e);
    color: var(--color-success, #22c55e);
  }

  .nav-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-4, 1rem);
  }

  .code :global(.snaplify-textarea) {
    font-family: var(--font-mono, monospace);
  }

  .page-reference {
    padding: var(--space-2, 0.5rem);
    background: var(--color-bg-muted, #f9fafb);
    border-radius: var(--radius-sm, 0.25rem);
  }

  .ref-title {
    font-size: var(--text-sm, 0.875rem);
    font-weight: var(--font-weight-semibold, 600);
    margin-bottom: var(--space-1, 0.25rem);
  }

  .ref-list {
    padding-left: var(--space-4, 1rem);
    font-size: var(--text-xs, 0.75rem);
  }

  .ref-item code {
    font-size: var(--text-xs, 0.75rem);
    background: var(--color-bg-code, #e5e7eb);
    padding: 0 var(--space-1, 0.25rem);
    border-radius: var(--radius-xs, 0.125rem);
  }

</style>
