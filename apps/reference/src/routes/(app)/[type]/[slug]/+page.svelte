<script lang="ts">
  import SeoHead from '$lib/components/SeoHead.svelte';
  import ContentMeta from '$lib/components/ContentMeta.svelte';
  import LikeButton from '$lib/components/LikeButton.svelte';
  import BookmarkButton from '$lib/components/BookmarkButton.svelte';
  import CommentSection from '$lib/components/CommentSection.svelte';
  import { typeToUrlSegment } from '$lib/utils/content-helpers';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  const item = data.item;
  const canonicalPath = `/${typeToUrlSegment(item.type)}/${item.slug}`;
</script>

<SeoHead
  title={item.title}
  description={item.seoDescription ?? item.description ?? ''}
  type={item.type}
  url={canonicalPath}
  image={item.coverImageUrl}
  authorName={item.author.displayName ?? item.author.username}
  publishedAt={item.publishedAt?.toString()}
  updatedAt={item.updatedAt.toString()}
/>

<article class="content-detail">
  {#if item.coverImageUrl}
    <img src={item.coverImageUrl} alt="" class="content-cover" />
  {/if}

  <header class="content-header">
    <h1>{item.title}</h1>
    {#if item.subtitle}
      <p class="content-subtitle">{item.subtitle}</p>
    {/if}
    <ContentMeta {item} />
  </header>

  <div class="content-body">
    {#if Array.isArray(item.content)}
      {#each item.content as block}
        {@const [type, attrs] = block as [string, Record<string, unknown>]}
        {#if type === 'text'}
          {@html attrs.html}
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
            {@html attrs.html}
            {#if attrs.attribution}<cite>{attrs.attribution}</cite>{/if}
          </blockquote>
        {:else if type === 'callout'}
          <div class="callout callout-{attrs.variant}">
            {@html attrs.html}
          </div>
        {/if}
      {/each}
    {/if}
  </div>

  {#if item.tags.length > 0}
    <div class="content-tags">
      {#each item.tags as tag}
        <span class="tag">{tag.name}</span>
      {/each}
    </div>
  {/if}

  <div class="content-actions">
    <LikeButton
      targetType={item.type}
      targetId={item.id}
      count={item.likeCount}
      liked={item.isLiked ?? false}
    />
    <BookmarkButton
      targetType={item.type}
      targetId={item.id}
      bookmarked={item.isBookmarked ?? false}
    />
  </div>

  <CommentSection targetType={item.type} targetId={item.id} />
</article>

<style>
  .content-detail {
    max-width: var(--layout-content-width, 768px);
    margin: 0 auto;
  }

  .content-cover {
    width: 100%;
    border-radius: var(--radius-md, 6px);
    margin-bottom: var(--space-lg, 2rem);
    aspect-ratio: 16 / 9;
    object-fit: cover;
  }

  .content-header {
    margin-bottom: var(--space-xl, 3rem);
  }

  .content-header h1 {
    font-size: var(--font-size-3xl, 2.25rem);
    line-height: 1.2;
    color: var(--color-text, #1a1a1a);
    margin: 0 0 var(--space-sm, 0.5rem);
  }

  .content-subtitle {
    font-size: var(--font-size-lg, 1.25rem);
    color: var(--color-text-secondary, #666);
    margin: 0 0 var(--space-md, 1rem);
  }

  .content-body {
    font-size: var(--font-size-md, 1rem);
    line-height: 1.7;
    color: var(--color-text, #1a1a1a);
  }

  .content-body :global(h2) {
    margin-top: var(--space-xl, 3rem);
    font-size: var(--font-size-xl, 1.5rem);
  }

  .content-body :global(h3) {
    margin-top: var(--space-lg, 2rem);
    font-size: var(--font-size-lg, 1.25rem);
  }

  .content-body :global(pre) {
    background: var(--color-surface-secondary, #f5f5f5);
    padding: var(--space-md, 1rem);
    border-radius: var(--radius-sm, 4px);
    overflow-x: auto;
  }

  .content-body :global(img) {
    max-width: 100%;
    border-radius: var(--radius-sm, 4px);
  }

  .content-body :global(blockquote) {
    border-left: 3px solid var(--color-primary, #2563eb);
    padding-left: var(--space-md, 1rem);
    margin-left: 0;
    color: var(--color-text-secondary, #666);
  }

  .callout {
    padding: var(--space-md, 1rem);
    border-radius: var(--radius-sm, 4px);
    margin: var(--space-md, 1rem) 0;
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

  .content-tags {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-xs, 0.25rem);
    margin: var(--space-xl, 3rem) 0 var(--space-lg, 2rem);
  }

  .tag {
    font-size: var(--font-size-sm, 0.875rem);
    padding: var(--space-xs, 0.25rem) var(--space-sm, 0.5rem);
    background: var(--color-surface-secondary, #f5f5f5);
    border-radius: var(--radius-sm, 4px);
    color: var(--color-text-secondary, #666);
  }

  .content-actions {
    display: flex;
    gap: var(--space-md, 1rem);
    padding: var(--space-md, 1rem) 0;
    border-top: 1px solid var(--color-border, #e5e5e5);
    border-bottom: 1px solid var(--color-border, #e5e5e5);
    margin: var(--space-lg, 2rem) 0;
  }
</style>
