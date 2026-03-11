<script lang="ts">
  import ExplainerQuiz from '$lib/components/explainer/ExplainerQuiz.svelte';
  import { sanitizeHtml } from '$lib/utils/sanitize';
  import type { QuizQuestion } from '@snaplify/explainer';

  let {
    lesson,
  }: {
    lesson: {
      type: string;
      content: unknown;
    };
  } = $props();

  const content = lesson.content as Record<string, unknown> | null;
</script>

<div class="lesson-viewer">
  {#if lesson.type === 'article' && content}
    {@const blocks =
      (content as { blocks?: Array<[string, Record<string, unknown>]> }).blocks ?? []}
    {#each blocks as [type, attrs]}
      {#if type === 'text'}
        {@html sanitizeHtml(String(attrs.html ?? ''))}
      {:else if type === 'heading'}
        {#if attrs.level === 1}<h1>{attrs.text}</h1>
        {:else if attrs.level === 2}<h2>{attrs.text}</h2>
        {:else if attrs.level === 3}<h3>{attrs.text}</h3>
        {:else}<h4>{attrs.text}</h4>
        {/if}
      {:else if type === 'code'}
        <pre class="code-block"><code class="language-{attrs.language}">{attrs.code}</code></pre>
      {:else if type === 'image'}
        <figure>
          <img src={attrs.src as string} alt={attrs.alt as string} loading="lazy" />
          {#if attrs.caption}<figcaption>{attrs.caption}</figcaption>{/if}
        </figure>
      {/if}
    {/each}
  {:else if lesson.type === 'video' && content}
    {@const videoUrl = (content as { url?: string }).url ?? ''}
    <div class="video-wrapper">
      <iframe
        src={videoUrl}
        title="Lesson video"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen
      ></iframe>
    </div>
  {:else if lesson.type === 'quiz' && content}
    {@const quizContent = content as { questions: QuizQuestion[]; passingScore: number }}
    <ExplainerQuiz
      questions={quizContent.questions}
      passingScore={quizContent.passingScore}
      isGate={false}
    />
  {:else if lesson.type === 'project' && content}
    {@const slug = (content as { slug?: string }).slug ?? ''}
    <div class="link-lesson">
      <p>This lesson is a project exercise.</p>
      <a href="/projects/{slug}" class="lesson-cta">Open Project</a>
    </div>
  {:else if lesson.type === 'explainer' && content}
    {@const slug = (content as { slug?: string }).slug ?? ''}
    <div class="link-lesson">
      <p>This lesson is an interactive explainer.</p>
      <a href="/explainers/{slug}" class="lesson-cta">Open Explainer</a>
    </div>
  {:else}
    <p class="no-content">No content available.</p>
  {/if}
</div>

<style>
  .lesson-viewer :global(pre) {
    background: var(--color-surface-alt, #1c1c1a);
    padding: var(--space-4, 1rem);
    border-radius: var(--radius-sm, 4px);
    overflow-x: auto;
  }

  .lesson-viewer :global(img) {
    max-width: 100%;
    border-radius: var(--radius-sm, 4px);
  }

  .video-wrapper {
    position: relative;
    padding-bottom: 56.25%;
    height: 0;
    overflow: hidden;
    border-radius: var(--radius-md, 6px);
  }

  .video-wrapper iframe {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    border: none;
  }

  .link-lesson {
    text-align: center;
    padding: var(--space-12, 3rem);
    border: 1px solid var(--color-border, #272725);
    border-radius: var(--radius-md, 6px);
    background: var(--color-surface-alt, #1c1c1a);
  }

  .lesson-cta {
    display: inline-block;
    margin-top: var(--space-4, 1rem);
    padding: var(--space-2, 0.5rem) var(--space-6, 2rem);
    background: var(--color-primary, #2563eb);
    color: var(--color-on-primary, #ffffff);
    border-radius: var(--radius-md, 6px);
    text-decoration: none;
    font-weight: var(--font-weight-medium, 500);
  }

  .no-content {
    color: var(--color-text-secondary, #888884);
    font-style: italic;
  }
</style>
