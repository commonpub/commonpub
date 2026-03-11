<script lang="ts">
  import { enhance } from '$app/forms';
  import type { LearningPathDetail } from '$lib/types';

  let { path }: { path: LearningPathDetail } = $props();

  let title = $state(path.title);
  let description = $state(path.description ?? '');
  let difficulty = $state(path.difficulty ?? '');
  let estimatedHours = $state(path.estimatedHours ?? '');
</script>

<form method="POST" action="?/updatePath" use:enhance class="path-form">
  <div class="form-field">
    <label for="path-title">Title</label>
    <input id="path-title" name="title" type="text" bind:value={title} required maxlength="255" />
  </div>

  <div class="form-field">
    <label for="path-desc">Description</label>
    <textarea id="path-desc" name="description" bind:value={description} maxlength="2000" rows="3"
    ></textarea>
  </div>

  <div class="form-row">
    <div class="form-field">
      <label for="path-difficulty">Difficulty</label>
      <select id="path-difficulty" name="difficulty" bind:value={difficulty}>
        <option value="">Select...</option>
        <option value="beginner">Beginner</option>
        <option value="intermediate">Intermediate</option>
        <option value="advanced">Advanced</option>
      </select>
    </div>

    <div class="form-field">
      <label for="path-hours">Estimated Hours</label>
      <input
        id="path-hours"
        name="estimatedHours"
        type="number"
        min="0.5"
        step="0.5"
        bind:value={estimatedHours}
      />
    </div>
  </div>

  <button type="submit" class="btn btn-save">Save Changes</button>
</form>

<style>
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

  .form-field input,
  .form-field textarea,
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

  .btn-save {
    padding: var(--space-2, 0.5rem) var(--space-4, 1rem);
    background: var(--color-primary, #2563eb);
    color: var(--color-on-primary, #ffffff);
    border: none;
    border-radius: var(--radius-md, 6px);
    font-size: var(--text-sm, 0.875rem);
    cursor: pointer;
  }
</style>
