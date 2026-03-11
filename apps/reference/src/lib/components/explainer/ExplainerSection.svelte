<script lang="ts">
  import type { ExplainerSection as ExplainerSectionType } from '@snaplify/explainer';
  import ExplainerQuiz from './ExplainerQuiz.svelte';
  import ExplainerCheckpoint from './ExplainerCheckpoint.svelte';
  import { sanitizeHtml } from '$lib/utils/sanitize';

  let {
    section,
    locked = false,
    completed = false,
    onsectioncomplete,
  }: {
    section: ExplainerSectionType;
    locked: boolean;
    completed: boolean;
    onsectioncomplete?: (sectionId: string, quizScore?: number) => void;
  } = $props();

  function handleQuizComplete(score: number, passed: boolean) {
    if (passed) {
      onsectioncomplete?.(section.id, score);
    }
  }

  function handleCheckpointComplete() {
    onsectioncomplete?.(section.id);
  }
</script>

<section
  id={section.anchor}
  class="explainer-section"
  class:explainer-section--locked={locked}
  class:explainer-section--completed={completed}
  data-section-id={section.id}
  data-section-type={section.type}
>
  <h2 class="explainer-section__title">{section.title}</h2>

  {#if locked}
    <div class="explainer-section__locked" role="alert">
      <p>This section is locked. Complete the required sections above to unlock.</p>
    </div>
  {:else}
    <div class="explainer-section__content">
      {#each section.content as block}
        {@const [type, attrs] = block as [string, Record<string, unknown>]}
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
        {:else if type === 'quote'}
          <blockquote>
            {@html sanitizeHtml(String(attrs.html ?? ''))}
            {#if attrs.attribution}<cite>{attrs.attribution}</cite>{/if}
          </blockquote>
        {:else if type === 'callout'}
          <div class="callout callout-{attrs.variant}">
            {@html sanitizeHtml(String(attrs.html ?? ''))}
          </div>
        {/if}
      {/each}
    </div>

    {#if section.type === 'quiz'}
      <ExplainerQuiz
        questions={section.questions}
        passingScore={section.passingScore}
        isGate={section.isGate}
        oncomplete={handleQuizComplete}
      />
    {:else if section.type === 'checkpoint'}
      <ExplainerCheckpoint locked={false} oncomplete={handleCheckpointComplete} />
    {/if}
  {/if}
</section>

<style>
  .explainer-section {
    margin-bottom: var(--space-12, 3rem);
    padding-bottom: var(--space-12, 3rem);
    border-bottom: 1px solid var(--color-border, #272725);
    scroll-margin-top: var(--space-6, 2rem);
  }

  .explainer-section__title {
    font-size: var(--text-xl, 1.5rem);
    color: var(--color-text, #d8d5cf);
    margin-bottom: var(--space-4, 1rem);
  }

  .explainer-section--locked {
    opacity: 0.5;
  }

  .explainer-section__locked {
    padding: var(--space-6, 2rem);
    text-align: center;
    color: var(--color-text-secondary, #888884);
    border: 2px dashed var(--color-border, #272725);
    border-radius: var(--radius-md, 6px);
  }

  .explainer-section__content {
    font-size: var(--text-md, 1rem);
    line-height: 1.7;
    color: var(--color-text, #d8d5cf);
  }

  .explainer-section__content :global(h2) {
    margin-top: var(--space-12, 3rem);
    font-size: var(--text-xl, 1.5rem);
  }

  .explainer-section__content :global(h3) {
    margin-top: var(--space-6, 2rem);
    font-size: var(--text-lg, 1.25rem);
  }

  .explainer-section__content :global(pre) {
    background: var(--color-surface-alt, #1c1c1a);
    padding: var(--space-4, 1rem);
    border-radius: var(--radius-sm, 4px);
    overflow-x: auto;
  }

  .explainer-section__content :global(img) {
    max-width: 100%;
    border-radius: var(--radius-sm, 4px);
  }

  .explainer-section__content :global(blockquote) {
    border-left: 3px solid var(--color-primary, #2563eb);
    padding-left: var(--space-4, 1rem);
    margin-left: 0;
    color: var(--color-text-secondary, #888884);
  }

  .callout {
    padding: var(--space-4, 1rem);
    border-radius: var(--radius-sm, 4px);
    margin: var(--space-4, 1rem) 0;
  }

  .callout-info {
    background: var(--color-info-bg, #eff6ff);
    border-left: 3px solid var(--color-info, #3b82f6);
  }

  .callout-warning {
    background: var(--color-warning-bg, #fffbeb);
    border-left: 3px solid var(--color-warning, #f59e0b);
  }

  .callout-success {
    background: var(--color-success-bg, #f0fdf4);
    border-left: 3px solid var(--color-success, #22c55e);
  }

  .callout-error {
    background: var(--color-error-bg, #fef2f2);
    border-left: 3px solid var(--color-error, #dc2626);
  }
</style>
