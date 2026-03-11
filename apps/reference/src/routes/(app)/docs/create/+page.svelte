<script lang="ts">
  import { Input, Textarea, Button } from '@snaplify/ui';
  import type { ActionData } from './$types';

  let { form }: { form: ActionData } = $props();
</script>

<svelte:head>
  <title>Create Documentation Site — Snaplify</title>
</svelte:head>

<section class="create-docs-page">
  <h1 class="page-title">Create Documentation Site</h1>

  {#if form?.error}
    <div class="error-message" role="alert">{form.error}</div>
  {/if}

  <form method="POST" class="create-form">
    <Input id="name" name="name" label="Name" required />

    <Textarea id="description" name="description" label="Description (optional)" rows={3} />

    <Button variant="primary" size="md" type="submit">Create Site</Button>
  </form>
</section>

<style>
  .create-docs-page {
    max-width: var(--layout-narrow-width, 640px);
    margin: 0 auto;
    padding: var(--space-4, 1rem);
  }

  .page-title {
    font-size: var(--text-2xl, 1.875rem);
    margin-bottom: var(--space-6, 2rem);
    color: var(--color-text, inherit);
  }

  .error-message {
    padding: var(--space-2, 0.5rem);
    margin-bottom: var(--space-4, 1rem);
    border: 1px solid var(--color-danger, #ef4444);
    border-radius: var(--radius-sm, 0.25rem);
    color: var(--color-danger, #ef4444);
    font-size: var(--text-sm, 0.875rem);
  }

  .create-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-4, 1rem);
  }

</style>
