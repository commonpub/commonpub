<script lang="ts">
  import SeoHead from '$lib/components/SeoHead.svelte';
  import LikeButton from '$lib/components/LikeButton.svelte';
  import BookmarkButton from '$lib/components/BookmarkButton.svelte';
  import CommentSection from '$lib/components/CommentSection.svelte';
  import ExplainerViewer from '$lib/components/explainer/ExplainerViewer.svelte';
  import type { ExplainerSection } from '@snaplify/explainer';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  const item = data.item;
  const sections = (item.sections ?? []) as ExplainerSection[];
  const storageKey = `explainer-progress-${item.slug}`;
</script>

<SeoHead
  title={item.title}
  description={item.seoDescription ?? item.description ?? ''}
  type="explainer"
  url="/explainers/{item.slug}"
  image={item.coverImageUrl}
  authorName={item.author.displayName ?? item.author.username}
  publishedAt={item.publishedAt?.toString()}
  updatedAt={item.updatedAt.toString()}
/>

{#if sections.length > 0}
  <ExplainerViewer {sections} title={item.title} {storageKey} />
{:else}
  <div class="empty-explainer">
    <h1>{item.title}</h1>
    <p>This explainer has no sections yet.</p>
  </div>
{/if}

<div class="explainer-social">
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
</div>

<style>
  .empty-explainer {
    max-width: var(--layout-content-width, 768px);
    margin: 0 auto;
    padding: var(--space-12, 3rem);
    text-align: center;
  }

  .empty-explainer h1 {
    font-size: var(--text-3xl, 2.25rem);
    color: var(--color-text, #d8d5cf);
    margin-bottom: var(--space-4, 1rem);
  }

  .empty-explainer p {
    color: var(--color-text-secondary, #888884);
  }

  .explainer-social {
    max-width: var(--layout-content-width, 768px);
    margin: 0 auto;
    padding: 0 var(--space-12, 3rem);
  }

  .content-actions {
    display: flex;
    gap: var(--space-4, 1rem);
    padding: var(--space-4, 1rem) 0;
    border-top: 1px solid var(--color-border, #272725);
    border-bottom: 1px solid var(--color-border, #272725);
    margin: var(--space-6, 2rem) 0;
  }
</style>
