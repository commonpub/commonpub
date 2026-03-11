<script lang="ts">
  import SeoHead from '$lib/components/SeoHead.svelte';
  import LikeButton from '$lib/components/LikeButton.svelte';
  import BookmarkButton from '$lib/components/BookmarkButton.svelte';
  import CommentSection from '$lib/components/CommentSection.svelte';
  import { Badge, Avatar } from '@snaplify/ui';
  import { typeToUrlSegment } from '$lib/utils/content-helpers';
  import { sanitizeHtml } from '$lib/utils/sanitize';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  const item = data.item;
  const canonicalPath = `/${typeToUrlSegment(item.type)}/${item.slug}`;

  const difficultyDots: Record<string, number> = {
    beginner: 1,
    intermediate: 2,
    advanced: 3,
  };
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

{#if item.type === 'project'}
  <!-- PROJECT LAYOUT: content + sidebar -->
  <div class="project-layout">
    <article class="project-main">
      {#if item.coverImageUrl}
        <img src={item.coverImageUrl} alt="" class="content-cover" />
      {/if}

      <header class="content-header">
        <div class="header-meta">
          <Badge variant="primary" size="sm" text={item.type} />
          {#if item.difficulty}
            <span class="difficulty">
              {#each Array(difficultyDots[item.difficulty] ?? 1) as _}
                <span class="dot dot-filled"></span>
              {/each}
              {#each Array(3 - (difficultyDots[item.difficulty] ?? 1)) as _}
                <span class="dot"></span>
              {/each}
              <span class="difficulty-label">{item.difficulty}</span>
            </span>
          {/if}
        </div>
        <h1>{item.title}</h1>
        {#if item.subtitle}
          <p class="content-subtitle">{item.subtitle}</p>
        {/if}
        <div class="author-bar">
          <Avatar
            src={item.author.avatarUrl ?? undefined}
            alt={item.author.displayName ?? item.author.username ?? ''}
            name={item.author.displayName ?? item.author.username ?? '?'}
            size="sm"
          />
          <div class="author-info">
            <a href="/u/{item.author.username}" class="author-name">
              {item.author.displayName ?? item.author.username}
            </a>
            <span class="author-date">
              {item.publishedAt ? new Date(item.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Draft'}
            </span>
          </div>
        </div>
      </header>

      <div class="content-body">
        {#if Array.isArray(item.content)}
          {#each item.content as block, i}
            {@const [type, attrs] = block as [string, Record<string, unknown>]}
            {#if type === 'text'}
              {@html sanitizeHtml(String(attrs.html ?? ''))}
            {:else if type === 'heading'}
              {#if attrs.level === 1}<h1>{attrs.text}</h1>
              {:else if attrs.level === 2}<h2>{attrs.text}</h2>
              {:else if attrs.level === 3}<h3>{attrs.text}</h3>
              {:else}<h4>{attrs.text}</h4>
              {/if}
            {:else if type === 'step'}
              <div class="step-block">
                <div class="step-number">{i + 1}</div>
                <div class="step-content">
                  {#if attrs.title}<h3 class="step-title">{attrs.title}</h3>{/if}
                  {@html sanitizeHtml(String(attrs.html ?? ''))}
                </div>
              </div>
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
        {/if}
      </div>

      {#if item.tags.length > 0}
        <div class="content-tags">
          {#each item.tags as tag}
            <a href="/search?tag={tag.slug}" class="tag">{tag.name}</a>
          {/each}
        </div>
      {/if}

      <div class="content-actions">
        <LikeButton targetType={item.type} targetId={item.id} count={item.likeCount} liked={item.isLiked ?? false} />
        <BookmarkButton targetType={item.type} targetId={item.id} bookmarked={item.isBookmarked ?? false} />
      </div>

      <CommentSection targetType={item.type} targetId={item.id} />
    </article>

    <aside class="project-sidebar">
      <div class="sidebar-card">
        <h3 class="sidebar-card-title">Actions</h3>
        <div class="sidebar-actions">
          <LikeButton targetType={item.type} targetId={item.id} count={item.likeCount} liked={item.isLiked ?? false} />
          <BookmarkButton targetType={item.type} targetId={item.id} bookmarked={item.isBookmarked ?? false} />
        </div>
      </div>

      <div class="sidebar-card">
        <h3 class="sidebar-card-title">Details</h3>
        <dl class="sidebar-meta">
          {#if item.difficulty}
            <dt>Difficulty</dt>
            <dd>{item.difficulty}</dd>
          {/if}
          {#if item.buildTime}
            <dt>Build Time</dt>
            <dd>{item.buildTime}</dd>
          {/if}
          {#if item.estimatedCost}
            <dt>Est. Cost</dt>
            <dd>{item.estimatedCost}</dd>
          {/if}
          <dt>Views</dt>
          <dd>{item.viewCount}</dd>
          <dt>Likes</dt>
          <dd>{item.likeCount}</dd>
          {#if item.forkCount > 0}
            <dt>Forks</dt>
            <dd>{item.forkCount}</dd>
          {/if}
        </dl>
      </div>
    </aside>
  </div>

{:else if item.type === 'article'}
  <!-- ARTICLE LAYOUT: full-bleed hero, narrow prose -->
  <article class="article-layout">
    {#if item.coverImageUrl}
      <div class="article-hero">
        <img src={item.coverImageUrl} alt="" class="article-hero-image" />
      </div>
    {/if}

    <div class="article-content">
      <header class="content-header">
        <div class="header-meta">
          <Badge variant="default" size="sm" text={item.type} />
        </div>
        <h1>{item.title}</h1>
        {#if item.subtitle}
          <p class="content-subtitle">{item.subtitle}</p>
        {/if}
        <div class="author-bar">
          <Avatar
            src={item.author.avatarUrl ?? undefined}
            alt={item.author.displayName ?? item.author.username ?? ''}
            name={item.author.displayName ?? item.author.username ?? '?'}
            size="sm"
          />
          <div class="author-info">
            <a href="/u/{item.author.username}" class="author-name">{item.author.displayName ?? item.author.username}</a>
            <span class="author-date">
              {item.publishedAt ? new Date(item.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Draft'}
            </span>
          </div>
        </div>
      </header>

      <div class="content-body">
        {#if Array.isArray(item.content)}
          {#each item.content as block}
            {@const [type, attrs] = block as [string, Record<string, unknown>]}
            {#if type === 'text'}
              {@html sanitizeHtml(String(attrs.html ?? ''))}
            {:else if type === 'heading'}
              {#if attrs.level === 2}<h2>{attrs.text}</h2>
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
        {/if}
      </div>

      {#if item.tags.length > 0}
        <div class="content-tags">
          {#each item.tags as tag}
            <a href="/search?tag={tag.slug}" class="tag">{tag.name}</a>
          {/each}
        </div>
      {/if}

      <div class="content-actions">
        <LikeButton targetType={item.type} targetId={item.id} count={item.likeCount} liked={item.isLiked ?? false} />
        <BookmarkButton targetType={item.type} targetId={item.id} bookmarked={item.isBookmarked ?? false} />
      </div>

      <CommentSection targetType={item.type} targetId={item.id} />
    </div>
  </article>

{:else}
  <!-- DEFAULT LAYOUT (blog, guide, explainer fallback): narrow prose -->
  <article class="default-layout">
    {#if item.coverImageUrl}
      <img src={item.coverImageUrl} alt="" class="content-cover" />
    {/if}

    <header class="content-header">
      <div class="header-meta">
        <Badge variant="default" size="sm" text={item.type} />
      </div>
      <h1>{item.title}</h1>
      {#if item.subtitle}
        <p class="content-subtitle">{item.subtitle}</p>
      {/if}
      <div class="author-bar">
        <Avatar
          src={item.author.avatarUrl ?? undefined}
          alt={item.author.displayName ?? item.author.username ?? ''}
          name={item.author.displayName ?? item.author.username ?? '?'}
          size="sm"
        />
        <div class="author-info">
          <a href="/u/{item.author.username}" class="author-name">{item.author.displayName ?? item.author.username}</a>
          <span class="author-date">
            {item.publishedAt ? new Date(item.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Draft'}
          </span>
        </div>
      </div>
    </header>

    <div class="content-body">
      {#if Array.isArray(item.content)}
        {#each item.content as block}
          {@const [type, attrs] = block as [string, Record<string, unknown>]}
          {#if type === 'text'}
            {@html sanitizeHtml(String(attrs.html ?? ''))}
          {:else if type === 'heading'}
            {#if attrs.level === 2}<h2>{attrs.text}</h2>
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
      {/if}
    </div>

    {#if item.tags.length > 0}
      <div class="content-tags">
        {#each item.tags as tag}
          <a href="/search?tag={tag.slug}" class="tag">{tag.name}</a>
        {/each}
      </div>
    {/if}

    <div class="content-actions">
      <LikeButton targetType={item.type} targetId={item.id} count={item.likeCount} liked={item.isLiked ?? false} />
      <BookmarkButton targetType={item.type} targetId={item.id} bookmarked={item.isBookmarked ?? false} />
    </div>

    <CommentSection targetType={item.type} targetId={item.id} />
  </article>
{/if}

<style>
  /* === PROJECT LAYOUT === */
  .project-layout {
    display: grid;
    grid-template-columns: 1fr 280px;
    gap: var(--space-6, 1.5rem);
    align-items: start;
  }

  .project-main {
    min-width: 0;
  }

  .project-sidebar {
    position: sticky;
    top: calc(var(--nav-height, 4rem) + var(--space-4, 1rem));
    display: flex;
    flex-direction: column;
    gap: var(--space-4, 1rem);
  }

  .sidebar-card {
    border: 1px solid var(--color-border, #272725);
    border-radius: var(--radius-lg, 0.5rem);
    padding: var(--space-4, 1rem);
    background: var(--color-surface-alt, #141413);
  }

  .sidebar-card-title {
    font-family: var(--font-mono, monospace);
    font-size: var(--text-xs, 0.6875rem);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--color-text-secondary, #888884);
    margin: 0 0 var(--space-3, 0.75rem);
  }

  .sidebar-actions {
    display: flex;
    gap: var(--space-2, 0.5rem);
  }

  .sidebar-meta {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: var(--space-1, 0.25rem) var(--space-3, 0.75rem);
    margin: 0;
    font-size: var(--text-sm, 0.75rem);
  }

  .sidebar-meta dt {
    color: var(--color-text-muted, #444440);
    font-family: var(--font-mono, monospace);
    font-size: var(--text-xs, 0.6875rem);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .sidebar-meta dd {
    margin: 0;
    color: var(--color-text, #d8d5cf);
  }

  /* === ARTICLE LAYOUT === */
  .article-layout {
    max-width: 100%;
  }

  .article-hero {
    margin: calc(-1 * var(--space-6, 1.5rem)) calc(-1 * var(--space-4, 1rem)) var(--space-8, 2rem);
    max-height: 400px;
    overflow: hidden;
  }

  .article-hero-image {
    width: 100%;
    height: 400px;
    object-fit: cover;
  }

  .article-content {
    max-width: 720px;
    margin: 0 auto;
  }

  /* === DEFAULT LAYOUT === */
  .default-layout {
    max-width: 768px;
    margin: 0 auto;
  }

  /* === SHARED STYLES === */
  .content-cover {
    width: 100%;
    border-radius: var(--radius-lg, 0.5rem);
    margin-bottom: var(--space-6, 1.5rem);
    aspect-ratio: 16 / 9;
    object-fit: cover;
  }

  .content-header {
    margin-bottom: var(--space-8, 2rem);
  }

  .header-meta {
    display: flex;
    align-items: center;
    gap: var(--space-2, 0.5rem);
    margin-bottom: var(--space-3, 0.75rem);
  }

  .difficulty {
    display: flex;
    align-items: center;
    gap: var(--space-1, 0.25rem);
  }

  .dot {
    width: 6px;
    height: 6px;
    border-radius: var(--radius-full, 50%);
    background: var(--color-border, #272725);
  }

  .dot-filled {
    background: var(--color-primary, #5b9cf6);
  }

  .difficulty-label {
    font-family: var(--font-mono, monospace);
    font-size: var(--text-xs, 0.6875rem);
    color: var(--color-text-muted, #444440);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-left: var(--space-1, 0.25rem);
  }

  .content-header h1 {
    font-size: var(--text-3xl, 1.75rem);
    line-height: var(--leading-tight, 1.1);
    color: var(--color-text, #d8d5cf);
    margin: 0 0 var(--space-2, 0.5rem);
    font-weight: var(--font-weight-bold, 700);
  }

  .content-subtitle {
    font-size: var(--text-lg, 1.125rem);
    color: var(--color-text-secondary, #888884);
    margin: 0 0 var(--space-4, 1rem);
  }

  .author-bar {
    display: flex;
    align-items: center;
    gap: var(--space-3, 0.75rem);
  }

  .author-info {
    display: flex;
    flex-direction: column;
  }

  .author-name {
    font-size: var(--text-sm, 0.75rem);
    font-weight: var(--font-weight-medium, 500);
    color: var(--color-text, #d8d5cf);
    text-decoration: none;
  }

  .author-name:hover {
    color: var(--color-primary, #5b9cf6);
  }

  .author-date {
    font-size: var(--text-xs, 0.6875rem);
    color: var(--color-text-muted, #444440);
  }

  /* Content body */
  .content-body {
    font-size: var(--text-base, 0.875rem);
    line-height: var(--leading-relaxed, 1.8);
    color: var(--color-text, #d8d5cf);
  }

  .content-body :global(h2) {
    margin-top: var(--space-10, 2.5rem);
    font-size: var(--text-xl, 1.25rem);
    color: var(--color-text, #d8d5cf);
  }

  .content-body :global(h3) {
    margin-top: var(--space-6, 1.5rem);
    font-size: var(--text-lg, 1.125rem);
    color: var(--color-text, #d8d5cf);
  }

  .content-body :global(pre) {
    background: var(--color-surface-alt, #141413);
    border: 1px solid var(--color-border, #272725);
    padding: var(--space-4, 1rem);
    border-radius: var(--radius-md, 0.25rem);
    overflow-x: auto;
    font-family: var(--font-mono, monospace);
    font-size: var(--text-sm, 0.75rem);
  }

  .content-body :global(img) {
    max-width: 100%;
    border-radius: var(--radius-md, 0.25rem);
  }

  .content-body :global(blockquote) {
    border-left: 2px solid var(--color-primary, #5b9cf6);
    padding-left: var(--space-4, 1rem);
    margin-left: 0;
    color: var(--color-text-secondary, #888884);
  }

  .content-body :global(a) {
    color: var(--color-primary, #5b9cf6);
  }

  /* Step blocks */
  .step-block {
    display: flex;
    gap: var(--space-4, 1rem);
    padding: var(--space-4, 1rem) 0;
    border-top: 1px solid var(--color-border, #272725);
  }

  .step-number {
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-full, 50%);
    background: var(--color-primary, #5b9cf6);
    color: var(--color-primary-text, #0c0c0b);
    font-weight: var(--font-weight-bold, 700);
    font-size: var(--text-sm, 0.75rem);
  }

  .step-content {
    flex: 1;
    min-width: 0;
  }

  .step-title {
    margin: 0 0 var(--space-2, 0.5rem);
    font-size: var(--text-md, 1rem);
  }

  /* Callouts */
  .callout {
    padding: var(--space-4, 1rem);
    border-radius: var(--radius-md, 0.25rem);
    margin: var(--space-4, 1rem) 0;
    border-left: 2px solid;
  }

  .callout-info { border-color: var(--color-info, #5b9cf6); background: rgba(91, 156, 246, 0.1); }
  .callout-warning { border-color: var(--color-warning, #fbbf24); background: rgba(251, 191, 36, 0.1); }
  .callout-success { border-color: var(--color-success, #4ade80); background: rgba(74, 222, 128, 0.1); }
  .callout-error { border-color: var(--color-error, #f87171); background: rgba(248, 113, 113, 0.1); }

  /* Tags */
  .content-tags {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2, 0.5rem);
    margin: var(--space-8, 2rem) 0 var(--space-6, 1.5rem);
  }

  .tag {
    font-size: var(--text-xs, 0.6875rem);
    padding: var(--space-1, 0.25rem) var(--space-3, 0.75rem);
    background: var(--color-surface-alt, #141413);
    border: 1px solid var(--color-border, #272725);
    border-radius: var(--radius-md, 0.25rem);
    color: var(--color-text-secondary, #888884);
    text-decoration: none;
    font-family: var(--font-mono, monospace);
  }

  .tag:hover {
    border-color: var(--color-border-strong, #333330);
    color: var(--color-text, #d8d5cf);
  }

  /* Actions */
  .content-actions {
    display: flex;
    gap: var(--space-4, 1rem);
    padding: var(--space-4, 1rem) 0;
    border-top: 1px solid var(--color-border, #272725);
    border-bottom: 1px solid var(--color-border, #272725);
    margin: var(--space-6, 1.5rem) 0;
  }

  @media (max-width: 768px) {
    .project-layout {
      grid-template-columns: 1fr;
    }

    .project-sidebar {
      position: static;
    }
  }
</style>
