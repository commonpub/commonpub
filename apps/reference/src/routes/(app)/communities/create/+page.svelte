<script lang="ts">
  import { enhance } from '$app/forms';
  import { Button, Input, Textarea } from '@snaplify/ui';
  import type { ActionData } from './$types';

  let { form }: { form: ActionData } = $props();
</script>

<svelte:head>
  <title>Create Community — Snaplify</title>
</svelte:head>

<div class="create-page">
  <h1>Create Community</h1>

  {#if form?.error}
    <div class="error-banner" role="alert">{form.error}</div>
  {/if}

  <form method="POST" use:enhance class="create-form">
    <div class="form-field">
      <Input
        id="name"
        label="Name"
        name="name"
        type="text"
        required
        placeholder="My Awesome Community"
      />
    </div>

    <div class="form-field">
      <Textarea
        id="description"
        label="Description"
        name="description"
        rows={3}
        placeholder="What is this community about?"
      />
    </div>

    <div class="form-field">
      <Textarea
        id="rules"
        label="Rules"
        name="rules"
        rows={5}
        placeholder="Community guidelines and rules..."
      />
    </div>

    <div class="form-field">
      <label for="joinPolicy">Join Policy</label>
      <select id="joinPolicy" name="joinPolicy">
        <option value="open">Open — Anyone can join</option>
        <option value="approval">Approval — Invite token required</option>
        <option value="invite">Invite Only — Invite token required</option>
      </select>
    </div>

    <Button variant="primary" type="submit">Create Community</Button>
  </form>
</div>

<style>
  .create-page {
    max-width: var(--layout-content-width, 640px);
    margin: 0 auto;
  }

  h1 {
    font-size: var(--text-2xl, 1.875rem);
    color: var(--color-text, #d8d5cf);
    margin-bottom: var(--space-6, 2rem);
  }

  .create-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-4, 1rem);
  }

  .form-field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1, 0.25rem);
  }

  .form-field label {
    font-weight: var(--font-weight-medium, 500);
    color: var(--color-text, #d8d5cf);
    font-size: var(--text-sm, 0.875rem);
  }

  .form-field select {
    padding: var(--space-2, 0.5rem) var(--space-4, 1rem);
    border: 1px solid var(--color-border, #272725);
    border-radius: var(--radius-md, 6px);
    font-size: var(--text-md, 1rem);
    background: var(--color-surface, #0c0c0b);
    color: var(--color-text, #d8d5cf);
  }

  .error-banner {
    padding: var(--space-2, 0.5rem) var(--space-4, 1rem);
    background: var(--color-error-bg, #fef2f2);
    color: var(--color-error, #dc2626);
    border-radius: var(--radius-md, 6px);
    margin-bottom: var(--space-4, 1rem);
  }

</style>
