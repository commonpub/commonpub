<script lang="ts">
  import ContentCard from '$lib/components/ContentCard.svelte';
  import MagazineHero from '$lib/components/MagazineHero.svelte';
  import { typeToUrlSegment } from '$lib/utils/content-helpers';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>Magazine — Snaplify</title>
  <meta name="description" content="Articles and blog posts from the maker community." />
</svelte:head>

<div class="page">
  {#if data.featured}
    <MagazineHero item={data.featured} />
  {/if}

  <!-- Recent Articles -->
  <section>
    <div class="sec-head">
      <h2>Recent Articles</h2>
      <a href="/articles" class="sec-sub">view all</a>
    </div>
    {#if data.articles.length === 0}
      <p class="empty-hint">No articles published yet.</p>
    {:else}
      <div class="grid-3">
        {#each data.articles as item (item.id)}
          <ContentCard {item} />
        {/each}
      </div>
    {/if}
  </section>

  <hr class="divider" />

  <!-- Community Posts -->
  <section>
    <div class="sec-head">
      <h2>Community Posts</h2>
      <a href="/blog" class="sec-sub">view all</a>
    </div>
    {#if data.blogPosts.length === 0}
      <p class="empty-hint">No community posts yet.</p>
    {:else}
      <div class="blog-list">
        {#each data.blogPosts as post (post.id)}
          <a href="/{typeToUrlSegment(post.type)}/{post.slug}" class="blog-row">
            <div class="blog-row-body">
              <h3 class="blog-row-title">{post.title}</h3>
              {#if post.description}
                <p class="blog-row-desc">{post.description}</p>
              {/if}
              <div class="blog-row-meta">
                <span class="av av-sm">{(post.author.displayName ?? post.author.username ?? '?')[0].toUpperCase()}</span>
                <span>{post.author.displayName ?? post.author.username}</span>
                {#if post.publishedAt}
                  <span class="blog-row-date">
                    {new Date(post.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                {/if}
              </div>
            </div>
          </a>
        {/each}
      </div>
    {/if}
  </section>
</div>

<style>
  .empty-hint {
    text-align: center;
    padding: var(--space-8, 2rem);
    color: var(--color-text-secondary, #888884);
    font-size: var(--text-sm, 0.75rem);
  }

  .blog-list {
    display: flex;
    flex-direction: column;
  }

  .blog-row {
    display: flex;
    gap: 12px;
    padding: 14px 0;
    border-bottom: 1px solid var(--color-border, #272725);
    text-decoration: none;
    color: inherit;
    transition: background var(--transition-fast, 0.1s ease);
  }

  .blog-row:last-child { border-bottom: none; }

  .blog-row:hover { background: var(--color-surface-alt, #141413); }

  .blog-row-body { flex: 1; }

  .blog-row-title {
    font-size: 13px;
    font-weight: var(--font-weight-semibold, 600);
    color: var(--color-text, #d8d5cf);
    margin: 0 0 4px;
  }

  .blog-row-desc {
    font-size: 12px;
    color: var(--color-text-secondary, #888884);
    margin: 0 0 8px;
    line-height: 1.55;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .blog-row-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    color: var(--color-text-secondary, #888884);
  }

  .blog-row-date {
    margin-left: auto;
    font-size: 10px;
    font-family: var(--font-mono, monospace);
    color: var(--color-text-muted, #444440);
  }
</style>
