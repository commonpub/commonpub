<script lang="ts">
  import SeoHead from '$lib/components/SeoHead.svelte';
  import CurriculumAccordion from '$lib/components/learning/CurriculumAccordion.svelte';
  import EnrollButton from '$lib/components/learning/EnrollButton.svelte';
  import ProgressBar from '$lib/components/learning/ProgressBar.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  const path = data.path;

  const totalLessons = path.modules.reduce((sum: number, m: { lessons: unknown[] }) => sum + m.lessons.length, 0);
</script>

<SeoHead
  title={path.title}
  description={path.description ?? ''}
  type="Course"
  url={`/learn/${path.slug}`}
  image={path.coverImageUrl}
  authorName={path.author.displayName ?? path.author.username}
/>

<div class="page">
  <!-- Hero -->
  {#if path.coverImageUrl}
    <div class="lp-hero">
      <img src={path.coverImageUrl} alt="" class="lp-hero-img" />
      <div class="lp-hero-overlay"></div>
    </div>
  {/if}

  <div class="grid-sb">
    <!-- Main content -->
    <div class="lp-main">
      <header class="lp-header">
        <div class="tag-row">
          <span class="tag tag-accent">learning path</span>
          {#if path.difficulty}
            <span class="tag"
              class:tag-green={path.difficulty === 'beginner'}
              class:tag-yellow={path.difficulty === 'intermediate'}
              class:tag-red={path.difficulty === 'advanced'}
            >{path.difficulty}</span>
          {/if}
        </div>

        <h1 class="lp-title">{path.title}</h1>

        {#if path.description}
          <p class="lp-description">{path.description}</p>
        {/if}

        <div class="lp-meta">
          <span class="lp-meta-item">By {path.author.displayName ?? path.author.username}</span>
          {#if path.estimatedHours}
            <span class="lp-meta-item">{path.estimatedHours}h estimated</span>
          {/if}
          <span class="lp-meta-item">{totalLessons} lessons</span>
          <span class="lp-meta-item">{path.enrollmentCount} enrolled</span>
        </div>
      </header>

      {#if path.isEnrolled && path.enrollment}
        <div class="lp-progress-section">
          <ProgressBar value={Number(path.enrollment.progress)} label="Path progress" />
        </div>
      {/if}

      <section class="lp-curriculum" aria-label="Curriculum">
        <div class="sec-head">
          <h2>Curriculum</h2>
          <span class="sec-sub">{path.modules.length} modules</span>
        </div>
        <CurriculumAccordion modules={path.modules} pathSlug={path.slug} />
      </section>
    </div>

    <!-- Sidebar -->
    <aside class="lp-sidebar">
      <div class="sb-card">
        <span class="sb-title">Enroll</span>
        <div class="lp-enroll-body">
          <EnrollButton
            isEnrolled={path.isEnrolled}
            progress={path.enrollment ? Number(path.enrollment.progress) : 0}
            pathSlug={path.slug}
          />
        </div>
      </div>

      <div class="sb-card">
        <span class="sb-title">Details</span>
        <div class="lp-detail-rows">
          {#if path.difficulty}
            <div class="lp-detail-row">
              <span class="lp-detail-key">Difficulty</span>
              <span class="lp-detail-val lp-diff-{path.difficulty}">{path.difficulty}</span>
            </div>
          {/if}
          {#if path.estimatedHours}
            <div class="lp-detail-row">
              <span class="lp-detail-key">Duration</span>
              <span class="lp-detail-val">{path.estimatedHours}h</span>
            </div>
          {/if}
          <div class="lp-detail-row">
            <span class="lp-detail-key">Modules</span>
            <span class="lp-detail-val">{path.modules.length}</span>
          </div>
          <div class="lp-detail-row">
            <span class="lp-detail-key">Lessons</span>
            <span class="lp-detail-val">{totalLessons}</span>
          </div>
          <div class="lp-detail-row">
            <span class="lp-detail-key">Enrolled</span>
            <span class="lp-detail-val">{path.enrollmentCount}</span>
          </div>
        </div>
      </div>

      <div class="sb-card">
        <span class="sb-title">Author</span>
        <div class="lp-author-row">
          <div class="av av-sm">{(path.author.displayName ?? path.author.username).charAt(0).toUpperCase()}</div>
          <a href="/u/{path.author.username}" class="lp-author-name">{path.author.displayName ?? path.author.username}</a>
        </div>
      </div>
    </aside>
  </div>
</div>

<style>
  .lp-hero {
    position: relative;
    width: 100%;
    aspect-ratio: 21 / 6;
    overflow: hidden;
    border-radius: var(--radius-sm, 4px);
    margin-bottom: var(--space-6, 1.5rem);
  }

  .lp-hero-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .lp-hero-overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(to top, var(--color-bg, #0c0c0b) 0%, transparent 60%);
  }

  .lp-main {
    display: flex;
    flex-direction: column;
    gap: var(--space-8, 2rem);
  }

  .lp-header {
    display: flex;
    flex-direction: column;
    gap: var(--space-3, 0.75rem);
  }

  .lp-title {
    font-size: var(--text-3xl, 2.25rem);
    font-weight: var(--font-weight-bold, 700);
    color: var(--color-text, #d8d5cf);
    line-height: 1.2;
    margin: 0;
  }

  .lp-description {
    font-size: var(--text-lg, 1.25rem);
    color: var(--color-text-secondary, #888884);
    line-height: 1.6;
    margin: 0;
  }

  .lp-meta {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3, 0.75rem);
  }

  .lp-meta-item {
    font-family: var(--font-mono, monospace);
    font-size: var(--text-xs, 0.6875rem);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-muted, #444440);
  }

  .lp-progress-section {
    padding: var(--space-4, 1rem);
    border: 1px solid var(--color-border, #272725);
    border-radius: var(--radius-sm, 4px);
    background: var(--color-surface-alt, #141413);
  }

  .lp-curriculum :global(h2) {
    font-size: var(--text-lg, 1.125rem);
    color: var(--color-text, #d8d5cf);
    margin: 0;
  }

  /* Sidebar */
  .lp-sidebar {
    display: flex;
    flex-direction: column;
    gap: var(--space-4, 1rem);
  }

  .lp-enroll-body {
    padding-top: var(--space-2, 0.5rem);
  }

  .lp-detail-rows {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .lp-detail-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-2, 0.5rem) 0;
    border-bottom: 1px solid var(--color-border, #272725);
  }

  .lp-detail-row:last-child {
    border-bottom: none;
  }

  .lp-detail-key {
    font-family: var(--font-mono, monospace);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--color-text-muted, #444440);
  }

  .lp-detail-val {
    font-size: var(--text-sm, 0.75rem);
    color: var(--color-text-secondary, #888884);
    text-transform: capitalize;
  }

  .lp-diff-beginner { color: var(--color-success, #4ade80); }
  .lp-diff-intermediate { color: var(--color-warning, #fbbf24); }
  .lp-diff-advanced { color: var(--color-error, #f87171); }

  .lp-author-row {
    display: flex;
    align-items: center;
    gap: var(--space-2, 0.5rem);
    padding-top: var(--space-2, 0.5rem);
  }

  .lp-author-name {
    font-size: var(--text-sm, 0.75rem);
    color: var(--color-text, #d8d5cf);
    text-decoration: none;
  }

  .lp-author-name:hover {
    color: var(--color-accent, #5b9cf6);
  }

  @media (max-width: 768px) {
    .lp-hero {
      aspect-ratio: 16 / 9;
    }
  }
</style>
