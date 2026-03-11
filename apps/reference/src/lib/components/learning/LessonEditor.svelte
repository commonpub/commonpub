<script lang="ts">
  import { enhance } from '$app/forms';

  let {
    moduleId,
    lessons,
  }: {
    moduleId: string;
    lessons: Array<{
      id: string;
      title: string;
      slug: string;
      type: string;
      duration: number | null;
      sortOrder: number;
    }>;
  } = $props();

  let newLessonTitle = $state('');
  let newLessonType = $state('article');
  let editingLessonId = $state<string | null>(null);
  let deleteConfirmId = $state<string | null>(null);

  const lessonTypes = ['article', 'video', 'quiz', 'project', 'explainer'];
</script>

<div class="lesson-editor">
  <ul class="lesson-list" role="list">
    {#each lessons as lesson (lesson.id)}
      <li class="lesson-item">
        {#if editingLessonId === lesson.id}
          <form method="POST" action="?/updateLesson" use:enhance class="lesson-edit-form">
            <input type="hidden" name="lessonId" value={lesson.id} />
            <input
              name="title"
              type="text"
              value={lesson.title}
              required
              maxlength="255"
              class="lesson-input"
            />
            <select name="type" value={lesson.type} class="lesson-select">
              {#each lessonTypes as t}
                <option value={t} selected={lesson.type === t}>{t}</option>
              {/each}
            </select>
            <button type="submit" class="btn btn-small">Save</button>
            <button type="button" class="btn btn-small" onclick={() => (editingLessonId = null)}
              >Cancel</button
            >
          </form>
        {:else}
          <div class="lesson-row">
            <span class="lesson-type-badge">{lesson.type}</span>
            <span class="lesson-title">{lesson.title}</span>
            {#if lesson.duration}
              <span class="lesson-duration">{lesson.duration}m</span>
            {/if}
            <div class="lesson-actions">
              <button class="btn btn-small" onclick={() => (editingLessonId = lesson.id)}
                >Edit</button
              >
              {#if deleteConfirmId === lesson.id}
                <form method="POST" action="?/deleteLesson" use:enhance class="inline-form">
                  <input type="hidden" name="lessonId" value={lesson.id} />
                  <button type="submit" class="btn btn-small btn-danger">Confirm</button>
                  <button
                    type="button"
                    class="btn btn-small"
                    onclick={() => (deleteConfirmId = null)}>Cancel</button
                  >
                </form>
              {:else}
                <button
                  class="btn btn-small btn-danger-outline"
                  onclick={() => (deleteConfirmId = lesson.id)}>Delete</button
                >
              {/if}
            </div>
          </div>
        {/if}
      </li>
    {/each}
  </ul>

  <form method="POST" action="?/addLesson" use:enhance class="add-lesson-form">
    <input type="hidden" name="moduleId" value={moduleId} />
    <input
      name="title"
      type="text"
      placeholder="New lesson title..."
      bind:value={newLessonTitle}
      required
      maxlength="255"
      class="lesson-input"
    />
    <select name="type" bind:value={newLessonType} class="lesson-select">
      {#each lessonTypes as t}
        <option value={t}>{t}</option>
      {/each}
    </select>
    <button type="submit" class="btn btn-add" disabled={!newLessonTitle.trim()}>Add</button>
  </form>
</div>

<style>
  .lesson-editor {
    padding: var(--space-2, 0.5rem) var(--space-4, 1rem);
  }

  .lesson-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .lesson-item {
    padding: var(--space-1, 0.25rem) 0;
    border-bottom: 1px solid var(--color-border, #272725);
  }

  .lesson-item:last-child {
    border-bottom: none;
  }

  .lesson-row {
    display: flex;
    align-items: center;
    gap: var(--space-2, 0.5rem);
  }

  .lesson-type-badge {
    font-size: var(--text-xs, 0.75rem);
    padding: 0 var(--space-1, 0.25rem);
    background: var(--color-surface-alt, #1c1c1a);
    border-radius: var(--radius-sm, 4px);
    color: var(--color-text-secondary, #888884);
    text-transform: capitalize;
  }

  .lesson-title {
    flex: 1;
    font-size: var(--text-sm, 0.875rem);
    color: var(--color-text, #d8d5cf);
  }

  .lesson-duration {
    font-size: var(--text-xs, 0.75rem);
    color: var(--color-text-secondary, #888884);
  }

  .lesson-actions {
    display: flex;
    gap: var(--space-1, 0.25rem);
  }

  .lesson-edit-form {
    display: flex;
    gap: var(--space-1, 0.25rem);
    align-items: center;
  }

  .lesson-input {
    flex: 1;
    padding: var(--space-1, 0.25rem) var(--space-2, 0.5rem);
    border: 1px solid var(--color-border, #272725);
    border-radius: var(--radius-sm, 4px);
    font-size: var(--text-sm, 0.875rem);
    background: var(--color-surface, #0c0c0b);
    color: var(--color-text, #d8d5cf);
  }

  .lesson-select {
    padding: var(--space-1, 0.25rem);
    border: 1px solid var(--color-border, #272725);
    border-radius: var(--radius-sm, 4px);
    font-size: var(--text-xs, 0.75rem);
    background: var(--color-surface, #0c0c0b);
    color: var(--color-text, #d8d5cf);
  }

  .add-lesson-form {
    display: flex;
    gap: var(--space-1, 0.25rem);
    margin-top: var(--space-2, 0.5rem);
  }

  .inline-form {
    display: flex;
    gap: var(--space-1, 0.25rem);
  }

  .btn {
    padding: var(--space-1, 0.25rem) var(--space-2, 0.5rem);
    border: 1px solid var(--color-border, #272725);
    border-radius: var(--radius-sm, 4px);
    font-size: var(--text-xs, 0.75rem);
    cursor: pointer;
    background: var(--color-surface-alt, #1c1c1a);
    color: var(--color-text, #d8d5cf);
  }

  .btn-small {
    padding: var(--space-1, 0.25rem) var(--space-2, 0.5rem);
  }

  .btn-add {
    background: var(--color-primary, #2563eb);
    color: var(--color-on-primary, #ffffff);
    border: none;
  }

  .btn-add:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-danger {
    background: var(--color-error, #dc2626);
    color: var(--color-on-primary, #ffffff);
    border: none;
  }

  .btn-danger-outline {
    color: var(--color-error, #dc2626);
    border-color: var(--color-error, #dc2626);
    background: transparent;
  }
</style>
