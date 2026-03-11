<script lang="ts">
  import SeoHead from '$lib/components/SeoHead.svelte';
  import LessonViewer from '$lib/components/learning/LessonViewer.svelte';
  import LessonNav from '$lib/components/learning/LessonNav.svelte';
  import ProgressBar from '$lib/components/learning/ProgressBar.svelte';
  import { enhance } from '$app/forms';
  import type { PageData, ActionData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  const lesson = data.lesson;
  const completedSet = new Set(data.completedIds);
  const isCompleted = completedSet.has(lesson.id);
</script>

<SeoHead
  title={`${lesson.title} — ${data.path.title}`}
  description=""
  type="Course"
  url={`/learn/${data.path.slug}/${lesson.slug}`}
/>

<article class="lesson-page">
  <nav class="lesson-breadcrumb" aria-label="Breadcrumb">
    <a href="/learn">Learn</a>
    <span aria-hidden="true">/</span>
    <a href="/learn/{data.path.slug}">{data.path.title}</a>
    <span aria-hidden="true">/</span>
    <span aria-current="page">{lesson.title}</span>
  </nav>

  {#if data.enrollment}
    <ProgressBar value={Number(data.enrollment.progress)} label="Path progress" />
  {/if}

  <header class="lesson-header">
    <span class="lesson-type">{lesson.type}</span>
    <h1>{lesson.title}</h1>
  </header>

  <div class="lesson-content">
    <LessonViewer {lesson} />
  </div>

  {#if data.enrollment && !isCompleted}
    <form method="POST" action="?/complete" use:enhance class="complete-form">
      <button type="submit" class="btn btn-primary">Mark as Complete</button>
    </form>
  {:else if isCompleted}
    <div class="completed-badge" role="status">Completed</div>
  {/if}

  {#if form?.certificateIssued}
    <div class="certificate-notice" role="alert">
      Congratulations! You've earned a certificate for completing this path.
      <a href="/dashboard/learning">View your certificates</a>
    </div>
  {/if}

  <LessonNav prevLesson={data.prevLesson} nextLesson={data.nextLesson} pathSlug={data.path.slug} />
</article>

<style>
  .lesson-page {
    max-width: var(--layout-content-width, 768px);
    margin: 0 auto;
  }

  .lesson-breadcrumb {
    display: flex;
    gap: var(--space-1, 0.25rem);
    font-size: var(--text-sm, 0.875rem);
    color: var(--color-text-secondary, #888884);
    margin-bottom: var(--space-4, 1rem);
  }

  .lesson-breadcrumb a {
    color: var(--color-primary, #2563eb);
    text-decoration: none;
  }

  .lesson-header {
    margin-bottom: var(--space-6, 2rem);
  }

  .lesson-type {
    display: inline-block;
    padding: var(--space-1, 0.25rem) var(--space-2, 0.5rem);
    background: var(--color-surface-alt, #1c1c1a);
    border-radius: var(--radius-sm, 4px);
    font-size: var(--text-xs, 0.75rem);
    text-transform: uppercase;
    color: var(--color-text-secondary, #888884);
    margin-bottom: var(--space-2, 0.5rem);
  }

  .lesson-header h1 {
    font-size: var(--text-2xl, 1.875rem);
    color: var(--color-text, #d8d5cf);
    margin: 0;
  }

  .lesson-content {
    margin-bottom: var(--space-12, 3rem);
    line-height: 1.7;
    color: var(--color-text, #d8d5cf);
  }

  .complete-form {
    margin-bottom: var(--space-6, 2rem);
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

  .completed-badge {
    display: inline-block;
    padding: var(--space-2, 0.5rem) var(--space-4, 1rem);
    background: var(--color-success-bg, #f0fdf4);
    color: var(--color-success, #22c55e);
    border-radius: var(--radius-md, 6px);
    font-weight: var(--font-weight-medium, 500);
    margin-bottom: var(--space-6, 2rem);
  }

  .certificate-notice {
    padding: var(--space-4, 1rem);
    background: var(--color-success-bg, #f0fdf4);
    color: var(--color-success, #22c55e);
    border-radius: var(--radius-md, 6px);
    margin-bottom: var(--space-6, 2rem);
  }

  .certificate-notice a {
    color: var(--color-primary, #2563eb);
    font-weight: var(--font-weight-medium, 500);
  }
</style>
