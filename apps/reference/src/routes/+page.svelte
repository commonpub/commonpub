<script lang="ts">
  import ContentCard from '$lib/components/ContentCard.svelte';
  import { Badge } from '@snaplify/ui';
  import { typeToUrlSegment } from '$lib/utils/content-helpers';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>Snaplify</title>
  <meta
    name="description"
    content="Discover projects, articles, and guides from the maker community."
  />
</svelte:head>

<div class="home">
  {#if data.featured}
    <section class="hero-section">
      <a href="/{typeToUrlSegment(data.featured.type)}/{data.featured.slug}" class="hero-card">
        {#if data.featured.coverImageUrl}
          <img src={data.featured.coverImageUrl} alt="" class="hero-image" loading="eager" />
        {:else}
          <div class="hero-image-placeholder"></div>
        {/if}
        <div class="hero-content">
          <div class="hero-meta">
            <Badge variant="primary" size="sm" text="Featured" />
            <span class="hero-type">{data.featured.type}</span>
          </div>
          <h1 class="hero-title">{data.featured.title}</h1>
          {#if data.featured.description}
            <p class="hero-description">{data.featured.description}</p>
          {/if}
          <div class="hero-author">
            {#if data.featured.author.avatarUrl}
              <img src={data.featured.author.avatarUrl} alt="" class="hero-avatar" width="28" height="28" />
            {/if}
            <span>{data.featured.author.displayName ?? data.featured.author.username}</span>
          </div>
        </div>
      </a>
    </section>
  {/if}

  {#if data.recentProjects.length > 0}
    <section class="content-section">
      <div class="section-header">
        <h2 class="section-title">Recent Projects</h2>
        <a href="/projects" class="section-link">View all</a>
      </div>
      <div class="content-grid">
        {#each data.recentProjects as item (item.id)}
          <ContentCard {item} />
        {/each}
      </div>
    </section>
  {/if}

  {#if data.recentArticles.length > 0}
    <section class="content-section">
      <div class="section-header">
        <h2 class="section-title">Articles</h2>
        <a href="/articles" class="section-link">View all</a>
      </div>
      <div class="content-grid content-grid-4">
        {#each data.recentArticles as item (item.id)}
          <ContentCard {item} />
        {/each}
      </div>
    </section>
  {/if}

  {#if data.recentBlog.length > 0}
    <section class="content-section">
      <div class="section-header">
        <h2 class="section-title">Blog</h2>
        <a href="/blog" class="section-link">View all</a>
      </div>
      <div class="content-grid content-grid-4">
        {#each data.recentBlog as item (item.id)}
          <ContentCard {item} />
        {/each}
      </div>
    </section>
  {/if}
</div>

<style>
  .home {
    display: flex;
    flex-direction: column;
    gap: var(--space-12, 3rem);
  }

  /* Hero */
  .hero-section {
    margin-bottom: var(--space-4, 1rem);
  }

  .hero-card {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0;
    text-decoration: none;
    color: inherit;
    border: 1px solid var(--color-border, #272725);
    border-radius: var(--radius-lg, 0.5rem);
    overflow: hidden;
    background: var(--color-surface-alt, #141413);
    transition: border-color var(--transition-default, 0.15s ease);
  }

  .hero-card:hover {
    border-color: var(--color-border-strong, #333330);
  }

  .hero-image {
    width: 100%;
    height: 100%;
    min-height: 280px;
    object-fit: cover;
  }

  .hero-image-placeholder {
    width: 100%;
    min-height: 280px;
    background: var(--color-surface-raised, #1c1c1a);
  }

  .hero-content {
    padding: var(--space-8, 2rem);
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: var(--space-3, 0.75rem);
  }

  .hero-meta {
    display: flex;
    align-items: center;
    gap: var(--space-2, 0.5rem);
  }

  .hero-type {
    font-family: var(--font-mono, monospace);
    font-size: var(--text-xs, 0.6875rem);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--color-text-secondary, #888884);
  }

  .hero-title {
    font-size: var(--text-3xl, 1.75rem);
    font-weight: var(--font-weight-bold, 700);
    color: var(--color-text, #d8d5cf);
    margin: 0;
    line-height: var(--leading-tight, 1.1);
  }

  .hero-description {
    font-size: var(--text-base, 0.875rem);
    color: var(--color-text-secondary, #888884);
    margin: 0;
    line-height: var(--leading-normal, 1.6);
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .hero-author {
    display: flex;
    align-items: center;
    gap: var(--space-2, 0.5rem);
    font-size: var(--text-sm, 0.75rem);
    color: var(--color-text-secondary, #888884);
  }

  .hero-avatar {
    border-radius: var(--radius-full, 50%);
    object-fit: cover;
  }

  /* Sections */
  .content-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-4, 1rem);
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }

  .section-title {
    font-size: var(--text-lg, 1.125rem);
    font-weight: var(--font-weight-semibold, 600);
    color: var(--color-text, #d8d5cf);
    margin: 0;
  }

  .section-link {
    font-family: var(--font-mono, monospace);
    font-size: var(--text-xs, 0.6875rem);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-primary, #5b9cf6);
    text-decoration: none;
  }

  .section-link:hover {
    text-decoration: underline;
  }

  /* Grids */
  .content-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-4, 1rem);
  }

  .content-grid-4 {
    grid-template-columns: repeat(4, 1fr);
  }

  @media (max-width: 1024px) {
    .hero-card {
      grid-template-columns: 1fr;
    }

    .content-grid {
      grid-template-columns: repeat(2, 1fr);
    }

    .content-grid-4 {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (max-width: 640px) {
    .content-grid,
    .content-grid-4 {
      grid-template-columns: 1fr;
    }
  }
</style>
