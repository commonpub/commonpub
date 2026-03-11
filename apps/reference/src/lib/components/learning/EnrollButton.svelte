<script lang="ts">
  import { enhance } from '$app/forms';

  let {
    isEnrolled = false,
    progress = 0,
    pathSlug,
  }: {
    isEnrolled?: boolean;
    progress?: number;
    pathSlug: string;
  } = $props();

  const isComplete = progress >= 100;
</script>

<div class="enroll-actions">
  {#if !isEnrolled}
    <form method="POST" action="/learn/{pathSlug}?/enroll" use:enhance>
      <button type="submit" class="btn btn-enroll">Enroll</button>
    </form>
  {:else if isComplete}
    <span class="btn btn-completed">Completed</span>
  {:else}
    <a href="/learn/{pathSlug}" class="btn btn-continue">Continue Learning</a>
  {/if}
</div>

<style>
  .enroll-actions {
    margin: var(--space-4, 1rem) 0;
  }

  .btn {
    display: inline-block;
    padding: var(--space-2, 0.5rem) var(--space-6, 2rem);
    border: none;
    border-radius: var(--radius-md, 6px);
    font-size: var(--text-md, 1rem);
    cursor: pointer;
    text-decoration: none;
    font-weight: var(--font-weight-medium, 500);
  }

  .btn-enroll {
    background: var(--color-primary, #2563eb);
    color: var(--color-on-primary, #ffffff);
  }

  .btn-continue {
    background: var(--color-primary, #2563eb);
    color: var(--color-on-primary, #ffffff);
  }

  .btn-completed {
    background: var(--color-success-bg, #f0fdf4);
    color: var(--color-success, #22c55e);
    cursor: default;
  }
</style>
