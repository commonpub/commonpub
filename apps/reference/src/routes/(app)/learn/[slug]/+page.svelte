<script lang="ts">
  import { enhance } from '$app/forms';
  import SeoHead from '$lib/components/SeoHead.svelte';
  import CurriculumAccordion from '$lib/components/learning/CurriculumAccordion.svelte';
  import EnrollButton from '$lib/components/learning/EnrollButton.svelte';
  import ProgressBar from '$lib/components/learning/ProgressBar.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  const path = data.path;
</script>

<SeoHead
  title={path.title}
  description={path.description ?? ''}
  type="Course"
  url={`/learn/${path.slug}`}
  image={path.coverImageUrl}
  authorName={path.author.displayName ?? path.author.username}
/>

<article class="path-detail">
  {#if path.coverImageUrl}
    <img src={path.coverImageUrl} alt="" class="path-cover" />
  {/if}

  <header class="path-header">
    <h1>{path.title}</h1>
    {#if path.description}
      <p class="path-description">{path.description}</p>
    {/if}

    <div class="path-meta">
      <span class="meta-item">By {path.author.displayName ?? path.author.username}</span>
      {#if path.difficulty}
        <span class="meta-item difficulty difficulty-{path.difficulty}">{path.difficulty}</span>
      {/if}
      {#if path.estimatedHours}
        <span class="meta-item">{path.estimatedHours}h</span>
      {/if}
      <span class="meta-item">{path.enrollmentCount} enrolled</span>
    </div>

    {#if path.isEnrolled && path.enrollment}
      <ProgressBar value={Number(path.enrollment.progress)} label="Path progress" />
    {/if}

    <EnrollButton
      isEnrolled={path.isEnrolled}
      progress={path.enrollment ? Number(path.enrollment.progress) : 0}
      pathSlug={path.slug}
    />
  </header>

  <section class="curriculum" aria-label="Curriculum">
    <h2>Curriculum</h2>
    <CurriculumAccordion modules={path.modules} pathSlug={path.slug} />
  </section>
</article>

<style>
  .path-detail {
    max-width: var(--layout-content-width, 768px);
    margin: 0 auto;
  }

  .path-cover {
    width: 100%;
    border-radius: var(--radius-md, 6px);
    margin-bottom: var(--space-6, 2rem);
    aspect-ratio: 16 / 9;
    object-fit: cover;
  }

  .path-header {
    margin-bottom: var(--space-12, 3rem);
  }

  .path-header h1 {
    font-size: var(--text-3xl, 2.25rem);
    line-height: 1.2;
    color: var(--color-text, #d8d5cf);
    margin: 0 0 var(--space-2, 0.5rem);
  }

  .path-description {
    font-size: var(--text-lg, 1.25rem);
    color: var(--color-text-secondary, #888884);
    margin: 0 0 var(--space-4, 1rem);
    line-height: 1.6;
  }

  .path-meta {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2, 0.5rem);
    font-size: var(--text-sm, 0.875rem);
    color: var(--color-text-secondary, #888884);
    margin-bottom: var(--space-4, 1rem);
  }

  .meta-item {
    padding: var(--space-1, 0.25rem) var(--space-2, 0.5rem);
    background: var(--color-surface-alt, #1c1c1a);
    border-radius: var(--radius-sm, 4px);
  }

  .difficulty {
    font-weight: var(--font-weight-medium, 500);
    text-transform: capitalize;
  }

  .difficulty-beginner {
    color: var(--color-success, #22c55e);
  }
  .difficulty-intermediate {
    color: var(--color-warning, #f59e0b);
  }
  .difficulty-advanced {
    color: var(--color-error, #dc2626);
  }

  .curriculum h2 {
    font-size: var(--text-xl, 1.5rem);
    margin-bottom: var(--space-4, 1rem);
    color: var(--color-text, #d8d5cf);
  }
</style>
