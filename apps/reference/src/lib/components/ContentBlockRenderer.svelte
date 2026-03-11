<script lang="ts">
  import type { BlockTuple } from '@snaplify/editor';

  let { blocks = [] }: { blocks: BlockTuple[] } = $props();
</script>

<div class="content-blocks">
  {#each blocks as [type, attrs]}
    {#if type === 'text'}
      <div class="prose-block">{@html (attrs.html as string) ?? ''}</div>
    {:else if type === 'heading'}
      {#if (attrs.level as number) === 1}
        <h1 class="block-heading">{@html (attrs.html as string) ?? (attrs.text as string) ?? ''}</h1>
      {:else if (attrs.level as number) === 3}
        <h3 class="block-heading block-h3">{@html (attrs.html as string) ?? (attrs.text as string) ?? ''}</h3>
      {:else}
        <h2 class="block-heading block-h2">{@html (attrs.html as string) ?? (attrs.text as string) ?? ''}</h2>
      {/if}
    {:else if type === 'step'}
      <div class="step-block">
        <div class="step-num">{attrs.number ?? ''}</div>
        <div class="step-content">
          <div class="step-title">{attrs.title ?? ''}</div>
          <div class="step-body">{@html (attrs.html as string) ?? ''}</div>
          {#if attrs.imageUrl}
            <img src={attrs.imageUrl as string} alt={attrs.imageAlt as string ?? ''} class="step-img-real" loading="lazy" />
          {/if}
        </div>
      </div>
    {:else if type === 'code'}
      <div class="code-block">
        <div class="code-hdr">
          <span class="code-lang">{attrs.language ?? 'text'}</span>
        </div>
        <div class="code-body"><pre>{attrs.code ?? ''}</pre></div>
      </div>
    {:else if type === 'image'}
      <figure class="block-figure">
        <img src={attrs.src as string ?? ''} alt={attrs.alt as string ?? ''} loading="lazy" class="block-img" />
        {#if attrs.caption}
          <figcaption class="block-caption">{attrs.caption}</figcaption>
        {/if}
      </figure>
    {:else if type === 'quote' || type === 'blockquote'}
      <blockquote class="block-quote">
        <div>{@html (attrs.html as string) ?? (attrs.text as string) ?? ''}</div>
        {#if attrs.attribution}
          <cite class="block-cite">&mdash; {attrs.attribution}</cite>
        {/if}
      </blockquote>
    {:else if type === 'callout'}
      <div class="callout callout-{attrs.variant ?? 'note'}">
        <span class="callout-icon">{(attrs.variant as string) === 'warn' || (attrs.variant as string) === 'warning' ? '!' : '#'}</span>
        <div>{@html (attrs.html as string) ?? (attrs.text as string) ?? ''}</div>
      </div>
    {:else if type === 'divider'}
      <hr class="divider" />
    {/if}
  {/each}
</div>

<style>
  .content-blocks {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .prose-block {
    font-size: 14px;
    line-height: 1.8;
    color: var(--color-text-secondary, #888884);
    margin-bottom: 14px;
  }

  .prose-block :global(a) {
    color: var(--color-accent, #5b9cf6);
  }

  .block-heading {
    color: var(--color-text);
    line-height: 1.3;
  }

  .block-heading:not(:first-child) {
    margin-top: 28px;
  }

  .block-h2 {
    font-size: 18px;
    font-weight: var(--font-weight-bold, 700);
    margin-bottom: 10px;
  }

  .block-h3 {
    font-size: 14px;
    font-weight: var(--font-weight-semibold, 600);
    margin-bottom: 8px;
  }

  .block-figure {
    margin: 16px 0;
  }

  .block-img {
    width: 100%;
    border: 1px solid var(--color-border, #272725);
    border-radius: var(--radius-md, 0.25rem);
  }

  .block-caption {
    font-size: 11px;
    font-family: var(--font-mono, monospace);
    color: var(--color-text-muted, #444440);
    margin-top: 6px;
  }

  .block-quote {
    border-left: 3px solid var(--color-accent, #5b9cf6);
    padding-left: 16px;
    color: var(--color-text-secondary);
    font-style: italic;
    margin: 18px 0;
    font-size: 14px;
    line-height: 1.7;
  }

  .block-cite {
    display: block;
    font-size: 12px;
    font-style: normal;
    color: var(--color-text-muted);
    margin-top: 8px;
    font-family: var(--font-mono, monospace);
  }

  .step-img-real {
    width: 100%;
    border: 1px solid var(--color-border, #272725);
    border-radius: var(--radius-md, 0.25rem);
    margin-top: 10px;
  }
</style>
