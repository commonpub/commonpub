<script lang="ts">
  import ContentCard from '$lib/components/ContentCard.svelte';
  import MagazineHero from '$lib/components/MagazineHero.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>Snaplify</title>
  <meta name="description" content="Discover projects, articles, and guides from the maker community." />
</svelte:head>

<div class="page">
  {#if data.featured}
    <MagazineHero item={data.featured} />
  {/if}

  {#if data.recentArticles.length > 0}
    <div class="sec-head">
      <h2>recent articles</h2>
      <span class="sec-sub">editorial &middot; requires editor role</span>
    </div>
    <div class="grid-3" style="margin-bottom: 32px;">
      {#each data.recentArticles as item (item.id)}
        <ContentCard {item} />
      {/each}
    </div>
  {/if}

  {#if data.recentBlog.length > 0}
    <div class="sec-head">
      <h2>community posts</h2>
      <span class="sec-sub">blog &middot; any authenticated user</span>
    </div>
    <div class="community-posts">
      {#each data.recentBlog as item (item.id)}
        <a href="/blog/{item.slug}" class="community-post">
          <div class="av">{(item.author.displayName ?? item.author.username ?? '?')[0].toUpperCase()}</div>
          <div>
            <div class="post-title">{item.title}</div>
            <div class="post-meta">
              {item.author.displayName ?? item.author.username}
              &middot;
              {item.publishedAt ? new Date(item.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Draft'}
              {#if item.likeCount > 0}
                &middot; &#x2665; {item.likeCount}
              {/if}
            </div>
          </div>
        </a>
      {/each}
    </div>
  {/if}

  {#if data.recentProjects.length > 0}
    <div class="sec-head" style="margin-top: 32px;">
      <h2>recent projects</h2>
      <span class="sec-sub"><a href="/projects" class="sec-link">view all &rarr;</a></span>
    </div>
    <div class="grid-3">
      {#each data.recentProjects as item (item.id)}
        <ContentCard {item} />
      {/each}
    </div>
  {/if}
</div>

<style>
  .community-posts {
    display: flex;
    flex-direction: column;
  }

  .community-post {
    display: flex;
    gap: 12px;
    padding: 14px 0;
    border-bottom: 1px solid var(--color-border, #272725);
    cursor: pointer;
    text-decoration: none;
    color: inherit;
  }

  .community-post:hover {
    background: var(--color-surface-alt, #141413);
  }

  .post-title {
    font-size: 13px;
    font-weight: var(--font-weight-semibold, 600);
    margin-bottom: 4px;
    color: var(--color-text);
  }

  .post-meta {
    font-size: 11px;
    font-family: var(--font-mono, monospace);
    color: var(--color-text-muted, #444440);
  }

  .sec-link {
    color: var(--color-accent, #5b9cf6);
    text-decoration: none;
    font-size: 11px;
  }

  .sec-link:hover {
    text-decoration: underline;
  }
</style>
