<script lang="ts">
  import SeoHead from '$lib/components/SeoHead.svelte';
  import LikeButton from '$lib/components/LikeButton.svelte';
  import BookmarkButton from '$lib/components/BookmarkButton.svelte';
  import CommentSection from '$lib/components/CommentSection.svelte';
  import ContentBlockRenderer from '$lib/components/ContentBlockRenderer.svelte';
  import SidebarCard from '$lib/components/SidebarCard.svelte';
  import type { BlockTuple } from '@snaplify/editor';
  import { Avatar } from '@snaplify/ui';
  import { typeToUrlSegment } from '$lib/utils/content-helpers';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  const item = data.item;
  const canonicalPath = `/${typeToUrlSegment(item.type)}/${item.slug}`;
  const blocks = (Array.isArray(item.content) ? item.content : []) as BlockTuple[];

  const difficultyLevel: Record<string, number> = {
    beginner: 1,
    intermediate: 2,
    advanced: 3,
  };

  const dateStr = item.publishedAt
    ? new Date(item.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Draft';
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
  <!-- PROJECT LAYOUT: grid-sb-wide -->
  <div class="page">
    <div class="breadcrumb">
      projects / {item.tags[0]?.name ?? item.type} / <span class="bc-current">{item.slug}</span>
    </div>
    <div class="grid-sb-wide">
      <article>
        {#if item.coverImageUrl}
          <div class="thumb thumb-16x9" style="height: 320px; margin-bottom: 12px;">
            <img src={item.coverImageUrl} alt="" style="width:100%;height:100%;object-fit:cover;position:relative;z-index:1;" />
          </div>
        {/if}

        <div class="tag-row" style="margin-bottom: 10px;">
          {#each item.tags as t}
            <a href="/search?tag={t.slug}" class="tag">{t.name}</a>
          {/each}
          {#if item.difficulty}
            <span class="tag tag-green">{item.difficulty}</span>
            <span class="diff-dots">
              {#each Array(5) as _, i}
                <span class="diff-dot" class:on={i < (difficultyLevel[item.difficulty] ?? 1)}></span>
              {/each}
            </span>
          {/if}
        </div>

        <h1 class="view-title">{item.title}</h1>

        <div class="author-strip">
          <div class="author-left">
            <Avatar
              src={item.author.avatarUrl ?? undefined}
              alt={item.author.displayName ?? item.author.username ?? ''}
              name={item.author.displayName ?? item.author.username ?? '?'}
              size="sm"
            />
            <strong class="author-name-text">{item.author.displayName ?? item.author.username}</strong>
          </div>
          <span class="meta-text">{dateStr}</span>
          {#if item.buildTime}
            <span class="meta-text">{item.buildTime}</span>
          {/if}
          <span class="fed-badge"><span class="fed-dot"></span> snaplify:Project &middot; federated</span>
        </div>

        {#if item.description}
          <p class="view-description">{item.description}</p>
        {/if}

        <ContentBlockRenderer {blocks} />

        <div class="actions-row">
          <LikeButton targetType={item.type} targetId={item.id} count={item.likeCount} liked={item.isLiked ?? false} />
          <BookmarkButton targetType={item.type} targetId={item.id} bookmarked={item.isBookmarked ?? false} />
        </div>

        <CommentSection targetType={item.type} targetId={item.id} />
      </article>

      <aside class="sidebar">
        {#if item.parts && item.parts.length > 0}
          <SidebarCard title="bill of materials">
            {#each item.parts as part}
              <div class="bom-row">
                <div class="bom-qty">{part.quantity ?? '1'}</div>
                <div class="bom-name">{part.name}</div>
              </div>
            {/each}
          </SidebarCard>
        {/if}

        <SidebarCard title="actions">
          <div style="display:flex;flex-direction:column;gap:8px;">
            <LikeButton targetType={item.type} targetId={item.id} count={item.likeCount} liked={item.isLiked ?? false} />
            <BookmarkButton targetType={item.type} targetId={item.id} bookmarked={item.isBookmarked ?? false} />
          </div>
        </SidebarCard>

        <SidebarCard title="metadata">
          <div class="meta-list">
            {#if item.difficulty}
              <div class="meta-row"><span class="meta-key">difficulty</span><span class="meta-val">{item.difficulty}</span></div>
            {/if}
            {#if item.buildTime}
              <div class="meta-row"><span class="meta-key">time</span><span class="meta-val">{item.buildTime}</span></div>
            {/if}
            {#if item.estimatedCost}
              <div class="meta-row"><span class="meta-key">cost</span><span class="meta-val">{item.estimatedCost}</span></div>
            {/if}
            <div class="meta-row"><span class="meta-key">views</span><span class="meta-val">{item.viewCount}</span></div>
            <div class="meta-row"><span class="meta-key">likes</span><span class="meta-val">{item.likeCount}</span></div>
            {#if item.forkCount > 0}
              <div class="meta-row"><span class="meta-key">forks</span><span class="meta-val">{item.forkCount}</span></div>
            {/if}
          </div>
        </SidebarCard>
      </aside>
    </div>
  </div>

{:else if item.type === 'article'}
  <!-- ARTICLE LAYOUT: full-bleed hero + narrow prose -->
  {#if item.coverImageUrl}
    <div class="article-hero-wrap">
      <div class="thumb thumb-21x9" style="max-height: 300px; border: none;">
        <img src={item.coverImageUrl} alt="" style="width:100%;height:100%;object-fit:cover;position:relative;z-index:1;" />
      </div>
    </div>
  {/if}
  <div class="page-narrow">
    <div class="tag-row" style="margin-bottom: 12px;">
      {#each item.tags as t}
        <a href="/search?tag={t.slug}" class="tag">{t.name}</a>
      {/each}
    </div>
    <h1 class="view-title" style="font-size: 26px;">{item.title}</h1>
    <div class="author-strip">
      <div class="author-left">
        <Avatar
          src={item.author.avatarUrl ?? undefined}
          alt={item.author.displayName ?? item.author.username ?? ''}
          name={item.author.displayName ?? item.author.username ?? '?'}
          size="sm"
        />
        <div>
          <div class="author-name-text">{item.author.displayName ?? item.author.username}</div>
          <div class="meta-text">{dateStr}</div>
        </div>
      </div>
      <div class="author-actions">
        <button class="btn btn-sm">share</button>
        <BookmarkButton targetType={item.type} targetId={item.id} bookmarked={item.isBookmarked ?? false} />
      </div>
    </div>
    <div class="prose">
      <ContentBlockRenderer {blocks} />
    </div>
    <div class="actions-row">
      <LikeButton targetType={item.type} targetId={item.id} count={item.likeCount} liked={item.isLiked ?? false} />
      <BookmarkButton targetType={item.type} targetId={item.id} bookmarked={item.isBookmarked ?? false} />
    </div>
    <CommentSection targetType={item.type} targetId={item.id} />
  </div>

{:else if item.type === 'guide'}
  <!-- GUIDE LAYOUT: grid-toc -->
  <div class="page">
    <div class="grid-toc">
      <aside class="toc-sidebar">
        <div class="faint-label">table of contents</div>
        {#if item.sections && item.sections.length > 0}
          {#each item.sections as section, i}
            <a href="#{section.slug ?? `section-${i}`}" class="toc-item" class:active={i === 0}>
              {i + 1}. {section.title}
            </a>
          {/each}
        {/if}
        <div class="toc-progress">
          <div class="faint-label">reading progress</div>
          <div class="progress-track" style="margin-top: 6px;"><div class="progress-fill" style="width: 0%;"></div></div>
        </div>
      </aside>
      <article>
        <div class="tag-row" style="margin-bottom: 12px;">
          {#each item.tags as t}
            <a href="/search?tag={t.slug}" class="tag">{t.name}</a>
          {/each}
          {#if item.difficulty}
            <span class="tag tag-green">{item.difficulty}</span>
          {/if}
          <span class="fed-badge"><span class="fed-dot"></span> snaplify:Guide &middot; federated</span>
        </div>
        <h1 class="view-title" style="font-size: 24px;">{item.title}</h1>
        <div class="author-strip" style="margin-bottom: 24px;">
          <div class="author-left">
            <Avatar
              src={item.author.avatarUrl ?? undefined}
              alt={item.author.displayName ?? item.author.username ?? ''}
              name={item.author.displayName ?? item.author.username ?? '?'}
              size="sm"
            />
            <strong class="author-name-text">{item.author.displayName ?? item.author.username}</strong>
          </div>
          <span class="meta-text">{dateStr}</span>
        </div>
        <div class="prose">
          <ContentBlockRenderer {blocks} />
        </div>
        <div class="actions-row">
          <LikeButton targetType={item.type} targetId={item.id} count={item.likeCount} liked={item.isLiked ?? false} />
          <BookmarkButton targetType={item.type} targetId={item.id} bookmarked={item.isBookmarked ?? false} />
        </div>
        <CommentSection targetType={item.type} targetId={item.id} />
      </article>
    </div>
  </div>

{:else if item.type === 'video'}
  <!-- VIDEO LAYOUT: grid-sb with video player + sidebar -->
  <div class="page">
    <div class="grid-sb">
      <div>
        <div class="video-player">
          {#if item.coverImageUrl}
            <img src={item.coverImageUrl} alt="" style="width:100%;height:100%;object-fit:cover;" />
          {/if}
          <div class="play-btn" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><polygon points="10,6 24,14 10,22" fill="currentColor"/></svg>
          </div>
        </div>

        <h1 class="view-title" style="font-size: 20px; margin-top: 16px;">{item.title}</h1>

        <div class="author-strip">
          <div class="author-left">
            <Avatar
              src={item.author.avatarUrl ?? undefined}
              alt={item.author.displayName ?? item.author.username ?? ''}
              name={item.author.displayName ?? item.author.username ?? '?'}
              size="sm"
            />
            <strong class="author-name-text">{item.author.displayName ?? item.author.username}</strong>
          </div>
          <span class="meta-text">{dateStr}</span>
          <span class="meta-text">{item.viewCount} views</span>
        </div>

        {#if item.description}
          <p class="view-description">{item.description}</p>
        {/if}

        <div class="prose">
          <ContentBlockRenderer {blocks} />
        </div>

        <div class="actions-row">
          <LikeButton targetType={item.type} targetId={item.id} count={item.likeCount} liked={item.isLiked ?? false} />
          <BookmarkButton targetType={item.type} targetId={item.id} bookmarked={item.isBookmarked ?? false} />
        </div>
        <CommentSection targetType={item.type} targetId={item.id} />
      </div>

      <aside class="sidebar">
        <SidebarCard title="details">
          <div class="meta-list">
            <div class="meta-row"><span class="meta-key">type</span><span class="meta-val">video</span></div>
            <div class="meta-row"><span class="meta-key">views</span><span class="meta-val">{item.viewCount}</span></div>
            <div class="meta-row"><span class="meta-key">likes</span><span class="meta-val">{item.likeCount}</span></div>
            <div class="meta-row"><span class="meta-key">published</span><span class="meta-val">{dateStr}</span></div>
          </div>
        </SidebarCard>
        {#if item.tags.length > 0}
          <SidebarCard title="tags">
            <div class="tag-row" style="flex-wrap:wrap;">
              {#each item.tags as t}
                <a href="/search?tag={t.slug}" class="tag">{t.name}</a>
              {/each}
            </div>
          </SidebarCard>
        {/if}
      </aside>
    </div>
  </div>

{:else}
  <!-- DEFAULT LAYOUT (blog, fallback): narrow prose -->
  <div class="page-narrow">
    <div class="tag-row" style="margin-bottom: 10px;">
      {#each item.tags as t}
        <a href="/search?tag={t.slug}" class="tag">{t.name}</a>
      {/each}
    </div>
    <h1 class="view-title" style="font-size: 20px;">{item.title}</h1>
    <div class="author-strip">
      <div class="author-left">
        <Avatar
          src={item.author.avatarUrl ?? undefined}
          alt={item.author.displayName ?? item.author.username ?? ''}
          name={item.author.displayName ?? item.author.username ?? '?'}
          size="sm"
        />
        <span class="author-name-text">{item.author.displayName ?? item.author.username}</span>
      </div>
      <span class="meta-text">{dateStr}</span>
      <span class="fed-badge"><span class="fed-dot"></span> AS2 Article &middot; federated</span>
    </div>
    <div class="prose">
      <ContentBlockRenderer {blocks} />
    </div>
    <div class="actions-row">
      <LikeButton targetType={item.type} targetId={item.id} count={item.likeCount} liked={item.isLiked ?? false} />
      <BookmarkButton targetType={item.type} targetId={item.id} bookmarked={item.isBookmarked ?? false} />
    </div>
    <CommentSection targetType={item.type} targetId={item.id} />
  </div>
{/if}

<style>
  .breadcrumb {
    font-size: 11px;
    font-family: var(--font-mono, monospace);
    color: var(--color-text-muted, #444440);
    margin-bottom: 20px;
  }

  .bc-current { color: var(--color-text-secondary, #888884); }

  .view-title {
    font-size: 22px;
    font-weight: var(--font-weight-bold, 700);
    line-height: 1.2;
    margin: 0 0 12px;
    color: var(--color-text);
  }

  .view-description {
    font-size: 14px;
    color: var(--color-text-secondary, #888884);
    line-height: 1.75;
    margin-bottom: 24px;
  }

  .author-strip {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 12px 0;
    border-top: 1px solid var(--color-border, #272725);
    border-bottom: 1px solid var(--color-border, #272725);
    margin-bottom: 20px;
    flex-wrap: wrap;
  }

  .author-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .author-name-text {
    font-size: 12px;
    font-weight: var(--font-weight-semibold, 600);
  }

  .meta-text {
    font-size: 11px;
    font-family: var(--font-mono, monospace);
    color: var(--color-text-secondary, #888884);
  }

  .author-actions {
    margin-left: auto;
    display: flex;
    gap: 8px;
  }

  .actions-row {
    display: flex;
    gap: var(--space-4, 1rem);
    padding: var(--space-4, 1rem) 0;
    border-top: 1px solid var(--color-border, #272725);
    border-bottom: 1px solid var(--color-border, #272725);
    margin: 28px 0 20px;
  }

  .sidebar {
    position: sticky;
    top: 64px;
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .meta-list {
    display: flex;
    flex-direction: column;
  }

  .meta-row {
    display: flex;
    font-size: 11px;
    padding: 5px 0;
    border-bottom: 1px solid var(--color-border, #272725);
  }

  .meta-row:last-child { border-bottom: none; }

  .meta-key {
    font-family: var(--font-mono, monospace);
    color: var(--color-text-muted, #444440);
    min-width: 80px;
  }

  .meta-val {
    color: var(--color-text-secondary, #888884);
  }

  .article-hero-wrap {
    background: var(--color-surface-raised, #1c1c1a);
    border-bottom: 1px solid var(--color-border, #272725);
    margin-bottom: 0;
  }

  .toc-sidebar {
    position: sticky;
    top: 64px;
  }

  .toc-progress {
    margin-top: 16px;
    padding-top: 10px;
    border-top: 1px solid var(--color-border, #272725);
  }
</style>
